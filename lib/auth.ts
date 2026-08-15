import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db";
import { sessions, users } from "../db/schema";

const COOKIE="techomie_session";
const enc=new TextEncoder();
const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,"0")).join("");
export const randomToken=()=>{const b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b,x=>x.toString(16).padStart(2,"0")).join("")};
export async function hashPassword(password:string,salt:string){const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:210000,hash:"SHA-256"},key,256))}
export async function hashToken(token:string){return hex(await crypto.subtle.digest("SHA-256",enc.encode(token)))}
export async function currentUser(){const token=(await cookies()).get(COOKIE)?.value;if(!token)return null;const db=getDb();const rows=await db.select({id:users.id,email:users.email,name:users.name,role:users.role,active:users.active}).from(sessions).innerJoin(users,eq(sessions.userId,users.id)).where(and(eq(sessions.tokenHash,await hashToken(token)),gt(sessions.expiresAt,new Date().toISOString()),eq(users.active,true))).limit(1);return rows[0]??null}
export async function requireUser(roles?:string[]){const user=await currentUser();if(!user)throw new Response("Unauthorized",{status:401});if(roles&&!roles.includes(user.role))throw new Response("Forbidden",{status:403});return user}
export async function setSession(userId:string){const token=randomToken(),now=new Date(),expires=new Date(now.getTime()+1000*60*60*24*7);await getDb().insert(sessions).values({id:crypto.randomUUID(),userId,tokenHash:await hashToken(token),expiresAt:expires.toISOString(),createdAt:now.toISOString()});(await cookies()).set(COOKIE,token,{httpOnly:true,sameSite:"lax",secure:false,path:"/",expires})}
export async function clearSession(){const jar=await cookies();const token=jar.get(COOKIE)?.value;if(token)await getDb().delete(sessions).where(eq(sessions.tokenHash,await hashToken(token)));jar.delete(COOKIE)}

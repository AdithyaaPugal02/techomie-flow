import { count } from "drizzle-orm";import { getDb } from "../../../../db";import { users,auditLog } from "../../../../db/schema";import { hashPassword,randomToken,setSession } from "../../../../lib/auth";
export async function POST(req:Request){
  try {
    const db=getDb();const [{value}]=await db.select({value:count()}).from(users);if(value)return Response.json({error:"Owner is already configured"},{status:409});const p=await req.json() as {name?:string,email?:string,password?:string};if(!p.name?.trim()||!p.email?.includes("@")||(p.password?.length??0)<10)return Response.json({error:"Name, valid email and a password of at least 10 characters are required"},{status:400});const id=crypto.randomUUID(),salt=randomToken(),now=new Date().toISOString();await db.insert(users).values({id,name:p.name.trim(),email:p.email.toLowerCase().trim(),role:"admin",passwordSalt:salt,passwordHash:await hashPassword(p.password!,salt),active:true,createdAt:now});await db.insert(auditLog).values({userId:id,action:"owner_created",entityType:"user",entityId:id,createdAt:now});await setSession(id);return Response.json({ok:true});
  } catch (error: any) {
    return Response.json({error: error?.message || "Failed to setup owner account"}, {status: 500});
  }
}

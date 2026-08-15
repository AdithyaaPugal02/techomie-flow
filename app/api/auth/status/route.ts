import { count } from "drizzle-orm";import { getDb } from "../../../../db";import { users } from "../../../../db/schema";import { currentUser } from "../../../../lib/auth";
export async function GET(){const [{value}]=await getDb().select({value:count()}).from(users);return Response.json({setupRequired:value===0,user:await currentUser()})}

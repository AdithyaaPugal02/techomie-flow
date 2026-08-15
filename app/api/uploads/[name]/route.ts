import { env } from "cloudflare:workers";
import { requireUser } from "../../../../lib/auth";

const fileName=(req:Request)=>decodeURIComponent(new URL(req.url).pathname.split("/").pop()||"");

export async function GET(req:Request){
 const name=fileName(req);
 if(!/^[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(name))return new Response("Not found",{status:404});
 const object=await env.FILES.get(name);
 if(!object)return new Response("Not found",{status:404});
 const headers=new Headers();object.writeHttpMetadata(headers);headers.set("etag",object.httpEtag);headers.set("cache-control","public, max-age=31536000, immutable");
 return new Response(object.body,{headers});
}

export async function DELETE(req:Request){try{await requireUser(["admin"]);const name=fileName(req);if(!/^[a-f0-9-]+\.(jpg|png|webp|gif)$/i.test(name))return new Response("Not found",{status:404});await env.FILES.delete(name);return Response.json({ok:true})}catch(e){return e instanceof Response?e:Response.json({error:"Unable to remove image"},{status:500})}}

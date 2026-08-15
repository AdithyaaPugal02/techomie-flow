import { env } from "cloudflare:workers";
import { requireUser } from "../../../lib/auth";

const allowed:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/gif":"gif"};
export async function POST(req:Request){
 try{
  await requireUser();
  const form=await req.formData(),file=form.get("image");
  if(!(file instanceof File))return Response.json({error:"Choose an image file"},{status:400});
  if(!allowed[file.type])return Response.json({error:"Use JPG, PNG, WebP or GIF"},{status:400});
  if(file.size>5*1024*1024)return Response.json({error:"Image must be smaller than 5 MB"},{status:400});
  const name=`${crypto.randomUUID()}.${allowed[file.type]}`;
  await env.FILES.put(name,file.stream(),{httpMetadata:{contentType:file.type}});
  return Response.json({url:`/api/uploads/${name}`},{status:201});
 }catch(e){return e instanceof Response?e:Response.json({error:"Unable to upload image"},{status:500})}
}

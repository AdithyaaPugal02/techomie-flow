import fs from "node:fs/promises";
const records=JSON.parse(await fs.readFile("tmp/import/full-catalog.json","utf8"));
const chunkSize=400;
const chunks=[];
for(let index=0;index<records.length;index+=chunkSize){
  const part=records.slice(index,index+chunkSize),partNumber=chunks.length+1;
  await fs.writeFile(`app/catalog-data-${partNumber}.ts`,`// @ts-nocheck -- generated catalog chunk\nexport default ${JSON.stringify(part)};\n`);
  chunks.push(partNumber);
}
const imports=chunks.map(number=>`import records${number} from './catalog-data-${number}';`).join("\n");
const arrays=chunks.map(number=>`...records${number}`).join(",");
const type=`${imports}\n\nexport type CatalogProduct={id:string,sku:string,supplierSku:string,name:string,series:string,category:string,subcategory:string,module:string,technology:string,material:string,finish:string,sellingPrice:number,purchaseCost:number,warranty:string,source:string,sourceSheet?:string,sourcePage?:number,image:string,description:string,hsn:string,gst:number};\n\nexport const catalog = [${arrays}] as CatalogProduct[];\n`;
await fs.writeFile("app/catalog-data.ts",type);
console.log(`Imported ${records.length} variants`);

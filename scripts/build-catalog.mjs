import fs from "node:fs/promises";
const records=JSON.parse(await fs.readFile("tmp/import/full-catalog.json","utf8"));
const type="export type CatalogProduct={id:string,sku:string,supplierSku:string,name:string,series:string,category:string,module:string,technology:string,finish:string,sellingPrice:number,purchaseCost:number,warranty:string,source:string,image:string,description:string,hsn:string,gst:number};\n";
await fs.writeFile("app/catalog-data.ts",`${type}export const catalog: CatalogProduct[] = ${JSON.stringify(records,null,2)};\n`);
console.log(`Imported ${records.length} variants`);

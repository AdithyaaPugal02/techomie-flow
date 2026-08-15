import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";
const path = "C:/Users/Admin/Downloads/Master Price List 2026 - 50% Discount.xlsx";
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
console.log((await wb.inspect({kind:"sheet",include:"id,name",maxChars:12000})).ndjson);
console.log((await wb.inspect({kind:"workbook,sheet,table",maxChars:20000,tableMaxRows:10,tableMaxCols:12,tableMaxCellChars:100})).ndjson);
const data={};
for(let i=0;i<30;i++){
  const s=wb.worksheets.getItemAt(i); data[s.name]=s.getUsedRange().values;
}
await fs.mkdir("tmp/import",{recursive:true});
await fs.writeFile("tmp/import/master-price-list.json",JSON.stringify(data,null,2));

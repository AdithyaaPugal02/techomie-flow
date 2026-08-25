import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const records = JSON.parse(await fs.readFile("tmp/import/full-catalog.json", "utf8"))
  .filter((item) => item.id.startsWith("VN-") || item.id.startsWith("PH-"));
const outputDir = "outputs/techomie-supplier-items-2026";
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Summary");
const items = workbook.worksheets.add("Items Master");
const taxonomy = workbook.worksheets.add("Taxonomy");

const headers = [
  "Supplier", "Supplier SKU", "Internal SKU", "Product Name", "Category", "Subcategory",
  "Series / Model", "Module", "Technology", "Material / Finish", "Unit", "GST %",
  "Purchase Cost", "Selling Price", "Warranty", "Source", "Source Location", "Description",
  "Image Path", "Active",
];
const rows = records.map((item) => [
  item.id.startsWith("PH-") ? "Phlipton" : "Noviq / Varni Digital",
  item.supplierSku || "", item.sku, item.name, item.category, item.subcategory, item.series,
  item.module, item.technology, item.material, "Nos", (item.gst || 0) / 100,
  item.purchaseCost, item.sellingPrice, item.warranty, item.source,
  item.sourceSheet ? `Sheet: ${item.sourceSheet}` : item.sourcePage ? `Page: ${item.sourcePage}` : "",
  item.description, item.image, true,
]);
items.getRangeByIndexes(0, 0, rows.length + 1, headers.length).values = [headers, ...rows];
items.showGridLines = false;
items.freezePanes.freezeRows(1);
items.freezePanes.freezeColumns(4);
items.getRange("A1:T1").format = {
  fill: "#0B4A6F", font: { bold: true, color: "#FFFFFF" },
  verticalAlignment: "center", wrapText: true,
};
items.getRange("A1:T1").format.rowHeight = 32;
items.getRange(`L2:L${rows.length + 1}`).format.numberFormat = "0%";
items.getRange(`M2:N${rows.length + 1}`).format.numberFormat = '₹#,##0.00';
items.getRange(`A2:T${rows.length + 1}`).format.borders = {
  insideHorizontal: { style: "thin", color: "#E6ECF1" },
};
const itemWidths = [18, 24, 38, 48, 22, 26, 20, 14, 23, 25, 8, 9, 16, 16, 18, 32, 20, 58, 42, 10];
itemWidths.forEach((width, index) => items.getRangeByIndexes(0, index, rows.length + 1, 1).format.columnWidth = width);
items.getRange(`D2:D${rows.length + 1}`).format.wrapText = true;
items.getRange(`R2:R${rows.length + 1}`).format.wrapText = true;
items.tables.add(`A1:T${rows.length + 1}`, true, "SupplierItemsTable").style = "TableStyleMedium2";

const combinations = [...new Map(records.map((item) => [
  [item.category, item.subcategory, item.technology, item.material].join("\u0001"),
  [item.category, item.subcategory, item.technology, item.material, item.id.startsWith("PH-") ? "Phlipton" : "Noviq / Varni Digital"],
])).values()].sort((a, b) => a.join("|").localeCompare(b.join("|")));
taxonomy.getRange("A1:F1").values = [["Category", "Subcategory", "Technology", "Material / Finish", "Supplier", "Variant Count"]];
taxonomy.getRangeByIndexes(1, 0, combinations.length, 5).values = combinations;
taxonomy.getRange("F2").formulas = [[`=COUNTIFS('Items Master'!$E$2:$E$${rows.length + 1},A2,'Items Master'!$F$2:$F$${rows.length + 1},B2,'Items Master'!$I$2:$I$${rows.length + 1},C2,'Items Master'!$J$2:$J$${rows.length + 1},D2,'Items Master'!$A$2:$A$${rows.length + 1},E2)`]];
taxonomy.getRange(`F2:F${combinations.length + 1}`).fillDown();
taxonomy.showGridLines = false;
taxonomy.freezePanes.freezeRows(1);
taxonomy.getRange("A1:F1").format = { fill: "#0B4A6F", font: { bold: true, color: "#FFFFFF" } };
taxonomy.getRange(`A1:F${combinations.length + 1}`).format.borders = { insideHorizontal: { style: "thin", color: "#E6ECF1" } };
[24, 28, 24, 28, 22, 14].forEach((width, index) => taxonomy.getRangeByIndexes(0, index, combinations.length + 1, 1).format.columnWidth = width);
taxonomy.tables.add(`A1:F${combinations.length + 1}`, true, "TaxonomyTable").style = "TableStyleMedium2";

const categoryNames = [...new Set(records.map((item) => item.category))].sort();
const technologyNames = [...new Set(records.map((item) => item.technology))].sort();
const materialNames = [...new Set(records.map((item) => item.material))].sort();
summary.showGridLines = false;
summary.getRange("A1:H2").merge();
summary.getRange("A1").values = [["Techomie Supplier Items - Categorized Master"]];
summary.getRange("A1:H2").format = { fill: "#073B57", font: { bold: true, color: "#FFFFFF", size: 20 }, verticalAlignment: "center" };
summary.getRange("A4:B8").values = [
  ["Catalog overview", "Value"],
  ["Total variants", null],
  ["Noviq / Varni variants", null],
  ["Phlipton variants", null],
  ["Unique categories", categoryNames.length],
];
summary.getRange("B5").formulas = [[`=COUNTA('Items Master'!$C$2:$C$${rows.length + 1})`]];
summary.getRange("B6").formulas = [[`=COUNTIF('Items Master'!$A$2:$A$${rows.length + 1},"Noviq / Varni Digital")`]];
summary.getRange("B7").formulas = [[`=COUNTIF('Items Master'!$A$2:$A$${rows.length + 1},"Phlipton")`]];
summary.getRange("A4:B4").format = { fill: "#DDF2FA", font: { bold: true, color: "#073B57" } };
summary.getRange("A4:B8").format.borders = { preset: "outside", style: "thin", color: "#AFC7D4" };

function addBreakdown(startCol, title, labels, sourceColumn) {
  const col = String.fromCharCode(65 + startCol);
  const valueCol = String.fromCharCode(66 + startCol);
  summary.getRange(`${col}4:${valueCol}4`).values = [[title, "Variants"]];
  summary.getRange(`${col}4:${valueCol}4`).format = { fill: "#DDF2FA", font: { bold: true, color: "#073B57" } };
  summary.getRangeByIndexes(4, startCol, labels.length, 1).values = labels.map((label) => [label]);
  summary.getRange(`${valueCol}5`).formulas = [[`=COUNTIF('Items Master'!$${sourceColumn}$2:$${sourceColumn}$${rows.length + 1},${col}5)`]];
  summary.getRange(`${valueCol}5:${valueCol}${labels.length + 4}`).fillDown();
  summary.getRange(`${col}4:${valueCol}${labels.length + 4}`).format.borders = { insideHorizontal: { style: "thin", color: "#E6ECF1" } };
}
addBreakdown(3, "Category", categoryNames, "E");
addBreakdown(6, "Technology", technologyNames, "I");
const materialStart = Math.max(categoryNames.length, technologyNames.length) + 7;
summary.getRange(`A${materialStart}:B${materialStart}`).values = [["Material / Finish", "Variants"]];
summary.getRange(`A${materialStart}:B${materialStart}`).format = { fill: "#DDF2FA", font: { bold: true, color: "#073B57" } };
summary.getRangeByIndexes(materialStart, 0, materialNames.length, 1).values = materialNames.map((label) => [label]);
summary.getRange(`B${materialStart + 1}`).formulas = [[`=COUNTIF('Items Master'!$J$2:$J$${rows.length + 1},A${materialStart + 1})`]];
summary.getRange(`B${materialStart + 1}:B${materialStart + materialNames.length}`).fillDown();
summary.getRange(`A${materialStart}:B${materialStart + materialNames.length}`).format.borders = { insideHorizontal: { style: "thin", color: "#E6ECF1" } };
summary.getRange("A:H").format.columnWidth = 24;
summary.getRange("A:A").format.columnWidth = 30;
summary.getRange("D:D").format.columnWidth = 29;
summary.getRange("G:G").format.columnWidth = 29;

const keyInspect = await workbook.inspect({ kind: "table", range: "Summary!A1:H30", include: "values,formulas", tableMaxRows: 30, tableMaxCols: 8, maxChars: 12000 });
console.log(keyInspect.ndjson);
const errors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(errors.ndjson);

for (const [sheetName, range, filename] of [
  ["Summary", `A1:H${Math.min(materialStart + materialNames.length, 55)}`, "summary.png"],
  ["Items Master", "A1:T32", "items-master.png"],
  ["Taxonomy", `A1:F${Math.min(combinations.length + 1, 55)}`, "taxonomy.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/${filename}`, new Uint8Array(await preview.arrayBuffer()));
}

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/Techomie-Supplier-Items-Categorized-2026.xlsx`);
console.log(JSON.stringify({ records: rows.length, categories: categoryNames.length, technologies: technologyNames.length, materials: materialNames.length }));

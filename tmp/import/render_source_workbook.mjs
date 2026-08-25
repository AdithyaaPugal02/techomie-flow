import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workbook = await SpreadsheetFile.importXlsx(
  await FileBlob.load("C:/Users/Admin/Downloads/Master Price List 2026 - 50% Discount.xlsx"),
);
await fs.mkdir("tmp/import/source-previews", { recursive: true });
for (const [sheetName, range] of [["WIFI-RE", "A1:J28"], ["ZIGBEE-TP", "A1:J28"], ["DND", "A1:J24"]]) {
  const preview = await workbook.render({ sheetName, range, scale: 0.6, format: "png" });
  await fs.writeFile(
    `tmp/import/source-previews/${sheetName.replaceAll("/", "-")}.png`,
    new Uint8Array(await preview.arrayBuffer()),
  );
}

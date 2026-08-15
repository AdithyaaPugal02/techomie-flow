type IdentifierInput = {
  category?: string | null;
  brand?: string | null;
  series?: string | null;
  name?: string | null;
  attributes?: Record<string, unknown> | null;
};

const clean = (value: unknown) =>
  String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
const token = (value: unknown, length = 3, fallback = "GEN") => {
  const words = clean(value).split(/\s+/).filter(Boolean);
  if (!words.length) return fallback;
  if (words.length > 1)
    return words.map((word) => word[0]).join("").slice(0, length);
  return words[0].slice(0, length);
};
const categoryCode = (value: unknown) => {
  const x = clean(value);
  if (x.includes("SWITCH")) return "SW";
  if (x.includes("LOCK")) return "LK";
  if (x.includes("CURTAIN")) return "CT";
  if (x.includes("GATE")) return "GT";
  if (x.includes("DOOR")) return "DR";
  if (x.includes("CAMERA") || x.includes("CCTV")) return "CC";
  if (x.includes("SENSOR")) return "SN";
  if (x.includes("LIGHT")) return "LT";
  if (x.includes("INSTALL")) return "IN";
  if (x.includes("SERVICE")) return "SV";
  return token(x, 2, "IT");
};
const technologyCode = (value: unknown) => {
  const x = clean(value);
  if (x.includes("ZIG")) return "ZB";
  if (x.includes("WI FI") || x === "WIFI") return "WF";
  if (x.includes("MATTER")) return "MT";
  if (x.includes("TOUCH")) return "TO";
  return token(x, 2, "NA");
};
const materialCode = (value: unknown) => {
  const x = clean(value);
  if (x.includes("GLASS")) return "GL";
  if (x.includes("ACRYLIC")) return "AC";
  if (x.includes("ALUMIN")) return "AL";
  if (x === "PC" || x.includes("POLYCARB")) return "PC";
  return token(x, 2, "NA");
};
const moduleCode = (value: unknown, name: unknown) => {
  const direct = clean(value).match(/^(2|4|6|8|12)(?:M)?$/);
  if (direct) return `${direct[1]}M`;
  const match = `${clean(value)} ${clean(name)}`.match(/(?:^|\s)(2|4|6|8|12)\s*M(?:\s|$)/);
  return match ? `${match[1]}M` : "NA";
};
const brandCode = (value: unknown) => {
  const x = clean(value);
  if (x.includes("NOVIQ")) return "NVQ";
  if (x.includes("AUTOZON")) return "ATZ";
  return token(x, 3, "GEN");
};

export const customerCode = (id: number) => `TCM-CUS-${String(id).padStart(6, "0")}`;

export const variantSku = (input: IdentifierInput, id: number) => {
  const a = input.attributes || {};
  return [
    "TCM",
    categoryCode(input.category),
    brandCode(input.brand),
    token(input.series || input.name, 3, "GEN"),
    moduleCode(a.module, input.name),
    technologyCode(a.technology),
    materialCode(a.material || a.finish),
    String(id).padStart(4, "0"),
  ].join("-");
};

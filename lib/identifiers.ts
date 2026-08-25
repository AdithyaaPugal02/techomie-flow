type IdentifierInput = {
  category?: string | null;
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
export const customerCode = (id: number) => `TCM-CUS-${String(id).padStart(6, "0")}`;

export const variantSku = (input: IdentifierInput, id: number) =>
  `TCM-${categoryCode(input.category)}-${String(id).padStart(4, "0")}`;

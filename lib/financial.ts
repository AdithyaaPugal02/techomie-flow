/**
 * Financial Calculation Engine for Techomie Flow
 * Precision financial calculations adhering to Indian GST statutory standards,
 * supporting line-level & document-level discounts, intrastate (CGST+SGST) vs interstate (IGST),
 * tax-inclusive & exclusive pricing, and strict round-off policies.
 */

export type DiscountType = "percent" | "fixed";
export type PricingMode = "exclusive" | "inclusive";
export type TaxMode = "GST" | "Non-GST";

export interface LineItemInput {
  id?: string | number;
  description: string;
  name?: string;
  sku?: string;
  variant?: string;
  room?: string;
  hsnSac?: string;
  uqc?: string;
  quantity: number;
  rate: number;
  discountRate?: number;
  discountType?: DiscountType;
  gstRate?: number;
  taxMode?: TaxMode;
  notes?: string;
}

export interface CalculatedLineItem {
  id: string | number;
  description: string;
  name: string;
  sku: string;
  variant: string;
  room: string;
  hsnSac: string;
  uqc: string;
  quantity: number;
  rate: number;
  grossAmount: number;
  discountRate: number;
  discountType: DiscountType;
  discountAmount: number;
  taxableValue: number;
  gstRate: number;
  taxMode: TaxMode;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  total: number;
}

export interface CalculationOptions {
  isInterstate?: boolean;
  pricingMode?: PricingMode;
  documentDiscountAmount?: number;
  documentDiscountRate?: number;
  amountPaid?: number;
}

export interface FinancialSummary {
  items: CalculatedLineItem[];
  subtotal: number;
  lineDiscountTotal: number;
  documentDiscountTotal: number;
  totalDiscount: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  totalTax: number;
  rawTotal: number;
  roundOff: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  amountWords: string;
  isInterstate: boolean;
  pricingMode: PricingMode;
}

/** Round to 2 decimal places using standard half-up arithmetic */
export function round2(num: number): number {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

/** Indian Currency Formatter with ₹ symbol and standard Indian lakh/crore commas */
export function formatINR(amount: number | null | undefined): string {
  const val = Number(amount || 0);
  const isNegative = val < 0;
  const absVal = Math.abs(val);
  const parts = absVal.toFixed(2).split(".");
  let intPart = parts[0];
  const decPart = parts[1];

  // Indian numbering grouping: last 3 digits, then groups of 2 digits
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== "") {
    lastThree = "," + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
  return `${isNegative ? "-" : ""}₹${formattedInt}.${decPart}`;
}

/** Converts integer or rounded number to Indian English currency words */
export function numberToWordsINR(amount: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"
  ];

  function convertBelowHundred(num: number): string {
    if (num < 20) return ones[num];
    const unit = num % 10;
    return `${tens[Math.floor(num / 10)]}${unit ? " " + ones[unit] : ""}`.trim();
  }

  function convertBelowThousand(num: number): string {
    if (num < 100) return convertBelowHundred(num);
    const remainder = num % 100;
    return `${ones[Math.floor(num / 100)]} Hundred${remainder ? " " + convertBelowHundred(remainder) : ""}`.trim();
  }

  let n = Math.round(Math.abs(amount));
  if (n === 0) return "Rupees Zero Only";

  const parts: string[] = [];

  // Crores (1,00,00,000)
  if (n >= 10000000) {
    const crores = Math.floor(n / 10000000);
    parts.push(`${convertBelowThousand(crores)} Crore`);
    n %= 10000000;
  }

  // Lakhs (1,00,000)
  if (n >= 100000) {
    const lakhs = Math.floor(n / 100000);
    parts.push(`${convertBelowThousand(lakhs)} Lakh`);
    n %= 100000;
  }

  // Thousands (1,000)
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    parts.push(`${convertBelowThousand(thousands)} Thousand`);
    n %= 1000;
  }

  // Hundreds & remainder
  if (n > 0) {
    parts.push(convertBelowThousand(n));
  }

  return `Rupees ${parts.join(" ")} Only`;
}

/**
 * Calculates complete financial breakdown for line items and document summary.
 */
export function calculateFinancials(
  lines: LineItemInput[],
  options: CalculationOptions = {}
): FinancialSummary {
  const isInterstate = Boolean(options.isInterstate);
  const pricingMode = options.pricingMode || "exclusive";

  let sumGross = 0;
  let sumLineDiscount = 0;
  let sumTaxable = 0;
  let sumCgst = 0;
  let sumSgst = 0;
  let sumIgst = 0;

  const items: CalculatedLineItem[] = lines.map((l, index) => {
    const qty = Math.max(0, Number(l.quantity || 1));
    const rate = Math.max(0, Number(l.rate || 0));
    const grossAmount = round2(qty * rate);

    const discountType: DiscountType = l.discountType || "percent";
    const discountRate = Math.max(0, Number(l.discountRate || 0));
    let discountAmount = 0;
    if (discountType === "fixed") {
      discountAmount = round2(Math.min(grossAmount, discountRate));
    } else {
      discountAmount = round2(grossAmount * (discountRate / 100));
    }

    const netBeforeTax = round2(Math.max(0, grossAmount - discountAmount));
    const taxMode: TaxMode = l.taxMode || "GST";
    const rawGstRate = taxMode === "Non-GST" ? 0 : Math.max(0, Number(l.gstRate ?? 18));

    let taxableValue = 0;
    if (pricingMode === "inclusive" && rawGstRate > 0) {
      taxableValue = round2(netBeforeTax / (1 + rawGstRate / 100));
    } else {
      taxableValue = netBeforeTax;
    }

    let cgstRate = 0;
    let sgstRate = 0;
    let igstRate = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    if (rawGstRate > 0) {
      if (isInterstate) {
        igstRate = rawGstRate;
        igstAmount = round2(taxableValue * (igstRate / 100));
      } else {
        cgstRate = rawGstRate / 2;
        sgstRate = rawGstRate / 2;
        cgstAmount = round2(taxableValue * (cgstRate / 100));
        sgstAmount = round2(taxableValue * (sgstRate / 100));
      }
    }

    const totalTax = round2(cgstAmount + sgstAmount + igstAmount);
    const lineTotal = round2(taxableValue + totalTax);

    sumGross = round2(sumGross + grossAmount);
    sumLineDiscount = round2(sumLineDiscount + discountAmount);
    sumTaxable = round2(sumTaxable + taxableValue);
    sumCgst = round2(sumCgst + cgstAmount);
    sumSgst = round2(sumSgst + sgstAmount);
    sumIgst = round2(sumIgst + igstAmount);

    return {
      id: l.id ?? index + 1,
      description: l.description || l.name || "Item",
      name: l.name || l.description || "Item",
      sku: l.sku || "",
      variant: l.variant || "",
      room: l.room || "",
      hsnSac: l.hsnSac || "8536",
      uqc: l.uqc || "NOS",
      quantity: qty,
      rate,
      grossAmount,
      discountRate,
      discountType,
      discountAmount,
      taxableValue,
      gstRate: rawGstRate,
      taxMode,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      totalTax,
      total: lineTotal,
    };
  });

  // Document level discount
  let documentDiscountTotal = 0;
  if (options.documentDiscountAmount) {
    documentDiscountTotal = round2(options.documentDiscountAmount);
  } else if (options.documentDiscountRate) {
    documentDiscountTotal = round2(sumTaxable * (options.documentDiscountRate / 100));
  }

  const effectiveTaxableTotal = round2(Math.max(0, sumTaxable - documentDiscountTotal));
  const totalDiscount = round2(sumLineDiscount + documentDiscountTotal);
  const totalTax = round2(sumCgst + sumSgst + sumIgst);

  const rawTotal = round2(effectiveTaxableTotal + totalTax);
  const grandTotal = Math.round(rawTotal);
  const roundOff = round2(grandTotal - rawTotal);

  const amountPaid = Math.max(0, round2(options.amountPaid || 0));
  const balanceDue = Math.max(0, round2(grandTotal - amountPaid));

  return {
    items,
    subtotal: sumGross,
    lineDiscountTotal: sumLineDiscount,
    documentDiscountTotal,
    totalDiscount,
    taxableTotal: effectiveTaxableTotal,
    cgstTotal: sumCgst,
    sgstTotal: sumSgst,
    igstTotal: sumIgst,
    totalTax,
    rawTotal,
    roundOff,
    grandTotal,
    amountPaid,
    balanceDue,
    amountWords: numberToWordsINR(grandTotal),
    isInterstate,
    pricingMode,
  };
}

/** Validate Indian 15-character GSTIN format */
export function validateGSTIN(gstin?: string | null): { valid: boolean; stateCode?: string; message?: string } {
  if (!gstin || !gstin.trim()) {
    return { valid: true }; // Unregistered B2C is permitted
  }
  const clean = gstin.trim().toUpperCase();
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!regex.test(clean)) {
    return {
      valid: false,
      message: `Invalid GSTIN format: "${gstin}". A valid Indian GSTIN must be 15 characters (e.g., 33GIMPP4721H1Z2).`,
    };
  }
  return { valid: true, stateCode: clean.substring(0, 2) };
}

/** Validates Place of Supply and state code consistency */
export function validatePlaceOfSupply(placeOfSupply?: string | null, placeOfSupplyCode?: string | null): { valid: boolean; message?: string } {
  if (!placeOfSupply || !placeOfSupply.trim()) {
    return { valid: false, message: "Place of Supply is required for tax invoice generation." };
  }
  if (!placeOfSupplyCode || !placeOfSupplyCode.trim()) {
    return { valid: false, message: "Place of Supply State Code (e.g., 33 for Tamil Nadu) is required." };
  }
  const codeNum = parseInt(placeOfSupplyCode.trim(), 10);
  if (isNaN(codeNum) || codeNum < 1 || codeNum > 38) {
    return { valid: false, message: `Invalid Place of Supply code: "${placeOfSupplyCode}". Must be a valid 2-digit Indian State/UT code (01-38).` };
  }
  return { valid: true };
}

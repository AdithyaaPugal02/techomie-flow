import { calculateFinancials, round2, formatINR, numberToWordsINR } from "../lib/financial";
import fs from "fs";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("Assertion failed: " + msg);
}

function runTests() {
  console.log("=== Testing Financial Calculation Engine ===");

  // TEST 1: Single-item quotation
  console.log("Test 1: Single item quotation");
  const single = calculateFinancials([
    { description: "Noviq Switch", quantity: 1, rate: 10000, discountRate: 10, gstRate: 18 }
  ]);
  assert(single.subtotal === 10000, "Single subtotal 10000");
  assert(single.totalDiscount === 1000, "Single discount 1000");
  assert(single.taxableTotal === 9000, "Single taxable 9000");
  assert(single.cgstTotal === 810, "Single CGST 810");
  assert(single.sgstTotal === 810, "Single SGST 810");
  assert(single.grandTotal === 10620, "Single grand total 10620");
  assert(single.roundOff === 0, "Single roundoff 0");
  console.log("✓ Single item passed");

  // TEST 2: Attached PDF 32-Item Regression Test (QT-1156)
  console.log("Test 2: 32-item Regression Test from Draft-Invoice (2).pdf");
  const envStr = fs.readFileSync(".env.local", "utf8");
  const env = Object.fromEntries(
    envStr.split("\n").filter((l) => l.includes("=")).map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim().replace(/^["']|["']$/g, "")];
    })
  );

  // Read snapshot from DB or hardcoded snapshot
  // Let's test with the 32 items
  const test32Lines = [
    { description: "Noviq Series 6 Lock", quantity: 1, rate: 27137, discountRate: 15, gstRate: 18 },
    { description: "Noviq Door/Window sensor", quantity: 5, rate: 1935.22, discountRate: 15, gstRate: 18 },
    { description: "Noviq Outdoor Siren", quantity: 2, rate: 5175, discountRate: 15, gstRate: 18 },
    { description: "Noviq WiFi Video Doorbell", quantity: 1, rate: 7929, discountRate: 15, gstRate: 18 },
    { description: "Noviq AUTOZON ARM", quantity: 1, rate: 80000, discountRate: 40, gstRate: 18 },
    { description: "Noviq Touch 4 Switch", quantity: 1, rate: 10500, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 8 Switch", quantity: 1, rate: 15285, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch 2 Fan", quantity: 1, rate: 18210, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 8 Switch", quantity: 1, rate: 15840, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch", quantity: 1, rate: 14107.50, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 12 Switch 2 Fan", quantity: 1, rate: 32000, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 4 Switch 1 USB 1 S", quantity: 2, rate: 14950, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch", quantity: 1, rate: 14107.50, discountRate: 15, gstRate: 18 },
    { description: "Noviq 10.1 Inch Control Panel", quantity: 1, rate: 75950, discountRate: 40, gstRate: 18 },
    { description: "Noviq Touch 6 Switch 1 Fan 1 S", quantity: 1, rate: 18216, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch 1 Fan", quantity: 1, rate: 17721, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 4 Switch (All 6A)", quantity: 1, rate: 9330, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 4 Switch", quantity: 1, rate: 10500, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 4 Switch", quantity: 1, rate: 10500, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch", quantity: 1, rate: 14107.50, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch 2 Fan", quantity: 1, rate: 18210, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch", quantity: 1, rate: 15411, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 4 Switch 1 USB 1 S", quantity: 1, rate: 11979, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch 1 Fan 1 S", quantity: 1, rate: 18216, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch 1 USB 1 S", quantity: 1, rate: 19216, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch 1 Fan 1 S", quantity: 1, rate: 18216, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch 1 Fan", quantity: 1, rate: 17721, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 4 Switch", quantity: 1, rate: 10500, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch 1 Fan 1 S", quantity: 1, rate: 18216, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 4 Switch 1 Socket", quantity: 1, rate: 14137.50, discountRate: 15, gstRate: 18 },
    { description: "Noviq Touch 6 Switch 1 Fan", quantity: 1, rate: 17721, discountRate: 15, gstRate: 18 },
    { description: "Noviq Compact Socket Gateway", quantity: 2, rate: 5332, discountRate: 15, gstRate: 18 },
  ];

  const reg = calculateFinancials(test32Lines, { isInterstate: false });
  console.log("32-item Taxable:", reg.taxableTotal);
  console.log("32-item CGST:", reg.cgstTotal);
  console.log("32-item SGST:", reg.sgstTotal);
  console.log("32-item Total Tax:", reg.totalTax);
  console.log("32-item Raw Total:", reg.rawTotal);
  console.log("32-item Round Off:", reg.roundOff);
  console.log("32-item Grand Total:", reg.grandTotal);
  console.log("32-item Amount in Words:", reg.amountWords);

  assert(reg.grandTotal === 587464, "Grand total must match exactly ₹5,87,464.00");
  assert(Math.abs(reg.cgstTotal - 44806.54) <= 0.05, "CGST must match ₹44,806.54");
  assert(Math.abs(reg.sgstTotal - 44806.54) <= 0.05, "SGST must match ₹44,806.54");
  assert(Math.abs(reg.roundOff - 0.41) <= 0.05 || Math.abs(reg.roundOff - 0.43) <= 0.05, "Round off must match ~0.43");
  assert(reg.amountWords.includes("Five Lakh Eighty Seven Thousand Four Hundred Sixty Four"), "Words must be dynamic");
  console.log("✓ 32-item regression passed");

  // TEST 3: Interstate IGST Calculation
  console.log("Test 3: Interstate IGST Calculation");
  const interstate = calculateFinancials(
    [{ description: "Interstate Supply", quantity: 2, rate: 50000, gstRate: 18 }],
    { isInterstate: true }
  );
  assert(interstate.cgstTotal === 0, "CGST should be 0 for interstate");
  assert(interstate.sgstTotal === 0, "SGST should be 0 for interstate");
  assert(interstate.igstTotal === 18000, "IGST should be 18000 (18%)");
  assert(interstate.grandTotal === 118000, "Grand total 118000");
  console.log("✓ Interstate IGST passed");

  // TEST 4: Non-GST item
  console.log("Test 4: Non-GST items");
  const nonGst = calculateFinancials([
    { description: "Labour / Freight", quantity: 1, rate: 5000, taxMode: "Non-GST" },
    { description: "Product", quantity: 1, rate: 5000, taxMode: "GST", gstRate: 18 }
  ]);
  assert(nonGst.subtotal === 10000, "Subtotal 10000");
  assert(nonGst.totalTax === 900, "Total tax only on GST item (900)");
  assert(nonGst.grandTotal === 10900, "Grand total 10900");
  console.log("✓ Non-GST item passed");

  // TEST 5: Multiple GST rates
  console.log("Test 5: Multiple GST rates (5%, 12%, 18%, 28%)");
  const multiRate = calculateFinancials([
    { description: "Item 5%", quantity: 1, rate: 1000, gstRate: 5 },
    { description: "Item 12%", quantity: 1, rate: 1000, gstRate: 12 },
    { description: "Item 18%", quantity: 1, rate: 1000, gstRate: 18 },
    { description: "Item 28%", quantity: 1, rate: 1000, gstRate: 28 },
  ]);
  assert(multiRate.subtotal === 4000, "Subtotal 4000");
  assert(multiRate.totalTax === 50 + 120 + 180 + 280, "Total tax 630");
  assert(multiRate.grandTotal === 4630, "Grand total 4630");
  console.log("✓ Multiple GST rates passed");

  // TEST 6: Tax-inclusive pricing mode
  console.log("Test 6: Tax-inclusive pricing mode");
  const inclusive = calculateFinancials(
    [{ description: "Inclusive Item", quantity: 1, rate: 1180, gstRate: 18 }],
    { pricingMode: "inclusive" }
  );
  assert(inclusive.taxableTotal === 1000, "Taxable must be 1000 for inclusive 1180 @ 18%");
  assert(inclusive.totalTax === 180, "Tax must be 180");
  assert(inclusive.grandTotal === 1180, "Grand total must match sticker price 1180");
  console.log("✓ Tax inclusive pricing passed");

  // TEST 7: 100-item calculation load test
  console.log("Test 7: 100-item calculation load test");
  const items100 = Array.from({ length: 100 }, (_, i) => ({
    description: `Product SKU ${i + 1}`,
    quantity: (i % 5) + 1,
    rate: 1500 + i * 25,
    discountRate: (i % 4) * 5,
    gstRate: 18
  }));
  const res100 = calculateFinancials(items100);
  assert(res100.items.length === 100, "100 items calculated");
  assert(res100.grandTotal > 0, "100 items grand total positive");
  assert(typeof res100.amountWords === "string" && res100.amountWords.length > 10, "Amount in words generated");
  console.log("✓ 100-item test passed");

  // TEST 8: Advance payments & Balance due
  console.log("Test 8: Partial advance and balance due");
  const advance = calculateFinancials(
    [{ description: "Big System", quantity: 1, rate: 100000, gstRate: 18 }],
    { amountPaid: 50000 }
  );
  assert(advance.grandTotal === 118000, "Grand total 118000");
  assert(advance.amountPaid === 50000, "Amount paid 50000");
  assert(advance.balanceDue === 68000, "Balance due 68000");
  console.log("✓ Partial advance passed");

  // TEST 9: Number to words edge cases
  console.log("Test 9: Number to words INR formatting");
  assert(numberToWordsINR(0) === "Rupees Zero Only", "Zero in words");
  assert(numberToWordsINR(1) === "Rupees One Only", "One in words");
  assert(numberToWordsINR(100000) === "Rupees One Lakh Only", "One lakh in words");
  assert(numberToWordsINR(10000000) === "Rupees One Crore Only", "One crore in words");
  assert(formatINR(587464) === "₹5,87,464.00", "Indian comma formatting ₹5,87,464.00");
  console.log("✓ Number to words & formatINR passed");

  console.log("\nALL 9 FINANCIAL ENGINE TESTS PASSED PERFECTLY!");
}

runTests();

import { env } from "cloudflare:workers";
import { requireUser } from "../../../lib/auth";

type Line = {
  description: string;
  sku?: string;
  hsnSac: string;
  uqc?: string;
  quantity: number;
  rate: number;
  discountRate?: number;
  gstRate: number;
};
const fy = (date: string) => {
  const d = new Date(date),
    y = d.getFullYear(),
    start = d.getMonth() < 3 ? y - 1 : y;
  return `${String(start).slice(-2)}-${String(start + 1).slice(-2)}`;
};
const words = (n: number) => {
  const one = [
      "",
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Eleven",
      "Twelve",
      "Thirteen",
      "Fourteen",
      "Fifteen",
      "Sixteen",
      "Seventeen",
      "Eighteen",
      "Nineteen",
    ],
    ten = [
      "",
      "",
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ],
    under100 = (x: number) =>
      x < 20 ? one[x] : `${ten[Math.floor(x / 10)]} ${one[x % 10]}`.trim(),
    part = (x: number) =>
      x < 100
        ? under100(x)
        : `${one[Math.floor(x / 100)]} Hundred ${under100(x % 100)}`.trim();
  let x = Math.round(n),
    out = [] as string[];
  for (const [v, label] of [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
  ] as [number, string][])
    if (x >= v) {
      out.push(`${part(Math.floor(x / v))} ${label}`);
      x %= v;
    }
  if (x) out.push(part(x));
  return `Rupees ${out.join(" ") || "Zero"} Only`;
};
const calculate = (lines: Line[], interstate: boolean, inclusive: boolean) => {
  let subtotal = 0,
    discountTotal = 0,
    taxableTotal = 0,
    cgstTotal = 0,
    sgstTotal = 0,
    igstTotal = 0;
  const items = lines.map((l, i) => {
    const gross = l.quantity * l.rate,
      discount = gross * (Number(l.discountRate || 0) / 100),
      after = gross - discount,
      taxable = inclusive ? after / (1 + l.gstRate / 100) : after,
      tax = (taxable * l.gstRate) / 100,
      cgst = interstate ? 0 : tax / 2,
      sgst = interstate ? 0 : tax / 2,
      igst = interstate ? tax : 0,
      total = taxable + tax;
    subtotal += gross;
    discountTotal += discount;
    taxableTotal += taxable;
    cgstTotal += cgst;
    sgstTotal += sgst;
    igstTotal += igst;
    return {
      ...l,
      id: crypto.randomUUID(),
      uqc: l.uqc || "NOS",
      discountAmount: discount,
      taxableValue: taxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: igst,
      total,
      sortOrder: i,
    };
  });
  const raw = taxableTotal + cgstTotal + sgstTotal + igstTotal,
    grandTotal = Math.round(raw),
    roundOff = grandTotal - raw;
  return {
    items,
    subtotal,
    discountTotal,
    taxableTotal,
    cgstTotal,
    sgstTotal,
    igstTotal,
    roundOff,
    grandTotal,
    amountWords: words(grandTotal),
  };
};
const audit = (uid: string, action: string, id: string) =>
  env.DB.prepare(
    "INSERT INTO audit_log (user_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?)",
  )
    .bind(uid, action, "tax_invoice", id, new Date().toISOString())
    .run();

export async function GET(req: Request) {
  try {
    await requireUser(["admin", "crm"]);
    const url = new URL(req.url),
      format = url.searchParams.get("format"),
      id = url.searchParams.get("id"),
      from = url.searchParams.get("from"),
      to = url.searchParams.get("to");
    if (id) {
      const invoice = await env.DB.prepare(
        "SELECT i.*,c.name customer_name,c.phone customer_phone,c.email customer_email FROM tax_invoices i JOIN customers c ON c.id=i.customer_id WHERE i.id=?",
      )
        .bind(id)
        .first<Record<string, unknown>>();
      if (!invoice)
        return Response.json({ error: "Invoice not found" }, { status: 404 });
      const [items, payments, notes] = await Promise.all([
        env.DB.prepare(
          "SELECT * FROM tax_invoice_items WHERE invoice_id=? ORDER BY sort_order",
        )
          .bind(id)
          .all(),
        env.DB.prepare(
          "SELECT * FROM invoice_payments WHERE invoice_id=? ORDER BY date,created_at",
        )
          .bind(id)
          .all(),
        env.DB.prepare(
          "SELECT * FROM tax_adjustment_notes WHERE invoice_id=? ORDER BY date,created_at",
        )
          .bind(id)
          .all(),
      ]);
      const paid = (payments.results as Record<string, unknown>[]).reduce(
        (s, p) => s + Number(p.amount || 0),
        0,
      );
      return Response.json({
        invoice: {
          ...invoice,
          items: items.results,
          payments: payments.results,
          notes: notes.results,
          paid,
          balance: Math.max(0, Number(invoice.grand_total) - paid),
        },
      });
    }
    let sql =
        "SELECT i.*,c.name customer_name,COALESCE((SELECT SUM(p.amount) FROM invoice_payments p WHERE p.invoice_id=i.id),0) paid FROM tax_invoices i JOIN customers c ON c.id=i.customer_id WHERE 1=1",
      args: unknown[] = [];
    if (from) {
      sql += " AND invoice_date>=?";
      args.push(from);
    }
    if (to) {
      sql += " AND invoice_date<=?";
      args.push(to);
    }
    sql += " ORDER BY invoice_date DESC,number DESC";
    const rows = (
      await env.DB.prepare(sql)
        .bind(...args)
        .all<Record<string, unknown>>()
    ).results.map((r) => ({
      ...r,
      balance: Math.max(0, Number(r.grand_total) - Number(r.paid)),
    }));
    const finalised = rows.filter(
      (r) => r.status !== "Draft" && r.status !== "Cancelled",
    );
    if (format === "gstr1") {
      const header =
          "Type,Invoice Number,Invoice Date,Customer,GSTIN,Place of Supply,Taxable Value,CGST,SGST,IGST,Invoice Value\n",
        csv = finalised
          .map((r) =>
            [
              r.customer_gstin ? "B2B" : "B2C",
              r.number,
              r.invoice_date,
              `\"${String(r.customer_name).replaceAll('"', '""')}\"`,
              r.customer_gstin || "",
              r.place_of_supply_code,
              r.taxable_total,
              r.cgst_total,
              r.sgst_total,
              r.igst_total,
              r.grand_total,
            ].join(","),
          )
          .join("\n");
      return new Response(header + csv, {
        headers: {
          "content-type": "text/csv",
          "content-disposition": "attachment; filename=Techomie-GSTR1.csv",
        },
      });
    }
    if (format === "hsn") {
      const hsn = (
        await env.DB.prepare(
          "SELECT CASE WHEN i.customer_gstin IS NULL OR i.customer_gstin='' THEN 'B2C' ELSE 'B2B' END supply_class,x.hsn_sac,x.uqc,SUM(x.quantity) quantity,SUM(x.taxable_value) taxable_value,x.gst_rate,SUM(x.cgst_amount) cgst,SUM(x.sgst_amount) sgst,SUM(x.igst_amount) igst FROM tax_invoice_items x JOIN tax_invoices i ON i.id=x.invoice_id WHERE i.status NOT IN ('Draft','Cancelled') GROUP BY supply_class,x.hsn_sac,x.uqc,x.gst_rate ORDER BY supply_class,x.hsn_sac",
        ).all<Record<string, unknown>>()
      ).results;
      const header =
          "Supply Class,HSN/SAC,UQC,Quantity,Taxable Value,GST Rate,CGST,SGST,IGST\n",
        csv = hsn
          .map((r) =>
            [
              r.supply_class,
              r.hsn_sac,
              r.uqc,
              r.quantity,
              r.taxable_value,
              r.gst_rate,
              r.cgst,
              r.sgst,
              r.igst,
            ].join(","),
          )
          .join("\n");
      return new Response(header + csv, {
        headers: {
          "content-type": "text/csv",
          "content-disposition":
            "attachment; filename=Techomie-HSN-Summary.csv",
        },
      });
    }
    if (format === "tax-summary")
      return Response.json({
        summary: finalised.reduce(
          (a, r) => ({
            taxable: a.taxable + Number(r.taxable_total),
            cgst: a.cgst + Number(r.cgst_total),
            sgst: a.sgst + Number(r.sgst_total),
            igst: a.igst + Number(r.igst_total),
            invoiceValue: a.invoiceValue + Number(r.grand_total),
          }),
          { taxable: 0, cgst: 0, sgst: 0, igst: 0, invoiceValue: 0 },
        ),
      });
    return Response.json({ invoices: rows });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "Unable to load invoices" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(["admin"]),
      p = (await req.json()) as Record<string, unknown>,
      lines = p.items as Line[];
    if (
      !p.customerId ||
      !p.billingAddress ||
      !p.placeOfSupply ||
      !p.placeOfSupplyCode ||
      !lines?.length
    )
      return Response.json(
        {
          error:
            "Customer, address, place of supply and invoice items are required",
        },
        { status: 400 },
      );
    const id = crypto.randomUUID(),
      now = new Date().toISOString(),
      invoiceDate = String(p.invoiceDate || now.slice(0, 10)),
      interstate = String(p.placeOfSupplyCode) !== "33",
      inclusive = p.pricingMode === "inclusive",
      calc = calculate(lines, interstate, inclusive),
      companyRow = await env.DB.prepare(
        "SELECT value FROM settings WHERE key='company'",
      ).first<{ value: string }>(),
      bankRow = await env.DB.prepare(
        "SELECT value FROM settings WHERE key='banks'",
      ).first<{ value: string }>(),
      company = companyRow
        ? JSON.parse(companyRow.value)
        : {
            legalName: "Techomie Smart Devices",
            gstin: "33GIMPP4721H1Z2",
            state: "Tamil Nadu",
            stateCode: "33",
          },
      banks = bankRow ? JSON.parse(bankRow.value) : {},
      snapshot = { ...p, items: calc.items, totals: calc, company, banks };
    await env.DB.prepare(
      "INSERT INTO tax_invoices (id,financial_year,quotation_id,project_id,customer_id,site_id,invoice_date,due_date,billing_address,shipping_address,customer_gstin,place_of_supply,place_of_supply_code,supply_type,pricing_mode,subtotal,discount_total,taxable_total,cgst_total,sgst_total,igst_total,round_off,grand_total,amount_words,payment_terms,bank_details,company_snapshot,snapshot,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        id,
        fy(invoiceDate),
        p.quotationId || null,
        p.projectId || null,
        p.customerId,
        p.siteId || null,
        invoiceDate,
        p.dueDate || null,
        p.billingAddress,
        p.shippingAddress || p.billingAddress,
        p.customerGstin || null,
        p.placeOfSupply,
        p.placeOfSupplyCode,
        interstate ? "Interstate" : "Intrastate",
        inclusive ? "inclusive" : "exclusive",
        calc.subtotal,
        calc.discountTotal,
        calc.taxableTotal,
        calc.cgstTotal,
        calc.sgstTotal,
        calc.igstTotal,
        calc.roundOff,
        calc.grandTotal,
        calc.amountWords,
        p.paymentTerms || null,
        JSON.stringify(banks),
        JSON.stringify(company),
        JSON.stringify(snapshot),
        "Draft",
        user.id,
        now,
        now,
      )
      .run();
    const stmts = calc.items.map((x) =>
      env.DB.prepare(
        "INSERT INTO tax_invoice_items (id,invoice_id,description,sku,hsn_sac,uqc,quantity,rate,discount_rate,discount_amount,taxable_value,gst_rate,cgst_amount,sgst_amount,igst_amount,total,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        x.id,
        id,
        x.description,
        x.sku || null,
        x.hsnSac,
        x.uqc,
        x.quantity,
        x.rate,
        x.discountRate || 0,
        x.discountAmount,
        x.taxableValue,
        x.gstRate,
        x.cgstAmount,
        x.sgstAmount,
        x.igstAmount,
        x.total,
        x.sortOrder,
      ),
    );
    if (stmts.length) await env.DB.batch(stmts);
    await audit(user.id, "invoice_draft_created", id);
    return Response.json(
      { invoice: { id, status: "Draft", ...calc } },
      { status: 201 },
    );
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          {
            error: e instanceof Error ? e.message : "Unable to create invoice",
          },
          { status: 500 },
        );
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(["admin"]),
      p = (await req.json()) as Record<string, unknown>,
      id = String(p.id || ""),
      action = String(p.action || "");
    const invoice = await env.DB.prepare(
      "SELECT * FROM tax_invoices WHERE id=?",
    )
      .bind(id)
      .first<Record<string, unknown>>();
    if (!invoice)
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    const locked = !!invoice.locked_at;
    if (action === "template") {
      if (locked || invoice.status !== "Draft")
        return Response.json({ error: "A finalised invoice design is immutable" }, { status: 423 });
      const snapshot = (() => { try { return JSON.parse(String(invoice.snapshot || "{}")); } catch { return {}; } })();
      snapshot.templateId = String(p.templateId || "executive");
      await env.DB.prepare("UPDATE tax_invoices SET snapshot=?,updated_at=? WHERE id=?")
        .bind(JSON.stringify(snapshot), new Date().toISOString(), id).run();
      await audit(user.id, "invoice_template_updated", id);
      return Response.json({ ok: true, templateId: snapshot.templateId });
    }
    if (action === "finalise") {
      if (locked || invoice.status !== "Draft")
        return Response.json(
          { error: "Only a draft invoice can be finalised" },
          { status: 409 },
        );
      const year = String(invoice.financial_year),
        seq = await env.DB.prepare(
          "INSERT INTO invoice_sequences (financial_year,last_number,updated_at) VALUES (?,1,?) ON CONFLICT(financial_year) DO UPDATE SET last_number=last_number+1,updated_at=excluded.updated_at RETURNING last_number",
        )
          .bind(year, new Date().toISOString())
          .first<{ last_number: number }>(),
        number = `TSD/${year}/${String(seq?.last_number || 1).padStart(4, "0")}`;
      await env.DB.prepare(
        "UPDATE tax_invoices SET number=?,status='Finalised',locked_at=?,updated_at=? WHERE id=? AND locked_at IS NULL",
      )
        .bind(number, new Date().toISOString(), new Date().toISOString(), id)
        .run();
      await audit(user.id, "invoice_finalised", id);
      return Response.json({ ok: true, number, status: "Finalised" });
    }
    if (action === "payment") {
      if (!locked)
        return Response.json(
          { error: "Finalise the invoice before recording payments" },
          { status: 409 },
        );
      const amount = Number(p.amount);
      if (!(amount > 0) || !p.reference)
        return Response.json(
          { error: "Valid amount and reference are required" },
          { status: 400 },
        );
      await env.DB.prepare(
        "INSERT INTO invoice_payments (id,invoice_id,date,amount,mode,reference,notes,received_by,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          id,
          p.date || new Date().toISOString().slice(0, 10),
          amount,
          p.mode || "Bank Transfer",
          p.reference,
          p.notes || null,
          user.id,
          new Date().toISOString(),
        )
        .run();
      const paid = await env.DB.prepare(
          "SELECT COALESCE(SUM(amount),0) paid FROM invoice_payments WHERE invoice_id=?",
        )
          .bind(id)
          .first<{ paid: number }>(),
        status =
          (paid?.paid || 0) >= Number(invoice.grand_total)
            ? "Paid"
            : "Partially Paid";
      await env.DB.prepare(
        "UPDATE tax_invoices SET status=?,updated_at=? WHERE id=?",
      )
        .bind(status, new Date().toISOString(), id)
        .run();
      await audit(user.id, "invoice_payment_recorded", id);
      return Response.json({
        ok: true,
        status,
        paid: paid?.paid || 0,
        balance: Math.max(0, Number(invoice.grand_total) - (paid?.paid || 0)),
      });
    }
    if (action === "note") {
      if (!locked)
        return Response.json(
          { error: "Notes can only link to a finalised invoice" },
          { status: 409 },
        );
      if (!p.reason || !(Number(p.total) > 0))
        return Response.json(
          { error: "Reason and note total are required" },
          { status: 400 },
        );
      const type = String(p.type) === "Debit" ? "Debit" : "Credit",
        count = await env.DB.prepare(
          "SELECT COUNT(*) n FROM tax_adjustment_notes WHERE invoice_id=? AND type=?",
        )
          .bind(id, type)
          .first<{ n: number }>(),
        number = `${type === "Credit" ? "CN" : "DN"}/${invoice.financial_year}/${String((count?.n || 0) + 1).padStart(4, "0")}`;
      await env.DB.prepare(
        "INSERT INTO tax_adjustment_notes (id,number,invoice_id,type,date,reason,taxable_value,cgst,sgst,igst,total,snapshot,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      )
        .bind(
          crypto.randomUUID(),
          number,
          id,
          type,
          p.date || new Date().toISOString().slice(0, 10),
          p.reason,
          Number(p.taxableValue || 0),
          Number(p.cgst || 0),
          Number(p.sgst || 0),
          Number(p.igst || 0),
          Number(p.total),
          JSON.stringify(p),
          user.id,
          new Date().toISOString(),
        )
        .run();
      await audit(user.id, `${type.toLowerCase()}_note_created`, id);
      return Response.json({ ok: true, number });
    }
    if (locked)
      return Response.json(
        {
          error:
            "Finalised invoices are immutable; issue a credit or debit note",
        },
        { status: 423 },
      );
    return Response.json(
      { error: "Use a supported invoice action" },
      { status: 400 },
    );
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          {
            error: e instanceof Error ? e.message : "Unable to update invoice",
          },
          { status: 500 },
        );
  }
}

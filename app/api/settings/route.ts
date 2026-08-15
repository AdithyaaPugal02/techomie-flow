import { env } from "cloudflare:workers";
import { hashPassword, randomToken, requireUser } from "../../../lib/auth";
type R = Record<string, any>;
const defaults: R = {
  company: {
    legalName: "Techomie Smart Devices",
    displayName: "Techomie Smart Devices",
    brandName: "Techomie",
    gstin: "33GIMPP4721H1Z2",
    pan: "GIMPP4721H",
    address:
      "356/2, Church Road, Sri Murugan Nagar, Phase II, Cheran Maa Nagar",
    city: "Coimbatore",
    state: "Tamil Nadu",
    pincode: "641048",
    country: "India",
    phone: "07598883121",
    whatsapp: "07598883121",
    email: "info.techomie@gmail.com",
    website: "https://www.techomie.com",
    placeOfSupply: "Tamil Nadu",
    financialYearStart: "April",
    financialYearEnd: "March",
    currency: "INR",
    timeZone: "Asia/Kolkata",
    logo: "/techomie-logo.jpg",
    signature: "",
    seal: "",
  },
  branding: {
    primaryColour: "#1769ff",
    secondaryColour: "#111318",
    pdfFont: "Inter",
    header: "Techomie Smart Devices",
    footer: "Coimbatore · www.techomie.com",
    cover: "Tech Proposal",
    signaturePosition: "right",
    contactFooter: true,
    showBank: true,
    imageLayout: "medium",
    showStandardImages: true,
    fullProposal: "Full Smart Home Proposal",
    standardQuote: "Standard Product Quotation",
    invoiceTemplate: "Tax Invoice",
  },
  banks: {
    accounts: [
      {
        id: "default",
        accountName: "Techomie Smart Devices",
        bankName: "",
        accountNumber: "",
        ifsc: "",
        branch: "",
        accountType: "Current",
        upi: "",
        qrImage: "",
        active: true,
        default: true,
      },
    ],
  },
  tax: {
    gstin: "33GIMPP4721H1Z2",
    placeOfSupply: "Tamil Nadu",
    intraRule: "CGST + SGST",
    interRule: "IGST",
    pricingMode: "exclusive",
    categoryRates: { Default: 18 },
    hsn: [{ code: "830140", description: "Smart locks", gst: 18, uqc: "NOS" }],
    uqc: ["NOS", "PCS", "MTR", "JOB", "SET"],
    reverseCharge: false,
    dueDays: 15,
    rounding: "Nearest rupee",
    adminTaxOverride: true,
  },
  numbering: {
    quotePrefix: "QT",
    quoteFinancialYear: false,
    quoteStart: 1145,
    revisionFormat: "Rev {n}",
    quoteValidity: 30,
    invoicePrefix: "INV",
    invoiceFinancialYear: true,
    invoiceStart: 1,
    creditPrefix: "CN",
    debitPrefix: "DN",
  },
  paymentTerms: {
    templates: [
      {
        id: "20-60-20",
        name: "20% advance + 60% procurement + 20% handover",
        active: true,
        milestones: [
          { name: "Advance", percent: 20, condition: "Order confirmation" },
          {
            name: "Procurement",
            percent: 60,
            condition: "Material procurement",
          },
          { name: "Handover", percent: 20, condition: "Handover" },
        ],
      },
      {
        id: "80-20",
        name: "80% confirmation + 20% installation",
        active: true,
        milestones: [
          { name: "Advance", percent: 80, condition: "Order confirmation" },
          {
            name: "Installation",
            percent: 20,
            condition: "Installation commencement",
          },
        ],
      },
    ],
    default: "20-60-20",
  },
  warranty: {
    templates: [
      {
        id: "noviq-premium",
        name: "Noviq premium / Edge series",
        appliesTo: "Noviq Edge",
        replacement: "5 years",
        service: "5 years",
        support: "5 years",
        amc: true,
        exclusions: "Physical damage, misuse and power surge",
        wording:
          "Five-year replacement and service support subject to warranty conditions.",
        active: true,
      },
      {
        id: "noviq-standard",
        name: "Other Noviq products",
        appliesTo: "Noviq",
        replacement: "2 years",
        service: "4 years",
        support: "2 years",
        amc: true,
        exclusions: "Physical damage and misuse",
        wording:
          "Manufacturer-backed replacement and Techomie service support.",
        active: true,
      },
    ],
  },
  terms: {
    templates: [
      {
        id: "standard",
        name: "Standard quotation",
        appliesTo: "Standard Product Quotation",
        content:
          "Quotation validity, scope changes, site readiness, payment milestones, stock availability, warranty exclusions and Coimbatore jurisdiction apply.",
        active: true,
      },
      {
        id: "invoice",
        name: "Final invoice",
        appliesTo: "Tax Invoice",
        content:
          "Payment is due as stated. Goods remain Techomie property until full payment.",
        active: true,
      },
    ],
  },
  masters: {
    categories: [
      "Smart switches",
      "Door locks",
      "Gateways",
      "Security",
      "Curtains",
      "CCTV",
      "Gate automation",
      "Installation",
      "Service",
    ],
    brands: ["Noviq", "Noviq OEM"],
    units: ["NOS", "PCS", "MTR", "JOB", "SET"],
    gstRates: [0, 5, 12, 18, 28],
    expenseReceiptThreshold: 1000,
    expenseCategories: ["Local travel","Fuel","Toll","Parking","Food / site refreshment","Courier / delivery","Material purchase","Small tools / consumables","Technician travel","Accommodation","Mobile / internet","Site visit","Emergency work","Other"],
    employeeDiscountLimit: 10,
    approvalDiscountLimit: 15,
    marginRule: "Selling price must remain above minimum selling price",
    supplierImportReview: true,
  },
  workflows: {
    lead: [
      "New",
      "Contacted",
      "Qualified",
      "Site Visit Scheduled",
      "Site Visit Done",
      "Quote In Progress",
      "Quote Sent",
      "Negotiation",
      "Won",
      "Lost",
    ],
    quotation: [
      "Draft",
      "Ready for Review",
      "Sent",
      "Negotiation",
      "Accepted",
      "Rejected",
      "Expired",
      "Revised",
      "Converted to Project",
    ],
    project: [
      "Confirmed",
      "Advance Pending",
      "Advance Received",
      "Material Planning",
      "Procurement",
      "Materials Ready",
      "Materials at Site",
      "Installation Scheduled",
      "Installation",
      "Testing & Configuration",
      "Handover & Training",
      "Completed",
      "On Hold",
      "Cancelled",
    ],
    service: [
      "Open",
      "Assigned",
      "In Progress",
      "Waiting for Parts",
      "Resolved",
      "Closed",
    ],
    requireStageChecks: true,
    defaultFollowupDays: 2,
  },
  notifications: {
    followupDue: true,
    overdueFollowup: true,
    quoteExpiry: true,
    paymentDue: true,
    invoiceOverdue: true,
    materialDelivery: true,
    installationDue: true,
    projectDelayed: true,
    taskOverdue: true,
    warrantyExpiry: true,
    amcRenewal: true,
    serviceOverdue: true,
    channel: "In-app",
    audience: "Assigned staff and Admin",
    quoteExpiryDays: 3,
  },
  integrations: {
    zoho: { enabled: false, status: "Not connected" },
    whatsapp: { enabled: false, status: "Not configured" },
    email: { enabled: false, status: "Not configured" },
    maps: { enabled: true, status: "Link mode" },
    storage: { enabled: true, status: "Local R2 ready" },
    backup: { enabled: true, status: "Local database" },
  },
  security: {
    backupFrequency: "Daily",
    lastBackup: "Not yet run",
    lastRestoreTest: "Not yet tested",
    applicationVersion: "2026.08",
    databaseStatus: "Connected",
    storageStatus: "Connected",
    auditRetention: "Permanent",
  },
  production: {
    url: "https://flow.techomie.com",
    sslStatus: "Pending production connection",
    databaseStatus: "Local development",
    storageStatus: "Local development",
    deploymentVersion: "2026.08",
    lastDeployment: "Local only",
  },
  danger: { archiveAfterYears: 7, productionReset: false },
};
defaults.branding = {
  ...defaults.branding,
  primaryColour: "#0aa9e8",
  secondaryColour: "#071522",
  accentColour: "#c8aa72",
  pdfFont: "Arial",
  footer: "Coimbatore | www.techomie.com",
  cover: "Smart Home Automation Proposal",
  imageLayout: "large",
  defaultQuoteTemplate: "luxury",
  defaultInvoiceTemplate: "executive",
  quoteTemplates: [
    {
      id: "luxury",
      name: "Luxury Smart Home",
      description:
        "Dark architectural cover with gold and electric-blue accents",
      active: true,
    },
    {
      id: "technical",
      name: "Technical Blueprint",
      description: "Circuit-inspired blue engineering presentation",
      active: true,
    },
    {
      id: "minimal",
      name: "Clean Minimal",
      description: "Bright, compact and procurement-friendly",
      active: true,
    },
  ],
  invoiceTemplates: [
    {
      id: "executive",
      name: "Executive Tax Invoice",
      description: "Premium structured GST invoice",
      active: true,
    },
    {
      id: "technical",
      name: "Technical Blue",
      description: "Blue-accented modern tax invoice",
      active: true,
    },
    {
      id: "classic",
      name: "Classic GST",
      description: "Conservative black and white accounts layout",
      active: true,
    },
  ],
};
const parse = (x: any, f: any = {}) => {
  try {
    return typeof x === "string" ? JSON.parse(x) : (x ?? f);
  } catch {
    return f;
  }
};
const audit = (u: string, action: string, key: string) =>
  env.DB.prepare(
    "INSERT INTO audit_log(user_id,action,entity_type,entity_id,created_at)VALUES(?,?,?,?,?)",
  )
    .bind(u, action, "setting", key, new Date().toISOString())
    .run();
export async function GET(req: Request) {
  try {
    const u = await requireUser(),
      x = new URL(req.url);
    if (u.role !== "admin") {
      const profile = await env.DB.prepare(
        "SELECT name,email,phone,profile_image,notification_preferences FROM users WHERE id=?",
      )
        .bind(u.id)
        .first<R>();
      return Response.json({
        admin: false,
        profile: {
          ...profile,
          notification_preferences: parse(profile?.notification_preferences, {
            inApp: true,
            email: false,
          }),
        },
      });
    }
    const rows = (
        await env.DB.prepare("SELECT * FROM settings ORDER BY key").all<R>()
      ).results,
      values = { ...defaults };
    for (const row of rows) {
      const saved = parse(row.value, defaults[row.key]);
      values[row.key] = saved && typeof saved === "object" && !Array.isArray(saved)
        ? { ...defaults[row.key], ...saved }
        : saved;
    }
    const auditRows =
      x.searchParams.get("audit") === "1"
        ? (
            await env.DB.prepare(
              "SELECT a.*,u.name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 250",
            ).all()
          ).results
        : [];
    return Response.json({
      admin: true,
      settings: values,
      audit: auditRows,
      system: {
        database: "Connected",
        storage: "Connected",
        environment: "Local development",
        productionResetAllowed: false,
      },
    });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json({ error: "Unable to load settings" }, { status: 500 });
  }
}
export async function PATCH(req: Request) {
  try {
    const u = await requireUser(),
      p = (await req.json()) as R,
      action = String(p.action || "save");
    if (action === "profile") {
      const fields = p.profile || {};
      await env.DB.prepare(
        "UPDATE users SET name=?,phone=?,profile_image=?,notification_preferences=? WHERE id=?",
      )
        .bind(
          fields.name || u.name,
          fields.phone || null,
          fields.profile_image || null,
          JSON.stringify(fields.notification_preferences || {}),
          u.id,
        )
        .run();
      if (p.password) {
        if (String(p.password).length < 10)
          return Response.json(
            { error: "Password must be at least 10 characters" },
            { status: 400 },
          );
        const salt = randomToken();
        await env.DB.prepare(
          "UPDATE users SET password_salt=?,password_hash=? WHERE id=?",
        )
          .bind(salt, await hashPassword(String(p.password), salt), u.id)
          .run();
      }
      await audit(u.id, "profile_updated", u.id);
      return Response.json({ ok: true });
    }
    if (u.role !== "admin")
      return Response.json({ error: "Admin access required" }, { status: 403 });
    if (action === "save") {
      const key = String(p.key),
        allowed = Object.keys(defaults);
      if (!allowed.includes(key))
        return Response.json(
          { error: "Unknown settings section" },
          { status: 400 },
        );
      if (key === "company" || key === "tax") {
        const gstin = String(p.value?.gstin || "");
        if (
          gstin &&
          !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/.test(gstin)
        )
          return Response.json(
            { error: "Enter a valid 15-character GSTIN" },
            { status: 400 },
          );
      }
      if (key === "banks") {
        const active = (p.value?.accounts || []).filter((a: R) => a.active);
        if (active.length && !active.some((a: R) => a.default))
          return Response.json(
            { error: "Choose one default active bank account" },
            { status: 400 },
          );
      }
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO settings(key,value,updated_by,updated_at)VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
      )
        .bind(key, JSON.stringify(p.value), u.id, now)
        .run();
      await audit(u.id, `${key}_settings_updated`, key);
      return Response.json({ ok: true, updatedAt: now });
    }
    if (action === "backup") {
      const now = new Date().toISOString(),
        current = {
          ...defaults.security,
          ...parse(
            (
              await env.DB.prepare(
                "SELECT value FROM settings WHERE key='security'",
              ).first<R>()
            )?.value,
            {},
          ),
          lastBackup: now,
        };
      await env.DB.prepare(
        "INSERT INTO settings(key,value,updated_by,updated_at)VALUES('security',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=excluded.updated_at",
      )
        .bind(JSON.stringify(current), u.id, now)
        .run();
      await audit(u.id, "backup_export_requested", "backup");
      const tables = [
        "customers",
        "customer_sites",
        "leads",
        "quotations",
        "tax_invoices",
        "projects",
        "payments",
        "expenses",
        "products",
        "variants",
      ];
      const data: R = { createdAt: now };
      for (const table of tables)
        data[table] = (
          await env.DB.prepare(`SELECT * FROM ${table}`).all()
        ).results;
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "content-type": "application/json",
          "content-disposition": `attachment; filename=Techomie-Backup-${now.slice(0, 10)}.json`,
        },
      });
    }
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (e) {
    return e instanceof Response
      ? e
      : Response.json(
          { error: e instanceof Error ? e.message : "Unable to save settings" },
          { status: 500 },
        );
  }
}

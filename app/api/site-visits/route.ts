import { env } from "cloudflare:workers";
import { requireUser } from "../../../lib/auth";

type R = Record<string, any>;
const now = () => new Date().toISOString();
const parse = (v: any, f: any = {}) => {
  try {
    return typeof v === "string" ? JSON.parse(v) : v ?? f;
  } catch {
    return f;
  }
};

export async function GET(req: Request) {
  try {
    const u = await requireUser(["admin", "crm", "sales", "technician"]);
    const x = new URL(req.url);
    const id = x.searchParams.get("id");
    if (id) {
      const v = await env.DB.prepare(
        `SELECT v.*, l.customer_name, l.phone, l.email, l.site_name lead_site, l.address lead_address, l.city, l.requirement, l.budget, l.customer_id, l.site_id, c.name customer_master, s.name site_master, s.address site_address, s.maps_url site_maps, u.name assigned_name
         FROM site_visits v
         JOIN leads l ON l.id = v.lead_id
         LEFT JOIN customers c ON c.id = l.customer_id
         LEFT JOIN customer_sites s ON s.id = l.site_id
         LEFT JOIN users u ON u.id = v.assigned_to
         WHERE v.id = ?`
      )
        .bind(id)
        .first<R>();
      if (!v) return Response.json({ error: "Site visit unavailable" }, { status: 404 });
      const files = (
        await env.DB.prepare(
          "SELECT * FROM attachments WHERE entity_type='site_visit' AND entity_id=? AND archived=0 ORDER BY created_at DESC"
        )
          .bind(id)
          .all()
      ).results;
      return Response.json({ visit: { ...v, survey: parse(v.survey, {}) }, files });
    }

    const where = ["1=1"];
    const args: any[] = [];
    const status = x.searchParams.get("status");
    const q = x.searchParams.get("q");
    if (status) {
      where.push("v.status = ?");
      args.push(status);
    }
    if (q) {
      where.push("(v.id LIKE ? OR l.customer_name LIKE ? OR l.phone LIKE ? OR l.site_name LIKE ? OR l.city LIKE ?)");
      for (let i = 0; i < 5; i++) args.push(`%${q}%`);
    }

    const rows = (
      await env.DB.prepare(
        `SELECT v.*, l.customer_name, l.phone, l.site_name, l.city, l.requirement, u.name assigned_name
         FROM site_visits v
         JOIN leads l ON l.id = v.lead_id
         LEFT JOIN users u ON u.id = v.assigned_to
         WHERE ${where.join(" AND ")}
         ORDER BY CASE WHEN v.status='Scheduled' THEN 0 ELSE 1 END, v.scheduled_at DESC`
      )
        .bind(...args)
        .all<R>()
    ).results;

    const leads = (
      await env.DB.prepare(
        "SELECT id, customer_name, phone, site_name, city, assigned_to FROM leads WHERE archived=0 AND lower(status) NOT IN('lost','cancelled') ORDER BY updated_at DESC LIMIT 500"
      ).all()
    ).results;

    const users = (
      await env.DB.prepare(
        "SELECT id, name, role FROM users WHERE active=1 AND role IN('admin','crm','sales','technician') ORDER BY name"
      ).all()
    ).results;

    return Response.json({ visits: rows, leads, users });
  } catch (e) {
    return e instanceof Response ? e : Response.json({ error: e instanceof Error ? e.message : "Unable to load site visits" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const u = await requireUser(["admin", "crm", "sales"]);
    const p = (await req.json()) as R;
    const t = now();

    // ACTION: Convert survey to an official draft quotation
    if (p.action === "convert-to-quote") {
      const visitId = p.visitId || p.id;
      const v = await env.DB.prepare(
        `SELECT v.*, l.customer_name, l.phone, l.email, l.site_name, l.address, l.city, l.customer_id, l.site_id, l.assigned_to lead_owner
         FROM site_visits v
         JOIN leads l ON l.id = v.lead_id
         WHERE v.id = ?`
      )
        .bind(visitId)
        .first<R>();

      if (!v) return Response.json({ error: "Site visit not found" }, { status: 404 });

      let customerId = v.customer_id;
      let siteId = v.site_id;

      // Ensure customer & site exist
      if (!customerId) {
        const custInsert = await env.DB.prepare(
          `INSERT INTO customers (name, phone, email, billing_address, city, state, pincode, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           RETURNING id`
        )
          .bind(
            v.customer_name || "Valued Client",
            v.phone || "",
            v.email || "",
            v.address || "",
            v.city || "Coimbatore",
            "Tamil Nadu",
            "641001",
            t
          )
          .first<{ id: number }>();

        if (custInsert) {
          customerId = custInsert.id;
          const siteInsert = await env.DB.prepare(
            `INSERT INTO customer_sites (id, customer_id, name, address, city, state, pincode, contact_name, contact_phone)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id`
          )
            .bind(
              `SITE-${Date.now().toString(36).toUpperCase()}`,
              customerId,
              v.site_name || `${v.customer_name}'s Residence`,
              v.address || "",
              v.city || "Coimbatore",
              "Tamil Nadu",
              "641001",
              v.customer_name || "",
              v.phone || ""
            )
            .first<{ id: string }>();

          if (siteInsert) siteId = siteInsert.id;
          await env.DB.prepare("UPDATE leads SET customer_id=?, site_id=?, updated_at=? WHERE id=?")
            .bind(customerId, siteId, t, v.lead_id)
            .run();
        }
      } else if (!siteId) {
        const existingSite = await env.DB.prepare(
          "SELECT id FROM customer_sites WHERE customer_id=? AND archived=0"
        )
          .bind(customerId)
          .first<R>();
        if (existingSite) {
          siteId = existingSite.id;
        } else {
          const siteInsert = await env.DB.prepare(
            `INSERT INTO customer_sites (id, customer_id, name, address, city, state, pincode, contact_name, contact_phone)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             RETURNING id`
          )
            .bind(
              `SITE-${Date.now().toString(36).toUpperCase()}`,
              customerId,
              v.site_name || "Main Site",
              v.address || "",
              v.city || "Coimbatore",
              "Tamil Nadu",
              "641001",
              v.customer_name || "",
              v.phone || ""
            )
            .first<{ id: string }>();
          if (siteInsert) siteId = siteInsert.id;
        }
        await env.DB.prepare("UPDATE leads SET site_id=?, updated_at=? WHERE id=?")
          .bind(siteId, t, v.lead_id)
          .run();
      }

      // Parse survey data
      const survey = parse(v.survey, {});
      const gate = survey.gateAutomation || {};
      const roomsSurvey = survey.walkthroughRooms || [];

      // Query active catalog variants
      const allVariants = (
        await env.DB.prepare(
          `SELECT v.id variant_id, v.sku, v.selling_price price, v.name, v.image_key, p.id product_id, p.name product_name, p.category, p.series, v.attributes
           FROM variants v
           JOIN products p ON p.id = v.product_id
           WHERE v.active=1 AND p.active=1`
        ).all<R>()
      ).results || [];

      const findProduct = (matcher: (item: R) => boolean, fallback: R): R => {
        const matched = allVariants.find(matcher);
        if (matched) {
          return {
            id: crypto.randomUUID(),
            productId: matched.product_id,
            variantId: matched.variant_id,
            name: matched.name || matched.product_name,
            sku: matched.sku,
            price: Number(matched.price || fallback.price),
            qty: fallback.qty || 1,
            gst: 18,
            taxMode: "GST",
            note: fallback.note || "",
            image: matched.image_key,
          };
        }
        return {
          id: crypto.randomUUID(),
          productId: null,
          variantId: null,
          name: fallback.name,
          sku: fallback.sku || `TCM-GEN-${Date.now().toString(36).toUpperCase()}`,
          price: fallback.price,
          qty: fallback.qty || 1,
          gst: 18,
          taxMode: "GST",
          note: fallback.note || "",
        };
      };

      const floors: R[] = [];
      const groundFloorRooms: R[] = [];

      // 1. GATE AUTOMATION
      if (gate.enabled) {
        const gateItems: R[] = [];
        const isSwing = /swing/i.test(gate.gateType || "");

        if (isSwing) {
          gateItems.push(
            findProduct(
              (item) => /swing.*kit/i.test(item.name),
              {
                name: `Noviq AUTOZON Swing Gate Operator Kit (${gate.dimensions?.weightKg || "800kg"} capacity)`,
                price: 57200,
                qty: 1,
                note: `For ${gate.gateType || "Swing Gate"}, ${gate.dimensions?.lengthFt || 14}ft x ${gate.dimensions?.heightFt || 6}ft`,
              }
            )
          );
        } else {
          gateItems.push(
            findProduct(
              (item) => /dc.*800kg.*kit|sliding.*kit/i.test(item.name),
              {
                name: `Noviq AUTOZON Sliding Gate DC Motor Kit (${gate.dimensions?.weightKg || "800kg"})`,
                price: 55200,
                qty: 1,
                note: `For Sliding Gate, ${gate.dimensions?.lengthFt || 16}ft width x ${gate.dimensions?.heightFt || 6}ft height`,
              }
            )
          );
        }

        if (gate.accessories?.photocellSensors !== false) {
          gateItems.push(
            findProduct(
              (item) => /photocell/i.test(item.name),
              {
                name: "Noviq AUTOZON Safety Infrared Photocell Sensor Pair",
                price: 7300,
                qty: 1,
                note: "Anti-collision obstacle safety sensors",
              }
            )
          );
        }

        if (gate.accessories?.flashingLamp) {
          gateItems.push(
            findProduct(
              (item) => /flash.*lamp/i.test(item.name),
              {
                name: "Noviq AUTOZON Flashing Warning Lamp",
                price: 3990,
                qty: 1,
                note: "Gate operation status indicator",
              }
            )
          );
        }

        const remotesCount = Number(gate.accessories?.remotesCount || 2);
        if (remotesCount > 0) {
          gateItems.push(
            findProduct(
              (item) => /double.*channel.*transmitter|remote/i.test(item.name),
              {
                name: "Noviq AUTOZON 2-Channel RF Remote Transmitter",
                price: 2170,
                qty: remotesCount,
                note: "Handheld gate remote control",
              }
            )
          );
        }

        if (!isSwing) {
          const rackMeters = Number(gate.trackLengthMeters || Math.ceil((Number(gate.dimensions?.lengthFt) || 16) * 0.3048) + 1);
          gateItems.push(
            findProduct(
              (item) => /rack/i.test(item.name),
              {
                name: "Heavy Duty Steel Galvanized Gear Rack (1 Meter Section)",
                price: 1650,
                qty: rackMeters,
                note: `${rackMeters} meters along gate track`,
              }
            )
          );
        }

        if (gate.accessories?.electricLock) {
          gateItems.push(
            findProduct(
              (item) => /electronic.*lock/i.test(item.name),
              {
                name: "Noviq AUTOZON Electronic Heavy Gate Lock",
                price: 15100,
                qty: 1,
                note: "High security automatic gate lock",
              }
            )
          );
        }

        groundFloorRooms.push({
          id: crypto.randomUUID(),
          name: "Entrance & Main Gate",
          note: `Gate: ${gate.gateType || "Sliding"} · Dimensions: ${gate.dimensions?.lengthFt || 16}ft W x ${gate.dimensions?.heightFt || 6}ft H · Power at pillar: ${gate.powerAtPillar || "Available"}`,
          items: gateItems,
        });
      }

      // 2. ROOM WALKTHROUGH
      for (const r of roomsSurvey) {
        const rItems: R[] = [];

        // Door lock
        if (r.doorLock?.required) {
          const lockFeatures = Array.isArray(r.doorLock.features)
            ? r.doorLock.features.join(", ")
            : "Fingerprint, RFID, PIN, App";
          rItems.push(
            findProduct(
              (item) => /al1.*lock|door.*lock/i.test(item.name),
              {
                name: "Noviq AL1 Aluminum / Wooden Profile Smart Door Lock",
                price: 10980,
                qty: 1,
                note: `Door: ${r.doorLock.doorType || "Standard Wooden"} · Features: ${lockFeatures}`,
              }
            )
          );
        }

        // Switchboards
        for (const sb of r.switchboards || []) {
          const mod = sb.moduleSize || "8M";
          const swCount = Number(sb.switches || 0);
          const fanCount = Number(sb.fans || 0);
          const hvCount = Number(sb.hvSwitches || 0);
          const plug16Count = Number(sb.plugs16A || 0);
          const plug5Count = Number(sb.plugs5A || 0);

          const modNum = parseInt(mod.replace(/[^0-9]/g, "")) || 8;
          const basePrice =
            modNum <= 2 ? 1850 : modNum <= 4 ? 2650 : modNum <= 6 ? 3450 : modNum <= 8 ? 4450 : modNum <= 12 ? 6250 : 7850;

          const descParts = [
            swCount > 0 ? `${swCount} Light Switch` : null,
            fanCount > 0 ? `${fanCount} Fan Speed` : null,
            hvCount > 0 ? `${hvCount} HV 16A/25A` : null,
            plug16Count > 0 ? `${plug16Count}x 16A Socket` : null,
            plug5Count > 0 ? `${plug5Count}x 5A Socket` : null,
          ]
            .filter(Boolean)
            .join(" + ") || "Smart Switch";

          rItems.push(
            findProduct(
              (item) =>
                (item.category === "Smart switches" || /switch/i.test(item.name)) &&
                new RegExp(`\\b${modNum}\\s*M`, "i").test(item.name),
              {
                name: `Noviq Smart Touch Switch ${mod} (${descParts})`,
                price: basePrice,
                qty: 1,
                note: `${sb.name || "Main Board"} · Finish: ${sb.finish || "Glass Touch"} · ${mod}`,
              }
            )
          );
        }

        // Curtains
        if (r.curtains?.required) {
          rItems.push(
            findProduct(
              (item) => /curtain.*motor/i.test(item.name),
              {
                name: "Noviq Heavy Duty Smart Curtain Motor (Zigbee/Wi-Fi)",
                price: 8900,
                qty: 1,
                note: `For ${r.name} · ${r.curtains.trackType || "Single Track"}`,
              }
            )
          );
          const trackLen = Number(r.curtains.lengthFt || 10);
          rItems.push(
            findProduct(
              (item) => /curtain.*track/i.test(item.name),
              {
                name: `Custom Motorized Curtain Track (${trackLen} Feet)`,
                price: trackLen * 450,
                qty: 1,
                note: `${trackLen} ft motorized track with ceiling brackets`,
              }
            )
          );
        }

        // Sensors
        if (r.sensors?.motionPir || r.sensors?.presenceRadar) {
          rItems.push(
            findProduct(
              (item) => /sensor|radar/i.test(item.name),
              {
                name: "Noviq mmWave Presence & Human Motion Radar Sensor",
                price: 3450,
                qty: 1,
                note: `Presence automation for ${r.name}`,
              }
            )
          );
        }

        groundFloorRooms.push({
          id: crypto.randomUUID(),
          name: r.name || "Room",
          note: `Surveyed for ${v.customer_name}`,
          items: rItems,
        });
      }

      if (groundFloorRooms.length === 0) {
        groundFloorRooms.push({
          id: crypto.randomUUID(),
          name: "Living Room",
          note: "Standard living room",
          items: [],
        });
      }

      floors.push({
        id: crypto.randomUUID(),
        name: "Ground Floor",
        rooms: groundFloorRooms,
      });

      let quoteTotal = 0;
      for (const fl of floors) {
        for (const rm of fl.rooms) {
          for (const it of rm.items) {
            quoteTotal += (Number(it.price) || 0) * (Number(it.qty) || 1);
          }
        }
      }

      const prefix = "QT";
      const start = 1145;
      const next = await env.DB.prepare(
        "SELECT COALESCE(MAX(CAST(substr(number,length(?)+2) AS INTEGER)),? - 1)+1 n FROM quotations WHERE number LIKE ?"
      )
        .bind(prefix, start, `${prefix}-%`)
        .first<{ n: number }>();
      const quoteNumber = `${prefix}-${next?.n || start}`;

      const quoteDate = t.slice(0, 10);
      const validUntil = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      const snapshot = {
        details: {
          title: `${v.customer_name} - ${v.site_name || "Smart Home Automation"}`,
          quoteType: "Detailed Smart Home Proposal",
          projectType: "Home / Villa",
          quoteDate,
          validUntil,
          introduction: `Thank you for having us for the on-site technical survey. Based on your site conditions, gate specifications, and room electrical layouts, we are pleased to submit this comprehensive automation proposal.`,
          internalNotes: `Auto-generated from Site Visit Survey ${v.id}. Includes gate automation and room switchboard configurations.`,
        },
        floors,
        paymentPlan: [
          { name: "Advance", percent: 50, condition: "Order confirmation & procurement" },
          { name: "Inception of Installation", percent: 20, condition: "On arrival of hardware at site" },
          { name: "On Handover", percent: 20, condition: "After system testing & commissioning" },
          { name: "One Month After Handover", percent: 10, condition: "Final sign-off & retention" },
        ],
        terms: "Prices are valid for 30 days. Standard warranty applies to all Noviq smart devices.",
        warranty: "Standard Products: 2+4 Years Warranty\nRoyal Edge & Touch Series: 10+10 Years Warranty",
        taxMode: "GST",
        pricingMode: "exclusive",
        quoteDiscount: 0,
      };

      const insertedQuote = await env.DB.prepare(
        `INSERT INTO quotations (number, revision, customer_id, site_id, title, quote_type, category, quote_date, valid_until, status, snapshot, total, sales_id, created_by, created_at, updated_at)
         VALUES (?, 0, ?, ?, ?, 'Detailed Smart Home Proposal', 'Smart Home Automation', ?, ?, 'Draft', ?, ?, ?, ?, ?, ?)
         RETURNING id`
      )
        .bind(
          quoteNumber,
          customerId,
          siteId,
          `${v.customer_name} - Smart Home Automation`,
          quoteDate,
          validUntil,
          JSON.stringify(snapshot),
          quoteTotal,
          v.assigned_to || u.id,
          u.id,
          t,
          t
        )
        .first<{ id: number }>();

      if (!insertedQuote) throw new Error("Failed to insert quotation");

      const batchStatements: any[] = [];
      for (let fi = 0; fi < floors.length; fi++) {
        const f = floors[fi];
        batchStatements.push(
          env.DB.prepare("INSERT INTO quotation_floors (id, quotation_id, name, sort_order) VALUES (?, ?, ?, ?)").bind(
            f.id,
            insertedQuote.id,
            f.name,
            fi
          )
        );
        for (let ri = 0; ri < f.rooms.length; ri++) {
          const rm = f.rooms[ri];
          batchStatements.push(
            env.DB.prepare("INSERT INTO quotation_rooms (id, floor_id, name, sort_order) VALUES (?, ?, ?, ?)").bind(
              rm.id,
              f.id,
              rm.name,
              ri
            )
          );
          for (let ii = 0; ii < rm.items.length; ii++) {
            const it = rm.items[ii];
            batchStatements.push(
              env.DB.prepare(
                `INSERT INTO quotation_items (id, quotation_id, room_id, product_id, variant_id, snapshot, quantity, unit_price, discount, tax_rate, tax_mode, installation, note, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              ).bind(
                it.id,
                insertedQuote.id,
                rm.id,
                it.productId || null,
                it.variantId || null,
                JSON.stringify(it),
                it.qty,
                it.price,
                0,
                18,
                "GST",
                0,
                it.note || null,
                ii
              )
            );
          }
        }
      }

      batchStatements.push(
        env.DB.prepare(
          "INSERT INTO quotation_revisions (id, quotation_id, revision, snapshot, created_by, created_at) VALUES (?, ?, 0, ?, ?, ?)"
        ).bind(crypto.randomUUID(), insertedQuote.id, JSON.stringify(snapshot), u.id, t)
      );

      await env.DB.batch(batchStatements);

      await env.DB.prepare(
        `UPDATE site_visits
         SET next_action='Quotation Created', visit_notes=COALESCE(visit_notes || ' · ', '') || ?, updated_at=?
         WHERE id=?`
      )
        .bind(`Quotation ${quoteNumber} created from survey`, t, v.id)
        .run();

      return Response.json(
        {
          ok: true,
          quotationId: insertedQuote.id,
          quotationNumber: quoteNumber,
          total: quoteTotal,
        },
        { status: 201 }
      );
    }

    // Default site visit creation
    if (!p.leadId || !p.scheduledAt) {
      return Response.json({ error: "Lead and schedule are required" }, { status: 400 });
    }
    const lead = await env.DB.prepare("SELECT * FROM leads WHERE id=? AND archived=0").bind(p.leadId).first<R>();
    if (!lead) return Response.json({ error: "Lead not found" }, { status: 404 });

    const assigned = p.assignedTo || lead.assigned_to || u.id;
    const id = `SV-${Date.now().toString(36).toUpperCase()}`;
    const survey = {
      visitType: p.visitType || "Initial Survey",
      purpose: p.purpose || lead.requirement || "",
      gateAutomation: {
        enabled: false,
        gateType: "Sliding Gate",
        dimensions: { lengthFt: 16, heightFt: 6, weightKg: "800kg" },
        powerAtPillar: "Yes - Available",
        accessories: {
          remotesCount: 2,
          photocellSensors: true,
          flashingLamp: true,
          electricLock: false,
        },
      },
      walkthroughRooms: [
        {
          id: "rm-1",
          name: "Entrance & Foyer",
          doorLock: {
            required: true,
            doorType: "Wooden (35-50mm)",
            features: ["Fingerprint", "PIN Code", "RFID Card", "Mobile App Unlock"],
          },
          switchboards: [
            {
              id: "sb-1",
              name: "Foyer Main Board",
              moduleSize: "4M",
              switches: 2,
              fans: 0,
              hvSwitches: 0,
              plugs5A: 1,
              plugs16A: 0,
              finish: "Glass Touch",
            },
          ],
        },
        {
          id: "rm-2",
          name: "Living Room",
          doorLock: { required: false },
          switchboards: [
            {
              id: "sb-2",
              name: "Living Main Entrance",
              moduleSize: "8M Horizontal",
              switches: 4,
              fans: 1,
              hvSwitches: 1,
              plugs5A: 1,
              plugs16A: 0,
              finish: "Glass Touch",
            },
            {
              id: "sb-3",
              name: "Living TV Console",
              moduleSize: "6M",
              switches: 2,
              fans: 0,
              hvSwitches: 0,
              plugs5A: 2,
              plugs16A: 1,
              finish: "Glass Touch",
            },
          ],
          curtains: {
            required: true,
            trackType: "Dual Track (Sheer + Main)",
            lengthFt: 14,
            powerPointNearTrack: true,
          },
        },
      ],
      checklist: [],
      items: [],
      rooms: [],
      measurements: [],
      customerPreferences: "",
      electrical: {},
      network: {},
      readiness: {},
      risks: [],
      recommendations: "",
    };

    await env.DB.prepare(
      `INSERT INTO site_visits(id, lead_id, scheduled_at, assigned_to, status, maps_url, visit_notes, survey, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'Scheduled', ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, p.leadId, p.scheduledAt, assigned, p.mapsUrl || lead.maps_url || null, p.visitNotes || null, JSON.stringify(survey), u.id, t, t)
      .run();

    await env.DB.prepare(
      `UPDATE leads SET status='Site Visit Scheduled', next_action='Site Visit', followup_at=?, last_activity_at=?, updated_at=? WHERE id=?`
    )
      .bind(p.scheduledAt, t, t, p.leadId)
      .run();

    return Response.json({ visit: { id } }, { status: 201 });
  } catch (e) {
    return e instanceof Response ? e : Response.json({ error: e instanceof Error ? e.message : "Unable to process site visit request" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const u = await requireUser(["admin", "crm", "sales", "technician"]);
    const p = (await req.json()) as R;
    const t = now();
    const v = await env.DB.prepare(
      `SELECT v.*, l.assigned_to lead_owner FROM site_visits v JOIN leads l ON l.id = v.lead_id WHERE v.id = ?`
    )
      .bind(p.id)
      .first<R>();

    if (!v) return Response.json({ error: "Site visit unavailable" }, { status: 404 });

    const status = p.action === "complete" ? "Completed" : p.action === "cancel" ? "Cancelled" : p.status || v.status;
    if (p.action === "complete" && !p.visitNotes) {
      return Response.json({ error: "Visit outcome notes are required before completion" }, { status: 400 });
    }

    await env.DB.prepare(
      `UPDATE site_visits
       SET scheduled_at = COALESCE(?, scheduled_at),
           assigned_to = COALESCE(?, assigned_to),
           status = ?,
           maps_url = COALESCE(?, maps_url),
           visit_notes = ?,
           requirement_confirmation = ?,
           budget_confirmation = ?,
           expected_quote_date = ?,
           next_action = ?,
           next_followup_at = ?,
           survey = ?,
           completed_at = CASE WHEN ?='Completed' THEN ? ELSE completed_at END,
           updated_at = ?
       WHERE id = ?`
    )
      .bind(
        p.scheduledAt || null,
        p.assignedTo || null,
        status,
        p.mapsUrl || null,
        p.visitNotes ?? v.visit_notes,
        p.requirementConfirmation || null,
        p.budgetConfirmation || null,
        p.expectedQuoteDate || null,
        p.nextAction || null,
        p.nextFollowupAt || null,
        JSON.stringify(p.survey || parse(v.survey, {})),
        status,
        t,
        t,
        p.id
      )
      .run();

    if (status === "Completed") {
      await env.DB.prepare(
        `UPDATE leads SET status='Site Visit Done', next_action=?, followup_at=?, last_activity_at=?, updated_at=? WHERE id=?`
      )
        .bind(p.nextAction || "Prepare Quote", p.nextFollowupAt || p.expectedQuoteDate || null, t, t, v.lead_id)
        .run();
    }

    return Response.json({ ok: true, status, updatedAt: t });
  } catch (e) {
    return e instanceof Response ? e : Response.json({ error: e instanceof Error ? e.message : "Unable to update site visit" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser(["admin"]);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return Response.json({ error: "Site visit ID is required" }, { status: 400 });
    await env.DB.batch([
      env.DB.prepare("DELETE FROM attachments WHERE entity_type='site_visit' AND entity_id=?").bind(id),
      env.DB.prepare("DELETE FROM site_visits WHERE id=?").bind(id),
    ]);
    return Response.json({ ok: true });
  } catch (e) {
    return e instanceof Response ? e : Response.json({ error: e instanceof Error ? e.message : "Unable to delete site visit" }, { status: 500 });
  }
}

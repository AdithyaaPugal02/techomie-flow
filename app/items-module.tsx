"use client";
import { useEffect, useState } from "react";
type R = Record<string, any>;
const money = (v: any) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));
const imageUrl = (v: string) =>
  v?.startsWith("/") ? v : `/api/uploads/${v}`;
const blank = {
  name: "",
  variantName: "",
  category: "Smart Switches",
  subcategory: "",
  brand: "Noviq",
  series: "",
  sku: "",
  supplierSku: "",
  itemType: "Product",
  technology: "ZigBee",
  material: "Glass",
  finish: "",
  description: "",
  hsn: "8536",
  unit: "Nos",
  taxRate: "18",
  warranty: "2 Years",
  sellingPrice: "",
  purchaseCost: "",
  minimumPrice: "",
  imageKey: "",
  active: true,
};
export default function ItemsModule({ isAdmin }: { isAdmin: boolean }) {
  const [items, setItems] = useState<R[]>([]),
    [meta, setMeta] = useState({ page: 1, pages: 1, total: 0, limit: 25 }),
    [opts, setOpts] = useState<R[]>([]),
    [f, setF] = useState({
      q: "",
      category: "",
      subcategory: "",
      brand: "",
      technology: "",
      type: "",
      active: "active",
      gst: "",
      image: "",
      minPrice: "",
      maxPrice: "",
      page: "1",
      limit: "25",
    }),
    [detail, setDetail] = useState<R | null>(null),
    [edit, setEdit] = useState<R | null>(null),
    [msg, setMsg] = useState("");
  const load = async () => {
    const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    const r = await fetch(`/api/products?${p}`),
      d = await r.json();
    if (r.ok) {
      setItems(d.items);
      setMeta(d.pagination);
      setOpts(d.filters || []);
    } else setMsg(d.error);
  };
  useEffect(() => {
    const x = setTimeout(load, f.q ? 200 : 0);
    return () => clearTimeout(x);
  }, [f]);
  const open = async (id: any) => {
    const r = await fetch(`/api/products?id=${id}`),
      d = await r.json();
    if (r.ok) setDetail(d);
  };
  const save = async () => {
    if (!edit) return;
    const body = {
        ...edit,
        sellingPrice: Number(edit.sellingPrice),
        purchaseCost: Number(edit.purchaseCost),
        minimumPrice: edit.minimumPrice ? Number(edit.minimumPrice) : null,
        taxRate: Number(edit.taxRate),
        attributes: {
          itemType: edit.itemType,
          technology: edit.technology,
          material: edit.material,
          finish: edit.finish,
          supplierSku: edit.supplierSku,
        },
      },
      r = await fetch("/api/products", {
        method: edit.variantId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      d = await r.json();
    if (!r.ok) return setMsg(d.error);
    setEdit(null);
    setMsg("Item saved");
    load();
  };
  const upload = async (file: File) => {
    if (!edit) return;
    const x = new FormData();
    x.set("image", file);
    const r = await fetch("/api/uploads", { method: "POST", body: x }),
      d = await r.json();
    if (r.ok) setEdit({ ...edit, imageKey: String(d.url).split("/").pop() });
    else setMsg(d.error);
  };
  const archive = async (v: R) => {
    if (
      !confirm(
        "Archive this item? Existing quotation history will remain permanent.",
      )
    )
      return;
    await fetch("/api/products", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ variantId: v.variant_id, action: "archive" }),
    });
    setDetail(null);
    setMsg("Item archived");
    load();
  };
  const categories = [...new Set(opts.map((x) => x.category).filter(Boolean))],
    subs = [...new Set(opts.map((x) => x.subcategory).filter(Boolean))],
    brands = [...new Set(opts.map((x) => x.brand).filter(Boolean))];
  return (
    <div className="itemsmaster">
      <div className="itemshero">
        <div>
          <small>SELLABLE MASTER LIST</small>
          <h1>Items</h1>
          <p>
            Products, accessories, installation charges and service items with
            practical variant configuration.
          </p>
        </div>
        {isAdmin && (
          <button className="primary" onClick={() => setEdit({ ...blank })}>
            ＋ Add Item
          </button>
        )}
      </div>
      {msg && (
        <div className="itemsmsg">
          {msg}
          <button onClick={() => setMsg("")}>×</button>
        </div>
      )}
      <div className="itemsfilters">
        <label className="itemssearch">
          ⌕
          <input
            value={f.q}
            onChange={(e) => setF({ ...f, q: e.target.value, page: "1" })}
            placeholder="Item, variant, SKU, brand, category or HSN/SAC"
          />
        </label>
        {[
          ["category", categories],
          ["subcategory", subs],
          ["brand", brands],
          ["technology", ["ZigBee", "Wi-Fi", "Matter", "Other"]],
          ["type", ["Product", "Installation", "Service"]],
          ["active", ["active", "inactive"]],
          ["gst", ["0", "5", "12", "18", "28"]],
          ["image", ["yes", "no"]],
        ].map(([k, a]: any) => (
          <select
            key={k}
            value={(f as R)[k]}
            onChange={(e) => setF({ ...f, [k]: e.target.value, page: "1" })}
          >
            <option value="">{k}</option>
            {a.map((x: string) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        ))}
        <input
          type="number"
          placeholder="Min ₹"
          value={f.minPrice}
          onChange={(e) => setF({ ...f, minPrice: e.target.value })}
        />
        <input
          type="number"
          placeholder="Max ₹"
          value={f.maxPrice}
          onChange={(e) => setF({ ...f, maxPrice: e.target.value })}
        />
        <button
          onClick={() =>
            setF({
              ...f,
              q: "",
              category: "",
              subcategory: "",
              brand: "",
              technology: "",
              type: "",
              active: "",
              gst: "",
              image: "",
              minPrice: "",
              maxPrice: "",
              page: "1",
            })
          }
        >
          Clear filters
        </button>
      </div>
      <div className="itemstable">
        <div className={`itemsrow itemshead ${isAdmin ? "admin" : ""}`}>
          <span>Image</span>
          <span>Item</span>
          <span>Category / Brand</span>
          <span>SKU / Base configuration</span>
          <span>Selling price</span>
          {isAdmin && (
            <>
              <span>Buying</span>
              <span>Margin</span>
            </>
          )}
          <span>GST / Warranty</span>
          <span>Status / Updated</span>
          <span>Actions</span>
        </div>
        {items.map((x) => {
          const a =
            typeof x.attributes === "string"
              ? JSON.parse(x.attributes || "{}")
              : x.attributes || {};
          return (
            <button
              key={x.variant_id}
              className={`itemsrow ${isAdmin ? "admin" : ""}`}
              onClick={() => open(x.variant_id)}
            >
              <span className="itemimage">
                {x.image_key ? (
                  <img src={imageUrl(x.image_key)} alt="" />
                ) : (
                  <i>No image</i>
                )}
              </span>
              <span>
                <b>{x.name}</b>
                <small>{x.variant_name}</small>
              </span>
              <span>
                <b>{x.category}</b>
                <small>
                  {x.brand} · {x.subcategory || "—"}
                </small>
              </span>
              <span>
                <b>{x.sku}</b>
                <small>
                  {[a.technology, a.material, a.finish]
                    .filter(Boolean)
                    .join(" · ") ||
                    x.series ||
                    "Base item"}
                </small>
              </span>
              <span>
                <b>{money(x.selling_price)}</b>
              </span>
              {isAdmin && (
                <>
                  <span>
                    <b>{money(x.purchase_cost)}</b>
                  </span>
                  <span>
                    <b>{money(x.margin)}</b>
                    <small>{Number(x.marginPercent).toFixed(1)}%</small>
                  </span>
                </>
              )}
              <span>
                <b>{x.tax_rate}%</b>
                <small>{x.warranty || "—"}</small>
              </span>
              <span>
                <em>{x.active ? "Active" : "Inactive"}</em>
                <small>{String(x.updated_at || "").slice(0, 10)}</small>
              </span>
              <span>
                <strong>Open →</strong>
              </span>
            </button>
          );
        })}
      </div>
      <div className="itempages">
        <span>{meta.total} items</span>
        <select
          value={f.limit}
          onChange={(e) => setF({ ...f, limit: e.target.value, page: "1" })}
        >
          {["25", "50", "100"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <button
          disabled={meta.page <= 1}
          onClick={() => setF({ ...f, page: String(meta.page - 1) })}
        >
          Previous
        </button>
        <span>
          Page {meta.page} / {meta.pages}
        </span>
        <button
          disabled={meta.page >= meta.pages}
          onClick={() => setF({ ...f, page: String(meta.page + 1) })}
        >
          Next
        </button>
      </div>
      {detail && (
        <ItemDetail
          d={detail}
          admin={isAdmin}
          close={() => setDetail(null)}
          edit={() => {
            const x = detail.item,
              a =
                typeof x.attributes === "string"
                  ? JSON.parse(x.attributes || "{}")
                  : x.attributes || {};
            setEdit({
              variantId: x.variant_id,
              name: x.name,
              variantName: x.variant_name,
              category: x.category,
              subcategory: x.subcategory || "",
              brand: x.brand,
              series: x.series || "",
              sku: x.sku,
              supplierSku: a.supplierSku || "",
              itemType: a.itemType || "Product",
              technology: a.technology || "",
              material: a.material || "",
              finish: a.finish || "",
              description: x.description || "",
              hsn: x.variant_hsn || x.hsn || "",
              unit: x.unit,
              taxRate: x.variant_tax || x.tax_rate,
              warranty: x.variant_warranty || x.warranty || "",
              sellingPrice: x.selling_price,
              purchaseCost: x.purchase_cost || 0,
              minimumPrice: x.minimum_price || "",
              imageKey: x.image_key || "",
              active: !!x.variant_active,
            });
          }}
          archive={() => archive(detail.item)}
        />
      )}{" "}
      {edit && (
        <ItemForm
          v={edit}
          set={setEdit}
          close={() => setEdit(null)}
          save={save}
          upload={upload}
        />
      )}
    </div>
  );
}
function ItemDetail({
  d,
  admin,
  close,
  edit,
  archive,
}: {
  d: R;
  admin: boolean;
  close: () => void;
  edit: () => void;
  archive: () => void;
}) {
  const x = d.item,
    a =
      typeof x.attributes === "string"
        ? JSON.parse(x.attributes || "{}")
        : x.attributes || {};
  return (
    <div className="itemdrawer">
      <header>
        <div>
          <small>{x.sku}</small>
          <h2>{x.name}</h2>
          <p>{x.variant_name}</p>
        </div>
        <button onClick={close}>×</button>
      </header>
      <main>
        <div className="itemdetailtop">
          <div className="gallery">
            {x.image_key ? (
              <img src={imageUrl(x.image_key)} alt={x.name} />
            ) : (
              <span>No product image</span>
            )}
          </div>
          <section>
            <em>
              {x.category} · {x.subcategory || "General"}
            </em>
            <h3>{x.brand}</h3>
            <p>
              {x.description || x.short_description || "No description added."}
            </p>
            <div className="variantchips">
              {Object.entries(a)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span key={k}>
                    {k}: {String(v)}
                  </span>
                ))}
            </div>
            <b className="sellprice">{money(x.selling_price)}</b>
            {admin && (
              <p>
                Buying {money(x.purchase_cost)} · Margin {money(x.margin)} (
                {Number(x.marginPercent).toFixed(1)}%)
              </p>
            )}
          </section>
        </div>
        <div className="itemfacts">
          {[
            ["HSN/SAC", x.variant_hsn || x.hsn],
            ["GST", `${x.variant_tax || x.tax_rate}%`],
            ["Unit", x.unit],
            ["Warranty", x.variant_warranty || x.warranty],
            ["Status", x.variant_active ? "Active" : "Inactive"],
            ["Updated", String(x.updated_at).slice(0, 10)],
          ].map((v) => (
            <div key={v[0]}>
              <small>{v[0]}</small>
              <b>{v[1] || "—"}</b>
            </div>
          ))}
        </div>
        <h3>Available variants</h3>
        <div className="variantrecords">
          {d.variants.map((v: R) => (
            <article key={v.id}>
              <span>
                <b>{v.name}</b>
                <small>{v.sku}</small>
              </span>
              <strong>{money(v.selling_price)}</strong>
            </article>
          ))}
        </div>
        {admin && (
          <>
            <h3>Quotation usage history</h3>
            <div className="variantrecords">
              {d.usage.length ? (
                d.usage.map((u: R) => (
                  <article key={u.quotation_id}>
                    <span>
                      <b>{u.number}</b>
                      <small>
                        {u.status} · Qty {u.quantity}
                      </small>
                    </span>
                    <strong>{money(u.unit_price)}</strong>
                  </article>
                ))
              ) : (
                <p>No quotation usage yet.</p>
              )}
            </div>
          </>
        )}
      </main>
      {admin && (
        <footer>
          <button onClick={archive}>Archive</button>
          <button className="primary" onClick={edit}>
            Edit item & variants
          </button>
        </footer>
      )}
    </div>
  );
}
function ItemForm({
  v,
  set,
  close,
  save,
  upload,
}: {
  v: R;
  set: (x: R) => void;
  close: () => void;
  save: () => void;
  upload: (f: File) => void;
}) {
  const field = (k: string, l: string, type = "text") => (
    <label>
      <span>{l}</span>
      <input
        type={type}
        value={v[k] ?? ""}
        onChange={(e) =>
          set({
            ...v,
            [k]: type === "checkbox" ? e.target.checked : e.target.value,
          })
        }
      />
    </label>
  );
  return (
    <div className="modalback">
      <div className="itemmodal">
        <header>
          <h2>{v.variantId ? "Edit Item" : "Add Item"}</h2>
          <button onClick={close}>×</button>
        </header>
        <div className="itemform">
          {field("name", "Item name *")}
          {field("variantName", "Base configuration / variant")}
          <label>
            <span>Techomie SKU</span>
            <input readOnly value={v.sku || "Generated automatically after save"} />
            <small>Unique company code generated from category, brand, series, module, technology and material.</small>
          </label>
          {field("supplierSku", "Supplier model / reference")}
          {field("category", "Category")}
          {field("subcategory", "Sub-category")}
          {field("brand", "Brand")}
          {field("series", "Series")}
          <label>
            <span>Item type</span>
            <select
              value={v.itemType}
              onChange={(e) => set({ ...v, itemType: e.target.value })}
            >
              {["Product", "Installation", "Service"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Technology</span>
            <select
              value={v.technology}
              onChange={(e) => set({ ...v, technology: e.target.value })}
            >
              {["", "ZigBee", "Wi-Fi", "Matter", "Other"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          {v.itemType === "Product" && field("material", "Material")}
          {v.itemType === "Product" && field("finish", "Finish / colour")}
          <label className="wide">
            <span>Description</span>
            <textarea
              value={v.description}
              onChange={(e) => set({ ...v, description: e.target.value })}
            />
          </label>
          {field("hsn", "HSN/SAC")}
          {field("unit", "Unit")}
          {field("taxRate", "GST %", "number")}
          {field("warranty", "Warranty")}
          {field("sellingPrice", "Selling price *", "number")}
          {field("purchaseCost", "Buying price *", "number")}
          {field("minimumPrice", "Minimum price", "number")}
          <label>
            <span>Upload / replace image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
          </label>
        </div>
        <footer>
          <button onClick={close}>Cancel</button>
          <button className="primary" onClick={save}>
            Save item
          </button>
        </footer>
      </div>
    </div>
  );
}

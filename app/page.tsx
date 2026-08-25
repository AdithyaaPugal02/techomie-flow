"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { catalog } from "./catalog-data";
import InvoiceModule from "./invoice-module";
import OverviewModule from "./overview-module";
import LeadsModule from "./leads-module";
import CustomersModule from "./customers-module";
import ItemMasterModule from "./item-master-module";
import ProjectsModule from "./projects-module";
import SettingsModule from "./settings-module";
import QuotationsModule from "./quotations-module";
import ExpensesModule from "./expenses-module";
import SiteVisitsModule from "./site-visits-module";

const products = catalog.map((p) => ({
  ...p,
  price: p.sellingPrice,
  variant: `${p.module} · ${p.technology} · ${p.finish}`,
  icon:
    p.category === "Door locks"
      ? "▥"
      : p.category === "Gateways"
        ? "◉"
        : p.category === "Security"
          ? "◫"
          : p.category === "Retrofit modules"
            ? "⌁"
            : "▦",
}));
type Product = (typeof products)[number];
type QuoteItem = Product & {
  qty: number;
  note?: string;
  discount?: number;
  taxMode?: "GST" | "Non-GST";
  gstRate?: number;
};
type ProductGroup = {
  key: string;
  name: string;
  category: string;
  series: string;
  module: string;
  variants: Product[];
};
const baseProducts = Array.from(
  products
    .reduce((groups, p) => {
      const key = [p.category, p.series, p.name, p.module].join("|");
      const group = groups.get(key);
      if (group) group.variants.push(p);
      else
        groups.set(key, {
          key,
          name: p.name,
          category: p.category,
          series: p.series,
          module: p.module,
          variants: [p],
        });
      return groups;
    }, new Map<string, ProductGroup>())
    .values(),
);

const initialRooms = [
  {
    name: "Living room",
    floor: "Ground floor",
    items: [
      { ...products[0], qty: 3 },
      { ...products[4], qty: 1 },
    ],
  },
  {
    name: "Master bedroom",
    floor: "First floor",
    items: [
      { ...products[1], qty: 2 },
      { ...products[6], qty: 1 },
    ],
  },
  {
    name: "Entrance",
    floor: "Ground floor",
    items: [{ ...products[5], qty: 1 }],
  },
];

const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export default function Home() {
  const [auth, setAuth] = useState<{
    loading: boolean;
    setupRequired: boolean;
    user: null | { name: string; email: string; role: string };
  }>({ loading: true, setupRequired: false, user: null });
  const [rooms, setRooms] = useState(initialRooms);
  const [activeRoom, setActiveRoom] = useState(0);
  const [module, setModule] = useState("Overview");
  const [moduleFilter, setModuleFilter] = useState<Record<string, string>>({});
  const [quoteScreen, setQuoteScreen] = useState<"list" | "detail">("list");
  const [savedQuoteId, setSavedQuoteId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [moduleSize, setModuleSize] = useState("All module sizes");
  const [notice, setNotice] = useState("All changes saved");
  const [mobileNav, setMobileNav] = useState(false);
  const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
  const [globalSearch,setGlobalSearch]=useState("");
  const [searchResults,setSearchResults]=useState<{module:string;title:string;detail:string;id:string}[]>([]);
  const [quickOpen,setQuickOpen]=useState(false);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [quoteSetup, setQuoteSetup] = useState(false);
  const [configure, setConfigure] = useState<ProductGroup | null>(null);
  const [productPicker, setProductPicker] = useState(false);
  const [editingLine, setEditingLine] = useState<{
    room: number;
    index: number;
    item: QuoteItem;
  } | null>(null);
  const [quoteDetails, setQuoteDetails] = useState({
    customer: "",
    customerId: "",
    site: "",
    siteId: "",
    projectTitle: "",
    category: "Smart Home Automation",
    pricingMode: "exclusive",
    sales: auth.user?.name || "",
    validity: "30",
    type: "Standard Product Quotation",
  });
  const filtered = baseProducts.filter(
    (g) =>
      (category === "All" || g.category === category) &&
      (moduleSize === "All module sizes" || g.module === moduleSize) &&
      `${g.name} ${g.series} ${g.module} ${g.variants.map((v) => `${v.sku} ${v.supplierSku} ${v.technology} ${v.finish}`).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const allItems = rooms.flatMap((r) => r.items);
  const lineBase = (p: QuoteItem) => p.price * p.qty;
  const lineTaxable = (p: QuoteItem) =>
    lineBase(p) * (1 - (p.discount || 0) / 100);
  const lineTax = (p: QuoteItem) =>
    p.taxMode === "Non-GST"
      ? 0
      : lineTaxable(p) * ((p.gstRate ?? p.gst ?? 18) / 100);
  const subtotal = allItems.reduce((s, p) => s + lineBase(p), 0);
  const discountTotal = allItems.reduce(
    (s, p) => s + (lineBase(p) - lineTaxable(p)),
    0,
  );
  const taxable = allItems.reduce((s, p) => s + lineTaxable(p), 0);
  const tax = Math.round(allItems.reduce((s, p) => s + lineTax(p), 0));
  const total = taxable + tax;
  const add = (p: (typeof products)[number]) => {
    setRooms((rs) =>
      rs.map((r, i) =>
        i === activeRoom
          ? {
              ...r,
              items: [
                ...r.items,
                {
                  ...p,
                  qty: 1,
                  discount: 0,
                  taxMode: "GST" as const,
                  gstRate: p.gst || 18,
                },
              ],
            }
          : r,
      ),
    );
    setNotice(`${p.name} added`);
    setTimeout(() => setNotice("All changes saved"), 1500);
  };
  const addConfigured = (
    p: Product,
    qty: number,
    configuration: string,
    installation: number,
  ) => {
    const item = {
      ...p,
      price: p.price + installation,
      variant: configuration,
      qty,
      discount: 0,
      taxMode: "GST" as const,
      gstRate: p.gst || 18,
    };
    setRooms((rs) =>
      rs.map((r, i) =>
        i === activeRoom ? { ...r, items: [...r.items, item] } : r,
      ),
    );
    setConfigure(null);
    setProductPicker(false);
    setNotice(`${p.name} configured and added`);
    setTimeout(() => setNotice("All changes saved"), 1800);
  };
  const changeQty = (idx: number, d: number) =>
    setRooms((rs) =>
      rs.map((r, i) =>
        i === activeRoom
          ? {
              ...r,
              items: r.items.map((p, j) =>
                j === idx ? { ...p, qty: Math.max(1, p.qty + d) } : p,
              ),
            }
          : r,
      ),
    );
  const removeItem = (idx: number) => {
    setRooms((rs) =>
      rs.map((r, i) =>
        i === activeRoom
          ? { ...r, items: r.items.filter((_, j) => j !== idx) }
          : r,
      ),
    );
    setNotice("Item removed");
  };
  const copyItemToRoom = (idx: number) => {
    if (rooms.length < 2) { setNotice("Add another room before copying"); return; }
    const target = (activeRoom + 1) % rooms.length;
    const item = { ...rooms[activeRoom].items[idx] };
    setRooms((rs) => rs.map((r, i) => i === target ? { ...r, items: [...r.items, item] } : r));
    setNotice(`Copied to ${rooms[target].name}`);
  };
  const saveItem = (item: QuoteItem) => {
    if (!editingLine) return;
    setRooms((rs) =>
      rs.map((r, i) =>
        i === editingLine.room
          ? {
              ...r,
              items: r.items.map((p, j) =>
                j === editingLine.index ? item : p,
              ),
            }
          : r,
      ),
    );
    setEditingLine(null);
    setNotice("Quotation item updated");
  };
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(baseProducts.map((p) => p.category)))],
    [],
  );
  const moduleSizes = useMemo(
    () => [
      "All module sizes",
      ...Array.from(
        new Set(baseProducts.map((p) => p.module).filter(Boolean)),
      ).sort(),
    ],
    [],
  );
  const addRoom = () => {
    setRooms((r) => [
      ...r,
      { name: `New room ${r.length + 1}`, floor: "Ground floor", items: [] },
    ]);
    setActiveRoom(rooms.length);
    setNotice("Room added");
  };
  const saveQuotation = async (send = false) => {
    if (!quoteDetails.customerId || !quoteDetails.siteId || !quoteDetails.projectTitle) { setQuoteSetup(true); setNotice("Select customer, site and project title first"); return; }
    const floors = Array.from(new Set(rooms.map(r=>r.floor))).map(floor=>({name:floor,rooms:rooms.filter(r=>r.floor===floor).map(r=>({name:r.name,items:r.items.map(i=>({...i,price:i.price,gst:i.gstRate??i.gst??18}))}))}));
    try {
      let id=savedQuoteId;
      if(!id){const response=await fetch("/api/quotations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({customerId:Number(quoteDetails.customerId),siteId:quoteDetails.siteId,title:quoteDetails.projectTitle,quoteType:quoteDetails.type,category:quoteDetails.category,pricingMode:quoteDetails.pricingMode,floors,total,details:quoteDetails})}),data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to save quotation");id=data.quotation.id;setSavedQuoteId(id);setNotice(`${data.quotation.number} saved as draft`)}
      if(send&&id){const response=await fetch("/api/quotations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action:"send"})}),data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to send quotation");setNotice("Quotation marked sent with an immutable revision snapshot")}
    } catch(e){setNotice(e instanceof Error?e.message:"Unable to save quotation")}
  };
  const downloadPdf = async () => {
    const workspace = document.querySelector(".workspace") as HTMLElement | null;
    if (!workspace) return;
    setNotice("Preparing PDF download…");
    workspace.classList.add("pdfexport");
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const filename = `Techomie-${quoteDetails.customer || "Quotation"}-${quoteDetails.site || "Proposal"}`.replace(/[^a-z0-9-]+/gi, "-") + ".pdf";
      await html2pdf().set({ margin: [8, 8, 8, 8], filename, image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["css", "legacy"] } }).from(workspace).save();
      setNotice("PDF downloaded");
    } catch {
      setNotice("Unable to download PDF");
    } finally {
      workspace.classList.remove("pdfexport");
      setTimeout(() => setNotice("All changes saved"), 1800);
    }
  };
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) =>
        setAuth({
          loading: false,
          setupRequired: d.setupRequired,
          user: d.user,
        }),
      )
      .catch(() => setAuth((a) => ({ ...a, loading: false })));
  }, []);
  useEffect(()=>{const saved=window.localStorage.getItem("techomie-sidebar-collapsed");setSidebarCollapsed(saved==="1")},[]);
  useEffect(()=>{window.localStorage.setItem("techomie-sidebar-collapsed",sidebarCollapsed?"1":"0")},[sidebarCollapsed]);
  useEffect(()=>{
    const syncModuleFromUrl=()=>{const requested=new URLSearchParams(window.location.search).get("module");if(requested)setModule(requested)};
    syncModuleFromUrl();
    window.addEventListener("popstate",syncModuleFromUrl);
    return()=>window.removeEventListener("popstate",syncModuleFromUrl);
  },[]);
  useEffect(()=>{if(globalSearch.trim().length<2){setSearchResults([]);return}const timer=window.setTimeout(async()=>{const q=encodeURIComponent(globalSearch.trim()),sources=[
    ["Leads",`/api/leads?q=${q}`],["Customers",`/api/customers?q=${q}`],["Quotations",`/api/quotations?q=${q}`],["Projects",`/api/projects?q=${q}`],["Invoices",`/api/invoices?q=${q}`],["Items",`/api/products?q=${q}`]
  ] as const;const found=(await Promise.all(sources.map(async([module,url])=>{try{const r=await fetch(url);if(!r.ok)return[];const d=await r.json(),rows=d.leads||d.customers||d.quotations||d.projects||d.invoices||d.items||[];return rows.slice(0,4).map((x:Record<string,unknown>)=>({module,title:String(x.customerName||x.customer_name||x.name||x.title||x.number||x.invoice_number||x.sku||"Record"),detail:String(x.phone||x.site_name||x.number||x.sku||x.status||""),id:String(x.id||x.variant_id||"")}))}catch{return[]}}))).flat().slice(0,12);setSearchResults(found)},220);return()=>window.clearTimeout(timer)},[globalSearch]);
  useEffect(() => {
    if (!auth.user) {
      setLeadCount(null);
      return;
    }
    let active = true;
    const loadLeadCount = () =>
      fetch("/api/leads?page=1&limit=10")
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (active && data?.pagination) setLeadCount(Number(data.pagination.total) || 0);
        })
        .catch(() => undefined);
    loadLeadCount();
    const refresh = () => loadLeadCount();
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(loadLeadCount, 30000);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, [auth.user, module]);
  if (auth.loading)
    return (
      <div className="authpage">
        <div className="authcard">
          <div className="brandmark">N</div>
          <h1>Techomie OS</h1>
          <p>Preparing your secure workspace…</p>
        </div>
      </div>
    );
  if (!auth.user)
    return (
      <AuthScreen
        setup={auth.setupRequired}
        onSuccess={() =>
          fetch("/api/auth/status")
            .then((r) => r.json())
            .then((d) =>
              setAuth({ loading: false, setupRequired: false, user: d.user }),
            )
        }
      />
    );
  const role=auth.user.role;
  const allNavigation=[
    {icon:"⌂",name:"Overview",roles:["admin","crm","sales"]},
    {icon:"◎",name:"Leads",label:role==="sales"?"My leads":"Leads",roles:["admin","crm","sales"]},
    {icon:"⌖",name:"Site Visits",roles:["admin","crm","sales","technician"]},
    {icon:"♙",name:"Customers",roles:["admin","crm","sales","technician"]},
    {icon:"✦",name:"Quotations",roles:["admin","crm","sales"]},
    {icon:"◇",name:"Projects",label:role==="technician"?"Assigned projects":"Projects",roles:["admin","crm","sales","technician"]},
    {icon:"✓",name:"Tasks",label:role==="technician"?"My tasks":"Tasks",roles:["admin","crm","sales","technician"]},
    {icon:"₹",name:"Invoices",roles:["admin"]},
    {icon:"₹",name:"Payments",roles:["admin"]},
    {icon:"₹",name:"Expenses",label:role==="admin"?"Company expenses":"My expenses",roles:["admin","sales","technician"]},
    {icon:"◫",name:"Items",roles:["admin","crm","sales","technician"]},
    {icon:"⌑",name:"Procurement",roles:["admin"]},
    {icon:"⚒",name:"Service",label:"Service & warranty",roles:["admin","sales","technician"]},
    {icon:"▤",name:"Reports",roles:["admin"]},
    {icon:"⚙",name:"Settings",roles:["admin","crm","sales","technician"]},
  ].filter(x=>x.roles.includes(role));
  const moduleHref=(target:string)=>`/?module=${encodeURIComponent(target)}`;
  const navigate=(target:string,filter:Record<string,string>={})=>{setModuleFilter(filter);setModule(target);if(target==="Quotations")setQuoteScreen("list");setMobileNav(false);setGlobalSearch("");setSearchResults([]);window.history.pushState(null,"",moduleHref(target))};
  const quickActions=[
    {label:"New lead",module:"Leads",roles:["admin","crm","sales"]},{label:"Schedule site visit",module:"Site Visits",roles:["admin","crm","sales"]},{label:"New customer",module:"Customers",roles:["admin","crm","sales"]},{label:"New quotation",module:"Quotations",roles:["admin","crm","sales"]},{label:"New project",module:"Projects",roles:["admin","sales"]},{label:"New invoice",module:"Invoices",roles:["admin"]},{label:"Add expense",module:"Expenses",roles:["admin","sales","technician"]},{label:"Add item",module:"Items",roles:["admin"]},{label:"Create service ticket",module:"Service",roles:["admin","sales","technician"]}
  ].filter(x=>x.roles.includes(role));
  return (
    <main className={`shell ${sidebarCollapsed?"navcollapsed":""}`}>
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <img src="/techomie-logo.jpg" alt="Techomie" />
          <span>
            <b>TECHOMIE</b>
            <small>OPERATIONS</small>
          </span>
        </div>
        <nav>
          {allNavigation.map(({icon:i,name:n,label}) => (
            <a
              key={n}
              href={moduleHref(n)}
              title={sidebarCollapsed?(label||n):undefined}
              onClick={(event) => {if(event.button===0&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey){event.preventDefault();navigate(n)}}}
              className={n === module ? "selected" : ""}
            >
              <span>{i}</span>
              <span className="navlabel">{label||n}</span>
              {n === "Leads" && leadCount !== null && leadCount > 0 && (
                <em title={`${leadCount} lead${leadCount === 1 ? "" : "s"}`}>{leadCount}</em>
              )}
            </a>
          ))}
        </nav>
        <div className="profile">
          <span>{auth.user.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <b>{auth.user.name}</b>
            <small>{auth.user.role}</small>
          </div>
          <button
            className="logout"
            onClick={() =>
              fetch("/api/auth/logout", { method: "POST" }).then(() =>
                setAuth((a) => ({ ...a, user: null })),
              )
            }
          >
            Logout
          </button>
        </div>
      </aside>
      <section className="workspace">
        <header>
          <button className="hamb" onClick={() => setMobileNav(!mobileNav)}>
            ☰
          </button>
          <button className="navcollapse" onClick={()=>setSidebarCollapsed(v=>!v)} title={sidebarCollapsed?"Expand navigation":"Collapse navigation"}>{sidebarCollapsed?"→":"←"}</button>
          <div className="crumb">
            <span>Techomie Flow</span>
            <i>/</i>
            <b>{module}</b>
          </div>
          <div className="globalsearch">
            <span>⌕</span><input value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} placeholder="Search customers, leads, quotes, projects, invoices or items" />
            {searchResults.length>0&&<div className="searchresults">{searchResults.map((x,i)=><button key={`${x.module}-${x.id}-${i}`} onClick={()=>navigate(x.module,{id:x.id,q:globalSearch})}><span>{x.module}</span><b>{x.title}</b><small>{x.detail}</small></button>)}</div>}
          </div>
          <div className="save">
            <span>●</span>
            {notice}
          </div>
          <div className="quickcreate"><button className="primary" onClick={()=>setQuickOpen(v=>!v)}>＋ Quick create</button>{quickOpen&&<div>{quickActions.map(x=><button key={x.label} onClick={()=>{navigate(x.module,{create:"1"});setQuickOpen(false)}}>{x.label}</button>)}</div>}</div>
          <button className="notification" title="Notifications">♢</button>
          {false && module === "Quotations" && quoteScreen === "detail" && (
            <>
              <button className="preview" onClick={() => setQuoteSetup(true)}>
                Quote details
              </button>
              <button className="preview" onClick={() => setQuoteScreen("list")}>
                All quotes
              </button>
              <button className="preview" onClick={() => window.print()}>
                Preview PDF
              </button>
              <button className="preview" onClick={() => window.print()}>
                Print
              </button>
              <button className="preview" onClick={downloadPdf}>
                Download PDF
              </button>
              <button className="preview" onClick={() => saveQuotation(false)}>
                Save draft
              </button>
              <button
                className="send"
                onClick={() => saveQuotation(true)}
              >
                Send quote <span>↗</span>
              </button>
            </>
          )}
        </header>
        {false ? quoteScreen === "list" ? (
          <QuotesList onNew={() => setQuoteScreen("detail")} onOpen={(customer,site) => {setQuoteDetails(d=>({...d,customer,site}));setQuoteScreen("detail")}} />
        ) : (
          <>
            <section className="printcover">
              <div className="techlines techlines-top" />
              <div className="coverbrand"><small>WWW.TECHOMIE.COM</small><img src="/techomie-logo.jpg" alt="Techomie"/><b>TECHOMIE</b><span>SMART DEVICES</span><em>HOME AUTOMATION · HOME SECURITY · GATE AUTOMATION</em></div>
              <div className="coverproposal"><small>TECHNICAL & COMMERCIAL PROPOSAL</small><h1>{quoteDetails.site}</h1><p>Prepared for {quoteDetails.customer}</p></div>
              <div className="noviqword">Noviq<small>HOME EVOLVED.</small></div><div className="techlines techlines-bottom" />
            </section>
            <div className="titlebar">
              <div>
                <p>
                  {quoteDetails.type.toUpperCase()} <span>REV 0</span>
                </p>
                <h1>{quoteDetails.site}</h1>
                <div className="meta">
                  <span>QT-1145</span>
                  <span>•</span>
                  <span>14 Aug 2026</span>
                  <span>•</span>
                  <span>Valid for {quoteDetails.validity} days</span>
                </div>
              </div>
              <div className="client">
                <small>PREPARED FOR</small>
                <b>{quoteDetails.customer}</b>
                <span>Sales person · {quoteDetails.sales}</span>
              </div>
            </div>
            {quoteSetup && (
              <QuoteDetailsModal
                details={quoteDetails}
                onClose={() => setQuoteSetup(false)}
                onSave={(d) => {
                  setQuoteDetails(d);
                  setQuoteSetup(false);
                  setNotice("Quote details saved");
                }}
              />
            )}
            {configure && (
              <ConfigureProductModal
                group={configure}
                isAdmin={auth.user.role === "admin"}
                onClose={() => setConfigure(null)}
                onAdd={addConfigured}
              />
            )}{" "}
            {productPicker && (
              <AddProductsModal
                groups={baseProducts}
                onClose={() => setProductPicker(false)}
                onConfigure={setConfigure}
                onAdd={add}
              />
            )}{" "}
            {editingLine && (
              <EditQuoteItemModal
                item={editingLine.item}
                onClose={() => setEditingLine(null)}
                onSave={saveItem}
              />
            )}
            <div className="builder">
              <section className="catalogue">
                <div className="sectionhead">
                  <div>
                    <span>01</span>
                    <div>
                      <h2>
                        Items master{" "}
                        <em className="count">{products.length} variants</em>
                      </h2>
                      <p>Choose an exact variant or use guided selection</p>
                    </div>
                  </div>
                  <button
                    className="primary"
                    onClick={() => setProductPicker(true)}
                  >
                    ＋ Add products
                  </button>
                </div>
                <label className="search">
                  ⌕
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products, variants or SKU"
                  />
                  <kbd>⌘ K</kbd>
                </label>
                <div className="chips">
                  {categories.map((c) => (
                    <button
                      onClick={() => setCategory(c)}
                      className={category === c ? "active" : ""}
                      key={c}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <label className="modulefilter">
                  <span>Module size</span>
                  <select
                    value={moduleSize}
                    onChange={(e) => setModuleSize(e.target.value)}
                  >
                    {moduleSizes.map((size) => (
                      <option key={size}>{size}</option>
                    ))}
                  </select>
                </label>
                <div className="resultcount">
                  Showing {Math.min(filtered.length, 120)} of {filtered.length}{" "}
                  matching base products
                </div>
                <div className="productgrid">
                  {filtered.slice(0, 120).map((g) => {
                    const p = g.variants[0],
                      prices = g.variants.map((v) => v.price).filter(Boolean);
                    return (
                      <article key={g.key}>
                        <div className="prodimg">
                          <img src={p.image} alt={p.name} />
                          <small>{p.series}</small>
                        </div>
                        <div className="prodinfo">
                          <small>{p.category.toUpperCase()}</small>
                          <h3>{p.name}</h3>
                          <p>
                            {p.module} · {g.variants.length} valid configuration
                            {g.variants.length === 1 ? "" : "s"}
                          </p>
                          <div>
                            <b>
                              {prices.length
                                ? `From ${money(Math.min(...prices))}`
                                : "Price on request"}
                            </b>
                            <span>Exact price selected automatically</span>
                            {auth.user.role === "admin" && (
                              <em className="cost">Buying cost · Admin only</em>
                            )}
                          </div>
                          <button onClick={() => setConfigure(g)}>
                            Configure & add →
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
              <section className="quote">
                <div className="sectionhead">
                  <div>
                    <span>02</span>
                    <div>
                      <h2>Build by room</h2>
                      <p>Ground & first floor · {rooms.length} rooms</p>
                    </div>
                  </div>
                  <button onClick={addRoom}>＋ Add room</button>
                </div>
                <div className="rooms">
                  {rooms.map((r, i) => (
                    <button
                      key={r.name}
                      onClick={() => setActiveRoom(i)}
                      className={activeRoom === i ? "active" : ""}
                    >
                      <small>{r.floor}</small>
                      <b>{r.name}</b>
                      <span>
                        {r.items.reduce((s, p) => s + p.qty, 0)} items
                      </span>
                    </button>
                  ))}
                </div>
                <div className="roomhead">
                  <div>
                    <small>{rooms[activeRoom].floor.toUpperCase()}</small>
                    <h2>{rooms[activeRoom].name}</h2>
                  </div>
                  <button>⋯</button>
                </div>
                <div className="lines">
                  {rooms[activeRoom].items.map((p, i) => (
                    <div className="line" key={`${p.id}-${i}`}>
                      <span className="handle">⋮⋮</span>
                      <div className="mini">
                        <img src={p.image} alt="" />
                      </div>
                      <div className="linedetail">
                        <b>{p.name}</b>
                        <span>{p.variant}</span>
                        <small>
                          {p.sku} · {p.discount || 0}% discount ·{" "}
                          {p.taxMode || "GST"}{" "}
                          {p.taxMode === "Non-GST"
                            ? ""
                            : `${p.gstRate ?? p.gst ?? 18}%`}
                        </small>
                      </div>
                      <div className="qty">
                        <button onClick={() => changeQty(i, -1)}>−</button>
                        <b>{p.qty}</b>
                        <button onClick={() => changeQty(i, 1)}>＋</button>
                      </div>
                      <strong>{money(lineTaxable(p) + lineTax(p))}</strong>
                      <span className="lineactions">
                        <button
                          onClick={() =>
                            setEditingLine({
                              room: activeRoom,
                              index: i,
                              item: p,
                            })
                          }
                        >
                          Edit
                        </button>
                        <button onClick={() => copyItemToRoom(i)}>Copy room</button>
                        <button
                          className="danger"
                          onClick={() => removeItem(i)}
                        >
                          Remove
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
                <button className="drop" onClick={() => setProductPicker(true)}>
                  ＋ Add products by variant or guided choices
                </button>
                <div className="summary">
                  <div>
                    <span>List subtotal</span>
                    <b>{money(subtotal)}</b>
                  </div>
                  {discountTotal > 0 && (
                    <div className="saving">
                      <span>Item discounts</span>
                      <b>− {money(discountTotal)}</b>
                    </div>
                  )}
                  <div>
                    <span>Taxable value</span>
                    <b>{money(taxable)}</b>
                  </div>
                  <div>
                    <span>CGST</span>
                    <b>{money(tax / 2)}</b>
                  </div>
                  <div>
                    <span>SGST</span>
                    <b>{money(tax / 2)}</b>
                  </div>
                  <div className="grand">
                    <span>
                      Grand total{" "}
                      <small>GST and non-GST items calculated separately</small>
                    </span>
                    <b>{money(total)}</b>
                  </div>
                  <div className="advance">
                    <span>80% advance at confirmation</span>
                    <b>{money(total * 0.8)}</b>
                  </div>
                </div>
                <section className="printterms">
                  <div className="techlines techlines-top"/><h2>Warranty & Service</h2><h3>Noviq Royal Edge — Premium Range</h3><p>10 years full replacement warranty · 10 years service warranty</p><h3>All other Noviq products</h3><p>2 years full replacement warranty · 4 years service warranty. Extended support and AMC options are available on request.</p><h2>Installation Timeline</h2><table><tbody><tr><th>Stage</th><th>Duration</th></tr><tr><td>Site survey</td><td>1 day</td></tr><tr><td>Installation</td><td>1–3 days, based on project size</td></tr><tr><td>Testing & configuration</td><td>1–2 days</td></tr><tr><td>Handover & training</td><td>Same day</td></tr></tbody></table><h2>Payment Terms</h2><ul><li>20% advance for freezing the order</li><li>60% upon procurement of materials</li><li>20% upon handover</li></ul><h2>Terms & Conditions</h2><ul><li>Changes to products or quantities will revise the quotation value.</li><li>Quotation is valid for {quoteDetails.validity} days from issue.</li><li>Client will provide site access, permissions and installation readiness.</li><li>Ownership transfers only after full payment is received.</li></ul><div className="printcontact"><b>TECHOMIE SMART DEVICES</b><span>Coimbatore, Tamil Nadu · www.techomie.com</span><small>Thank you for choosing Techomie for a smarter, safer and more luxurious living experience.</small></div><div className="techlines techlines-bottom"/>
                </section>
              </section>
            </div>
          </>
        ) : module === "Quotations" ? (
          <QuotationsModule role={auth.user.role} />
        ) : module === "Overview" ? (
          <OverviewModule role={auth.user.role} onNavigate={(target, filter) => { setModuleFilter(filter || {}); setModule(target); if (target === "Quotations") setQuoteScreen("list"); }} />
        ) : module === "Projects" ? (
          <ProjectsModule role={auth.user.role} initialFilter={moduleFilter} onNavigate={(target) => setModule(target)} />
        ) : module === "Customers" ? (
          <CustomersModule role={auth.user.role} initialFilter={moduleFilter} onNavigate={(target) => setModule(target)} />
        ) : module === "Leads" ? (
          <LeadsModule role={auth.user.role} initialFilter={moduleFilter} onCreateQuote={() => { setModule("Quotations"); setQuoteScreen("list"); }} />
        ) : module === "Invoices" ? (
          <InvoiceModule
            rooms={rooms}
            details={quoteDetails}
            focusId={moduleFilter.id}
            subtotal={subtotal}
            discount={discountTotal}
            taxable={taxable}
            tax={tax}
            total={total}
          />
        ) : module === "Items" ? (
          <ItemMasterModule isAdmin={auth.user.role === "admin"} />
        ) : module === "Expenses" ? (
          <ExpensesModule role={auth.user.role} initialFilter={moduleFilter} />
        ) : module === "Site Visits" ? (
          <SiteVisitsModule role={auth.user.role} initialFilter={moduleFilter} />
        ) : module === "Settings" ? (
          <SettingsModule role={auth.user.role} currentEmail={auth.user.email} />
        ) : module === "Reports" ? (
          <OverviewModule role={auth.user.role} onNavigate={(target,filter)=>navigate(target,filter||{})} />
        ) : (
          <OperationsModule name={module} role={auth.user.role} initialFilter={moduleFilter} />
        )}
      </section>
      <nav className="mobilebottom">{[{i:"⌂",n:role==="technician"?"Tasks":"Overview"},{i:role==="technician"?"◇":"◎",n:role==="technician"?"Projects":"Leads"},{i:"＋",n:"Create"},{i:role==="technician"?"⚒":"◇",n:role==="technician"?"Service":"Projects"},{i:"•••",n:"More"}].map(x=><button key={x.n} className={module===x.n?"active":""} onClick={()=>x.n==="Create"?setQuickOpen(true):x.n==="More"?setMobileNav(true):navigate(x.n)}><b>{x.i}</b><span>{x.n}</span></button>)}</nav>
    </main>
  );
}

const quoteRows = [
  {date:"14/08/2026",number:"QT-1147",reference:"Lead-1048",customer:"Mr. Vikram",site:"Vikram Residence",status:"Invoiced",amount:2200},
  {date:"13/08/2026",number:"QT-1146",reference:"Lead-1047",customer:"Mr. Abhilash",site:"Abhilash Residence",status:"Draft",amount:26844},
  {date:"13/08/2026",number:"QT-1145",reference:"Lead-1046",customer:"Mr. Srinivasan Ramasamy",site:"Ramasamy Residence",status:"Draft",amount:284155},
  {date:"12/08/2026",number:"QT-1144",reference:"Lead-1045",customer:"Mr. Abdhul Razack",site:"Abdhul Razack Residence",status:"Draft",amount:433571},
  {date:"11/08/2026",number:"QT-1143",reference:"Lead-1044",customer:"Mr. Shanmugavel",site:"Shanmugavel Residence",status:"Draft",amount:113080},
  {date:"08/08/2026",number:"QT-1142",reference:"Lead-1043",customer:"Mr. Srinivasan Ramasamy",site:"Ramasamy Smart Home",status:"Draft",amount:207132},
  {date:"08/08/2026",number:"QT-1141",reference:"Lead-1042",customer:"Mr. Srinivasan Ramasamy",site:"Ramasamy Extension",status:"Draft",amount:207806},
  {date:"08/08/2026",number:"QT-1140",reference:"Lead-1041",customer:"Ms. Swetha Krishnamoorthy",site:"Swetha Residence",status:"Draft",amount:79866},
  {date:"06/08/2026",number:"QT-1139",reference:"Lead-1040",customer:"Mr. Srinivasan Ramasamy",site:"Ramasamy Villa",status:"Draft",amount:96759},
  {date:"04/08/2026",number:"QT-1138",reference:"Lead-1039",customer:"Mr. Palani Ram",site:"Palani Residence",status:"Invoiced",amount:24414},
];
function QuotesList({onNew,onOpen}:{onNew:()=>void;onOpen:(customer:string,site:string)=>void}) {
  const [search,setSearch]=useState(""),[status,setStatus]=useState(""),[rows,setRows]=useState<any[]>([]),[page,setPage]=useState(1),[pages,setPages]=useState(1),[total,setTotal]=useState(0),[loading,setLoading]=useState(true),[notice,setNotice]=useState("");
  const load=useCallback(async()=>{setLoading(true);const r=await fetch(`/api/quotations?q=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&page=${page}`),d=await r.json();if(r.ok){setRows(d.quotations||[]);setPages(d.pagination?.pages||1);setTotal(d.pagination?.total||0)}else setNotice(d.error||"Unable to load quotations");setLoading(false)},[search,status,page]);
  useEffect(()=>{const t=setTimeout(load,180);return()=>clearTimeout(t)},[load]);
  const act=async(id:number,action:string)=>{if(action==="archive"&&!confirm("Archive this draft quotation?"))return;const r=await fetch("/api/quotations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action})}),d=await r.json();setNotice(r.ok?(action==="duplicate"?`Created ${d.number}`:"Quotation updated"):(d.error||"Action failed"));if(r.ok)load()};
  const exportList=()=>{const head=["Quote Number","Revision","Date","Customer","Site","Project","Type","Sales","Amount","Status","Valid Until","Updated"],csv=[head,...rows.map(q=>[q.number,q.revision,q.quote_date,q.customer_name,q.site_name,q.title,q.quote_type,q.sales_name,q.total,q.status,q.valid_until,q.updated_at])].map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="Techomie-Quotations.csv";a.click();URL.revokeObjectURL(a.href)};
  return <div className="quoteslist">{notice&&<div className="quotenotice">{notice}</div>}<div className="quotesbar"><div><h1>Quotations</h1></div><label>⌕<input value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} placeholder="Customer, site, quote, phone, project or sales person"/></label><button className="primary" onClick={onNew}>＋ New quotation</button><button className="morebutton" onClick={exportList}>Export</button></div><div className="quotefilters">{["","Draft","Ready for Review","Sent","Negotiation","Accepted","Rejected","Expired","Converted to Project"].map(s=><button key={s||"All"} className={status===s?"active":""} onClick={()=>{setStatus(s);setPage(1)}}>{s||"All"}</button>)}<span>{total} quotations</span></div><div className="quotelisttable"><div className="quotegrid quotegridhead"><span>QUOTE / DATE</span><span>CUSTOMER / SITE</span><span>PROJECT / TYPE</span><span>SALES / VALIDITY</span><span>STATUS</span><span>AMOUNT / ACTIONS</span></div>{loading?<div className="quoteempty">Loading quotations…</div>:!rows.length?<div className="quoteempty">No quotations match these filters.</div>:rows.map(q=><div className="quotegrid" key={q.id}><span><button className="quotelink" onClick={()=>onOpen(q.customer_name,q.site_name)}>{q.number} <small>Rev {q.revision||0}</small></button><small>{q.quote_date||String(q.created_at).slice(0,10)}</small></span><strong>{q.customer_name}<small>{q.site_name} · {q.city||""}</small></strong><span><b>{q.title||"Untitled project"}</b><small>{q.quote_type||"Standard quotation"}</small></span><span>{q.sales_name||q.created_name}<small>Valid until {q.valid_until||"—"}</small></span><em className={String(q.status).toLowerCase().replaceAll(" ","-")}>{String(q.status).toUpperCase()}</em><strong>{money(Number(q.total||0))}<span className="quoteactions">{q.status==="Draft"&&<><button onClick={()=>act(q.id,"review")}>Review</button><button onClick={()=>act(q.id,"archive")}>Archive</button></>}{q.status==="Ready for Review"&&<button onClick={()=>act(q.id,"send")}>Send</button>}{["Sent","Viewed","Negotiation"].includes(q.status)&&<><button onClick={()=>act(q.id,"accept")}>Accept</button><button onClick={()=>act(q.id,"revision")}>Revise</button></>}<button onClick={()=>act(q.id,"duplicate")}>Duplicate</button></span></strong></div>)}</div><div className="quotepager"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page} of {pages}</span><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Next</button></div></div>;
}

function LegacyItemsModule({
  products,
  isAdmin,
}: {
  products: typeof products;
  isAdmin: boolean;
}) {
  const [q, setQ] = useState(""),
    [showCost, setShowCost] = useState(isAdmin),
    [edits, setEdits] = useState<Record<string, Product>>({}),
    [removed, setRemoved] = useState<string[]>([]),
    [editing, setEditing] = useState<Product | null | "new">(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("techomie_catalog_changes") || "{}",
      );
      setEdits(saved.edits || {});
      setRemoved(saved.removed || []);
    } catch {}
  }, []);
  const persist = (
    nextEdits: Record<string, Product>,
    nextRemoved: string[],
  ) => {
    setEdits(nextEdits);
    setRemoved(nextRemoved);
    localStorage.setItem(
      "techomie_catalog_changes",
      JSON.stringify({ edits: nextEdits, removed: nextRemoved }),
    );
  };
  const custom = Object.values(edits).filter((p) => p.id.startsWith("custom-"));
  const all = [
      ...products
        .filter((p) => !removed.includes(p.id))
        .map((p) => edits[p.id] || p),
      ...custom,
    ],
    list = all.filter((p) =>
      `${p.name} ${p.sku} ${p.supplierSku} ${p.series}`
        .toLowerCase()
        .includes(q.toLowerCase()),
    );
  const save = (values: Record<string, string>) => {
    const original = editing !== "new" && editing ? editing : products[0],
      id = editing !== "new" && editing ? editing.id : `custom-${Date.now()}`,
      selling = +values.sellingPrice,
      purchase = +values.purchaseCost;
    const product = {
      ...original,
      id,
      name: values.name,
      sku: values.sku,
      supplierSku: values.supplierSku || "",
      series: values.series,
      category: values.category,
      module: values.module,
      technology: values.technology,
      finish: values.finish,
      sellingPrice: selling,
      price: selling,
      purchaseCost: purchase,
      warranty: values.warranty || original.warranty,
      image: values.image || original.image,
      description: values.description || values.name,
      variant: `${values.module} · ${values.technology} · ${values.finish}`,
    };
    persist(
      { ...edits, [id]: product },
      removed.filter((x) => x !== id),
    );
    setEditing(null);
    setNotice("Product saved");
  };
  const remove = (p: Product) => {
    persist(
      Object.fromEntries(Object.entries(edits).filter(([id]) => id !== p.id)),
      [...removed, p.id],
    );
    setNotice("Product removed");
  };
  return (
    <div className="modulepage">
      <div className="modulehero">
        <div>
          <small>PRODUCT MASTER</small>
          <h1>Items</h1>
          <p>
            {all.length} editable variants from your Noviq and supplier price
            lists.
          </p>
        </div>
        <div className="heroactions">
          {isAdmin && (
            <button onClick={() => setShowCost(!showCost)}>
              {showCost ? "Hide" : "Show"} admin costs
            </button>
          )}
          <button className="primary" onClick={() => setEditing("new")}>
            ＋ Add product
          </button>
        </div>
      </div>
      {notice && <div className="toast">{notice}</div>}
      <label className="bigsearch">
        ⌕{" "}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, series or SKU"
        />
      </label>
      <div className="catalogtable">
        <div className="tablerow tablehead">
          <span>Product</span>
          <span>Variant</span>
          <span>SKU</span>
          <span>List price</span>
          {showCost && <span>Buying cost</span>}
          <span>Actions</span>
        </div>
        {list.slice(0, 80).map((p) => (
          <div className="tablerow" key={p.id}>
            <span className="catalogproduct">
              <img src={p.image} alt="" />
              <i>
                <b>{p.name}</b>
                <small>{p.series}</small>
              </i>
            </span>
            <span>
              {p.module} · {p.technology} · {p.finish}
            </span>
            <span>
              <b>{p.sku}</b>
              <small>
                {p.supplierSku
                  ? `Supplier: ${p.supplierSku}`
                  : "Noviq internal SKU"}
              </small>
            </span>
            <strong>{p.price ? money(p.price) : "On request"}</strong>
            {showCost && (
              <strong className="buying">
                {p.purchaseCost ? money(p.purchaseCost) : "Not set"}
              </strong>
            )}
            <span className="rowactions">
              <button onClick={() => setEditing(p)}>Edit</button>
              <button className="danger" onClick={() => remove(p)}>
                Remove
              </button>
            </span>
          </div>
        ))}
      </div>
      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function ProductEditor({
  product,
  onClose,
  onSave,
}: {
  product: Product | null;
  onClose: () => void;
  onSave: (v: Record<string, string>) => void;
}) {
  const [v, setV] = useState<Record<string, string>>({
      name: product?.name || "",
      sku: product?.sku || "",
      supplierSku: product?.supplierSku || "",
      series: product?.series || "",
      category: product?.category || "Smart switches",
      module: product?.module || "",
      technology: product?.technology || "",
      finish: product?.finish || "",
      sellingPrice: String(product?.sellingPrice || ""),
      purchaseCost: String(product?.purchaseCost || ""),
      warranty: product?.warranty || "",
      image: product?.image || "",
      description: product?.description || "",
    }),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const field = (key: string, label: string, type = "text") => (
    <label>
      <span>{label}</span>
      <input
        type={type}
        value={v[key]}
        onChange={(e) => setV({ ...v, [key]: e.target.value })}
        required={
          !["purchaseCost", "image", "description", "supplierSku"].includes(key)
        }
      />
    </label>
  );
  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    setError("");
    const body = new FormData();
    body.append("image", file);
    const response = await fetch("/api/uploads", { method: "POST", body }),
      data = await response.json();
    setUploading(false);
    if (!response.ok) {
      setError(data.error || "Upload failed");
      return;
    }
    setV((current) => ({ ...current, image: data.url }));
  };
  return (
    <div className="modalback">
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v);
        }}
      >
        <div className="modalhead">
          <div>
            <small>CATALOGUE ITEM</small>
            <h2>{product ? "Edit product" : "Add product"}</h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="formgrid">
          {field("name", "Product name")}
          {field("sku", "Noviq variant SKU")}
          {field("supplierSku", "Original supplier code")}
          {field("series", "Series / brand")}
          {field("category", "Category")}
          {field("module", "Base configuration")}
          {field("technology", "Technology")}
          {field("finish", "Material / finish")}
          {field("warranty", "Warranty")}
          {field("sellingPrice", "Selling price", "number")}
          {field("purchaseCost", "Buying price", "number")}
          <label>
            <span>Upload / replace image</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => upload(e.target.files?.[0])}
            />
            <small>
              {uploading ? "Uploading…" : "JPG, PNG, WebP or GIF · max 5 MB"}
            </small>
          </label>
          {field("image", "Image URL")}
          <label className="wide imagepreview">
            <span>Current image</span>
            {v.image ? (
              <img src={v.image} alt="Product preview" />
            ) : (
              <em>No image selected</em>
            )}
          </label>
          <label className="wide">
            <span>Description</span>
            <textarea
              value={v.description}
              onChange={(e) => setV({ ...v, description: e.target.value })}
            />
          </label>
        </div>
        {error && <p className="formerror">{error}</p>}
        <div className="modalactions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={uploading}>
            Save product
          </button>
        </div>
      </form>
    </div>
  );
}

function AddProductsModal({
  groups,
  onClose,
  onConfigure,
  onAdd,
}: {
  groups: ProductGroup[];
  onClose: () => void;
  onConfigure: (g: ProductGroup) => void;
  onAdd: (p: Product) => void;
}) {
  const [mode, setMode] = useState<"guided" | "variants">("guided"),
    [search, setSearch] = useState(""),
    [directModule, setDirectModule] = useState("All module sizes");
  const categories = Array.from(new Set(groups.map((g) => g.category))).sort();
  const [category, setCategory] = useState(
    categories.includes("Smart switches")
      ? "Smart switches"
      : categories[0] || "",
  );
  const categoryGroups = groups.filter((g) => g.category === category),
    series = Array.from(new Set(categoryGroups.map((g) => g.series))).sort();
  const [seriesName, setSeriesName] = useState("");
  const activeSeries = series.includes(seriesName)
    ? seriesName
    : series[0] || "";
  const seriesGroups = categoryGroups.filter((g) => g.series === activeSeries),
    names = Array.from(new Set(seriesGroups.map((g) => g.name))).sort();
  const [productName, setProductName] = useState("");
  const activeName = names.includes(productName) ? productName : names[0] || "";
  const namedGroups = seriesGroups.filter((g) => g.name === activeName),
    guidedModules = Array.from(
      new Set(namedGroups.map((g) => g.module)),
    ).sort();
  const [guidedModule, setGuidedModule] = useState("");
  const activeModule = guidedModules.includes(guidedModule)
    ? guidedModule
    : guidedModules[0] || "";
  const selectedGroup =
    namedGroups.find((g) => g.module === activeModule) ?? namedGroups[0];
  const variants = selectedGroup?.variants || [],
    technologies = Array.from(new Set(variants.map((v) => v.technology))),
    materials = Array.from(new Set(variants.map((v) => v.finish)));
  const [technology, setTechnology] = useState(""),
    [material, setMaterial] = useState("");
  const activeTechnology = technologies.includes(technology)
      ? technology
      : technologies[0] || "",
    activeMaterial = materials.includes(material)
      ? material
      : materials[0] || "";
  const exact =
    variants.find(
      (v) => v.technology === activeTechnology && v.finish === activeMaterial,
    ) ??
    variants.find((v) => v.technology === activeTechnology) ??
    variants[0];
  const allVariants = groups.flatMap((g) => g.variants),
    allModules = [
      "All module sizes",
      ...Array.from(
        new Set(allVariants.map((v) => v.module).filter(Boolean)),
      ).sort(),
    ];
  const visible = allVariants
    .filter(
      (v) =>
        (directModule === "All module sizes" || v.module === directModule) &&
        `${v.name} ${v.category} ${v.series} ${v.sku} ${v.module} ${v.technology} ${v.finish}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .slice(0, 100);
  return (
    <div className="modalback">
      <div className="modal picker">
        <div className="modalhead">
          <div>
            <small>ADD PRODUCTS</small>
            <h2>Choose how you want to add</h2>
            <p>Select an exact SKU or let Techomie guide the configuration.</p>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <div className="picktabs">
          <button
            className={mode === "guided" ? "active" : ""}
            onClick={() => setMode("guided")}
          >
            Guided product choices
          </button>
          <button
            className={mode === "variants" ? "active" : ""}
            onClick={() => setMode("variants")}
          >
            All variants / SKUs
          </button>
        </div>
        {mode === "guided" ? (
          <div className="guided">
            <div className="guidesteps">
              <label>
                <b>1</b>
                <span>Product category</span>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setSeriesName("");
                    setProductName("");
                  }}
                >
                  {categories.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                <b>2</b>
                <span>Series / collection</span>
                <select
                  value={activeSeries}
                  onChange={(e) => {
                    setSeriesName(e.target.value);
                    setProductName("");
                  }}
                >
                  {series.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                <b>3</b>
                <span>Product</span>
                <select
                  value={activeName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    setGuidedModule("");
                  }}
                >
                  {names.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="modulesizechoice">
                <b>4</b>
                <span>Module size</span>
                <select
                  value={activeModule}
                  onChange={(e) => setGuidedModule(e.target.value)}
                >
                  {guidedModules.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                <b>5</b>
                <span>Technology</span>
                <select
                  value={activeTechnology}
                  onChange={(e) => setTechnology(e.target.value)}
                >
                  {technologies.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                <b>6</b>
                <span>Material / finish</span>
                <select
                  value={activeMaterial}
                  onChange={(e) => setMaterial(e.target.value)}
                >
                  {materials.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            {exact && (
              <div className="selectedvariant">
                <img src={exact.image} alt="" />
                <div>
                  <small>EXACT VARIANT</small>
                  <b>{exact.name}</b>
                  <span>
                    {exact.sku} · {exact.module} · {exact.technology} ·{" "}
                    {exact.finish}
                  </span>
                  <strong>{money(exact.price)}</strong>
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    onAdd(exact);
                    onClose();
                  }}
                >
                  Add exact variant
                </button>
                {selectedGroup && (
                  <button onClick={() => onConfigure(selectedGroup)}>
                    Advanced configuration
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="variantbrowser">
            <label className="modulefilter variantmodulefilter">
              <span>Filter by module size</span>
              <select
                value={directModule}
                onChange={(e) => setDirectModule(e.target.value)}
              >
                {allModules.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label className="bigsearch">
              ⌕{" "}
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search SKU, category, series, technology or material"
              />
            </label>
            <div className="variantlist">
              {visible.map((v) => (
                <div key={v.id}>
                  <img src={v.image} alt="" />
                  <span>
                    <b>{v.name}</b>
                    <small>
                      {v.category} · {v.series} · {v.module} · {v.technology} ·{" "}
                      {v.finish}
                    </small>
                    <em>{v.sku}</em>
                  </span>
                  <strong>{money(v.price)}</strong>
                  <button onClick={() => onAdd(v)}>Add</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="modalactions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ConfigureProductModal({
  group,
  isAdmin,
  onClose,
  onAdd,
}: {
  group: ProductGroup;
  isAdmin: boolean;
  onClose: () => void;
  onAdd: (
    p: Product,
    qty: number,
    configuration: string,
    installation: number,
  ) => void;
}) {
  const technologies = Array.from(new Set(group.variants.map((v) => v.technology).filter(Boolean)));
  const [technology, setTechnology] = useState(technologies[0]),
    [material, setMaterial] = useState(""),
    [qty, setQty] = useState(1),
    [installation, setInstallation] = useState(0),
    [rack, setRack] = useState("Not required"),
    [photocell, setPhotocell] = useState("No"),
    [remotes, setRemotes] = useState("2"),
    [track, setTrack] = useState("10 ft"),
    [trackType, setTrackType] = useState("Straight"),
    [curtainSide, setCurtainSide] = useState("Centre opening"),
    [direction, setDirection] = useState("Standard"),
    [lensType, setLensType] = useState("Standard lens"),
    [cableLength, setCableLength] = useState(0),
    [mountingAccessory, setMountingAccessory] = useState("None"),
    [switchMaterial, setSwitchMaterial] = useState("PC (included)"),
    [switchTechnology, setSwitchTechnology] = useState("Zigbee PC (included)"),
    [touchOnly, setTouchOnly] = useState(false),
    [customIconCharge, setCustomIconCharge] = useState(0),
    [lockConnectivity, setLockConnectivity] = useState("Base configuration"),
    [lockExtra, setLockExtra] = useState("None"),
    [lockExtraQty, setLockExtraQty] = useState(1),
    [note, setNote] = useState("");
  const technologyVariants = technologies.length > 1 ? group.variants.filter(v=>v.technology===technology) : group.variants;
  const materials = Array.from(new Set(technologyVariants.map(v=>v.finish).filter(Boolean)));
  const selectedMaterial = materials.includes(material) ? material : materials[0] || "";
  const variant = technologyVariants.find(v=>!selectedMaterial||v.finish===selectedMaterial);
  const isGate =
      group.category === "Gate automation" ||
      group.category === "Boom barriers",
    isCurtain = group.category === "Curtains",
    isCamera = group.category === "Security" && /camera|cctv|bullet|dome/i.test(`${group.name} ${group.module}`),
    isDoor =
      group.category.includes("Door") || group.category === "Window automation";
  if (!variant) return <div className="modalback"><div className="modal"><div className="modalhead"><div><small>INVALID COMBINATION</small><h2>{group.name}</h2><p>Change the selected technology or finish.</p></div><button onClick={onClose}>×</button></div><div className="modalactions"><button onClick={onClose}>Close</button></div></div></div>;
  const isTitan = group.series === "Noviq Titan",
    isLuxeray = group.series === "Noviq Luxeray",
    isPremiumSwitch = isTitan || isLuxeray,
    isSupplierLock = group.category === "Door locks" && variant.id.startsWith("PH-"),
    pricingModule = variant.module === "6M" ? "6/8M" : variant.module;
  const titanMaterialPrices: Record<string, Record<string, number>> = {
      "2M": { Aluminium: 750, Glass: 650 },
      "4M": { Aluminium: 1200, Glass: 950 },
      "6/8M": { Aluminium: 1800, Glass: 1500 },
    },
    luxerayUpgradePrices: Record<string, number> = {
      "2M": 750,
      "4M": 970,
      "6/8M": 1340,
    };
  const materialAddon = isTitan
      ? (titanMaterialPrices[pricingModule]?.[switchMaterial] ?? 0)
      : isLuxeray && switchMaterial === "Glass + Aluminium bezel"
        ? (luxerayUpgradePrices[pricingModule] ?? 0)
        : 0,
    technologyAddon = isLuxeray && switchTechnology === "WiFi" ? -80 : 0,
    touchAddon = isLuxeray && touchOnly ? -350 : 0,
    switchAddon = materialAddon + technologyAddon + touchAddon + customIconCharge,
    lockText = `${variant.name} ${variant.description}`.toLowerCase(),
    lockConnectivityOptions = [
      "Base configuration",
      lockText.includes("wifi +₹550") && "WiFi app (+₹550)",
      lockText.includes("zigbee") && lockText.includes("₹850") && "Zigbee lock bind (+₹850)",
      lockText.includes("rx-tx") && "RX-TX integration (+₹1,100)",
    ].filter(Boolean) as string[],
    lockExtraOptions = [
      "None",
      lockText.includes("wireless remote") && "Extra wireless remote (+₹450)",
      lockText.includes("indoor chime") && "Extra indoor chime (+₹740)",
      lockText.includes("indoor screen") && "Extra indoor screen + adapter (+₹5,200)",
      lockText.includes("outdoor") && lockText.includes("₹2400") && "Extra outdoor unit (+₹2,400)",
    ].filter(Boolean) as string[],
    lockConnectivityPrice = lockConnectivity.includes("550") ? 550 : lockConnectivity.includes("850") ? 850 : lockConnectivity.includes("1,100") ? 1100 : 0,
    lockExtraPrice = lockExtra.includes("450") ? 450 : lockExtra.includes("740") ? 740 : lockExtra.includes("5,200") ? 5200 : lockExtra.includes("2,400") ? 2400 : 0,
    lockAddon = isSupplierLock ? lockConnectivityPrice + lockExtraPrice * lockExtraQty : 0,
    totalAddon = switchAddon + lockAddon,
    finalUnitPrice = Math.max(0, variant.price + installation + totalAddon);
  const extras = [
    isGate && `Rack: ${rack}`,
    isGate && `Photocell: ${photocell}`,
    isGate && `Remotes: ${remotes}`,
    isCurtain && `Track: ${track} ${trackType}`,
    isCurtain && `Opening: ${curtainSide}`,
    isDoor && `Opening: ${direction}`,
    isCamera && `Lens: ${lensType}`,
    isCamera && cableLength > 0 && `Cable: ${cableLength} m`,
    isCamera && mountingAccessory !== "None" && `Mount: ${mountingAccessory}`,
    isPremiumSwitch && `Material: ${switchMaterial}`,
    isLuxeray && `Technology: ${switchTechnology}`,
    isLuxeray && touchOnly && "Only touch version",
    customIconCharge > 0 && `Custom icons: ${money(customIconCharge)}`,
    isSupplierLock && lockConnectivity !== "Base configuration" && lockConnectivity,
    isSupplierLock && lockExtra !== "None" && `${lockExtra} × ${lockExtraQty}`,
    note && `Note: ${note}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const configuration = [
    variant.module,
    technologies.length > 1 && technology,
    materials.length > 1 && selectedMaterial,
    extras,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="modalback">
      <div className="modal configuremodal">
        <div className="modalhead">
          <div>
            <small>CONFIGURE ITEM</small>
            <h2>{group.name}</h2>
            <p>
              {group.category} · {group.series}
            </p>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <div className="configurebody">
          <div className="configpreview">
            <img src={variant.image} alt={variant.name} />
            <div>
              <small>FINAL CONFIGURATION</small>
              <b>{variant.name}</b>
              <span>{configuration}</span>
              <strong>
                {variant.price
                  ? money(finalUnitPrice)
                  : "Price on request"}
              </strong>
              <em>
                {variant.warranty} · GST {variant.gst}% · HSN{" "}
                {variant.hsn || "not specified"}
              </em>
              {isAdmin && <div className="adminpricing"><span>Buying {money(variant.purchaseCost||0)}</span><span>Margin {variant.price?Math.round(((variant.price-(variant.purchaseCost||0))/variant.price)*100):0}%</span><b>Profit {money(Math.max(0,variant.price-(variant.purchaseCost||0)))}</b></div>}
            </div>
          </div>
          <div className="configfields">
            {technologies.length > 1 && (
              <label>
                <span>Technology</span>
                <select
                  value={technology}
                  onChange={(e) => {setTechnology(e.target.value);setMaterial("")}}
                >
                  {technologies.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            )}
            {materials.length > 1 && !isPremiumSwitch && (
              <label>
                <span>Material / finish</span>
                <select
                  value={selectedMaterial}
                  onChange={(e) => setMaterial(e.target.value)}
                >
                  {materials.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            )}
            {isPremiumSwitch && (
              <>
                <label>
                  <span>Panel material / upgrade</span>
                  <select
                    value={switchMaterial}
                    onChange={(e) => setSwitchMaterial(e.target.value)}
                  >
                    <option>PC (included)</option>
                    {isTitan ? (
                      <>
                        <option>Aluminium</option>
                        <option>Glass</option>
                      </>
                    ) : (
                      <option>Glass + Aluminium bezel</option>
                    )}
                  </select>
                  <small>
                    Add-on: {money(materialAddon)} for {pricingModule}
                  </small>
                </label>
                {isLuxeray && (
                  <>
                    <label>
                      <span>Switch technology</span>
                      <select
                        value={switchTechnology}
                        onChange={(e) => setSwitchTechnology(e.target.value)}
                      >
                        <option>Zigbee PC (included)</option>
                        <option>WiFi</option>
                      </select>
                      <small>{technologyAddon ? "−₹80 per unit" : "Base price"}</small>
                    </label>
                    <label className="checkfield">
                      <span>Touch-only version</span>
                      <input
                        type="checkbox"
                        checked={touchOnly}
                        onChange={(e) => setTouchOnly(e.target.checked)}
                      />
                      <small>Deduct ₹350 per unit</small>
                    </label>
                  </>
                )}
                <label>
                  <span>Custom icon charge per unit</span>
                  <input
                    type="number"
                    min="0"
                    value={customIconCharge}
                    onChange={(e) =>
                      setCustomIconCharge(Math.max(0, +e.target.value))
                    }
                  />
                </label>
                <div className="wide addonprice">
                  <span>Base {money(variant.price)}</span>
                  <span>Options {switchAddon >= 0 ? "+" : "−"} {money(Math.abs(switchAddon))}</span>
                  <b>Configured unit price {money(finalUnitPrice)}</b>
                </div>
              </>
            )}
            {isSupplierLock && (lockConnectivityOptions.length > 1 || lockExtraOptions.length > 1) && (
              <>
                {lockConnectivityOptions.length > 1 && <label>
                  <span>App / integration variant</span>
                  <select value={lockConnectivity} onChange={(e)=>setLockConnectivity(e.target.value)}>{lockConnectivityOptions.map(v=><option key={v}>{v}</option>)}</select>
                  <small>Select only the integration required for this lock.</small>
                </label>}
                {lockExtraOptions.length > 1 && <label>
                  <span>Lock accessory</span>
                  <select value={lockExtra} onChange={(e)=>setLockExtra(e.target.value)}>{lockExtraOptions.map(v=><option key={v}>{v}</option>)}</select>
                </label>}
                {lockExtra !== "None" && <label>
                  <span>Accessory quantity</span>
                  <input type="number" min="1" value={lockExtraQty} onChange={(e)=>setLockExtraQty(Math.max(1,+e.target.value))}/>
                </label>}
                <div className="wide addonprice">
                  <span>Base {money(variant.price)}</span>
                  <span>Lock options + {money(lockAddon)}</span>
                  <b>Configured unit price {money(finalUnitPrice)}</b>
                </div>
              </>
            )}
            {isGate && (
              <>
                <label>
                  <span>Gear rack / boom length</span>
                  <input
                    value={rack}
                    onChange={(e) => setRack(e.target.value)}
                  />
                </label>
                <label>
                  <span>Photocell sensor</span>
                  <select
                    value={photocell}
                    onChange={(e) => setPhotocell(e.target.value)}
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </label>
                <label>
                  <span>Remote quantity</span>
                  <input
                    type="number"
                    min="0"
                    value={remotes}
                    onChange={(e) => setRemotes(e.target.value)}
                  />
                </label>
              </>
            )}
            {isCurtain && (
              <>
                <label>
                  <span>Track length</span>
                  <select
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                  >
                    <option>10 ft</option>
                    <option>15 ft</option>
                    <option>Custom</option>
                  </select>
                </label>
                <label>
                  <span>Track type</span>
                  <select
                    value={trackType}
                    onChange={(e) => setTrackType(e.target.value)}
                  >
                    <option>Straight</option>
                    <option>Curved</option>
                  </select>
                </label>
                <label><span>Curtain opening side</span><select value={curtainSide} onChange={(e)=>setCurtainSide(e.target.value)}><option>Centre opening</option><option>Left stack</option><option>Right stack</option></select></label>
              </>
            )}
            {isDoor && (
              <label>
                <span>Opening direction</span>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                >
                  <option>Standard</option>
                  <option>Left opening</option>
                  <option>Right opening</option>
                  <option>Inward</option>
                  <option>Outward</option>
                </select>
              </label>
            )}
            {isCamera && <><label><span>Lens type</span><select value={lensType} onChange={e=>setLensType(e.target.value)}><option>Standard lens</option><option>Wide angle</option><option>Varifocal</option></select></label><label><span>Cable length (metres)</span><input type="number" min="0" value={cableLength} onChange={e=>setCableLength(Math.max(0,+e.target.value))}/></label><label><span>Mounting accessory</span><select value={mountingAccessory} onChange={e=>setMountingAccessory(e.target.value)}><option>None</option><option>Junction box</option><option>Wall bracket</option><option>Pole mount</option></select></label></>}
            <label>
              <span>Quantity</span>
              <input
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(Math.max(1, +e.target.value))}
              />
            </label>
            <label>
              <span>Installation charge per unit</span>
              <input
                type="number"
                min="0"
                value={installation}
                onChange={(e) => setInstallation(Math.max(0, +e.target.value))}
              />
            </label>
            <label className="wide">
              <span>Room-specific note</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="modalactions">
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            disabled={!variant}
            onClick={() =>
              onAdd(variant, qty, configuration, installation + totalAddon)
            }
          >
            Add {qty} to room
          </button>
        </div>
      </div>
    </div>
  );
}

function EditQuoteItemModal({
  item,
  onClose,
  onSave,
}: {
  item: QuoteItem;
  onClose: () => void;
  onSave: (item: QuoteItem) => void;
}) {
  const [v, setV] = useState<QuoteItem>({
    ...item,
    discount: item.discount || 0,
    taxMode: item.taxMode || "GST",
    gstRate: item.gstRate ?? item.gst ?? 18,
  });
  const base = v.price * v.qty,
    taxable = base * (1 - (v.discount || 0) / 100),
    tax = v.taxMode === "GST" ? taxable * ((v.gstRate || 0) / 100) : 0;
  return (
    <div className="modalback">
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v);
        }}
      >
        <div className="modalhead">
          <div>
            <small>QUOTATION ITEM</small>
            <h2>Edit item</h2>
            <p>{item.name}</p>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="formgrid">
          <label className="wide">
            <span>Final configuration</span>
            <input
              value={v.variant}
              onChange={(e) => setV({ ...v, variant: e.target.value })}
            />
          </label>
          <label>
            <span>Quantity</span>
            <input
              type="number"
              min="1"
              value={v.qty}
              onChange={(e) =>
                setV({ ...v, qty: Math.max(1, +e.target.value) })
              }
            />
          </label>
          <label>
            <span>Unit selling price</span>
            <input
              type="number"
              min="0"
              value={v.price}
              onChange={(e) =>
                setV({ ...v, price: Math.max(0, +e.target.value) })
              }
            />
          </label>
          <label>
            <span>Item discount %</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={v.discount || 0}
              onChange={(e) =>
                setV({
                  ...v,
                  discount: Math.min(100, Math.max(0, +e.target.value)),
                })
              }
            />
          </label>
          <label>
            <span>Tax billing</span>
            <select
              value={v.taxMode}
              onChange={(e) =>
                setV({ ...v, taxMode: e.target.value as QuoteItem["taxMode"] })
              }
            >
              <option>GST</option>
              <option>Non-GST</option>
            </select>
          </label>
          {v.taxMode === "GST" && (
            <label>
              <span>GST rate</span>
              <select
                value={v.gstRate}
                onChange={(e) => setV({ ...v, gstRate: +e.target.value })}
              >
                <option value="0">0%</option>
                <option value="5">5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </label>
          )}
          <label className="wide">
            <span>Room-specific note</span>
            <textarea
              value={v.note || ""}
              onChange={(e) => setV({ ...v, note: e.target.value })}
            />
          </label>
          <div className="wide calcpreview">
            <span>List: {money(base)}</span>
            <span>After discount: {money(taxable)}</span>
            <b>Line total: {money(taxable + tax)}</b>
          </div>
        </div>
        <div className="modalactions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save changes</button>
        </div>
      </form>
    </div>
  );
}

function LegacyInvoiceModule({
  rooms,
  details,
  subtotal,
  discount,
  taxable,
  tax,
  total,
}: {
  rooms: { name: string; floor: string; items: QuoteItem[] }[];
  details: typeof initialQuote;
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
}) {
  const [status, setStatus] = useState("Draft"),
    [paid, setPaid] = useState(0),
    [invoiceNo, setInvoiceNo] = useState("INV-2026-001");
  const items = rooms.flatMap((r) =>
    r.items.map((i) => ({ ...i, room: r.name })),
  );
  const updatePaid = (value: string) => {
    const n = Math.max(0, +value);
    setPaid(n);
    setStatus(n >= total ? "Paid" : n > 0 ? "Part Paid" : "Draft");
  };
  return (
    <div className="modulepage invoicepage">
      <div className="modulehero">
        <div>
          <small>SALES INVOICE</small>
          <h1>Invoice</h1>
          <p>
            Created directly from the current quotation with exact variants,
            discounts and tax treatment.
          </p>
        </div>
        <div className="heroactions">
          <button onClick={() => window.print()}>Print / Save PDF</button>
          <button className="primary" onClick={() => setStatus("Issued")}>
            Issue invoice
          </button>
        </div>
      </div>
      <div className="invoicehead">
        <div>
          <img src="/techomie-logo.jpg" alt="Techomie" />
          <span>
            <b>TECHOMIE SMART DEVICES</b>
            <small>Tax invoice</small>
          </span>
        </div>
        <div className="invoicefields">
          <label>
            Invoice number
            <input
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
            />
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option>Draft</option>
              <option>Issued</option>
              <option>Part Paid</option>
              <option>Paid</option>
              <option>Cancelled</option>
            </select>
          </label>
        </div>
      </div>
      <div className="billgrid">
        <div>
          <small>BILL TO</small>
          <b>{details.customer || "Select customer in quotation details"}</b>
          <span>{details.site}</span>
        </div>
        <div>
          <small>INVOICE DETAILS</small>
          <b>{new Date().toLocaleDateString("en-IN")}</b>
          <span>Reference QT-1145 · Sales: {details.sales}</span>
        </div>
      </div>
      <div className="invoicetable">
        <div className="invrow invheader">
          <span>Item / SKU</span>
          <span>Qty</span>
          <span>Rate</span>
          <span>Discount</span>
          <span>Tax</span>
          <span>Amount</span>
        </div>
        {items.map((p, i) => {
          const base = p.price * p.qty,
            taxableLine = base * (1 - (p.discount || 0) / 100),
            lineTax =
              p.taxMode === "Non-GST"
                ? 0
                : taxableLine * ((p.gstRate ?? p.gst ?? 18) / 100);
          return (
            <div className="invrow" key={`${p.id}-${i}`}>
              <span>
                <b>{p.name}</b>
                <small>
                  {p.sku} · {p.variant} · {p.room}
                </small>
              </span>
              <span>{p.qty}</span>
              <span>{money(p.price)}</span>
              <span>{p.discount || 0}%</span>
              <span>
                {p.taxMode === "Non-GST"
                  ? "Non-GST"
                  : `${p.gstRate ?? p.gst ?? 18}%`}
              </span>
              <strong>{money(taxableLine + lineTax)}</strong>
            </div>
          );
        })}
      </div>
      <div className="invoicebottom">
        <div className="paymentbox">
          <small>PAYMENT TRACKING</small>
          <label>
            Amount received
            <input
              type="number"
              min="0"
              max={total}
              value={paid}
              onChange={(e) => updatePaid(e.target.value)}
            />
          </label>
          <p>
            Balance due <b>{money(Math.max(0, total - paid))}</b>
          </p>
        </div>
        <div className="summary">
          <div>
            <span>List subtotal</span>
            <b>{money(subtotal)}</b>
          </div>
          <div>
            <span>Discount</span>
            <b>− {money(discount)}</b>
          </div>
          <div>
            <span>Taxable value</span>
            <b>{money(taxable)}</b>
          </div>
          <div>
            <span>CGST</span>
            <b>{money(tax / 2)}</b>
          </div>
          <div>
            <span>SGST</span>
            <b>{money(tax / 2)}</b>
          </div>
          <div className="grand">
            <span>Invoice total</span>
            <b>{money(total)}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

const moduleData: Record<string, { stats: string[]; rows: string[][] }> = {
  Overview: {
    stats: [
      "12 active leads",
      "₹8.42L pipeline",
      "3 installs this week",
      "₹2.18L outstanding",
    ],
    rows: [
      ["Today", "Site visit · Ramanathan Residence", "Ajith · 11:30 AM"],
      ["Today", "Quote follow-up · Meera Villa", "Resmi · 3:00 PM"],
      ["Tomorrow", "Installation · Sree Towers", "2 technicians"],
    ],
  },
  Leads: {
    stats: ["12 new", "8 follow-ups today", "4 site visits", "31% conversion"],
    rows: [
      ["LD-1048", "Karthik S · Smart Home", "New · Resmi"],
      ["LD-1047", "Nandhini · Door Lock", "Site visit · Ajith"],
      ["LD-1046", "Vishal Homes · CCTV", "Quote sent · Resmi"],
    ],
  },
  Customers: {
    stats: [
      "148 customers",
      "192 sites",
      "27 active projects",
      "14 service plans",
    ],
    rows: [
      ["Arun Ramanathan", "Ramanathan Residence", "Coimbatore"],
      ["Meera Krishnan", "Meera Villa", "Erode"],
      ["Sree Builders", "Sree Towers", "Coimbatore"],
    ],
  },
  Projects: {
    stats: [
      "9 active",
      "3 installing",
      "2 ready for handover",
      "94% on schedule",
    ],
    rows: [
      ["PR-208", "Ramanathan Residence", "Materials ready"],
      ["PR-207", "Sree Towers", "Installation"],
      ["PR-206", "Greenfield Office", "Testing"],
    ],
  },
  Payments: {
    stats: [
      "₹11.6L collected",
      "₹2.18L pending",
      "₹82K overdue",
      "6 due this week",
    ],
    rows: [
      ["PAY-588", "Ramanathan Residence", "₹1,48,240 · UPI"],
      ["PAY-587", "Sree Towers", "₹2,75,000 · Bank"],
      ["PAY-586", "Meera Villa", "₹86,500 · Cash"],
    ],
  },
  Settings: {
    stats: [
      "4 users",
      "4 permission roles",
      "18% default GST",
      "30-day validity",
    ],
    rows: [
      ["Adithyaa", "Admin / Owner", "Full access"],
      ["Resmi", "CRM / Marketing", "No cost or margin"],
      ["Ajith", "Sales / Site Visit", "Assigned records only"],
      ["Technician", "Technician", "Projects and service only"],
    ],
  },
};
function OperationsModule({ name,role,initialFilter={} }: { name: string;role:string;initialFilter?:Record<string,string> }) {
  const endpoint:Record<string,string>={Leads:"/api/leads",Customers:"/api/customers",Projects:"/api/records/projects",Tasks:"/api/records/tasks",Payments:"/api/records/payments",Procurement:"/api/records/materials",Expenses:"/api/records/expenses",Service:"/api/records/service"};
  const [rows,setRows]=useState<Record<string,unknown>[]>([]),[search,setSearch]=useState(Object.values(initialFilter).join(" ")),[open,setOpen]=useState(false),[editing,setEditing]=useState<Record<string,unknown>|null>(null),[toast,setToast]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [paymentLookups,setPaymentLookups]=useState<{customers:Record<string,unknown>[];projects:Record<string,unknown>[];quotations:Record<string,unknown>[]}>({customers:[],projects:[],quotations:[]});
  const [taskLookups,setTaskLookups]=useState<{projects:Record<string,unknown>[];users:Record<string,unknown>[]}>({projects:[],users:[]});
  const singular=name==="Customers"?"customer":name==="Leads"?"lead":name==="Procurement"?"material":name==="Service"?"service ticket":name.endsWith("s")?name.slice(0,-1).toLowerCase():name.toLowerCase();
  const allowed=!(role!=="admin"&&["Expenses","Procurement"].includes(name))&&!(role==="technician"&&!["Projects","Tasks","Service","Overview"].includes(name));
  const load=async()=>{setLoading(true);setError("");try{if(name==="Overview"){const urls=role==="technician"?["/api/records/projects","/api/records/tasks","/api/records/service"]:["/api/leads","/api/customers","/api/quotations","/api/records/projects","/api/records/payments","/api/records/service"];const results=await Promise.all(urls.map(async url=>{const r=await fetch(url);if(!r.ok)return[];const d=await r.json();return d.records||d.leads||d.customers||d.quotations||[]}));setRows(results.flat());return}const r=await fetch(`${endpoint[name]}?q=${encodeURIComponent(search)}`),d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to load records");setRows(d.records||d.leads||d.customers||[])}catch(e){setError(e instanceof Error?e.message:"Unable to load records")}finally{setLoading(false)}};
  useEffect(()=>{setSearch(Object.values(initialFilter).join(" "));if(allowed)load();if(name==="Payments")Promise.all([fetch("/api/projects").then(r=>r.json()),fetch("/api/quotations?limit=100").then(r=>r.json())]).then(([p,q])=>{const customerMap=new Map<string,Record<string,unknown>>();[...(p.filters?.customers||[]),...(q.filters?.customers||[])].forEach((c:Record<string,unknown>)=>customerMap.set(String(c.id),c));setPaymentLookups({customers:[...customerMap.values()],projects:p.projects||[],quotations:q.quotations||[]})}).catch(()=>setToast("Unable to load customer payment choices"));if(name==="Tasks")fetch("/api/projects").then(r=>r.json()).then(p=>setTaskLookups({projects:p.projects||[],users:p.filters?.users||[]})).catch(()=>setToast("Unable to load project task choices"))},[name,JSON.stringify(initialFilter)]);
  const save=async(v:Record<string,string>)=>{try{let payload:Record<string,unknown>={...v};if(name==="Leads")payload={...v,customerName:v.name};const url=endpoint[name],method=editing?"PATCH":"POST";if(editing)payload.id=editing.id;const r=await fetch(url,{method,headers:{"content-type":"application/json"},body:JSON.stringify(payload)}),d=await r.json();if(!r.ok)throw new Error(d.error||"Unable to save record");setOpen(false);setEditing(null);setToast(`${singular} saved`);load()}catch(e){setToast(e instanceof Error?e.message:"Unable to save record")}};
  const archive=async(row:Record<string,unknown>)=>{if(!confirm(`Archive this ${singular}?`))return;const r=await fetch(`${endpoint[name]}?id=${row.id}`,{method:"DELETE"});if(r.ok){setToast(`${singular} archived`);load()}else setToast("Unable to archive record")};
  const titleOf=(r:Record<string,unknown>)=>String(r.customerName||r.customer_name||r.name||r.title||r.problem||r.sku||r.invoice_number||r.id||"Record"),detailOf=(r:Record<string,unknown>)=>[name==="Tasks"?taskLookups.projects.find(p=>String(p.id)===String(r.project_id))?.title:null,r.status,r.phone,r.site_name,r.mode,r.date,r.due_at].filter(Boolean).join(" · ");
  const paymentFields:Field[]=name==="Payments"?[
    {key:"customer_selector",label:"Customer name",required:true,options:paymentLookups.customers.map(c=>({value:String(c.id),label:String(c.name)}))},
    {key:"project_id",label:"Project / site",dependsOn:"customer_selector",options:paymentLookups.projects.map(p=>({value:String(p.id),label:`${String(p.title||p.id)}${p.site_name?` · ${String(p.site_name)}`:""}`,parent:String(p.customer_id)}))},
    {key:"quotation_id",label:"Quotation",dependsOn:"customer_selector",options:paymentLookups.quotations.map(q=>({value:String(q.id),label:`${String(q.number)} · ${String(q.title||"Quotation")}`,parent:String(q.customer_id)}))},
    ...formFields.Payments.slice(2)
  ]:name==="Tasks"?[
    {key:"project_id",label:"Project / customer",required:true,options:taskLookups.projects.map(p=>({value:String(p.id),label:`${String(p.customer_name)} · ${String(p.title||p.id)}${p.site_name?` · ${String(p.site_name)}`:""}`}))},
    {key:"title",label:"Task",required:true},
    {key:"assigned_to",label:"Assign to",required:true,options:taskLookups.users.map(u=>({value:String(u.id),label:`${String(u.name)} · ${String(u.role)}`}))},
    {key:"due_at",label:"Due date and time",type:"datetime-local",required:true},
    {key:"status",label:"Status",required:true,options:["To Do","In Progress","Waiting","Completed"]},
    {key:"mandatory",label:"Priority",options:[{value:"0",label:"Normal"},{value:"1",label:"Priority / mandatory"}]},
    {key:"notes",label:"Instructions / completion notes",type:"textarea"}
  ]:formFields[name]||formFields.Overview;
  const modalInitial=editing?Object.fromEntries(Object.entries(editing).map(([k,v])=>[k,String(v??"")])):undefined;
  if(modalInitial&&name==="Payments"){const linked=paymentLookups.projects.find(p=>String(p.id)===modalInitial.project_id)||paymentLookups.quotations.find(q=>String(q.id)===modalInitial.quotation_id);if(linked)modalInitial.customer_selector=String(linked.customer_id)}
  if(!allowed)return <div className="modulepage"><div className="modulehero"><div><small>RESTRICTED</small><h1>{name}</h1><p>Your role does not have permission to access this financial area.</p></div></div></div>;
  return (
    <div className="modulepage">
      <div className="modulehero">
        <div>
          <small>TECHOMIE OPERATIONS</small>
          <h1>{name}</h1>
          <p>Live workspace for your team’s {name.toLowerCase()} workflow.</p>
        </div>
        {name!=="Overview"&&<button className="primary" onClick={() => {setEditing(null);setOpen(true)}}>＋ Add {singular}</button>}
      </div>
      {toast && <div className="toast">✓ {toast}</div>}
      <div className="statgrid"><article><small>{name==="Tasks"?"TOTAL TASKS":"LIVE RECORDS"}</small><b>{rows.length}</b></article><article><small>{name==="Tasks"?"DUE TODAY":"ACTIVE / OPEN"}</small><b>{name==="Tasks"?rows.filter(r=>String(r.due_at||"").slice(0,10)===new Date().toISOString().slice(0,10)&&String(r.status).toLowerCase()!=="completed").length:rows.filter(r=>!["closed","completed","lost","inactive"].includes(String(r.status||"").toLowerCase())).length}</b></article><article><small>{name==="Tasks"?"OVERDUE":"UPDATED"}</small><b>{name==="Tasks"?rows.filter(r=>String(r.due_at||"9999")<new Date().toISOString()&&String(r.status).toLowerCase()!=="completed").length:loading?"Loading…":"Now"}</b></article><article><small>{name==="Tasks"?"COMPLETED":"DATA SOURCE"}</small><b>{name==="Tasks"?rows.filter(r=>String(r.status).toLowerCase()==="completed").length:"Secure database"}</b></article></div>
      <div className="records">
        <div className="recordtools">
          <h2>
            {name === "Overview"
              ? "Upcoming activity"
              : `Recent ${name.toLowerCase()}`}
          </h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records"
          />
        </div>
        {error&&<p className="formerror">{error}</p>}{!loading&&!error&&rows.length===0&&<p className="emptyrow">No records yet. Add the first {singular}.</p>}{rows.filter(r=>JSON.stringify(r).toLowerCase().includes(search.toLowerCase())).map((r,i)=><div className="record" key={String(r.id||i)}><span>{String(r.id||r.number||"—")}</span><b>{titleOf(r)}</b><small>{detailOf(r)||"Saved record"}</small><span className="rowactions"><button onClick={()=>{setEditing(r);setOpen(true)}}>{name==="Tasks"?"Update":"Edit"}</button>{name!=="Overview"&&name!=="Tasks"&&<button className="danger" onClick={()=>archive(r)}>Archive</button>}</span></div>)}
      </div>
      {open && (
        <RecordModal
          title={`Add ${singular}`}
          fields={paymentFields}
          initial={modalInitial}
          onClose={() => setOpen(false)}
          onSave={save}
        />
      )}
    </div>
  );
}

type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "crm" | "sales" | "technician";
  active: boolean;
  lastLogin?: string | null;
  createdAt: string;
};
const roleNames = {
  admin: "Admin / Owner",
  crm: "CRM / Marketing",
  sales: "Sales / Site Visit",
  technician: "Technician",
};
function UsersModule({ currentEmail }: { currentEmail: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]),
    [loading, setLoading] = useState(true),
    [open, setOpen] = useState(false),
    [editing, setEditing] = useState<ManagedUser | null>(null),
    [notice, setNotice] = useState("");
  const load = () => {
    setLoading(true);
    fetch("/api/users")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setUsers(d.users);
      })
      .catch((e) => setNotice(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  const update = async (
    user: ManagedUser,
    changes: Record<string, unknown>,
  ) => {
    const r = await fetch("/api/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: user.id, ...changes }),
      }),
      d = await r.json();
    if (!r.ok) {
      setNotice(d.error || "Unable to update employee");
      return;
    }
    setNotice("Employee account updated");
    setEditing(null);
    load();
  };
  return (
    <div className="modulepage">
      <div className="modulehero">
        <div>
          <small>ADMINISTRATION</small>
          <h1>Users & access</h1>
          <p>
            Only the Admin / Owner can create accounts and control employee
            access.
          </p>
        </div>
        <button className="primary" onClick={() => setOpen(true)}>
          ＋ Add employee
        </button>
      </div>
      {notice && <div className="toast">{notice}</div>}
      <div className="statgrid">
        <article>
          <small>TOTAL USERS</small>
          <b>{users.length}</b>
        </article>
        <article>
          <small>ACTIVE</small>
          <b>{users.filter((u) => u.active).length}</b>
        </article>
        <article>
          <small>ADMINS</small>
          <b>{users.filter((u) => u.role === "admin").length}</b>
        </article>
        <article>
          <small>SECURITY</small>
          <b>Admin controlled</b>
        </article>
      </div>
      <div className="records">
        <div className="recordtools">
          <h2>Employee accounts</h2>
          <span className="securebadge">Passwords encrypted</span>
        </div>
        {loading ? (
          <p className="emptyrow">Loading accounts…</p>
        ) : (
          users.map((u) => (
            <div className="userrow" key={u.id}>
              <span className={u.active ? "useravatar" : "useravatar off"}>
                {u.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <b>{u.name}</b>
                <small>{u.email}</small>
              </div>
              <span className="rolepill">{roleNames[u.role]}</span>
              <span className={u.active ? "statuspill active" : "statuspill"}>
                {u.active ? "Active" : "Inactive"}
              </span>
              <button onClick={() => setEditing(u)}>Manage</button>
            </div>
          ))
        )}
      </div>
      {open && (
        <UserModal
          onClose={() => setOpen(false)}
          onSave={async (v) => {
            const r = await fetch("/api/users", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(v),
              }),
              d = await r.json();
            if (!r.ok) throw new Error(d.error);
            setOpen(false);
            setNotice("Employee account created");
            load();
          }}
        />
      )}
      {editing && (
        <ManageUserModal
          user={editing}
          isSelf={editing.email === currentEmail}
          onClose={() => setEditing(null)}
          onUpdate={(c) => update(editing, c)}
        />
      )}
    </div>
  );
}
function UserModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (v: Record<string, string>) => Promise<void>;
}) {
  const [v, setV] = useState({
      name: "",
      email: "",
      password: "",
      role: "sales",
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="modalback">
      <form
        className="modal"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await onSave(v);
          } catch (x) {
            setError(
              x instanceof Error ? x.message : "Unable to create employee",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="modalhead">
          <div>
            <small>ADMIN ONLY</small>
            <h2>Create employee account</h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="formgrid">
          <label>
            <span>Full name *</span>
            <input
              required
              value={v.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
            />
          </label>
          <label>
            <span>Work email *</span>
            <input
              type="email"
              required
              value={v.email}
              onChange={(e) => setV({ ...v, email: e.target.value })}
            />
          </label>
          <label>
            <span>Role *</span>
            <select
              value={v.role}
              onChange={(e) => setV({ ...v, role: e.target.value })}
            >
              {Object.entries(roleNames).map(([k, n]) => (
                <option value={k} key={k}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Temporary password *</span>
            <input
              type="password"
              minLength={10}
              required
              value={v.password}
              onChange={(e) => setV({ ...v, password: e.target.value })}
            />
          </label>
        </div>
        {error && <p className="formerror">{error}</p>}
        <div className="modalactions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </div>
      </form>
    </div>
  );
}
function ManageUserModal({
  user,
  isSelf,
  onClose,
  onUpdate,
}: {
  user: ManagedUser;
  isSelf: boolean;
  onClose: () => void;
  onUpdate: (v: Record<string, unknown>) => void;
}) {
  const [role, setRole] = useState(user.role),
    [password, setPassword] = useState("");
  const changed = role !== user.role || password.length >= 10;
  return (
    <div className="modalback">
      <div className="modal">
        <div className="modalhead">
          <div>
            <small>USER ACCESS</small>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <div className="formgrid">
          <label>
            <span>Permission role</span>
            <select
              value={role}
              disabled={isSelf}
              onChange={(e) => setRole(e.target.value as ManagedUser["role"])}
            >
              {Object.entries(roleNames).map(([k, n]) => (
                <option value={k} key={k}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>New password (optional)</span>
            <input
              type="password"
              minLength={10}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 10 characters"
            />
          </label>
        </div>
        {isSelf && (
          <p className="ownerhint">
            The signed-in owner account cannot be deactivated or demoted.
          </p>
        )}
        <div className="modalactions">
          <button onClick={onClose}>Cancel</button>
          {!isSelf && (
            <button onClick={() => onUpdate({ active: !user.active })}>
              {user.active ? "Deactivate" : "Activate"}
            </button>
          )}
          <button
            className="primary"
            disabled={!changed}
            onClick={() => {
              const changes: Record<string, unknown> = {};
              if (role !== user.role) changes.role = role;
              if (password) changes.password = password;
              onUpdate(changes);
            }}
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

type Field = {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: (string | {value:string;label:string;parent?:string})[];
  dependsOn?: string;
  placeholder?: string;
};
const formFields: Record<string, Field[]> = {
  Overview: [
    { key: "title", label: "Activity", required: true },
    { key: "status", label: "When", type: "datetime-local", required: true },
    { key: "name", label: "Assigned employee", required: true },
  ],
  Leads: [
    { key: "name", label: "Customer name", required: true },
    { key: "phone", label: "Phone number", type: "tel", required: true },
    {
      key: "requirement",
      label: "Requirement",
      required: true,
      options: [
        "Smart Home",
        "Switches",
        "Door Lock",
        "Curtains",
        "CCTV",
        "Gate Automation",
        "Networking",
        "Service",
      ],
    },
    {
      key: "source",
      label: "Lead source",
      options: [
        "Instagram",
        "Facebook",
        "Google",
        "Website",
        "Referral",
        "Walk-in",
        "Existing Customer",
      ],
    },
    { key: "site", label: "Site address", required: true },
    {
      key: "status",
      label: "Pipeline status",
      options: [
        "New",
        "Contacted",
        "Site Visit Scheduled",
        "Quote In Progress",
        "Quote Sent",
        "Follow-up",
        "Won",
        "Lost",
      ],
    },
    { key: "followup", label: "Follow-up date", type: "date" },
    { key: "notes", label: "Notes", type: "textarea" },
  ],
  Customers: [
    { key: "name", label: "Customer name", required: true },
    { key: "phone", label: "Phone / WhatsApp", type: "tel", required: true },
    { key: "email", label: "Email", type: "email" },
    { key: "gstin", label: "GSTIN" },
    { key: "site", label: "Site name", required: true },
    { key: "address", label: "Full address", type: "textarea", required: true },
    {
      key: "building",
      label: "Building type",
      options: ["Villa", "Apartment", "Office", "Showroom", "Factory", "Other"],
    },
  ],
  Projects: [
    { key: "id", label: "Project ID", required: true },
    { key: "title", label: "Project title", required: true },
    { key: "customer_id", label: "Customer database ID", type:"number", required: true },
    { key: "site_id", label: "Site ID", required: true },
    { key: "quotation_id", label: "Accepted quotation ID", type:"number", required: true },
    { key: "value", label: "Project value", type: "number", required: true },
    { key: "manager_id", label: "Project manager user ID" },
    {
      key: "status",
      label: "Stage",
      options: [
        "Confirmed",
        "Advance Received",
        "Procurement",
        "Materials Ready",
        "Materials at Site",
        "Installation",
        "Testing and Configuration",
        "Handover",
        "Completed",
      ],
    },
    {
      key: "planned_start",
      label: "Planned start",
      type: "date",
    },
    { key:"planned_end",label:"Planned completion",type:"date" },
    { key:"notes",label:"Notes",type:"textarea" },
  ],
  Payments: [
    { key: "project_id", label: "Project ID" },
    { key: "quotation_id", label: "Quotation ID", type:"number" },
    { key: "amount", label: "Amount received", type: "number", required: true },
    { key: "date", label: "Payment date", type: "date", required: true },
    {
      key: "mode",
      label: "Payment mode",
      options: ["Bank transfer", "Cash", "UPI", "Cheque"],
      required: true,
    },
    { key: "reference", label: "Transaction reference", required: true },
    { key: "notes", label: "Notes", type:"textarea" },
  ],
  Procurement:[{key:"project_id",label:"Project ID",required:true},{key:"name",label:"Material / product",required:true},{key:"sku",label:"SKU"},{key:"required_qty",label:"Required quantity",type:"number",required:true},{key:"ordered_qty",label:"Ordered quantity",type:"number"},{key:"received_qty",label:"Received quantity",type:"number"},{key:"status",label:"Status",options:["Required","Pending","Ordered","Received","At Site","Installed"]},{key:"vendor_id",label:"Vendor ID"},{key:"buying_price",label:"Buying price",type:"number"},{key:"freight",label:"Freight",type:"number"},{key:"purchase_reference",label:"Purchase reference"},{key:"expected_delivery",label:"Expected delivery",type:"date"}],
  Expenses:[{key:"id",label:"Expense ID",required:true},{key:"project_id",label:"Linked project ID"},{key:"date",label:"Date",type:"date",required:true},{key:"category",label:"Category",options:["Product Purchase","Freight","Site Travel","Labour","Salary","Rent","Marketing","Tools","Miscellaneous"],required:true},{key:"vendor",label:"Vendor",required:true},{key:"amount",label:"Amount",type:"number",required:true},{key:"tax",label:"GST / tax",type:"number"},{key:"mode",label:"Payment mode",options:["Cash","Bank Transfer","UPI","Cheque","Other"],required:true},{key:"notes",label:"Notes",type:"textarea"}],
  Service:[{key:"customer_id",label:"Customer ID",type:"number",required:true},{key:"site_id",label:"Site ID",required:true},{key:"project_id",label:"Project ID"},{key:"problem",label:"Problem description",type:"textarea",required:true},{key:"priority",label:"Priority",options:["Low","Normal","High","Urgent"]},{key:"assigned_to",label:"Technician user ID"},{key:"scheduled_at",label:"Visit schedule",type:"datetime-local"},{key:"status",label:"Status",options:["Open","Assigned","In Progress","Waiting for Parts","Resolved","Closed"]},{key:"resolution",label:"Resolution notes",type:"textarea"},{key:"parts_replaced",label:"Parts replaced",type:"textarea"}],
  Settings: [
    { key: "name", label: "Employee name", required: true },
    { key: "email", label: "Work email", type: "email", required: true },
    {
      key: "role",
      label: "Role",
      options: [
        "Admin / Owner",
        "CRM / Marketing",
        "Sales / Site Visit",
        "Technician",
      ],
      required: true,
    },
    { key: "status", label: "Account status", options: ["Active", "Inactive"] },
  ],
  Items: [
    { key: "name", label: "Product name", required: true },
    { key: "series", label: "Series / brand", required: true },
    { key: "sku", label: "SKU", required: true },
    { key: "module", label: "Module size", required: true },
    {
      key: "technology",
      label: "Technology",
      options: ["ZigBee", "Wi-Fi", "Matter", "Manual"],
    },
    { key: "finish", label: "Finish", required: true },
    {
      key: "sellingPrice",
      label: "Selling price",
      type: "number",
      required: true,
    },
    {
      key: "purchaseCost",
      label: "Purchase cost (Admin only)",
      type: "number",
      required: true,
    },
  ],
};
function RecordModal({
  title,
  fields,
  onClose,
  onSave,
  initial,
}: {
  title: string;
  fields: Field[];
  onClose: () => void;
  onSave: (v: Record<string, string>) => void;
  initial?: Record<string,string>;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial||{});
  const [error, setError] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = fields.find((f) => f.required && !values[f.key]?.trim());
    if (missing) {
      setError(`${missing.label} is required`);
      return;
    }
    onSave(values);
  };
  return (
    <div
      className="modalback"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="modal" onSubmit={submit}>
        <div className="modalhead">
          <div>
            <small>TECHOMIE FLOW</small>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="formgrid">
          {fields.map((f) => (
            <label className={f.type === "textarea" ? "wide" : ""} key={f.key}>
              <span>
                {f.label}
                {f.required && <b> *</b>}
              </span>
              {f.options ? (
                <select
                  value={values[f.key] || ""}
                  onChange={(e) => setValues((v) => {
                    const next={...v,[f.key]:e.target.value};
                    fields.filter(field=>field.dependsOn===f.key).forEach(field=>{next[field.key]=""});
                    return next;
                  })}
                >
                  <option value="">Select</option>
                  {f.options.filter(o=>typeof o==="string"||!f.dependsOn||!o.parent||o.parent===values[f.dependsOn]).map((o) => typeof o==="string"?(
                    <option key={o} value={o}>{o}</option>
                  ):(<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  value={values[f.key] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              ) : (
                <input
                  type={f.type || "text"}
                  placeholder={f.placeholder}
                  value={values[f.key] || ""}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              )}
            </label>
          ))}
        </div>
        {error && <p className="formerror">{error}</p>}
        <div className="modalactions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save record
          </button>
        </div>
      </form>
    </div>
  );
}
function QuoteDetailsModal({
  details,
  onClose,
  onSave,
}: {
  details: typeof initialQuote;
  onClose: () => void;
  onSave: (v: typeof initialQuote) => void;
}) {
  const [v, setV] = useState(details),[customers,setCustomers]=useState<any[]>([]),[sites,setSites]=useState<any[]>([]);
  useEffect(()=>{fetch("/api/quotations?page=1&limit=25").then(r=>r.json()).then(d=>{setCustomers(d.filters?.customers||[]);setSites(d.filters?.sites||[])})},[]);
  const customerSites=sites.filter(s=>String(s.customer_id)===String(v.customerId));
  return (
    <div className="modalback">
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v);
        }}
      >
        <div className="modalhead">
          <div>
            <small>QUOTATION SETUP</small>
            <h2>Quote details</h2>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="formgrid">
          <label><span>Customer</span><select required value={v.customerId} onChange={e=>{const c=customers.find(x=>String(x.id)===e.target.value);setV({...v,customerId:e.target.value,customer:c?.name||"",siteId:"",site:""})}}><option value="">Select customer</option>{customers.map(c=><option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}</select></label>
          <label><span>Customer site</span><select required value={v.siteId} onChange={e=>{const s=sites.find(x=>String(x.id)===e.target.value);setV({...v,siteId:e.target.value,site:s?.name||""})}}><option value="">Select site</option>{customerSites.map(s=><option key={s.id} value={s.id}>{s.name} · {s.city}</option>)}</select></label>
          <label className="wide"><span>Project title</span><input required value={v.projectTitle} onChange={e=>setV({...v,projectTitle:e.target.value})}/></label>
          <label><span>Quote type</span><select value={v.type} onChange={e=>setV({...v,type:e.target.value})}><option>Full Smart Home Proposal</option><option>Standard Product Quotation</option><option>CCTV / Networking Quotation</option><option>Gate Automation Quotation</option><option>Service Estimate</option></select></label>
          <label><span>Project category</span><input value={v.category} onChange={e=>setV({...v,category:e.target.value})}/></label>
          <label><span>Pricing</span><select value={v.pricingMode} onChange={e=>setV({...v,pricingMode:e.target.value})}><option value="exclusive">GST exclusive</option><option value="inclusive">GST inclusive</option></select></label>
          <label><span>Validity (days)</span><input type="number" min="1" value={v.validity} onChange={e=>setV({...v,validity:e.target.value})}/></label>
          <label><span>Sales person</span><input value={v.sales} onChange={e=>setV({...v,sales:e.target.value})}/></label>
        </div>
        <div className="modalactions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary">Save quote details</button>
        </div>
      </form>
    </div>
  );
}
const initialQuote = {
  customer: "",
  customerId: "",
  site: "",
  siteId: "",
  projectTitle: "",
  category: "Smart Home Automation",
  pricingMode: "exclusive",
  sales: "",
  validity: "30",
  type: "Standard Product Quotation",
};
function AuthScreen({
  setup,
  onSuccess,
}: {
  setup: boolean;
  onSuccess: () => void;
}) {
  const [v, setV] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(setup ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(v),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Unable to continue");
        return;
      }
      onSuccess();
    } catch {
      setError("The server could not complete sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="authpage">
      <form className="authcard" onSubmit={submit}>
        <div className="authbrand">
          <img src="/techomie-logo.jpg" alt="Techomie Smart Devices" />
          <div>
            <b>TECHOMIE</b>
            <small>OPERATIONS SYSTEM</small>
          </div>
        </div>
        <small>{setup ? "FIRST-RUN OWNER SETUP" : "SECURE SIGN IN"}</small>
        <h1>{setup ? "Create owner account" : "Welcome back"}</h1>
        <p>
          {setup
            ? "Configure the first Admin / Owner account for this installation."
            : "Sign in to access Techomie’s internal operations."}
        </p>
        {setup && (
          <label>
            <span>Full name</span>
            <input
              value={v.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
              required
            />
          </label>
        )}
        <label>
          <span>Email address</span>
          <input
            type="email"
            value={v.email}
            onChange={(e) => setV({ ...v, email: e.target.value })}
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={v.password}
            onChange={(e) => setV({ ...v, password: e.target.value })}
            minLength={10}
            required
          />
        </label>
        {error && <div className="autherror">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? "Please wait…" : setup ? "Create owner account" : "Sign in"}
        </button>
        {!setup && (
          <button type="button" className="forgot">
            Forgot password?
          </button>
        )}
        <em>Employee accounts can only be created by the Admin / Owner.</em>
      </form>
    </div>
  );
}

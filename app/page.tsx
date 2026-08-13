"use client";

import { useMemo, useState } from "react";

const products = [
  {id:1, category:"Smart switches", name:"Royal Edge 2M", variant:"4 Switch · ZigBee · Black Glass", sku:"RE-2M-4S-ZB-BG", price:6490, warranty:"6 years", icon:"▦"},
  {id:2, category:"Smart switches", name:"Royal Edge 6M", variant:"4 Switch + 1 Fan · ZigBee · White Glass", sku:"RE-6M-4SF-ZB-WG", price:12490, warranty:"6 years", icon:"▦"},
  {id:3, category:"Smart switches", name:"Touch Plus 8", variant:"8 Switch · Wi-Fi · Black Glass", sku:"TP-8S-WF-BG", price:8990, warranty:"6 years", icon:"⌁"},
  {id:4, category:"Security", name:"Door / Window Sensor", variant:"ZigBee · White", sku:"NQ-DWS-ZB", price:2490, warranty:"2 years", icon:"◫"},
  {id:5, category:"Gateways", name:"NOVIQ Smart Gateway", variant:"ZigBee 3.0 · Wi-Fi", sku:"NQ-GW-ZB3", price:5490, warranty:"2 years", icon:"◉"},
  {id:6, category:"Door locks", name:"Astra Face ID Lock", variant:"Wi-Fi · Camera · Graphite", sku:"NQ-ASTRA-FR", price:32900, warranty:"2 years", icon:"▥"},
  {id:7, category:"Curtains", name:"Silent Curtain Motor", variant:"15 ft · ZigBee · Twin track", sku:"NQ-CM15-ZB", price:18900, warranty:"3 years", icon:"↔"},
  {id:8, category:"CCTV", name:"4MP AI Dome Camera", variant:"PoE · Night colour", sku:"NQ-CCTV-4MP", price:7490, warranty:"2 years", icon:"◉"},
];

const initialRooms = [
  {name:"Living room", floor:"Ground floor", items:[{...products[0],qty:3},{...products[4],qty:1}]},
  {name:"Master bedroom", floor:"First floor", items:[{...products[1],qty:2},{...products[6],qty:1}]},
  {name:"Entrance", floor:"Ground floor", items:[{...products[5],qty:1}]},
];

const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);

export default function Home(){
  const [rooms,setRooms]=useState(initialRooms);
  const [active,setActive]=useState(0);
  const [query,setQuery]=useState("");
  const [category,setCategory]=useState("All");
  const [notice,setNotice]=useState("All changes saved");
  const [mobileNav,setMobileNav]=useState(false);
  const filtered=products.filter(p=>(category==="All"||p.category===category)&&`${p.name} ${p.variant} ${p.sku}`.toLowerCase().includes(query.toLowerCase()));
  const subtotal=rooms.flatMap(r=>r.items).reduce((s,p)=>s+p.price*p.qty,0);
  const tax=Math.round(subtotal*.18); const total=subtotal+tax;
  const add=(p:typeof products[number])=>{setRooms(rs=>rs.map((r,i)=>i===active?{...r,items:[...r.items,{...p,qty:1}]}:r));setNotice(`${p.name} added`);setTimeout(()=>setNotice("All changes saved"),1500)};
  const changeQty=(idx:number,d:number)=>setRooms(rs=>rs.map((r,i)=>i===active?{...r,items:r.items.map((p,j)=>j===idx?{...p,qty:Math.max(1,p.qty+d)}:p)}:r));
  const categories=useMemo(()=>["All",...Array.from(new Set(products.map(p=>p.category)))],[]);
  return <main className="shell">
    <aside className={mobileNav?"sidebar open":"sidebar"}>
      <div className="brand"><span className="brandmark">N</span><span><b>TECHOMIE</b><small>OPERATIONS</small></span></div>
      <nav>{[["⌂","Overview"],["◎","Leads"],["♙","Customers"],["◫","Catalogue"],["✦","Quotations"],["◇","Projects"],["₹","Payments"],["⚙","Settings"]].map(([i,n])=><button key={n} className={n==="Quotations"?"selected":""}><span>{i}</span>{n}{n==="Leads"&&<em>12</em>}</button>)}</nav>
      <div className="profile"><span>AR</span><div><b>Adithyaa R</b><small>Admin / Owner</small></div><i>•••</i></div>
    </aside>
    <section className="workspace">
      <header><button className="hamb" onClick={()=>setMobileNav(!mobileNav)}>☰</button><div className="crumb"><span>Quotations</span><i>/</i><b>QT-1145</b></div><div className="save"><span>●</span>{notice}</div><button className="preview" onClick={()=>window.print()}>Preview PDF</button><button className="send" onClick={()=>setNotice("Quote marked ready to send")}>Send quote <span>↗</span></button></header>
      <div className="titlebar"><div><p>STANDARD QUOTATION <span>REV 0</span></p><h1>Ramanathan Residence</h1><div className="meta"><span>QT-1145</span><span>•</span><span>14 Aug 2026</span><span>•</span><span>Valid for 30 days</span></div></div><div className="client"><small>PREPARED FOR</small><b>Arun Ramanathan</b><span>Villa 18, Nehru Nagar, Coimbatore</span></div></div>
      <div className="builder">
        <section className="catalogue"><div className="sectionhead"><div><span>01</span><div><h2>Product catalogue</h2><p>Pick a product to add it to the selected room</p></div></div><button>＋ New product</button></div>
          <label className="search">⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products, variants or SKU"/><kbd>⌘ K</kbd></label>
          <div className="chips">{categories.map(c=><button onClick={()=>setCategory(c)} className={category===c?"active":""} key={c}>{c}</button>)}</div>
          <div className="productgrid">{filtered.map(p=><article key={p.id}><div className="prodimg"><span>{p.icon}</span><small>NOVIQ</small></div><div className="prodinfo"><small>{p.category.toUpperCase()}</small><h3>{p.name}</h3><p>{p.variant}</p><div><b>{money(p.price)}</b><span>incl. 18% GST</span></div><button onClick={()=>add(p)}>＋ Add to room</button></div></article>)}</div>
        </section>
        <section className="quote"><div className="sectionhead"><div><span>02</span><div><h2>Build by room</h2><p>Ground & first floor · 3 rooms</p></div></div><button>＋ Add room</button></div>
          <div className="rooms">{rooms.map((r,i)=><button key={r.name} onClick={()=>setActive(i)} className={active===i?"active":""}><small>{r.floor}</small><b>{r.name}</b><span>{r.items.reduce((s,p)=>s+p.qty,0)} items</span></button>)}</div>
          <div className="roomhead"><div><small>{rooms[active].floor.toUpperCase()}</small><h2>{rooms[active].name}</h2></div><button>⋯</button></div>
          <div className="lines">{rooms[active].items.map((p,i)=><div className="line" key={`${p.id}-${i}`}><span className="handle">⋮⋮</span><div className="mini">{p.icon}</div><div className="linedetail"><b>{p.name}</b><span>{p.variant}</span><small>{p.sku} · {p.warranty} warranty</small></div><div className="qty"><button onClick={()=>changeQty(i,-1)}>−</button><b>{p.qty}</b><button onClick={()=>changeQty(i,1)}>＋</button></div><strong>{money(p.price*p.qty)}</strong><button className="more">•••</button></div>)}</div>
          <button className="drop">＋ Drop products here or choose from catalogue</button>
          <div className="summary"><div><span>Subtotal</span><b>{money(subtotal)}</b></div><div><span>CGST 9%</span><b>{money(tax/2)}</b></div><div><span>SGST 9%</span><b>{money(tax/2)}</b></div><div className="grand"><span>Grand total <small>incl. taxes</small></span><b>{money(total)}</b></div><div className="advance"><span>80% advance at confirmation</span><b>{money(total*.8)}</b></div></div>
        </section>
      </div>
    </section>
  </main>
}

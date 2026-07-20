module.exports=[735884,a=>{"use strict";var b=a.i(761469);async function c(a){return(await (0,b.query)("SELECT * FROM billing_profiles WHERE customer_uid = ? LIMIT 1",[a]))[0]||null}async function d(){let a=new Date,c=a.getMonth()>=3?a.getFullYear():a.getFullYear()-1,d=`${String(c).slice(-2)}-${String(c+1).slice(-2)}`;await (0,b.query)(`INSERT INTO invoice_counters (financial_year, last_number) VALUES (?, 0)
     ON DUPLICATE KEY UPDATE last_number = last_number`,[d]),await (0,b.query)("UPDATE invoice_counters SET last_number = last_number + 1 WHERE financial_year = ?",[d]);let e=await (0,b.query)("SELECT last_number FROM invoice_counters WHERE financial_year = ? LIMIT 1",[d]);return`AR360/${d}/${String(e[0]?.last_number||1).padStart(5,"0")}`}async function e(a){return await (0,b.query)(`INSERT INTO billing_invoices
      (invoice_uid, invoice_number, customer_uid, subscription_id, plan_id, period, amount_paise, subtotal_paise,
       tax_paise, cgst_paise, sgst_paise, igst_paise, total_paise, currency, status, razorpay_payment_id, paid_at,
       buyer_name, buyer_email, buyer_gstin, buyer_address, seller_gstin, invoice_html)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[a.invoiceUid,a.invoiceNumber,a.customerUid,a.subscriptionId||null,a.planId,a.period,a.amountPaise,a.subtotalPaise,a.taxPaise,a.cgstPaise,a.sgstPaise,a.igstPaise,a.totalPaise,a.status||"paid",a.razorpayPaymentId||null,a.paidAt||null,a.buyerName||null,a.buyerEmail||null,a.buyerGstin||null,a.buyerAddress||null,a.sellerGstin||null,a.invoiceHtml||null]),f(a.invoiceUid)}async function f(a){return(await (0,b.query)("SELECT * FROM billing_invoices WHERE invoice_uid = ? LIMIT 1",[a]))[0]||null}async function g(a){return(await (0,b.query)("SELECT * FROM billing_invoices WHERE razorpay_payment_id = ? ORDER BY created_at DESC LIMIT 1",[a]))[0]||null}async function h(a){let c=(await (0,b.query)("SELECT contact_name, company_name, email, phone, country FROM customers WHERE customer_uid = ? LIMIT 1",[a]))[0];return c?{company_name:c.company_name||c.contact_name,billing_name:c.contact_name,billing_email:c.email,billing_phone:c.phone,country:c.country||"India"}:null}a.s(["getBillingProfile",0,c,"getCustomerFallbackProfile",0,h,"getInvoiceByRazorpayPaymentId",0,g,"getInvoiceByUid",0,f,"insertInvoice",0,e,"nextInvoiceNumber",0,d])},660682,a=>{"use strict";var b=a.i(254799),c=a.i(735884),d=a.i(761469);let e=process.env.BILLING_SELLER_GSTIN||"",f=process.env.BILLING_SELLER_NAME||"AR360 Studio",g=process.env.BILLING_SELLER_ADDRESS||"India",h=process.env.BILLING_SELLER_STATE||"Gujarat",i=process.env.BILLING_SUPPORT_EMAIL||"support@ar360.studio";function j(a){return`₹${(a/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`}function k(a){return a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function l(a){let b=String(a||"").trim().toLowerCase(),c={basic:"Basic",starter:"Starter",professional:"Professional",pro:"Professional",business:"Business",enterprise:"Enterprise",free:"Free",trial:"Trial"};return c[b]?c[b]:String(a||"Plan").replace(/[_-]+/g," ").replace(/\b\w/g,a=>a.toUpperCase())}async function m(b){let c=String(b||"").trim();if(!c)return"Plan";let d=l(c);if(!c.startsWith("ecp_")&&d!==c.replace(/[_-]+/g," ").replace(/\b\w/g,a=>a.toUpperCase()))return d;try{let{query:b}=await a.A(3571);if(c.startsWith("ecp_")){let a=await b("SELECT name FROM enterprise_custom_plans WHERE custom_plan_uid = ? LIMIT 1",[c]);if(a[0]?.name)return a[0].name}let d=await b("SELECT name FROM billing_plans WHERE id = ? LIMIT 1",[c]);if(d[0]?.name)return d[0].name}catch{}return d}function n(a){if(!a)return"—";let b=new Date(a);return Number.isNaN(b.getTime())?"—":b.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}async function o(a){let b=await (0,c.getBillingProfile)(a);return b||(0,c.getCustomerFallbackProfile)(a)}async function p(a){var d,p,q;let r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T=await o(a.customerUid),U=await (0,c.nextInvoiceNumber)(),{subtotalPaise:V,taxPaise:W,totalPaise:X}=function(a){if(!Number.isSafeInteger(a)||a<=0)throw Error("Invoice total must be positive paise.");let b=Math.round(a/1.18);return{subtotalPaise:b,taxPaise:a-b,totalPaise:a}}(a.amountPaise),Y=(T?.state||"").toLowerCase()===h.toLowerCase(),Z=Y?Math.round(W/2):0,$=Y?W-Z:0,_=Y?0:W,aa={invoice_uid:`INV_${(0,b.randomUUID)().replace(/-/g,"").slice(0,16).toUpperCase()}`,invoice_number:U,customer_uid:a.customerUid,subscription_id:a.subscriptionId||null,plan_id:a.planId,period:a.period,amount_paise:V,subtotal_paise:V,tax_paise:W,cgst_paise:Z,sgst_paise:$,igst_paise:_,total_paise:X,currency:"INR",status:a.status||"paid",razorpay_payment_id:a.razorpayPaymentId||null,paid_at:a.paidAt||null,buyer_name:T?.company_name||T?.billing_name||"Customer",buyer_email:T?.billing_email||null,buyer_gstin:T?.gstin||null,buyer_address:T?[T.address_line1,T.address_line2,T.city,T.state,T.postal_code,T.country].filter(Boolean).join(", "):"",seller_gstin:e||null,created_at:new Date().toISOString()},ab=await m(a.planId);return(0,c.insertInvoice)({...a,amountPaise:V,invoiceUid:aa.invoice_uid,invoiceNumber:U,subtotalPaise:V,taxPaise:W,cgstPaise:Z,sgstPaise:$,igstPaise:_,totalPaise:X,buyerName:aa.buyer_name,buyerEmail:aa.buyer_email,buyerGstin:aa.buyer_gstin,buyerAddress:aa.buyer_address,sellerGstin:e||null,invoiceHtml:(d=aa,p=ab,t=k(d.invoice_uid),u=k(d.invoice_number||d.invoice_uid),v=k(f),w=k(g),x=k(d.seller_gstin||e||"Not registered"),y=k(h),z=k(d.buyer_name||"Customer"),A=k(d.buyer_email||""),B=k(d.buyer_address||""),C=k(d.buyer_gstin||"—"),D=k(p||l(d.plan_id)),E=k("yearly"===(r=String((q=d.period)||"").toLowerCase())||"annual"===r||"year"===r?"Yearly":"monthly"===r||"month"===r?"Monthly":String(q||"—").replace(/\b\w/g,a=>a.toUpperCase())),F=k(i),G=d.razorpay_payment_id?k(d.razorpay_payment_id):"",H="paid"===(s=String(d.status||"").toLowerCase())?{label:"Paid",bg:"#EEF9E0",fg:"#3D6600",border:"#C8E6A0"}:"failed"===s?{label:"Failed",bg:"#FEF2F2",fg:"#B91C1C",border:"#FECACA"}:"void"===s||"refunded"===s?{label:"void"===s?"Void":"Refunded",bg:"#F3F4F6",fg:"#4B5563",border:"#E5E7EB"}:{label:"Draft",bg:"#F8FAFC",fg:"#64748B",border:"#E2E8F0"},I=d.subtotal_paise??d.amount_paise,J=d.cgst_paise||0,K=d.sgst_paise||0,L=d.igst_paise||0,M=(d.tax_paise??0)||J+K+L,N=n(d.created_at),O=n(d.paid_at),P=j(d.total_paise),Q=`/api/billing/invoices/${t}/download?format=pdf`,R=[],J>0&&R.push(`<tr><td>CGST (9% on ${j(I)})</td><td class="num">${j(J)}</td></tr>`),K>0&&R.push(`<tr><td>SGST (9% on ${j(I)})</td><td class="num">${j(K)}</td></tr>`),L>0&&R.push(`<tr><td>IGST (18% on ${j(I)})</td><td class="num">${j(L)}</td></tr>`),S="paid"===d.status?`${P} INR \xb7 Paid${d.paid_at?` ${O}`:""}`:`${P} INR due`,`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${u}</title>
  <style>
    @page { size: A4; margin: 0; }
    :root {
      --ink: #111111;
      --muted: #6B7280;
      --line: #E5E7EB;
      --lime: #B9FF2C;
      --lime-ink: #3D6600;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #E8EAED;
      color: var(--ink);
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .toolbar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 10px;
      padding: 14px 16px;
      background: rgba(255,255,255,0.92);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(10px);
    }
    .toolbar a, .toolbar button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 40px;
      padding: 0 16px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #fff;
      color: var(--ink);
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
    }
    .toolbar a.primary {
      border-color: #0A0B14;
      background: #0A0B14;
      color: #fff;
    }
    .toolbar a.primary:hover { background: #1a1b24; }
    .toolbar button:hover, .toolbar a:not(.primary):hover { background: #FAFAFA; }
    .sheet-wrap {
      padding: 28px 16px 40px;
      display: flex;
      justify-content: center;
    }
    .sheet {
      width: 210mm;
      min-height: 297mm;
      height: 297mm;
      background: #fff;
      padding: 18mm 18mm 14mm;
      box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
      display: flex;
      flex-direction: column;
    }
    .sheet-body { flex: 1 1 auto; }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
    }
    .top h1 {
      margin: 0;
      font-size: 34px;
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .mark {
      width: 34px;
      height: 34px;
      border: 3px solid var(--lime);
      border-radius: 8px;
    }
    .logo-text {
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.03em;
    }
    .logo-text span { color: #84D400; }
    .meta {
      margin-top: 22px;
      font-size: 13px;
      line-height: 1.7;
      color: #374151;
    }
    .meta strong { color: var(--ink); font-weight: 700; }
    .parties {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 28px;
      margin-top: 28px;
    }
    .party .label {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .party .name {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .party p {
      margin: 0;
      font-size: 13px;
      line-height: 1.55;
      color: #4B5563;
    }
    .due {
      margin-top: 28px;
      padding: 4px 0 18px;
      border-bottom: 1px solid var(--line);
    }
    .due .amount {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .due .badge {
      display: inline-flex;
      margin-left: 10px;
      padding: 3px 9px;
      border-radius: 999px;
      border: 1px solid ${H.border};
      background: ${H.bg};
      color: ${H.fg};
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      vertical-align: middle;
    }
    .due .ref {
      margin-top: 6px;
      font-size: 12px;
      color: var(--muted);
    }
    table.items {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    table.items th {
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
      padding: 12px 8px;
      border-bottom: 1px solid var(--line);
    }
    table.items th.num, table.items td.num { text-align: right; }
    table.items th.qty, table.items td.qty { text-align: center; width: 48px; }
    table.items td {
      padding: 14px 8px;
      border-bottom: 1px solid var(--line);
      font-size: 13px;
      vertical-align: top;
    }
    table.items .desc { font-weight: 700; }
    table.items .desc-sub {
      margin-top: 2px;
      font-size: 12px;
      color: var(--muted);
    }
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    table.totals { width: 280px; border-collapse: collapse; }
    table.totals td {
      padding: 7px 0;
      font-size: 13px;
      color: #4B5563;
    }
    table.totals td.num { text-align: right; color: var(--ink); font-weight: 600; }
    table.totals tr.grand td {
      padding-top: 12px;
      border-top: 1px solid var(--ink);
      font-size: 14px;
      font-weight: 800;
      color: var(--ink);
    }
    .footer {
      margin-top: auto;
      padding-top: 14px;
      border-top: 1px solid var(--line);
      font-size: 12px;
      color: var(--muted);
      line-height: 1.55;
      flex-shrink: 0;
    }
    .footer a { color: var(--lime-ink); font-weight: 700; text-decoration: none; }
    @media print {
      html, body {
        background: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 210mm;
        height: 297mm;
      }
      .toolbar { display: none !important; }
      .sheet-wrap {
        padding: 0 !important;
        margin: 0 !important;
        display: block !important;
      }
      .sheet {
        width: 210mm !important;
        height: 297mm !important;
        min-height: 297mm !important;
        margin: 0 !important;
        padding: 16mm 16mm 12mm !important;
        box-shadow: none !important;
        display: flex !important;
        flex-direction: column !important;
        page-break-after: avoid;
      }
      .sheet-body { flex: 1 1 auto !important; }
      .footer { margin-top: auto !important; }
      .top { flex-direction: row !important; }
      .parties { grid-template-columns: 1fr 1fr !important; }
    }
    /* screen-only: avoid print preview picking up mobile layout */
    @media screen and (max-width: 820px) {
      .sheet {
        width: 100%;
        height: auto;
        min-height: 0;
        padding: 28px 20px;
      }
      .parties { grid-template-columns: 1fr; gap: 18px; }
      .top { flex-direction: column-reverse; }
      .footer { margin-top: 40px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <a class="primary" href="${Q}">Download PDF</a>
    <button type="button" onclick="window.print()">Print</button>
  </div>
  <div class="sheet-wrap">
    <article class="sheet">
      <div class="sheet-body">
      <div class="top">
        <h1>Invoice</h1>
        <div class="logo">
          <div class="mark" aria-hidden="true"></div>
          <div class="logo-text">AR<span>360</span></div>
        </div>
      </div>

      <div class="meta">
        <div><strong>Invoice number</strong>&nbsp;&nbsp;${u}</div>
        <div><strong>Date of issue</strong>&nbsp;&nbsp;${N}</div>
        <div><strong>${d.paid_at?"Date paid":"Status"}</strong>&nbsp;&nbsp;${d.paid_at?O:H.label}</div>
        ${G?`<div><strong>Payment ref</strong>&nbsp;&nbsp;${G}</div>`:""}
      </div>

      <div class="parties">
        <section class="party">
          <div class="label">${v}</div>
          <div class="name">AR360</div>
          <p>${w}</p>
          <p>State: ${y}</p>
          <p>GSTIN: ${x}</p>
          <p><a href="mailto:${F}">${F}</a></p>
        </section>
        <section class="party">
          <div class="label">Bill to</div>
          <div class="name">${z}</div>
          ${A?`<p>${A}</p>`:""}
          <p>${B||"—"}</p>
          <p>GSTIN: ${C}</p>
        </section>
      </div>

      <div class="due">
        <div class="amount">${S}<span class="badge">${H.label}</span></div>
        ${G?`<div class="ref">Paid via Razorpay \xb7 ${G}</div>`:""}
      </div>

      <table class="items">
        <thead>
          <tr>
            <th>Description</th>
            <th class="qty">Qty</th>
            <th class="num">Unit price</th>
            <th class="num">Tax</th>
            <th class="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="desc">${D} Plan</div>
              <div class="desc-sub">${E} subscription \xb7 AR360 SaaS</div>
            </td>
            <td class="qty">1</td>
            <td class="num">${j(I)}</td>
            <td class="num">18%</td>
            <td class="num">${j(I)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals-wrap">
        <table class="totals">
          <tr><td>Subtotal</td><td class="num">${j(I)}</td></tr>
          <tr><td>Total excluding tax</td><td class="num">${j(I)}</td></tr>
          ${R.join("")}
          ${0===R.length&&M>0?`<tr><td>GST (18%)</td><td class="num">${j(M)}</td></tr>`:""}
          <tr class="grand"><td>Amount ${"paid"===d.status?"paid":"due"}</td><td class="num">${P} INR</td></tr>
        </table>
      </div>
      </div>

      <footer class="footer">
        <div>${v}</div>
        <div>GSTIN: ${x} \xb7 This is a computer-generated tax invoice. No signature required.</div>
      </footer>
    </article>
  </div>
</body>
</html>`)})}async function q(a){if(a.razorpayPaymentId){let b=await (0,c.getInvoiceByRazorpayPaymentId)(a.razorpayPaymentId);if(b)return a.orderUid&&await (0,d.query)("UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW() WHERE order_uid = ?",[b.invoice_uid,a.orderUid]),b}let b=await p({customerUid:a.customerUid,planId:a.planId,period:a.period,amountPaise:a.amountPaise,status:"paid",razorpayPaymentId:a.razorpayPaymentId||null,subscriptionId:a.subscriptionId||null,paidAt:a.paidAt||null});return b?.invoice_uid&&(a.orderUid&&await (0,d.query)("UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW() WHERE order_uid = ?",[b.invoice_uid,a.orderUid]),a.razorpayPaymentId&&await (0,d.query)("UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW() WHERE razorpay_payment_id = ?",[b.invoice_uid,a.razorpayPaymentId])),b}a.s(["finalizePaymentInvoice",0,q])}];

//# sourceMappingURL=src_server_billing_1mssajj._.js.map
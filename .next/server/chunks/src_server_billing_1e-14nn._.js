module.exports=[823337,t=>{"use strict";var e=t.i(843793);async function i(t){return(await (0,e.query)("SELECT * FROM billing_profiles WHERE customer_uid = ? LIMIT 1",[t]))[0]||null}async function a(t){return await (0,e.query)(`INSERT INTO billing_profiles
      (customer_uid, company_name, billing_name, billing_email, billing_phone, gstin, address_line1, address_line2, city, state, postal_code, country)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      company_name = VALUES(company_name), billing_name = VALUES(billing_name), billing_email = VALUES(billing_email),
      billing_phone = VALUES(billing_phone), gstin = VALUES(gstin), address_line1 = VALUES(address_line1),
      address_line2 = VALUES(address_line2), city = VALUES(city), state = VALUES(state), postal_code = VALUES(postal_code),
      country = VALUES(country), updated_at = NOW()`,[t.customer_uid,t.company_name||null,t.billing_name||null,t.billing_email||null,t.billing_phone||null,t.gstin||null,t.address_line1||null,t.address_line2||null,t.city||null,t.state||null,t.postal_code||null,t.country||"India"]),i(t.customer_uid)}async function n(){let t=new Date,i=t.getMonth()>=3?t.getFullYear():t.getFullYear()-1,a=`${String(i).slice(-2)}-${String(i+1).slice(-2)}`;await (0,e.query)(`INSERT INTO invoice_counters (financial_year, last_number) VALUES (?, 0)
     ON DUPLICATE KEY UPDATE last_number = last_number`,[a]),await (0,e.query)("UPDATE invoice_counters SET last_number = last_number + 1 WHERE financial_year = ?",[a]);let n=await (0,e.query)("SELECT last_number FROM invoice_counters WHERE financial_year = ? LIMIT 1",[a]);return`AR360/${a}/${String(n[0]?.last_number||1).padStart(5,"0")}`}async function r(t){return await (0,e.query)(`INSERT INTO billing_invoices
      (invoice_uid, invoice_number, customer_uid, subscription_id, plan_id, period, amount_paise, subtotal_paise,
       tax_paise, cgst_paise, sgst_paise, igst_paise, total_paise, currency, status, razorpay_payment_id, paid_at,
       buyer_name, buyer_email, buyer_gstin, buyer_address, seller_gstin, invoice_html)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,[t.invoiceUid,t.invoiceNumber,t.customerUid,t.subscriptionId||null,t.planId,t.period,t.amountPaise,t.subtotalPaise,t.taxPaise,t.cgstPaise,t.sgstPaise,t.igstPaise,t.totalPaise,t.status||"paid",t.razorpayPaymentId||null,t.paidAt||null,t.buyerName||null,t.buyerEmail||null,t.buyerGstin||null,t.buyerAddress||null,t.sellerGstin||null,t.invoiceHtml||null]),o(t.invoiceUid)}async function o(t){return(await (0,e.query)("SELECT * FROM billing_invoices WHERE invoice_uid = ? LIMIT 1",[t]))[0]||null}async function l(t){return(await (0,e.query)("SELECT * FROM billing_invoices WHERE razorpay_payment_id = ? ORDER BY created_at DESC LIMIT 1",[t]))[0]||null}async function s(t){let i=(await (0,e.query)("SELECT contact_name, company_name, email, phone, country FROM customers WHERE customer_uid = ? LIMIT 1",[t]))[0];return i?{company_name:i.company_name||i.contact_name,billing_name:i.contact_name,billing_email:i.email,billing_phone:i.phone,country:i.country||"India"}:null}async function d(t,i){return(await (0,e.query)("SELECT * FROM billing_invoices WHERE customer_uid = ? AND invoice_uid = ? LIMIT 1",[t,i]))[0]||null}async function p(t,i=50){return(0,e.query)("SELECT * FROM billing_invoices WHERE customer_uid = ? ORDER BY created_at DESC LIMIT ?",[t,i])}t.s(["getBillingProfile",0,i,"getCustomerFallbackProfile",0,s,"getInvoiceByRazorpayPaymentId",0,l,"getInvoiceByUid",0,o,"getInvoiceForCustomer",0,d,"insertInvoice",0,r,"listInvoicesForCustomer",0,p,"nextInvoiceNumber",0,n,"upsertBillingProfile",0,a])},42176,t=>{"use strict";var e=t.i(254799),i=t.i(823337),a=t.i(843793);let n=process.env.BILLING_SELLER_GSTIN||"",r=process.env.BILLING_SELLER_NAME||"AR360 Studio",o=process.env.BILLING_SELLER_ADDRESS||"India",l=process.env.BILLING_SELLER_STATE||"Gujarat",s=process.env.BILLING_SUPPORT_EMAIL||"support@ar360.studio";function d(t){return`₹${(t/100).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`}function p(t){return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function u(t){let e=String(t||"").trim().toLowerCase(),i={basic:"Basic",starter:"Starter",professional:"Professional",pro:"Professional",business:"Business",enterprise:"Enterprise",free:"Free",trial:"Trial"};return i[e]?i[e]:String(t||"Plan").replace(/[_-]+/g," ").replace(/\b\w/g,t=>t.toUpperCase())}async function c(e){let i=String(e||"").trim();if(!i)return"Plan";let a=u(i);if(!i.startsWith("ecp_")&&a!==i.replace(/[_-]+/g," ").replace(/\b\w/g,t=>t.toUpperCase()))return a;try{let{query:e}=await t.A(989186);if(i.startsWith("ecp_")){let t=await e("SELECT name FROM enterprise_custom_plans WHERE custom_plan_uid = ? LIMIT 1",[i]);if(t[0]?.name)return t[0].name}let a=await e("SELECT name FROM billing_plans WHERE id = ? LIMIT 1",[i]);if(a[0]?.name)return a[0].name}catch{}return a}function m(t){let e=String(t||"").toLowerCase();return"yearly"===e||"annual"===e||"year"===e?"Yearly":"monthly"===e||"month"===e?"Monthly":String(t||"—").replace(/\b\w/g,t=>t.toUpperCase())}function g(t){if(!t)return"—";let e=new Date(t);return Number.isNaN(e.getTime())?"—":e.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}function b(t,e){let i,a=p(t.invoice_uid),c=p(t.invoice_number||t.invoice_uid),b=p(r),_=p(o),y=p(t.seller_gstin||n||"Not registered"),f=p(l),v=p(t.buyer_name||"Customer"),h=p(t.buyer_email||""),x=p(t.buyer_address||""),E=p(t.buyer_gstin||"—"),I=p(e||u(t.plan_id)),w=p(m(t.period)),S=p(s),L=t.razorpay_payment_id?p(t.razorpay_payment_id):"",P="paid"===(i=String(t.status||"").toLowerCase())?{label:"Paid",bg:"#EEF9E0",fg:"#3D6600",border:"#C8E6A0"}:"failed"===i?{label:"Failed",bg:"#FEF2F2",fg:"#B91C1C",border:"#FECACA"}:"void"===i||"refunded"===i?{label:"void"===i?"Void":"Refunded",bg:"#F3F4F6",fg:"#4B5563",border:"#E5E7EB"}:{label:"Draft",bg:"#F8FAFC",fg:"#64748B",border:"#E2E8F0"},$=t.subtotal_paise??t.amount_paise,A=t.cgst_paise||0,T=t.sgst_paise||0,R=t.igst_paise||0,C=(t.tax_paise??0)||A+T+R,U=g(t.created_at),N=g(t.paid_at),F=d(t.total_paise),z=`/api/billing/invoices/${a}/download?format=pdf`,D=[];A>0&&D.push(`<tr><td>CGST (9% on ${d($)})</td><td class="num">${d(A)}</td></tr>`),T>0&&D.push(`<tr><td>SGST (9% on ${d($)})</td><td class="num">${d(T)}</td></tr>`),R>0&&D.push(`<tr><td>IGST (18% on ${d($)})</td><td class="num">${d(R)}</td></tr>`);let B="paid"===t.status?`${F} INR \xb7 Paid${t.paid_at?` ${N}`:""}`:`${F} INR due`;return`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${c}</title>
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
      border: 1px solid ${P.border};
      background: ${P.bg};
      color: ${P.fg};
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
    <a class="primary" href="${z}">Download PDF</a>
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
        <div><strong>Invoice number</strong>&nbsp;&nbsp;${c}</div>
        <div><strong>Date of issue</strong>&nbsp;&nbsp;${U}</div>
        <div><strong>${t.paid_at?"Date paid":"Status"}</strong>&nbsp;&nbsp;${t.paid_at?N:P.label}</div>
        ${L?`<div><strong>Payment ref</strong>&nbsp;&nbsp;${L}</div>`:""}
      </div>

      <div class="parties">
        <section class="party">
          <div class="label">${b}</div>
          <div class="name">AR360</div>
          <p>${_}</p>
          <p>State: ${f}</p>
          <p>GSTIN: ${y}</p>
          <p><a href="mailto:${S}">${S}</a></p>
        </section>
        <section class="party">
          <div class="label">Bill to</div>
          <div class="name">${v}</div>
          ${h?`<p>${h}</p>`:""}
          <p>${x||"—"}</p>
          <p>GSTIN: ${E}</p>
        </section>
      </div>

      <div class="due">
        <div class="amount">${B}<span class="badge">${P.label}</span></div>
        ${L?`<div class="ref">Paid via Razorpay \xb7 ${L}</div>`:""}
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
              <div class="desc">${I} Plan</div>
              <div class="desc-sub">${w} subscription \xb7 AR360 SaaS</div>
            </td>
            <td class="qty">1</td>
            <td class="num">${d($)}</td>
            <td class="num">18%</td>
            <td class="num">${d($)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals-wrap">
        <table class="totals">
          <tr><td>Subtotal</td><td class="num">${d($)}</td></tr>
          <tr><td>Total excluding tax</td><td class="num">${d($)}</td></tr>
          ${D.join("")}
          ${0===D.length&&C>0?`<tr><td>GST (18%)</td><td class="num">${d(C)}</td></tr>`:""}
          <tr class="grand"><td>Amount ${"paid"===t.status?"paid":"due"}</td><td class="num">${F} INR</td></tr>
        </table>
      </div>
      </div>

      <footer class="footer">
        <div>${b}</div>
        <div>GSTIN: ${y} \xb7 This is a computer-generated tax invoice. No signature required.</div>
      </footer>
    </article>
  </div>
</body>
</html>`}async function _(t,e){return(0,i.upsertBillingProfile)({...e,customer_uid:t})}async function y(t){let e=await (0,i.getBillingProfile)(t);return e||(0,i.getCustomerFallbackProfile)(t)}async function f(t){let e=await (0,i.getBillingProfile)(t);return e||(0,i.getCustomerFallbackProfile)(t)}async function v(t){let a=await f(t.customerUid),r=await (0,i.nextInvoiceNumber)(),{subtotalPaise:o,taxPaise:s,totalPaise:d}=function(t){if(!Number.isSafeInteger(t)||t<=0)throw Error("Invoice total must be positive paise.");let e=Math.round(t/1.18);return{subtotalPaise:e,taxPaise:t-e,totalPaise:t}}(t.amountPaise),p=(a?.state||"").toLowerCase()===l.toLowerCase(),u=p?Math.round(s/2):0,m=p?s-u:0,g=p?0:s,_={invoice_uid:`INV_${(0,e.randomUUID)().replace(/-/g,"").slice(0,16).toUpperCase()}`,invoice_number:r,customer_uid:t.customerUid,subscription_id:t.subscriptionId||null,plan_id:t.planId,period:t.period,amount_paise:o,subtotal_paise:o,tax_paise:s,cgst_paise:u,sgst_paise:m,igst_paise:g,total_paise:d,currency:"INR",status:t.status||"paid",razorpay_payment_id:t.razorpayPaymentId||null,paid_at:t.paidAt||null,buyer_name:a?.company_name||a?.billing_name||"Customer",buyer_email:a?.billing_email||null,buyer_gstin:a?.gstin||null,buyer_address:a?[a.address_line1,a.address_line2,a.city,a.state,a.postal_code,a.country].filter(Boolean).join(", "):"",seller_gstin:n||null,created_at:new Date().toISOString()},y=await c(t.planId);return(0,i.insertInvoice)({...t,amountPaise:o,invoiceUid:_.invoice_uid,invoiceNumber:r,subtotalPaise:o,taxPaise:s,cgstPaise:u,sgstPaise:m,igstPaise:g,totalPaise:d,buyerName:_.buyer_name,buyerEmail:_.buyer_email,buyerGstin:_.buyer_gstin,buyerAddress:_.buyer_address,sellerGstin:n||null,invoiceHtml:b(_,y)})}async function h(t){if(t.razorpayPaymentId){let e=await (0,i.getInvoiceByRazorpayPaymentId)(t.razorpayPaymentId);if(e)return t.orderUid&&await (0,a.query)("UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW() WHERE order_uid = ?",[e.invoice_uid,t.orderUid]),e}let e=await v({customerUid:t.customerUid,planId:t.planId,period:t.period,amountPaise:t.amountPaise,status:"paid",razorpayPaymentId:t.razorpayPaymentId||null,subscriptionId:t.subscriptionId||null,paidAt:t.paidAt||null});return e?.invoice_uid&&(t.orderUid&&await (0,a.query)("UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW() WHERE order_uid = ?",[e.invoice_uid,t.orderUid]),t.razorpayPaymentId&&await (0,a.query)("UPDATE billing_payments SET invoice_uid = ?, updated_at = NOW() WHERE razorpay_payment_id = ?",[e.invoice_uid,t.razorpayPaymentId])),e}async function x(t){return(0,i.listInvoicesForCustomer)(t)}async function E(t,e){return(0,i.getInvoiceForCustomer)(t,e)}async function I(t,e){let a=await (0,i.getInvoiceForCustomer)(t,e);if(!a)return null;if(a.invoice_html)return a.invoice_html;let n=await c(a.plan_id);return b(a,n)}async function w(e){let{getInvoiceByUid:i}=await t.A(856299),a=await i(e);if(!a)return null;if(a.invoice_html)return a.invoice_html;let n=await c(a.plan_id);return b(a,n)}t.s(["createTaxInvoice",0,v,"finalizePaymentInvoice",0,h,"formatMoney",0,d,"formatPeriodLabel",0,m,"getBillingProfileForCustomer",0,y,"getCustomerInvoice",0,E,"getCustomerInvoiceHtml",0,I,"getCustomerInvoices",0,x,"getMasterInvoiceHtml",0,w,"resolvePlanDisplayName",0,c,"saveBillingProfile",0,_])}];

//# sourceMappingURL=src_server_billing_1e-14nn._.js.map
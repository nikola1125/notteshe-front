import Mailjet from "node-mailjet";
import { getRuntimeEnv } from "./runtime-env";
import { formatMoney, DEFAULT_RATE, type Rate, type Currency } from "./currency";
import { cldImg } from "./cldImage";

let _mailjet: Mailjet | undefined;

export function getMailjet(): Mailjet {
  if (!_mailjet) {
    const apiKey = getRuntimeEnv("MAILJET_API_KEY");
    const secretKey = getRuntimeEnv("MAILJET_SECRET_KEY");
    if (!apiKey) throw new Error("MAILJET_API_KEY is not set");
    if (!secretKey) throw new Error("MAILJET_SECRET_KEY is not set");
    _mailjet = new Mailjet({ apiKey, apiSecret: secretKey });
  }
  return _mailjet;
}

// Admin-set EUR→Lek rate so the email shows prices in the order's currency.
async function getRate(): Promise<Rate> {
  try {
    const { db } = await import("@/db");
    const { shippingConfig } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await db()
      .select({ eurToLekRate: shippingConfig.eurToLekRate, lekRounding: shippingConfig.lekRounding })
      .from(shippingConfig)
      .where(eq(shippingConfig.id, "default"))
      .limit(1);
    if (row) return { eurToLek: row.eurToLekRate ?? 100, lekRounding: row.lekRounding ?? 100 };
  } catch { /* fall back */ }
  return DEFAULT_RATE;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  line1: string;
  line2?: string | null;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
}

interface OrderConfirmationData {
  to: string;
  firstName: string;
  orderId: string;
  currency?: Currency; // amounts below are EUR base; formatted into this currency
  items: Array<{ name: string; size: string; colour: string; quantity: number; unitPrice: number; image?: string | null }>;
  subtotal: number;
  shippingFee: number;
  discountAmount?: number;
  total: number;
  paymentMethod?: string;
  shippingAddress?: ShippingAddress | null;
}

// Brand palette (dark plum) as hex so it renders consistently across email clients.
const C = {
  bg: "#17101c",
  card: "#201525",
  border: "#3a2c42",
  ink: "#f2ecf3",
  muted: "#a99fb2",
  clay: "#cf8791",
};
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";

// Escape user-controlled values before interpolating into email HTML. Without
// this, a gift-card sender name / message (or shipping address) could inject
// arbitrary HTML — turning our own mail server into a phishing delivery channel.
function esc(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Strip line breaks/control chars from values used in email Subject headers.
function escHeader(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

// Pure HTML builder — exported so the email can be previewed in the browser
// (see the admin email-preview route) without sending anything.
export function buildOrderConfirmationHtml(data: OrderConfirmationData, rate: Rate): string {
  const currency: Currency = data.currency ?? "EUR";
  const money = (eur: number) => formatMoney(eur, currency, rate);
  const ref = data.orderId.slice(0, 8).toUpperCase();

  // Item ledger — left-aligned, hairline-separated rows (receipt feel)
  const itemRows = data.items
    .map((i, idx) => {
      const topRule = idx === 0 ? "" : `border-top:1px solid ${C.border};`;
      const thumb = i.image
        ? `<img src="${esc(cldImg(i.image, 120))}" width="44" height="56" alt="" style="display:block;width:44px;height:56px;object-fit:cover;border:1px solid ${C.border};" />`
        : `<div style="width:44px;height:56px;background:${C.border};"></div>`;
      return `<tr>
        <td width="52" valign="top" style="padding:15px 0;${topRule}">${thumb}</td>
        <td valign="top" style="padding:15px 14px;${topRule}font-family:${SANS};">
          <div style="font-size:14px;color:${C.ink};line-height:1.35;">${esc(i.name)}</div>
          <div style="margin-top:5px;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;color:${C.muted};">${esc(i.size)} &nbsp;·&nbsp; ${esc(i.colour)} &nbsp;·&nbsp; Qty ${i.quantity}</div>
        </td>
        <td valign="top" align="right" style="padding:15px 0;${topRule}font-family:${SANS};font-size:14px;color:${C.ink};white-space:nowrap;">${money(i.unitPrice * i.quantity)}</td>
      </tr>`;
    })
    .join("");

  // Totals ledger — uppercase labels; the Total lands in serif on a clay rule
  const row = (label: string, value: string, strong = false): string => `
    <tr>
      <td style="font-family:${SANS};font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${strong ? C.ink : C.muted};padding:${strong ? "15px 0 0" : "5px 0"};${strong ? `border-top:2px solid ${C.clay};` : ""}">${label}</td>
      <td align="right" style="font-family:${strong ? SERIF : SANS};font-size:${strong ? "22px" : "13px"};color:${C.ink};padding:${strong ? "12px 0 0" : "5px 0"};${strong ? `border-top:2px solid ${C.clay};` : ""}">${value}</td>
    </tr>`;

  const addr = data.shippingAddress;
  const addressBlock = addr
    ? `<tr><td style="padding:2px 40px 30px;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid ${C.border};">
          <tr><td style="padding-top:22px;">
            <p style="margin:0 0 10px;font-family:${SANS};font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:${C.muted};">Shipping to</p>
            <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.75;color:${C.ink};">
              ${esc(addr.firstName)} ${esc(addr.lastName)}<br/>
              ${esc(addr.line1)}${addr.line2 ? `, ${esc(addr.line2)}` : ""}<br/>
              ${esc(addr.city)}, ${esc(addr.postalCode)} &nbsp; ${esc(addr.country)}<br/>
              <span style="color:${C.muted};">${esc(addr.phone)}</span>
            </p>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  // Hallmark · macrostructure: Ledger (editorial receipt) · tone: restrained/transactional
  // anchor: clay · pre-emit critique: P5 H5 E4 S4 R5 V5 · email-adapted (tables/inline/hex)
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${C.bg};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.bg};padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;max-width:92%;background:${C.card};border:1px solid ${C.border};">

        <!-- Masthead: wordmark left · order ref right -->
        <tr><td style="padding:30px 40px 22px;border-bottom:1px solid ${C.border};">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td valign="middle" style="font-family:${SERIF};font-size:21px;letter-spacing:0.2em;text-transform:uppercase;color:${C.ink};">Notteshe</td>
            <td valign="middle" align="right" style="font-family:${SANS};font-size:9px;letter-spacing:0.18em;text-transform:uppercase;color:${C.muted};line-height:1.5;">Order<br/><span style="color:${C.clay};font-size:13px;letter-spacing:0.08em;">#${ref}</span></td>
          </tr></table>
        </td></tr>

        <!-- Statement (left) -->
        <tr><td style="padding:34px 40px 4px;">
          <p style="margin:0 0 12px;font-family:${SANS};font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:${C.clay};">Order confirmed</p>
          <h1 style="margin:0 0 12px;font-family:${SERIF};font-weight:400;font-size:32px;line-height:1.05;color:${C.ink};">Thank you, ${esc(data.firstName)}.</h1>
          <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.75;color:${C.muted};">
            We have your order and we're preparing it with care. We'll write again the moment it ships.
          </p>
        </td></tr>

        <!-- Item ledger -->
        <tr><td style="padding:26px 40px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td colspan="2" style="font-family:${SANS};font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:${C.muted};padding-bottom:10px;border-bottom:1px solid ${C.border};">The pieces</td>
              <td align="right" style="font-family:${SANS};font-size:9px;letter-spacing:0.22em;text-transform:uppercase;color:${C.muted};padding-bottom:10px;border-bottom:1px solid ${C.border};">Amount</td>
            </tr>
            ${itemRows}
          </table>
        </td></tr>

        <!-- Totals -->
        <tr><td style="padding:20px 40px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            ${row("Subtotal", money(data.subtotal))}
            ${row("Shipping", money(data.shippingFee))}
            ${data.discountAmount && data.discountAmount > 0 ? row("Discount", `−${money(data.discountAmount)}`) : ""}
            ${data.paymentMethod ? row("Payment", esc(data.paymentMethod)) : ""}
            ${row("Total", money(data.total), true)}
          </table>
        </td></tr>

        ${addressBlock}

        <!-- Footer (left) -->
        <tr><td style="padding:22px 40px 28px;border-top:1px solid ${C.border};">
          <p style="margin:0 0 5px;font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${C.muted};">Designed &amp; made in Albania</p>
          <p style="margin:0;font-family:${SANS};font-size:10px;color:${C.muted};">© Notteshe &nbsp;·&nbsp; <a href="https://notteshe.com" style="color:${C.clay};text-decoration:none;">notteshe.com</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

  return html;
}

export async function sendOrderConfirmation(data: OrderConfirmationData) {
  const rate = await getRate();
  const html = buildOrderConfirmationHtml(data, rate);
  const ref = data.orderId.slice(0, 8).toUpperCase();
  const fromEmail = getRuntimeEnv("EMAIL_FROM") ?? "order@notteshe.com";

  await getMailjet()
    .post("send", { version: "v3.1" })
    .request({
      Messages: [
        {
          From: { Email: fromEmail, Name: "Notteshe" },
          To: [{ Email: data.to, Name: data.firstName }],
          Subject: `Order confirmed — #${ref}`,
          HTMLPart: html,
        },
      ],
    });
}

// ─── Gift Card Delivery Email ─────────────────────────────────────────────────

interface GiftCardDeliveryData {
  to: string;
  recipientName: string;
  senderName: string | null;    // null = for self
  code: string;
  amountLek: number;
  message: string | null;
}

// Pure builder — exported for the browser preview route.
export function buildGiftCardDelivery(data: GiftCardDeliveryData): { subject: string; html: string; plainText: string } {
  const formattedAmount = `ALL ${new Intl.NumberFormat("sq-AL").format(Math.round(data.amountLek))}`;
  const isGift = !!data.senderName;
  const subject = isGift
    ? `${escHeader(data.senderName)} has something for you — Notteshe`
    : `Your Notteshe code is ready`;

  // "From" banner — left statement, shown only when sent as a gift
  const fromBanner = isGift
    ? `<tr><td style="padding:30px 40px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-bottom:1px solid ${C.border};"><tr><td style="padding-bottom:26px;">
          <div style="font-family:${SANS};font-size:9px;letter-spacing:0.28em;text-transform:uppercase;color:${C.muted};margin-bottom:8px;">A gift from</div>
          <div style="font-family:${SERIF};font-size:30px;line-height:1;color:${C.ink};">${esc(data.senderName)}</div>
        </td></tr></table>
      </td></tr>`
    : "";

  // Personal message — pull-quote with a marginal clay rule
  const messageBlock = data.message
    ? `<tr><td style="padding:28px 40px 0;">
        <div style="padding-left:18px;border-left:2px solid ${C.clay};">
          <div style="font-family:${SANS};font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:${C.muted};margin-bottom:10px;">A note for you</div>
          <div style="font-family:${SERIF};font-size:20px;line-height:1.55;color:${C.ink};">&ldquo;${esc(data.message)}&rdquo;</div>
        </div>
      </td></tr>`
    : "";

  // Numbered redemption step
  const step = (n: string, text: string): string =>
    `<tr>
      <td valign="top" width="34" style="padding:0 14px 16px 0;font-family:${SERIF};font-size:20px;color:${C.clay};white-space:nowrap;line-height:1.1;">${n}</td>
      <td valign="top" style="padding:0 0 16px;font-family:${SANS};font-size:12px;line-height:1.65;color:${C.muted};">${text}</td>
    </tr>`;

  // Hallmark · macrostructure: Statement/Poster · tone: warm/editorial · anchor: clay
  // pre-emit critique: P5 H5 E4 S4 R5 V5 · email-adapted (tables/inline/hex)
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.bg};padding:40px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" role="presentation" style="width:580px;max-width:92%;background:${C.card};border:1px solid ${C.border};">

  <!-- Masthead (left) -->
  <tr><td style="padding:30px 40px 22px;border-bottom:1px solid ${C.border};">
    <div style="font-family:${SERIF};font-size:21px;letter-spacing:0.2em;text-transform:uppercase;color:${C.ink};">Notteshe</div>
    <div style="margin-top:6px;font-family:${SANS};font-size:9px;letter-spacing:0.24em;text-transform:uppercase;color:${C.clay};">Grua e Fortë</div>
  </td></tr>

  <!-- Amount statement (dark band, left-aligned) -->
  <tr><td style="padding:44px 40px;background:#0f0a14;">
    <div style="font-family:${SANS};font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:${C.muted};margin-bottom:16px;">${isGift ? "You've received a gift card" : "Your gift card"}</div>
    <div style="font-family:${SERIF};font-size:60px;font-weight:300;line-height:0.95;color:${C.ink};">${formattedAmount}</div>
    <div style="margin-top:18px;height:2px;width:44px;background:${C.clay};font-size:0;line-height:0;">&nbsp;</div>
    <div style="margin-top:14px;font-family:${SANS};font-size:9px;letter-spacing:0.28em;text-transform:uppercase;color:${C.muted};">Notteshe Gift Card &nbsp;·&nbsp; No expiry</div>
  </td></tr>

  ${fromBanner}
  ${messageBlock}

  <!-- Greeting (left) -->
  <tr><td style="padding:30px 40px 0;">
    <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.8;color:${C.muted};">
      Dear <strong style="color:${C.ink};">${esc(data.recipientName)}</strong>,<br/>
      ${isGift
        ? `${esc(data.senderName)} has sent you something to spend at <a href="https://notteshe.com" style="color:${C.clay};text-decoration:none;">notteshe.com</a>. Your code is below — the balance applies the moment you enter it at checkout.`
        : `Your gift card is ready. Enter the code below at checkout on <a href="https://notteshe.com" style="color:${C.clay};text-decoration:none;">notteshe.com</a> and the balance applies instantly.`
      }
    </p>
  </td></tr>

  <!-- Code artifact (left) -->
  <tr><td style="padding:26px 40px 6px;">
    <div style="border:1px solid ${C.border};background:#0f0a14;padding:26px 28px;">
      <div style="font-family:${SANS};font-size:8px;letter-spacing:0.3em;text-transform:uppercase;color:${C.muted};margin-bottom:14px;">Your code</div>
      <div style="font-family:'Courier New',monospace;font-size:25px;letter-spacing:6px;color:${C.ink};font-weight:700;">${esc(data.code)}</div>
    </div>
  </td></tr>

  <!-- How to redeem (numbered ledger) -->
  <tr><td style="padding:26px 40px 40px;">
    <div style="font-family:${SANS};font-size:9px;letter-spacing:0.28em;text-transform:uppercase;color:${C.muted};margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid ${C.border};">How to redeem</div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      ${step("01", "Browse <a href=\"https://notteshe.com/shop\" style=\"color:${C.clay};text-decoration:none;\">notteshe.com</a> and add your favourites to the cart")}
      ${step("02", "At checkout, enter the code above in the Gift card field")}
      ${step("03", "The balance applies instantly — any remainder stays on your code")}
    </table>
  </td></tr>

  <!-- Footer (left) -->
  <tr><td style="padding:22px 40px 28px;border-top:1px solid ${C.border};">
    <p style="margin:0 0 5px;font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${C.muted};">Designed &amp; made in Albania</p>
    <p style="margin:0;font-family:${SANS};font-size:10px;color:${C.muted};">© Notteshe &nbsp;·&nbsp; <a href="https://notteshe.com" style="color:${C.clay};text-decoration:none;">notteshe.com</a></p>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  const giftIntro = isGift
    ? `${data.senderName} sent you a gift card.\n\n${data.message ? `"${data.message}"\n\n` : ""}`
    : `Your gift card is ready.\n\n`;

  const plainText = `NOTTESHE\n\nDear ${data.recipientName},\n\n${giftIntro}Your code: ${data.code}\nBalance: ${formattedAmount}\n\nTo redeem:\n1. Visit notteshe.com/shop\n2. At checkout, enter the code above in the Gift card field\n3. The balance applies instantly\n\n— Notteshe\nnotteshe.com`;

  return { subject, html, plainText };
}

export async function sendGiftCardDelivery(data: GiftCardDeliveryData) {
  const fromEmail = getRuntimeEnv("EMAIL_FROM") ?? "order@notteshe.com";
  const { subject, html, plainText } = buildGiftCardDelivery(data);

  await getMailjet()
    .post("send", { version: "v3.1" })
    .request({
      Messages: [
        {
          From: { Email: fromEmail, Name: "Notteshe" },
          To: [{ Email: data.to, Name: data.recipientName }],
          Subject: subject,
          TextPart: plainText,
          HTMLPart: html,
        },
      ],
    });
}

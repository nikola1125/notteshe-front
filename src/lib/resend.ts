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

export async function sendOrderConfirmation(data: OrderConfirmationData) {
  const currency: Currency = data.currency ?? "EUR";
  const rate = await getRate();
  const money = (eur: number) => formatMoney(eur, currency, rate);
  const ref = data.orderId.slice(0, 8).toUpperCase();

  const itemRows = data.items
    .map((i) => {
      const thumb = i.image
        ? `<img src="${cldImg(i.image, 120)}" width="48" height="60" alt="" style="display:block;width:48px;height:60px;object-fit:cover;border:1px solid ${C.border};" />`
        : `<div style="width:48px;height:60px;background:${C.border};"></div>`;
      return `<tr>
        <td width="56" valign="top" style="padding:14px 0;">${thumb}</td>
        <td valign="top" style="padding:14px 14px;font-family:${SANS};">
          <div style="font-size:14px;color:${C.ink};">${i.name}</div>
          <div style="margin-top:4px;font-size:11px;letter-spacing:0.05em;color:${C.muted};">${i.size} · ${i.colour} · ×${i.quantity}</div>
        </td>
        <td valign="top" align="right" style="padding:14px 0;font-family:${SANS};font-size:14px;color:${C.ink};white-space:nowrap;">${money(i.unitPrice * i.quantity)}</td>
      </tr>`;
    })
    .join("");

  const row = (label: string, value: string, strong = false) => `
    <tr>
      <td style="font-family:${SANS};font-size:${strong ? "15px" : "12px"};color:${strong ? C.ink : C.muted};padding:${strong ? "14px 0 4px" : "4px 0"};${strong ? `border-top:1px solid ${C.border};font-weight:600;` : ""}">${label}</td>
      <td align="right" style="font-family:${SANS};font-size:${strong ? "15px" : "12px"};color:${strong ? C.ink : C.muted};text-align:right;padding:${strong ? "14px 0 4px" : "4px 0"};${strong ? `border-top:1px solid ${C.border};font-weight:600;` : ""}">${value}</td>
    </tr>`;

  const addr = data.shippingAddress;
  const addressBlock = addr
    ? `<tr><td style="padding:0 44px 32px;">
        <p style="margin:0 0 10px;font-family:${SANS};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${C.muted};">Shipping to</p>
        <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.7;color:${C.ink};">
          ${addr.firstName} ${addr.lastName}<br/>
          ${addr.line1}${addr.line2 ? `, ${addr.line2}` : ""}<br/>
          ${addr.city}, ${addr.postalCode}<br/>
          ${addr.country}<br/>
          <span style="color:${C.muted};">${addr.phone}</span>
        </p>
      </td></tr>`
    : "";

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:${C.bg};">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.bg};padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;max-width:92%;background:${C.card};border:1px solid ${C.border};">

        <!-- Header -->
        <tr><td align="center" style="padding:40px 44px 28px;border-bottom:1px solid ${C.border};">
          <div style="font-family:${SERIF};font-size:30px;color:${C.ink};letter-spacing:0.5px;">Notteshe<span style="color:${C.clay};">.</span></div>
          <div style="margin-top:10px;font-family:${SERIF};font-style:italic;font-size:16px;color:${C.clay};">— Grua e Fortë —</div>
        </td></tr>

        <!-- Intro -->
        <tr><td style="padding:36px 44px 8px;">
          <p style="margin:0 0 10px;font-family:${SANS};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${C.muted};">Order confirmed</p>
          <h1 style="margin:0 0 14px;font-family:${SERIF};font-weight:400;font-size:30px;line-height:1.1;color:${C.ink};">Thank you, ${data.firstName}.</h1>
          <p style="margin:0 0 8px;font-family:${SANS};font-size:13px;line-height:1.7;color:${C.muted};">
            Your order <strong style="color:${C.ink};">#${ref}</strong> is confirmed. We'll be in touch when it ships.
          </p>
        </td></tr>

        <!-- Items -->
        <tr><td style="padding:16px 44px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid ${C.border};">
            ${itemRows}
          </table>
        </td></tr>

        <!-- Totals -->
        <tr><td style="padding:8px 44px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border-top:1px solid ${C.border};padding-top:8px;">
            ${row("Subtotal", money(data.subtotal))}
            ${row("Shipping", data.shippingFee === 0 ? "Free" : money(data.shippingFee))}
            ${data.discountAmount && data.discountAmount > 0 ? row("Discount", `−${money(data.discountAmount)}`) : ""}
            ${data.paymentMethod ? row("Payment", data.paymentMethod) : ""}
            ${row("Total", money(data.total), true)}
          </table>
        </td></tr>

        ${addressBlock}

        <!-- Footer -->
        <tr><td align="center" style="padding:26px 44px;border-top:1px solid ${C.border};">
          <p style="margin:0 0 6px;font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${C.muted};">Designed and made in Albania</p>
          <p style="margin:0;font-family:${SANS};font-size:10px;color:${C.muted};opacity:0.7;">© Notteshe · All rights reserved</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

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

export async function sendGiftCardDelivery(data: GiftCardDeliveryData) {
  const fromEmail = getRuntimeEnv("EMAIL_FROM") ?? "order@notteshe.com";
  const formattedAmount = `ALL ${new Intl.NumberFormat("sq-AL").format(Math.round(data.amountLek))}`;
  const isGift = !!data.senderName;
  const subject = isGift
    ? `${data.senderName} sent you a ${formattedAmount} gift card`
    : `Your ${formattedAmount} Notteshe gift card`;

  // "From" banner — shown only when sent as a gift
  const fromBanner = isGift
    ? `<tr><td align="center" style="padding:32px 44px 0;">
        <div style="background:${C.border};padding:24px 32px;text-align:center;">
          <div style="font-family:${SANS};font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:${C.muted};margin-bottom:10px;">A gift from</div>
          <div style="font-family:${SERIF};font-size:28px;font-weight:400;color:${C.ink};">${data.senderName}</div>
        </div>
      </td></tr>`
    : "";

  // Personal message block
  const messageBlock = data.message
    ? `<tr><td style="padding:28px 44px 0;">
        <div style="border-left:2px solid ${C.clay};padding:16px 20px;">
          <div style="font-family:${SANS};font-size:9px;letter-spacing:0.25em;text-transform:uppercase;color:${C.muted};margin-bottom:10px;">Personal message</div>
          <div style="font-family:${SERIF};font-style:italic;font-size:18px;line-height:1.6;color:${C.ink};">&ldquo;${data.message}&rdquo;</div>
        </div>
      </td></tr>`
    : "";

  // Step helper
  const step = (n: string, text: string) =>
    `<tr>
      <td valign="top" style="padding:0 12px 14px 0;font-family:${SERIF};font-size:22px;color:${C.clay};white-space:nowrap;line-height:1;">${n}</td>
      <td valign="top" style="padding:0 0 14px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">${text}</td>
    </tr>`;

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${C.bg};padding:40px 0;">
<tr><td align="center">
<table width="580" cellpadding="0" cellspacing="0" role="presentation" style="width:580px;max-width:92%;background:${C.card};border:1px solid ${C.border};">

  <!-- Logo -->
  <tr><td align="center" style="padding:36px 44px 28px;border-bottom:1px solid ${C.border};">
    <div style="font-family:${SERIF};font-size:26px;letter-spacing:6px;text-transform:uppercase;color:${C.ink};">NOTTESHE</div>
    <div style="margin-top:6px;font-family:${SERIF};font-style:italic;font-size:13px;color:${C.clay};">— Grua e Fortë —</div>
  </td></tr>

  <!-- Dark hero with amount -->
  <tr><td align="center" style="padding:52px 44px 44px;background:#0f0a14;">
    <div style="font-family:${SANS};font-size:9px;letter-spacing:0.35em;text-transform:uppercase;color:${C.muted};margin-bottom:18px;">${isGift ? "You received a gift card" : "Your gift card"}</div>
    <div style="font-family:${SERIF};font-size:68px;font-weight:300;line-height:1;color:${C.ink};">${formattedAmount}</div>
    <div style="margin-top:16px;width:40px;height:1px;background:${C.clay};display:inline-block;"></div>
    <div style="margin-top:14px;font-family:${SANS};font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:${C.muted};">Notteshe Gift Card</div>
  </td></tr>

  ${fromBanner}
  ${messageBlock}

  <!-- Greeting -->
  <tr><td style="padding:32px 44px 0;">
    <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.8;color:${C.muted};">
      Dear <strong style="color:${C.ink};">${data.recipientName}</strong>,<br/>
      ${isGift
        ? `You have received a gift card from <strong style="color:${C.ink};">${data.senderName}</strong>. Use the code below at checkout on <a href="https://notteshe.com" style="color:${C.clay};text-decoration:none;">notteshe.com</a> to redeem your balance.`
        : `Your gift card is ready. Use the code below at checkout on <a href="https://notteshe.com" style="color:${C.clay};text-decoration:none;">notteshe.com</a> to redeem your balance.`
      }
    </p>
  </td></tr>

  <!-- Code block -->
  <tr><td align="center" style="padding:32px 44px;">
    <div style="border:1px solid ${C.border};background:#0f0a14;padding:36px 40px;text-align:center;">
      <div style="font-family:${SANS};font-size:8px;letter-spacing:0.35em;text-transform:uppercase;color:${C.muted};margin-bottom:16px;">Your gift card code</div>
      <div style="font-family:monospace;font-size:26px;letter-spacing:8px;color:${C.ink};font-weight:600;">${data.code}</div>
      <div style="margin-top:20px;border-top:1px solid ${C.border};padding-top:16px;">
        <span style="display:inline-block;font-family:${SANS};font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${C.muted};opacity:0.7;">No expiry &nbsp;·&nbsp; Redeemable online</span>
      </div>
    </div>
  </td></tr>

  <!-- How to use -->
  <tr><td style="padding:0 44px 44px;">
    <div style="font-family:${SANS};font-size:8px;letter-spacing:0.3em;text-transform:uppercase;color:${C.muted};margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid ${C.border};">How to redeem</div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      ${step("01", "Browse <a href=\"https://notteshe.com/shop\" style=\"color:${C.clay};text-decoration:none;\">notteshe.com</a> and add your favourites to cart")}
      ${step("02", "At checkout, enter the code above in the <em>Gift card</em> field")}
      ${step("03", "The balance applies instantly — enjoy free shipping on orders over 5,000 L")}
    </table>
    <div style="margin-top:28px;text-align:center;">
      <a href="https://notteshe.com/shop" style="display:inline-block;padding:14px 44px;background:${C.clay};font-family:${SANS};font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:#ffffff;text-decoration:none;">Start Shopping</a>
    </div>
  </td></tr>

  <!-- Footer -->
  <tr><td align="center" style="padding:24px 44px;border-top:1px solid ${C.border};">
    <div style="font-family:${SANS};font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:${C.muted};opacity:0.6;">Designed and made in Albania</div>
    <div style="margin-top:8px;">
      <a href="https://notteshe.com" style="font-family:${SANS};font-size:9px;color:${C.clay};text-decoration:none;letter-spacing:0.1em;">notteshe.com</a>
      <span style="font-family:${SANS};font-size:9px;color:${C.muted};opacity:0.4;"> &nbsp;·&nbsp; </span>
      <span style="font-family:${SANS};font-size:9px;color:${C.muted};opacity:0.6;">© Notteshe</span>
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;

  await getMailjet()
    .post("send", { version: "v3.1" })
    .request({
      Messages: [
        {
          From: { Email: fromEmail, Name: "Notteshe" },
          To: [{ Email: data.to, Name: data.recipientName }],
          Subject: subject,
          HTMLPart: html,
        },
      ],
    });
}

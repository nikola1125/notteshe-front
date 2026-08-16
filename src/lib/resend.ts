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
  const formattedAmount = `${new Intl.NumberFormat("sq-AL").format(Math.round(data.amountLek))} L`;

  const senderLine = data.senderName
    ? `<p style="margin:0 0 8px;font-family:${SANS};font-size:13px;line-height:1.7;color:${C.muted};">
        Sent with love from <strong style="color:${C.ink};">${data.senderName}</strong>.
      </p>`
    : "";

  const messageLine = data.message
    ? `<blockquote style="margin:20px 0;padding:16px 20px;border-left:2px solid ${C.border};font-family:${SERIF};font-style:italic;font-size:16px;color:${C.muted};">"${data.message}"</blockquote>`
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

        <!-- Gift card hero -->
        <tr><td align="center" style="padding:48px 44px 32px;">
          <p style="margin:0 0 10px;font-family:${SANS};font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:${C.muted};">You received a gift card</p>
          <h1 style="margin:0 0 8px;font-family:${SERIF};font-weight:400;font-size:54px;line-height:1;color:${C.ink};">${formattedAmount}</h1>
          <p style="margin:0;font-family:${SANS};font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:${C.muted};">Gift card · Notteshe</p>
        </td></tr>

        <!-- Personal message -->
        <tr><td style="padding:0 44px 32px;">
          ${senderLine}
          ${messageLine}
          <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.7;color:${C.muted};">
            Dear ${data.recipientName}, use the code below at checkout on
            <a href="https://notteshe.com" style="color:${C.clay};">notteshe.com</a> to redeem your gift card.
          </p>
        </td></tr>

        <!-- Code block -->
        <tr><td align="center" style="padding:0 44px 48px;">
          <div style="border:1px solid ${C.border};padding:28px 32px;text-align:center;">
            <p style="margin:0 0 12px;font-family:${SANS};font-size:9px;letter-spacing:0.3em;text-transform:uppercase;color:${C.muted};">Your gift card code</p>
            <p style="margin:0;font-family:monospace;font-size:28px;letter-spacing:0.25em;color:${C.ink};">${data.code}</p>
          </div>
          <p style="margin:16px 0 0;font-family:${SANS};font-size:11px;color:${C.muted};opacity:0.7;">Enter this code at checkout · No expiry</p>
        </td></tr>

        <!-- Footer -->
        <tr><td align="center" style="padding:26px 44px;border-top:1px solid ${C.border};">
          <p style="margin:0 0 6px;font-family:${SANS};font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:${C.muted};">Designed and made in Albania</p>
          <p style="margin:0;font-family:${SANS};font-size:10px;color:${C.muted};opacity:0.7;">© Notteshe · All rights reserved</p>
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
          Subject: `Your ${formattedAmount} Notteshe gift card`,
          HTMLPart: html,
        },
      ],
    });
}

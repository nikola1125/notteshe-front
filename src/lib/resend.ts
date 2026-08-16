import Mailjet from "node-mailjet";
import { getRuntimeEnv } from "./runtime-env";

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

interface OrderConfirmationData {
  to: string;
  firstName: string;
  orderId: string;
  items: Array<{ name: string; size: string; colour: string; quantity: number; unitPrice: number }>;
  subtotal: number;
  shippingFee: number;
  total: number;
  paymentMethod: string;
}

export async function sendOrderConfirmation(data: OrderConfirmationData) {
  const itemRows = data.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;font-size:13px;color:#111">${i.name} · ${i.size} · ${i.colour}</td>
          <td style="padding:8px 0;font-size:13px;color:#111;text-align:right">×${i.quantity} &nbsp; ${(i.unitPrice * i.quantity).toFixed(2)} €</td>
        </tr>`
    )
    .join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#FAFAFA;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAFA;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #E0D9D0;">
        <tr><td style="padding:40px 48px 32px;border-bottom:1px solid #E0D9D0;">
          <p style="margin:0;font-size:18px;letter-spacing:0.15em;color:#111;text-transform:uppercase;">Notteshe</p>
        </td></tr>
        <tr><td style="padding:40px 48px 32px;">
          <p style="margin:0 0 8px;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6B6B6B;">Order confirmed</p>
          <h1 style="margin:0 0 24px;font-size:28px;font-weight:300;color:#111;">Thank you, ${data.firstName}.</h1>
          <p style="margin:0 0 32px;font-size:13px;line-height:1.7;color:#6B6B6B;">
            Your order <strong style="color:#111;">#${data.orderId.slice(0, 8).toUpperCase()}</strong> has been confirmed.
            We'll send you another email when it ships.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #E0D9D0;margin-bottom:24px;">
            ${itemRows}
          </table>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="font-size:12px;color:#6B6B6B;padding:4px 0;">Subtotal</td>
              <td style="font-size:12px;color:#6B6B6B;text-align:right;padding:4px 0;">${data.subtotal.toFixed(2)} €</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#6B6B6B;padding:4px 0;">Shipping</td>
              <td style="font-size:12px;color:#6B6B6B;text-align:right;padding:4px 0;">${data.shippingFee === 0 ? "Free" : `${data.shippingFee.toFixed(2)} €`}</td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#6B6B6B;padding:4px 0;">Payment method</td>
              <td style="font-size:12px;color:#6B6B6B;text-align:right;padding:4px 0;">${data.paymentMethod}</td>
            </tr>
            <tr>
              <td style="font-size:14px;font-weight:500;color:#111;padding:12px 0 4px;border-top:1px solid #E0D9D0;">Total</td>
              <td style="font-size:14px;font-weight:500;color:#111;text-align:right;padding:12px 0 4px;border-top:1px solid #E0D9D0;">${data.total.toFixed(2)} €</td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:24px 48px;border-top:1px solid #E0D9D0;">
          <p style="margin:0;font-size:11px;color:#6B6B6B;letter-spacing:0.1em;">© Notteshe · All rights reserved</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const fromEmail = getRuntimeEnv("EMAIL_FROM") ?? "orders@notteshe.com";

  await getMailjet()
    .post("send", { version: "v3.1" })
    .request({
      Messages: [
        {
          From: { Email: fromEmail, Name: "Notteshe" },
          To: [{ Email: data.to, Name: data.firstName }],
          Subject: `Order confirmed — #${data.orderId.slice(0, 8).toUpperCase()}`,
          HTMLPart: html,
        },
      ],
    });
}

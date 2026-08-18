// Renders the transactional email templates to standalone HTML files you can
// open in a browser — no email is sent. Run: npm run email:preview
// Output: email-previews/*.html
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { buildOrderConfirmationHtml, buildGiftCardDelivery } from "../src/lib/resend.ts";
import { DEFAULT_RATE } from "../src/lib/currency.ts";

const outDir = join(process.cwd(), "email-previews");
mkdirSync(outDir, { recursive: true });

const order = buildOrderConfirmationHtml(
  {
    to: "customer@example.com",
    firstName: "Elira",
    orderId: "a1b2c3d4-0000-0000-0000-000000000000",
    currency: "ALL",
    items: [
      { name: "Silk Slip Dress — Noir", size: "M", colour: "Black", quantity: 1, unitPrice: 189, image: null },
      { name: "Wide-Leg Trouser", size: "S", colour: "Sand", quantity: 2, unitPrice: 96, image: null },
    ],
    subtotal: 381,
    shippingFee: 0,
    discountAmount: 40,
    total: 341,
    paymentMethod: "Card (POK Pay)",
    shippingAddress: {
      firstName: "Elira", lastName: "Hoxha",
      line1: "Rr. Myslym Shyri 42", line2: "Apt 7",
      city: "Tiranë", postalCode: "1001", country: "Albania", phone: "+355 69 000 0000",
    },
  },
  DEFAULT_RATE,
);

const giftToSomeone = buildGiftCardDelivery({
  to: "recipient@example.com",
  recipientName: "Ana",
  senderName: "Elira",
  code: "NOTT-7F3A-9K2C-QX41",
  amountLek: 10000,
  message: "For all the late nights and loud laughs — wear something that's just yours. Happy birthday.",
}).html;

const giftToSelf = buildGiftCardDelivery({
  to: "self@example.com",
  recipientName: "Elira",
  senderName: null,
  code: "NOTT-2B8D-5M1E-Z093",
  amountLek: 5000,
  message: null,
}).html;

const files: Array<[string, string]> = [
  ["order-confirmation.html", order],
  ["gift-card-gift.html", giftToSomeone],
  ["gift-card-self.html", giftToSelf],
];

for (const [name, html] of files) {
  writeFileSync(join(outDir, name), html);
  console.log("wrote", join("email-previews", name));
}

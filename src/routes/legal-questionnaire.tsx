import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { getMailjet } from "@/lib/resend";
import { getRuntimeEnv } from "@/lib/runtime-env";

// ── Server function ────────────────────────────────────────────────────────────
// Receives a pre-built HTML string from the client so the server function
// doesn't need to reference the QUESTIONS array (which lives in client scope).

const submitSchema = z.object({ html: z.string().min(1).max(500_000) });

const submitQuestionnaireFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const fromEmail = getRuntimeEnv("EMAIL_FROM") ?? "order@notteshe.com";
    await getMailjet()
      .post("send", { version: "v3.1" })
      .request({
        Messages: [
          {
            From: { Email: fromEmail, Name: "Notteshe" },
            To: [{ Email: "nikolaos@91.life", Name: "Nikolaos" }],
            Subject: "Notteshe — Legal Questionnaire Answers",
            HTMLPart: data.html,
          },
        ],
      });
  });

// ── Questions data ─────────────────────────────────────────────────────────────

interface Question {
  num: number;
  name: string;
  label: string;
  prefilled?: string;
  long?: boolean;
  hint?: string;
  section: string;
}

const QUESTIONS: Question[] = [
  // Privacy — Business Identity
  { num: 1, name: "q1", label: "Full legal company name (as registered)", section: "Privacy Policy — Business Identity" },
  { num: 2, name: "q2", label: "Registered business address (full)", section: "Privacy Policy — Business Identity", long: true },
  { num: 3, name: "q3", label: "Country of legal incorporation", section: "Privacy Policy — Business Identity", prefilled: "Republic of Albania" },
  { num: 4, name: "q4", label: "Business registration number (NIPT or equivalent)", section: "Privacy Policy — Business Identity" },
  { num: 5, name: "q5", label: "VAT number (if applicable)", section: "Privacy Policy — Business Identity", hint: "Leave blank if not applicable" },
  { num: 6, name: "q6", label: "Official contact email for privacy / legal matters", section: "Privacy Policy — Business Identity", prefilled: "info@notteshe.com" },
  { num: 7, name: "q7", label: "Do you have a designated Data Protection Officer (DPO)?", section: "Privacy Policy — Business Identity", prefilled: "No" },
  { num: 8, name: "q8", label: "Are you registered with Albania's data protection authority (IDPD)?", section: "Privacy Policy — Business Identity", hint: "Yes / No / In progress" },
  // Privacy — Data Collected
  { num: 9, name: "q9", label: "Do you collect: full name, email, phone, shipping address, billing address?", section: "Privacy Policy — Data Collected", prefilled: "Yes — all of the above" },
  { num: 10, name: "q10", label: "Do you store payment card details on your servers?", section: "Privacy Policy — Data Collected", prefilled: "No — handled entirely by POK (Credins Bank)" },
  { num: 11, name: "q11", label: "Do you collect IP addresses and browser/device information automatically?", section: "Privacy Policy — Data Collected", prefilled: "No" },
  { num: 12, name: "q12", label: "Do you use website analytics?", section: "Privacy Policy — Data Collected", prefilled: "Yes — Microsoft Clarity" },
  { num: 13, name: "q13", label: "Do you use any session recording or heatmap tools?", section: "Privacy Policy — Data Collected", prefilled: "Yes — Microsoft Clarity (clarity.microsoft.com). All form fields automatically masked. GDPR compliant. No data sold to third parties.", long: true },
  { num: 14, name: "q14", label: "Do you collect data via social media pixels?", section: "Privacy Policy — Data Collected", prefilled: "No" },
  { num: 15, name: "q15", label: "Do you collect data when users contact you?", section: "Privacy Policy — Data Collected", prefilled: "Yes — via the contact form" },
  { num: 16, name: "q16", label: "Do you collect wishlist or browsing behaviour data?", section: "Privacy Policy — Data Collected", prefilled: "Yes — wishlist items stored per user account. Browsing behaviour recorded via Microsoft Clarity.", long: true },
  // Privacy — Cookies
  { num: 17, name: "q17", label: "Do you show a cookie consent banner?", section: "Privacy Policy — Cookies", prefilled: "Yes" },
  { num: 18, name: "q18", label: "List all cookies your site sets", section: "Privacy Policy — Cookies", prefilled: "Session cookie (login), consent preference cookie (notteshe_cookie_consent), Microsoft Clarity cookies (_clsk, _clck, CLID, MUID and related), POK payment session cookies during checkout", long: true },
  { num: 19, name: "q19", label: "Do you use any advertising / retargeting cookies?", section: "Privacy Policy — Cookies", prefilled: "No" },
  { num: 20, name: "q20", label: "Do you use any third-party cookies outside your direct control?", section: "Privacy Policy — Cookies", prefilled: "Yes — Microsoft Clarity (analytics) and POK by Credins Bank (payment processing)", long: true },
  // Privacy — Purpose
  { num: 21, name: "q21", label: "Do you send marketing emails or SMS to customers?", section: "Privacy Policy — Purpose of Data Use", prefilled: "Yes — marketing emails only via Mailjet. No SMS." },
  { num: 22, name: "q22", label: "Do you use customer data for product improvement or internal analytics?", section: "Privacy Policy — Purpose of Data Use", prefilled: "Yes — anonymised browsing behaviour via Microsoft Clarity used to improve website experience", long: true },
  { num: 23, name: "q23", label: "Do you use customer data for personalised advertising (retargeting)?", section: "Privacy Policy — Purpose of Data Use", prefilled: "No" },
  // Privacy — Legal Basis
  { num: 24, name: "q24", label: "Do you obtain explicit consent before sending marketing emails?", section: "Privacy Policy — Legal Basis", prefilled: "Yes — customers actively sign up. No pre-ticked boxes." },
  { num: 25, name: "q25", label: "Is newsletter signup opt-in or opt-out?", section: "Privacy Policy — Legal Basis", prefilled: "Opt-in" },
  { num: 26, name: "q26", label: "Do you process data based on legitimate interest?", section: "Privacy Policy — Legal Basis", prefilled: "Yes — transactional order emails (confirmations, shipping, refunds) and fraud prevention", long: true },
  // Privacy — Third Parties
  { num: 27, name: "q27", label: "Full name of your payment processor", section: "Privacy Policy — Third Parties & Data Sharing", prefilled: "POK by Credins Bank sh.a." },
  { num: 28, name: "q28", label: "Full name(s) of your courier / shipping company", section: "Privacy Policy — Third Parties & Data Sharing", hint: "e.g. DHL Express, Fan Courier, Albania Post…" },
  { num: 29, name: "q29", label: "Full name of your email service provider", section: "Privacy Policy — Third Parties & Data Sharing", prefilled: "Mailjet S.A.S." },
  { num: 30, name: "q30", label: "Full name of your image hosting provider", section: "Privacy Policy — Third Parties & Data Sharing", prefilled: "Cloudinary Ltd." },
  { num: 31, name: "q31", label: "Full name of your database / hosting provider", section: "Privacy Policy — Third Parties & Data Sharing", prefilled: "Neon Inc. (database) and OVH SAS (application server/VPS)" },
  { num: 32, name: "q32", label: "Do you share any customer data with other third parties?", section: "Privacy Policy — Third Parties & Data Sharing", prefilled: "No" },
  { num: 33, name: "q33", label: "Do you ever sell customer data to third parties?", section: "Privacy Policy — Third Parties & Data Sharing", prefilled: "No" },
  // Privacy — International
  { num: 34, name: "q34", label: "Do any third-party providers process data outside Albania/EU?", section: "Privacy Policy — International Data Transfers", prefilled: "Yes — Cloudinary (US), Neon Inc. (US), and Microsoft Clarity (US)", long: true },
  { num: 35, name: "q35", label: "What safeguards are in place?", section: "Privacy Policy — International Data Transfers", prefilled: "Standard Contractual Clauses (SCCs) with all US-based providers. Microsoft is additionally certified under the EU-US Data Privacy Framework.", long: true },
  // Privacy — Retention
  { num: 36, name: "q36", label: "How long do you keep order data after an order is completed?", section: "Privacy Policy — Data Retention", hint: "Recommended: 5 years (Albanian fiscal law)" },
  { num: 37, name: "q37", label: "How long do you keep customer account data if inactive?", section: "Privacy Policy — Data Retention", hint: "Recommended: 2 years of inactivity" },
  { num: 38, name: "q38", label: "How long do you keep newsletter subscriber data?", section: "Privacy Policy — Data Retention", prefilled: "Not applicable — no standalone newsletter service" },
  { num: 39, name: "q39", label: "How long do you keep contact form messages?", section: "Privacy Policy — Data Retention", prefilled: "1 year after receipt" },
  { num: 40, name: "q40", label: "Do you automatically delete data after the retention period, or manually?", section: "Privacy Policy — Data Retention", prefilled: "Manually" },
  // Privacy — User Rights
  { num: 41, name: "q41", label: "Privacy contact email for data requests", section: "Privacy Policy — User Rights", prefilled: "info@notteshe.com" },
  { num: 42, name: "q42", label: "How many days to respond to data requests?", section: "Privacy Policy — User Rights", prefilled: "Within 30 days" },
  { num: 43, name: "q43", label: "Can users download a copy of all their personal data?", section: "Privacy Policy — User Rights", prefilled: "Yes — by emailing info@notteshe.com. Provided within 30 days.", long: true },
  // Privacy — Security
  { num: 44, name: "q44", label: "Is your website served over HTTPS at all times?", section: "Privacy Policy — Security", prefilled: "Yes" },
  { num: 45, name: "q45", label: "Are passwords stored hashed (never in plain text)?", section: "Privacy Policy — Security", prefilled: "Yes — bcrypt hashing via Better Auth" },
  { num: 46, name: "q46", label: "In the event of a data breach, how quickly will you notify users?", section: "Privacy Policy — Security", prefilled: "Within 72 hours we notify IDPD. Affected users notified within 7 days.", long: true },
  // Privacy — Minors
  { num: 47, name: "q47", label: "What is the minimum age to create an account or purchase?", section: "Privacy Policy — Minors", hint: "Recommended: 16 (aligned with GDPR / Albanian law)" },
  { num: 48, name: "q48", label: "Do you knowingly collect data from children under that age?", section: "Privacy Policy — Minors", prefilled: "No" },
  // T&C — Products
  { num: 49, name: "q49", label: "Are all products designed and/or made in Albania?", section: "Terms & Conditions — Business & Products", hint: "e.g. Designed and made in Albania / Designed in Albania, manufactured elsewhere" },
  { num: 50, name: "q50", label: "Are products handmade, manufactured, or both?", section: "Terms & Conditions — Business & Products", hint: "Handmade / Manufactured / Both" },
  { num: 51, name: "q51", label: "Do product photos accurately represent colours, or do you disclaim monitor variation?", section: "Terms & Conditions — Business & Products", prefilled: "Disclaim monitor variation — colours may vary depending on screen settings and calibration", long: true },
  { num: 52, name: "q52", label: "Do you reserve the right to discontinue any product without notice?", section: "Terms & Conditions — Business & Products", prefilled: "Yes" },
  // T&C — Pricing
  { num: 53, name: "q53", label: "Are all displayed prices inclusive of VAT?", section: "Terms & Conditions — Pricing", hint: "Yes, inclusive / No, VAT added at checkout / Not VAT registered" },
  { num: 54, name: "q54", label: "What is the official currency of sale?", section: "Terms & Conditions — Pricing", prefilled: "Both Albanian Lek (ALL) and Euro (EUR). Customer can switch between currencies on the site.", long: true },
  { num: 55, name: "q55", label: "Who sets the EUR/Lek exchange rate and how often is it updated?", section: "Terms & Conditions — Pricing", prefilled: "Set manually by Notteshe administration and updated at their discretion", long: true },
  { num: 56, name: "q56", label: "Do you reserve the right to change prices at any time without notice?", section: "Terms & Conditions — Pricing", prefilled: "Yes. Price at time of order confirmation is the price charged.", long: true },
  { num: 57, name: "q57", label: "If a pricing error occurs and an order is placed, what is your policy?", section: "Terms & Conditions — Pricing", prefilled: "We reserve the right to cancel the order and issue a full refund. Customer will be notified promptly.", long: true },
  // T&C — Orders
  { num: 58, name: "q58", label: "At what point is a contract formed?", section: "Terms & Conditions — Orders", prefilled: "When Notteshe confirms and dispatches the order. The order confirmation email is an acknowledgement only, not acceptance of a contract.", long: true },
  { num: 59, name: "q59", label: "Do you reserve the right to refuse or cancel any order?", section: "Terms & Conditions — Orders", prefilled: "Yes — including cases of suspected fraud, pricing errors, stock unavailability, or payment failure. Full refund issued where payment has been taken.", long: true },
  { num: 60, name: "q60", label: "What happens if an item is out of stock after the customer has paid?", section: "Terms & Conditions — Orders", prefilled: "Customer notified and full refund issued within 5 business days" },
  { num: 61, name: "q61", label: "Can customers modify or cancel an order after placing it?", section: "Terms & Conditions — Orders", long: true, hint: "e.g. Yes, within 24 hours by contacting info@notteshe.com before dispatch" },
  // T&C — Payment
  { num: 62, name: "q62", label: "What payment methods are accepted?", section: "Terms & Conditions — Payment", prefilled: "Card payment only, processed by POK (Credins Bank sh.a.)" },
  { num: 63, name: "q63", label: "When is the card charged?", section: "Terms & Conditions — Payment", prefilled: "Authorized at order placement. Charged when the order is confirmed for dispatch by Notteshe.", long: true },
  { num: 64, name: "q64", label: "Cash on Delivery", section: "Terms & Conditions — Payment", prefilled: "Not applicable — removed" },
  { num: 65, name: "q65", label: "Are gift cards treated as cash equivalent?", section: "Terms & Conditions — Payment", prefilled: "Yes — cash equivalent. Cannot be used to purchase other gift cards. Remaining balance retained. No expiry.", long: true },
  // T&C — Shipping
  { num: 66, name: "q66", label: "Which countries do you ship to?", section: "Terms & Conditions — Shipping & Delivery", long: true, hint: "e.g. Albania only / Albania and all EU countries / Worldwide" },
  { num: 67, name: "q67", label: "What are your estimated delivery times?", section: "Terms & Conditions — Shipping & Delivery", long: true, hint: "e.g. 2–4 business days within Albania, 5–10 business days internationally" },
  { num: 68, name: "q68", label: "What courier / carrier do you use?", section: "Terms & Conditions — Shipping & Delivery", hint: "e.g. DHL Express, Fan Courier, Albania Post…" },
  { num: 69, name: "q69", label: "What are the shipping costs?", section: "Terms & Conditions — Shipping & Delivery", long: true, hint: "e.g. 400 ALL within Albania, €8 for EU countries" },
  { num: 70, name: "q70", label: "Who is responsible if a package is lost or damaged in transit?", section: "Terms & Conditions — Shipping & Delivery", long: true },
  { num: 71, name: "q71", label: "Do you provide tracking numbers for all orders?", section: "Terms & Conditions — Shipping & Delivery", hint: "Yes, all orders / Only some / No" },
  { num: 72, name: "q72", label: "What happens if a delivery attempt fails (nobody home)?", section: "Terms & Conditions — Shipping & Delivery", long: true },
  // T&C — Returns
  { num: 73, name: "q73", label: "What is the return / exchange window?", section: "Terms & Conditions — Returns & Exchanges", hint: "The website currently states 14 days — confirm or correct" },
  { num: 74, name: "q74", label: "Does the return window start from the purchase date or the delivery date?", section: "Terms & Conditions — Returns & Exchanges", hint: "Purchase date / Delivery date" },
  { num: 75, name: "q75", label: "What condition must returned items be in?", section: "Terms & Conditions — Returns & Exchanges", long: true, hint: "e.g. Unworn, unwashed, with all original tags attached, in original packaging" },
  { num: 76, name: "q76", label: "Who pays the return shipping costs?", section: "Terms & Conditions — Returns & Exchanges", hint: "Customer / Notteshe / Notteshe if faulty, customer otherwise" },
  { num: 77, name: "q77", label: "How are refunds issued?", section: "Terms & Conditions — Returns & Exchanges", prefilled: "To the original payment method" },
  { num: 78, name: "q78", label: "How many business days does a refund take after receiving the return?", section: "Terms & Conditions — Returns & Exchanges", prefilled: "Within 5 business days" },
  { num: 79, name: "q79", label: "Are any items non-returnable?", section: "Terms & Conditions — Returns & Exchanges", long: true, hint: "e.g. Sale items, intimates/underwear, items that have been worn or washed…" },
  { num: 80, name: "q80", label: "Do you offer exchanges, or only refunds?", section: "Terms & Conditions — Returns & Exchanges", hint: "Both exchanges and refunds / Refunds only / Exchanges / store credit only" },
  // T&C — Gift Cards
  { num: 81, name: "q81", label: "Do gift cards have an expiry date?", section: "Terms & Conditions — Gift Cards", prefilled: "No" },
  { num: 82, name: "q82", label: "Are gift cards refundable for cash?", section: "Terms & Conditions — Gift Cards", prefilled: "No. Non-refundable once issued. If the original order is cancelled before the code has been used, the refund goes to the original payment method.", long: true },
  { num: 83, name: "q83", label: "What happens if a gift card code is lost or stolen?", section: "Terms & Conditions — Gift Cards", hint: "e.g. We reissue once upon identity verification by email / We do not replace lost codes" },
  { num: 84, name: "q84", label: "Can gift cards be combined with discount codes?", section: "Terms & Conditions — Gift Cards", prefilled: "Yes" },
  { num: 85, name: "q85", label: "Can the remaining balance of a partially used gift card still be used?", section: "Terms & Conditions — Gift Cards", prefilled: "Yes — remaining balance is retained and can be used on future orders", long: true },
  // T&C — IP
  { num: 86, name: "q86", label: "Who owns the brand name, logo, and all website content?", section: "Terms & Conditions — Intellectual Property", prefilled: "Individual owner (founder of Notteshe)" },
  { num: 87, name: "q87", label: "Are the product photos your own or licensed? Who owns the copyright?", section: "Terms & Conditions — Intellectual Property", hint: "Our own original photos / Third-party photographer, licensed to us / Mixed" },
  { num: 88, name: "q88", label: "Do you prohibit reproduction of your content without permission?", section: "Terms & Conditions — Intellectual Property", prefilled: "Yes — all content may not be reproduced, distributed, or used without prior written permission", long: true },
  // T&C — Accounts
  { num: 89, name: "q89", label: "Can customers purchase without creating an account (guest checkout)?", section: "Terms & Conditions — User Accounts", hint: "Yes — guest checkout available / No — account required" },
  { num: 90, name: "q90", label: "Do you reserve the right to suspend or delete accounts that violate your terms?", section: "Terms & Conditions — User Accounts", prefilled: "Yes" },
  // T&C — Dispute
  { num: 91, name: "q91", label: "Which country's law governs these terms?", section: "Terms & Conditions — Dispute Resolution & Governing Law", prefilled: "Laws of the Republic of Albania" },
  { num: 92, name: "q92", label: "Which courts have jurisdiction for disputes?", section: "Terms & Conditions — Dispute Resolution & Governing Law", prefilled: "Courts of Tirana, Republic of Albania" },
  { num: 93, name: "q93", label: "Do you offer any alternative dispute resolution (ADR)?", section: "Terms & Conditions — Dispute Resolution & Governing Law", prefilled: "Yes — customers should contact info@notteshe.com first. We aim to resolve within 30 days before legal action.", long: true },
  { num: 94, name: "q94", label: "Are you registered with the EU ODR platform?", section: "Terms & Conditions — Dispute Resolution & Governing Law", hint: "Yes / Not yet — will register / No" },
  // T&C — Liability
  { num: 95, name: "q95", label: "Do you limit your liability to the value of the order placed?", section: "Terms & Conditions — Liability", prefilled: "Yes" },
  { num: 96, name: "q96", label: "Do you disclaim liability for website downtime or technical errors?", section: "Terms & Conditions — Liability", prefilled: "Yes" },
  { num: 97, name: "q97", label: "Do you have a force majeure clause?", section: "Terms & Conditions — Liability", prefilled: "Yes" },
  // T&C — Changes
  { num: 98, name: "q98", label: "How will you notify customers of changes to these terms?", section: "Terms & Conditions — Changes to Terms", prefilled: "Website notice and email to registered customers, at least 14 days before changes take effect", long: true },
  { num: 99, name: "q99", label: "How many days' notice will you give before changes take effect?", section: "Terms & Conditions — Changes to Terms", prefilled: "14 days" },
  { num: 100, name: "q100", label: "Will continued use of the site after changes count as acceptance?", section: "Terms & Conditions — Changes to Terms", prefilled: "Yes" },
];

// ── Component ──────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/legal-questionnaire")({
  component: LegalQuestionnaire,
});

function LegalQuestionnaire() {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    QUESTIONS.forEach((q) => { if (q.prefilled) init[q.name] = q.prefilled; });
    return init;
  });
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const sections = [...new Set(QUESTIONS.map((q) => q.section))];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const rows = QUESTIONS.map((q) => {
        const val = (values[q.name] ?? "").trim();
        const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `<tr style="border-bottom:1px solid #e8e4de;">
          <td style="padding:8px 12px;color:#999;font-family:monospace;font-size:12px;width:28px;vertical-align:top;">${q.num}</td>
          <td style="padding:8px 12px;font-size:13px;color:#444;width:44%;vertical-align:top;">${esc(q.label)}</td>
          <td style="padding:8px 12px;font-size:13px;color:${val ? "#1a1a1a" : "#bbb"};vertical-align:top;">${val ? esc(val) : "—"}</td>
        </tr>`;
      }).join("");

      const notesHtml = notes.trim()
        ? `<div style="padding:16px 20px;border-top:2px solid #eee;font-size:13px;color:#444;">
            <strong>Additional notes:</strong><br/>${notes.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}
           </div>`
        : "";

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f7f5f2;padding:32px 16px;">
<div style="max-width:800px;margin:0 auto;background:#fff;border:1px solid #ddd;">
<div style="background:#222;color:#fff;padding:14px 20px;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;">Notteshe — Legal Questionnaire Answers</div>
<table style="width:100%;border-collapse:collapse;">${rows}</table>
${notesHtml}
</div></body></html>`;

      await submitQuestionnaireFn({ data: { html } });
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f5f2", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "#999", marginBottom: 12, fontFamily: "Georgia, serif" }}>Notteshe</div>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: "normal", marginBottom: 12, color: "#111" }}>Answers submitted</h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.7 }}>Your answers have been sent to Nikolaos. Thank you.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f5f2", padding: "40px 16px 80px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 36, paddingBottom: 24, borderBottom: "2px solid #222" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase", color: "#999", marginBottom: 10, fontFamily: "Georgia, serif" }}>Notteshe</div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: "normal", color: "#111", marginBottom: 10 }}>Privacy Policy & Terms — Legal Questionnaire</h1>
          <p style={{ fontSize: 13, color: "#666", lineHeight: 1.7, maxWidth: 540, margin: "0 auto" }}>
            All 100 questions are listed below. <strong>Green fields</strong> are already answered — review and correct anything wrong. <strong>White fields</strong> need your answer. Hit <strong>Submit</strong> when done.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {sections.map((section) => {
            const qs = QUESTIONS.filter((q) => q.section === section);
            return (
              <div key={section} style={{ marginBottom: 28 }}>
                <div style={{ background: "#333", color: "#fff", fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", padding: "7px 12px", marginBottom: 0 }}>
                  {section}
                </div>
                <div style={{ background: "#fff", border: "1px solid #e8e4de", borderTop: "none" }}>
                  {qs.map((q, i) => {
                    const isPrefilled = !!q.prefilled;
                    const val = values[q.name] ?? "";
                    const inputStyle: React.CSSProperties = {
                      width: "100%",
                      fontFamily: "Arial, sans-serif",
                      fontSize: 13,
                      color: "#1a1a1a",
                      border: "1px solid " + (isPrefilled ? "#b2d8b2" : "#ddd"),
                      background: isPrefilled ? "#f1f8f1" : "#fffdf5",
                      padding: "8px 10px",
                      outline: "none",
                      resize: "vertical" as const,
                      boxSizing: "border-box" as const,
                    };
                    return (
                      <div key={q.name} style={{ padding: "12px 14px", borderBottom: i < qs.length - 1 ? "1px solid #f0ece6" : "none" }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, color: "#bbb", fontFamily: "monospace", flexShrink: 0, paddingTop: 1 }}>{q.num}</span>
                          <span style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>{q.label}</span>
                        </div>
                        {q.hint && <div style={{ fontSize: 11.5, color: "#aaa", fontStyle: "italic", marginBottom: 5, paddingLeft: 20 }}>{q.hint}</div>}
                        <div style={{ paddingLeft: 20 }}>
                          {q.long ? (
                            <textarea
                              name={q.name}
                              value={val}
                              rows={3}
                              style={inputStyle}
                              onChange={(e) => setValues((v) => ({ ...v, [q.name]: e.target.value }))}
                            />
                          ) : (
                            <input
                              type="text"
                              name={q.name}
                              value={val}
                              style={inputStyle}
                              onChange={(e) => setValues((v) => ({ ...v, [q.name]: e.target.value }))}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Notes */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ background: "#333", color: "#fff", fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", padding: "7px 12px" }}>
              Additional Notes or Corrections
            </div>
            <div style={{ background: "#fff", border: "1px solid #e8e4de", borderTop: "none", padding: "12px 14px" }}>
              <textarea
                name="notes"
                value={notes}
                rows={4}
                placeholder="If anything above is incorrect or needs clarification, write it here."
                style={{ width: "100%", fontFamily: "Arial, sans-serif", fontSize: 13, color: "#1a1a1a", border: "1px solid #ddd", background: "#fffdf5", padding: "8px 10px", outline: "none", resize: "vertical", boxSizing: "border-box" }}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          {error && <div style={{ background: "#fee", border: "1px solid #fcc", padding: "12px 16px", fontSize: 13, color: "#c00", marginBottom: 16 }}>{error}</div>}

          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <button
              type="submit"
              disabled={submitting}
              style={{ background: submitting ? "#888" : "#222", color: "#fff", border: "none", padding: "14px 40px", fontSize: 13, letterSpacing: "0.15em", textTransform: "uppercase", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "Arial, sans-serif" }}
            >
              {submitting ? "Sending…" : "Submit Answers"}
            </button>
            <div style={{ marginTop: 10, fontSize: 12, color: "#999" }}>Answers will be emailed directly to Nikolaos.</div>
          </div>
        </form>
      </div>
    </div>
  );
}

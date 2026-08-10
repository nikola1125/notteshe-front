import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { db } from "@/db";
import { contactMessage } from "@/db/schema";
import { z } from "zod";
import { nanoid } from "nanoid";

const ContactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
});

const submitContact = createServerFn({ method: "POST" })
  .validator(ContactSchema)
  .handler(async ({ data }) => {
    await db().insert(contactMessage).values({
      id: nanoid(),
      name: data.name,
      email: data.email,
      message: data.message,
    });
    const { notifyAdmins } = await import("@/lib/admin/sse");
    notifyAdmins({ event: "new_message", name: data.name });
    return { ok: true };
  });

export const Route = createFileRoute("/contact")({
  component: ContactPage,
});

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [errors, setErrors] = useState<Partial<typeof form>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const next: Partial<typeof form> = {};
    if (!form.name.trim()) next.name = "Required";
    if (!form.email.trim()) next.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.message.trim()) next.message = "Required";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setStatus("sending");
    try {
      await submitContact({ data: { name: form.name, email: form.email, message: form.message } });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1600px] px-5 pb-32 pt-24 md:px-12 md:pt-32">

        <button
          onClick={() => window.history.back()}
          className="mb-10 flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M9 2 4 7l5 5" />
          </svg>
          Back
        </button>

        <div className="grid grid-cols-1 gap-20 md:grid-cols-2">

          {/* Left */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Get in touch</p>
            <h1 className="serif mt-4 text-5xl font-light text-ink md:text-6xl">Contact us</h1>
            <p className="mt-8 max-w-sm text-[14px] font-light leading-relaxed text-muted-foreground">
              For order enquiries, press, or general questions — we usually respond within one business day.
            </p>
            <div className="mt-12 space-y-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Email</p>
                <a href="mailto:hello@notteshe.com" className="mt-1 block text-[14px] text-ink transition hover:text-ink/60">
                  hello@notteshe.com
                </a>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Based in</p>
                <p className="mt-1 text-[14px] text-ink">Tirana, Albania</p>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div>
            {status === "sent" ? (
              <div className="flex h-full flex-col items-start justify-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border">
                  <svg width="18" height="13" viewBox="0 0 22 16" fill="none" stroke="currentColor" strokeWidth="1.2">
                    <polyline points="1 8 7 14 21 1" />
                  </svg>
                </div>
                <p className="serif text-2xl text-ink">Message sent.</p>
                <p className="text-[13px] font-light text-muted-foreground">We'll be in touch within one business day.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8" noValidate>
                <Field label="Your name" value={form.name} onChange={(v) => set("name", v)} error={errors.name} placeholder="Full name" />
                <Field label="Email address" value={form.email} onChange={(v) => set("email", v)} error={errors.email} type="email" placeholder="you@somewhere.com" />
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Message</label>
                  <textarea
                    value={form.message}
                    onChange={(e) => set("message", e.target.value)}
                    rows={5}
                    placeholder="How can we help?"
                    style={{ fontSize: '16px' }}
                    className={`mt-2 w-full resize-none border-b bg-transparent pb-2.5 text-ink outline-none placeholder:text-muted-foreground/30 transition-colors focus:border-ink/60 ${errors.message ? "border-clay" : "border-border"}`}
                  />
                  {errors.message && <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-clay">{errors.message}</p>}
                </div>
                <div className="space-y-3">
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    className="w-full bg-ink py-4 font-mono text-[11px] uppercase tracking-widest text-background transition-colors hover:bg-ink/90 disabled:opacity-50 md:w-auto md:px-12"
                  >
                    {status === "sending" ? (
                      <span className="flex items-center gap-3">
                        <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                          <path d="M12 2a10 10 0 0 1 10 10" />
                        </svg>
                        Sending…
                      </span>
                    ) : "Send message"}
                  </button>
                  {status === "error" && (
                    <p className="font-mono text-[9px] uppercase tracking-widest text-clay">
                      Something went wrong. Please try again.
                    </p>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface FieldProps {
  label: string; value: string; onChange: (v: string) => void;
  error?: string; type?: string; placeholder?: string;
}

function Field({ label, value, onChange, error, type = "text", placeholder }: FieldProps) {
  return (
    <div>
      <label className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ fontSize: '16px' }}
        className={`mt-2 w-full border-b bg-transparent pb-2.5 text-ink outline-none placeholder:text-muted-foreground/30 transition-colors focus:border-ink/60 ${error ? "border-clay" : "border-border"}`}
      />
      {error && <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-clay">{error}</p>}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { BackButton } from "@/components/admin/BackButton";
import { eq, desc, count } from "drizzle-orm";
import { toast } from "sonner";
import { useState } from "react";
import { db } from "@/db";
import { newsletterSubscriber } from "@/db/schema";
import { requireAdmin } from "@/lib/admin/auth";
import { logAudit } from "@/lib/admin/audit";
import type { InferSelectModel } from "drizzle-orm";

type NewsletterSubscriber = InferSelectModel<typeof newsletterSubscriber>;

interface NewsletterData {
  subscribers: NewsletterSubscriber[];
  activeCount: number;
}

const getSubscribers = createServerFn({ method: "GET" }).handler(
  async (): Promise<NewsletterData> => {
    await requireAdmin();
    const database = db();

    const [subs, activeResult] = await Promise.all([
      database
        .select()
        .from(newsletterSubscriber)
        .orderBy(desc(newsletterSubscriber.createdAt)),
      database
        .select({ count: count() })
        .from(newsletterSubscriber)
        .where(eq(newsletterSubscriber.isActive, true)),
    ]);

    return {
      subscribers: subs,
      activeCount: Number(activeResult[0]?.count ?? 0),
    };
  }
);

const toggleSubscriber = createServerFn({ method: "POST" })
  .validator((input: unknown) => input as { id: string; active: boolean })
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    await db()
      .update(newsletterSubscriber)
      .set({ isActive: data.active })
      .where(eq(newsletterSubscriber.id, data.id));
    await logAudit(
      admin.id,
      "newsletter.toggle",
      "newsletter_subscriber",
      data.id
    );
    return { success: true };
  });

export const Route = createFileRoute("/admin/newsletter")({
  loader: () => getSubscribers(),
  staleTime: 30_000,
  component: Newsletter,
});

function Newsletter() {
  const loaderData = Route.useLoaderData();
  const [data, setData] = useState(loaderData);

  async function handleToggle(id: string, current: boolean) {
    try {
      await toggleSubscriber({ data: { id, active: !current } });
      setData((prev) => ({
        ...prev,
        subscribers: prev.subscribers.map((s) =>
          s.id === id ? { ...s, isActive: !current } : s
        ),
        activeCount: prev.activeCount + (current ? -1 : 1),
      }));
    } catch {
      toast.error("Failed to update");
    }
  }

  function fmtDate(d: Date | string) {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className="p-6 lg:p-8">
      <BackButton />
      <div className="mb-6 flex items-center gap-4">
        <h1 className="font-serif text-2xl italic text-[var(--color-foreground)]">
          Newsletter
        </h1>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            Active
          </p>
          <p className="font-serif text-xl italic text-[var(--color-clay)]">
            {data.activeCount}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
            Total
          </p>
          <p className="font-serif text-xl italic text-[var(--color-foreground)]">
            {data.subscribers.length}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-paper)]">
              {["Email", "Source", "Subscribed", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-paper)]">
            {data.subscribers.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="py-12 text-center font-mono text-xs text-[var(--color-muted-foreground)]"
                >
                  No subscribers yet
                </td>
              </tr>
            )}
            {data.subscribers.map((s) => (
              <tr key={s.id} className="hover:bg-[var(--color-muted)]/30">
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-foreground)]">
                  {s.email}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--color-muted-foreground)]">
                    {s.source ?? "website"}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-[var(--color-muted-foreground)]">
                  {fmtDate(s.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleToggle(s.id, s.isActive)}
                    className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider transition-colors ${s.isActive ? "bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400" : "bg-red-500/20 text-red-400 hover:bg-green-500/20 hover:text-green-400"}`}
                  >
                    {s.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

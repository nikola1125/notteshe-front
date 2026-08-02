import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/login")({
  component: AdminLogin,
});

function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json() as { success: boolean; error?: string };
      if (json.success) {
        await router.navigate({ to: "/admin" });
      } else {
        toast.error(json.error ?? "Invalid credentials");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-muted-foreground)]">
            Admin
          </p>
          <h1 className="font-serif text-3xl italic text-[var(--color-foreground)]">
            Notteshe
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-6"
        >
          <div className="space-y-1">
            <label
              htmlFor="email"
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none transition-colors focus:border-[var(--color-clay)]"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="password"
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none transition-colors focus:border-[var(--color-clay)]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-[var(--color-clay)] px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { loginAdminFn } from "@/lib/admin/auth";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "manifest", href: "/manifest.json" }],
  }),
  component: AdminLogin,
});

function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Register SW so the browser evaluates this site as PWA-installable
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    // Capture the install prompt silently — we'll trigger it after login
    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__installPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await loginAdminFn({ data: { email, password } });
      if (result.success) {
        if ((window as any).__installPrompt) {
          (window as any).__installPrompt.prompt();
          (window as any).__installPrompt = null;
        }
        await router.navigate({ to: "/admin" });
      } else {
        toast.error(result.error ?? "Invalid credentials");
      }
    } catch {
      toast.error("Login failed");
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

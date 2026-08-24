import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { loginAdminFn } from "@/lib/admin/auth";
import { startAuthenticationFn, finishAuthenticationFn } from "@/lib/admin/passkey";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "manifest", href: "/manifest.json" }],
  }),
  component: AdminLogin,
});

type BiometricState = "detecting" | "pending" | "unavailable" | "failed";

function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [biometric, setBiometric] = useState<BiometricState>("detecting");
  const hasAutoTriggered = useRef(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__installPrompt = e;
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Detect biometric support then auto-trigger
  useEffect(() => {
    if (!window.PublicKeyCredential) {
      setBiometric("unavailable");
      return;
    }
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      .then((available) => {
        if (!available) { setBiometric("unavailable"); return; }
        if (hasAutoTriggered.current) return;
        hasAutoTriggered.current = true;
        setBiometric("pending");
        // Small delay so the UI renders before the system sheet appears
        setTimeout(() => runBiometric(true), 300);
      })
      .catch(() => setBiometric("unavailable"));
  }, []);

  async function runBiometric(silent = false) {
    setBiometric("pending");
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const options = await startAuthenticationFn();
      const authResponse = await startAuthentication({ optionsJSON: options });
      const result = await finishAuthenticationFn({ data: { response: authResponse } });
      if (result.success) {
        sessionStorage.setItem("adminActive", "1");
        if ((window as any).__installPrompt) {
          (window as any).__installPrompt.prompt();
          (window as any).__installPrompt = null;
        }
        await router.navigate({ to: "/admin" });
      } else {
        setBiometric("failed");
        if (!silent) toast.error((result as any).error ?? "Biometric login failed");
      }
    } catch (err: any) {
      setBiometric("failed");
      if (!silent && err?.name !== "NotAllowedError") {
        toast.error("Biometric login failed");
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await loginAdminFn({ data: { email, password } });
      if (result.success) {
        sessionStorage.setItem("adminActive", "1");
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

  const showPasswordForm = biometric === "unavailable" || biometric === "failed";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[var(--color-muted-foreground)]">
            Admin
          </p>
          <h1 className="font-serif text-3xl text-[var(--color-foreground)]">
            Notteshe
          </h1>
        </div>

        {/* Biometric auto-triggering */}
        {(biometric === "detecting" || biometric === "pending") && (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] p-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--color-clay)] opacity-80">
              <path d="M12 10a2 2 0 0 0-2 2v1a2 2 0 0 0 4 0v-1a2 2 0 0 0-2-2z"/>
              <path d="M10.4 3.3A8 8 0 0 1 20 11v4"/>
              <path d="M4 13a8 8 0 0 1 3.4-6.5"/>
              <path d="M8 20.7A8 8 0 0 0 19.4 17"/>
              <path d="M12 20v.01"/>
              <path d="M12 14v3"/>
            </svg>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              {biometric === "detecting" ? "Checking…" : "Waiting for Face ID / Touch ID"}
            </p>
          </div>
        )}

        {/* Biometric failed — show retry + password form */}
        {biometric === "failed" && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-paper)] px-4 py-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)]">
              Face ID / Touch ID
            </span>
            <button
              onClick={() => runBiometric(false)}
              className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-clay)] transition-opacity hover:opacity-70"
            >
              Try again
            </button>
          </div>
        )}

        {/* Password form — shown when biometric unavailable or failed */}
        {showPasswordForm && (
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
        )}
      </div>
    </div>
  );
}

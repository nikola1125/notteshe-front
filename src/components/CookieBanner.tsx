import { useState, useEffect } from "react";

const STORAGE_KEY = "notteshe_cookie_consent";

function loadClarity() {
  if (typeof window === "undefined") return;
  if ((window as any).clarity) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://www.clarity.ms/tag/y3svsr7kjm";
  document.head.appendChild(s);
  (window as any).clarity = (window as any).clarity || function (...args: any[]) {
    ((window as any).clarity.q = (window as any).clarity.q || []).push(args);
  };
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (consent === "accepted") {
      loadClarity();
    } else if (!consent) {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    loadClarity();
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, "declined");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background px-4 py-4 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground">
          We use cookies to analyse how visitors use our site (Microsoft Clarity).
          No personal data is sold. You can decline and still use the site fully.{" "}
          <a
            href="/privacy"
            className="underline underline-offset-2 hover:text-ink transition-colors"
          >
            Privacy Policy
          </a>
        </p>
        <div className="flex shrink-0 gap-3">
          <button
            onClick={decline}
            className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-ink"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="border border-ink px-5 py-2 font-mono text-[10px] uppercase tracking-widest text-ink transition-opacity hover:opacity-70"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

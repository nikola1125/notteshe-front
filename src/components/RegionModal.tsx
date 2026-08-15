import { useEffect, useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { ALBANIA_CODE, currencyForCountry } from "@/lib/currency";
import { useCurrencyStore } from "@/store/currencyStore";

// First-visit "Where are you shopping from?" picker — a compact country dropdown.
// Shows once (until a region is chosen) and can be reopened from the header.
// Albania → Lek, every other country → Euro.
export function RegionModal() {
  const hasHydrated = useCurrencyStore((s) => s.hasHydrated);
  const chosen = useCurrencyStore((s) => s.chosen);
  const pickerOpen = useCurrencyStore((s) => s.pickerOpen);
  const savedCountry = useCurrencyStore((s) => s.country);
  const setCountry = useCurrencyStore((s) => s.setCountry);
  const closePicker = useCurrencyStore((s) => s.closePicker);

  const [selected, setSelected] = useState(savedCountry ?? ALBANIA_CODE);

  const open = hasHydrated && (!chosen || pickerOpen);
  const isLek = currencyForCountry(selected) === "ALL";

  useEffect(() => {
    if (!open) return;
    setSelected(savedCountry ?? ALBANIA_CODE);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, savedCountry]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md border border-border/70 bg-background shadow-2xl">
        <div className="px-7 pt-7 pb-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-clay">Notteshe</p>
          <h2 className="serif mt-3 text-[26px] leading-tight text-ink">Where are you shopping from?</h2>
          <p className="mt-2.5 text-[13px] font-light leading-relaxed text-muted-foreground">
            Choose your country and we’ll show prices in your currency.
          </p>

          {/* Country dropdown */}
          <label htmlFor="region-country" className="mt-6 block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Country
          </label>
          <div className="relative mt-2">
            <select
              id="region-country"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full appearance-none border border-border/70 bg-transparent py-3 pl-4 pr-10 text-[15px] text-ink outline-none transition-colors focus:border-ink/50"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} className="bg-background text-ink">
                  {c.name}
                </option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground" width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M3 4.5 6 7.5 9 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Live currency indicator */}
          <p className="mt-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-1 w-1 rounded-full bg-clay" />
            Prices shown in {isLek ? "Lek · L" : "Euro · €"}
          </p>

          {/* Confirm */}
          <button
            onClick={() => setCountry(selected)}
            className="mt-7 w-full bg-ink py-3.5 font-mono text-[11px] uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80"
          >
            Continue
          </button>

          {chosen && (
            <button
              onClick={closePicker}
              className="mt-3 w-full text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-ink"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { currencyForCountry, type Currency } from "@/lib/currency";

interface CurrencyStore {
  /** Selected ISO country code, or null until the shopper chooses. */
  country: string | null;
  /** True once the shopper has picked a region (so the popup shows only once). */
  chosen: boolean;
  /** True after localStorage rehydration — used to avoid SSR/hydration mismatch. */
  hasHydrated: boolean;
  /** Transient: force the region picker open (e.g. header "change region"). */
  pickerOpen: boolean;
  setCountry: (code: string) => void;
  openPicker: () => void;
  closePicker: () => void;
}

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set) => ({
      country: null,
      chosen: false,
      hasHydrated: false,
      pickerOpen: false,
      setCountry: (code) => set({ country: code, chosen: true, pickerOpen: false }),
      openPicker: () => set({ pickerOpen: true }),
      closePicker: () => set({ pickerOpen: false }),
    }),
    {
      name: "notteshe-region",
      partialize: (s) => ({ country: s.country, chosen: s.chosen }),
      onRehydrateStorage: () => (state) => {
        if (state) state.hasHydrated = true;
      },
    }
  )
);

/** Selected currency, defaulting to EUR before a choice is made. */
export function useCurrency(): Currency {
  const country = useCurrencyStore((s) => s.country);
  const hasHydrated = useCurrencyStore((s) => s.hasHydrated);
  // Before hydration, always report EUR so server and first client render match.
  if (!hasHydrated) return "EUR";
  return currencyForCountry(country);
}

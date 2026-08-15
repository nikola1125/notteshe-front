import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_RATE, formatMoney, type Rate } from "@/lib/currency";
import { useCurrency } from "@/store/currencyStore";

// The EUR→Lek rate is admin-set and delivered from the server (root loader),
// then made available app-wide through this context.
const RateContext = createContext<Rate>(DEFAULT_RATE);

export function CurrencyRateProvider({ rate, children }: { rate: Rate; children: ReactNode }) {
  return <RateContext.Provider value={rate}>{children}</RateContext.Provider>;
}

export function useRate(): Rate {
  return useContext(RateContext);
}

/**
 * Renders an EUR base amount in the shopper's selected currency.
 * `value` is ALWAYS the euro price stored in the DB — conversion happens here.
 */
export function Price({ value, className }: { value: number; className?: string }) {
  const currency = useCurrency();
  const rate = useRate();
  return <span className={className}>{formatMoney(value, currency, rate)}</span>;
}

// Currency model:
//   • EUR is the base / source-of-truth price stored in the DB.
//   • Albania shops in Lek (ALL); every other country shops in Euro (EUR).
//   • Lek amount = round(eurAmount × rate) to the nearest `rounding` step.
// The card a customer uses never changes what we receive — only the currency
// the order is charged in (which follows the selected country) does.

export type Currency = "EUR" | "ALL";

export const ALBANIA_CODE = "AL";

export interface Rate {
  eurToLek: number;   // e.g. 100 => 1 EUR = 100 L
  lekRounding: number; // round Lek prices to nearest N (e.g. 100)
}

export const DEFAULT_RATE: Rate = { eurToLek: 100, lekRounding: 100 };

/** Currency implied by a country code. Albania => Lek, everything else => Euro. */
export function currencyForCountry(code: string | null | undefined): Currency {
  return code === ALBANIA_CODE ? "ALL" : "EUR";
}

/** Convert a base EUR amount into the target currency's numeric value. */
export function convert(eurAmount: number, currency: Currency, rate: Rate): number {
  if (currency === "EUR") return eurAmount;
  const step = rate.lekRounding > 0 ? rate.lekRounding : 1;
  return Math.round((eurAmount * rate.eurToLek) / step) * step;
}

/** Format an EUR base amount for display in the selected currency. */
export function formatMoney(eurAmount: number, currency: Currency, rate: Rate): string {
  if (currency === "ALL") {
    const value = convert(eurAmount, "ALL", rate);
    return `ALL ${new Intl.NumberFormat("sq-AL").format(value)}`;
  }
  // EUR: whole numbers show with no decimals, otherwise up to 2.
  const rounded = Math.round(eurAmount * 100) / 100;
  const str = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/\.?0+$/, "");
  return `${str} €`;
}

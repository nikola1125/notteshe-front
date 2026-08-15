// Shared definition of the landing "collections" layout so the admin builder and
// the homepage renderer agree on row types, cell counts, and column spans.
//
// One control, auto-responsive: a 12-column grid at ALL breakpoints, with explicit
// mobile and desktop spans per cell — so asymmetric rows keep their ratio on phones
// and nothing ever overflows.

export type RowType = "full" | "two" | "three" | "four" | "wide-narrow" | "narrow-wide" | "wide-stack" | "stack-wide";

// Structured rows have a nested (non-flat) layout handled specially by the renderer.
export function isStructured(type: RowType): boolean {
  return type === "wide-stack" || type === "stack-wide";
}

export interface HomeRow {
  id: string;
  type: RowType;
  items: (string | null)[]; // collection ids per cell (null = empty cell)
}

export interface RowTypeDef {
  type: RowType;
  label: string;
  cells: number;
  desktop: number[]; // 12-col spans on desktop
  mobile: number[];  // 12-col spans on mobile
}

export const ROW_TYPES: RowTypeDef[] = [
  { type: "full",        label: "Full width",          cells: 1, desktop: [12],      mobile: [12] },
  { type: "two",         label: "Two equal",           cells: 2, desktop: [6, 6],    mobile: [6, 6] },
  { type: "three",       label: "Three equal",         cells: 3, desktop: [4, 4, 4], mobile: [6, 6, 12] },
  { type: "four",        label: "Four equal",          cells: 4, desktop: [3, 3, 3, 3], mobile: [6, 6, 6, 6] },
  { type: "wide-narrow", label: "Wide + narrow",       cells: 2, desktop: [8, 4],    mobile: [8, 4] },
  { type: "narrow-wide", label: "Narrow + wide",       cells: 2, desktop: [4, 8],    mobile: [4, 8] },
  // Structured (nested) — one wide card beside two stacked cards that fill its height.
  { type: "wide-stack",  label: "Wide + two stacked",  cells: 3, desktop: [8, 4, 4], mobile: [12, 6, 6] },
  { type: "stack-wide",  label: "Two stacked + wide",  cells: 3, desktop: [4, 4, 8], mobile: [6, 6, 12] },
];

export function rowDef(type: RowType): RowTypeDef {
  return ROW_TYPES.find((r) => r.type === type) ?? ROW_TYPES[0];
}

// Static class maps so Tailwind keeps every span in the build.
const MOBILE: Record<number, string> = {
  3: "col-span-3", 4: "col-span-4", 6: "col-span-6", 8: "col-span-8", 12: "col-span-12",
};
const DESKTOP: Record<number, string> = {
  3: "md:col-span-3", 4: "md:col-span-4", 6: "md:col-span-6", 8: "md:col-span-8", 12: "md:col-span-12",
};

/** Combined mobile+desktop col-span classes for a given cell index of a row. */
export function cellSpanClass(type: RowType, index: number): string {
  const def = rowDef(type);
  const m = def.mobile[index] ?? def.mobile[def.mobile.length - 1];
  const d = def.desktop[index] ?? def.desktop[def.desktop.length - 1];
  return `${MOBILE[m] ?? "col-span-6"} ${DESKTOP[d] ?? "md:col-span-4"}`;
}

/**
 * Aspect ratio per cell so the section stays a sensible height on desktop:
 * wider cells go landscape, narrow cells stay portrait. Mobile is portrait.
 */
export function cellAspectClass(type: RowType, index: number): string {
  const span = rowDef(type).desktop[index] ?? 4;
  if (span >= 12) return "aspect-[4/5] md:aspect-[21/9]"; // full-width banner
  if (span >= 8) return "aspect-[4/5] md:aspect-[3/2]";   // wide → landscape
  if (span >= 6) return "aspect-[4/5] md:aspect-[4/3]";   // half → slight landscape
  return "aspect-[3/4]";                                    // third / quarter → portrait
}

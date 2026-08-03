import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/size-guide")({
  component: SizeGuidePage,
});

const TOPS = [
  { size: "XS", chest: "80–84", waist: "62–66", hips: "88–92" },
  { size: "S",  chest: "84–88", waist: "66–70", hips: "92–96" },
  { size: "M",  chest: "88–92", waist: "70–74", hips: "96–100" },
  { size: "L",  chest: "92–96", waist: "74–78", hips: "100–104" },
  { size: "XL", chest: "96–100", waist: "78–82", hips: "104–108" },
];

const BOTTOMS = [
  { size: "XS", waist: "62–66", hips: "88–92", inseam: "76" },
  { size: "S",  waist: "66–70", hips: "92–96", inseam: "77" },
  { size: "M",  waist: "70–74", hips: "96–100", inseam: "78" },
  { size: "L",  waist: "74–78", hips: "100–104", inseam: "79" },
  { size: "XL", waist: "78–82", hips: "104–108", inseam: "80" },
];

function SizeGuidePage() {
  const [unit, setUnit] = useState<"cm" | "in">("cm");

  function convert(val: string): string {
    if (unit === "cm") return val;
    return val.split("–").map((v) => Math.round(parseInt(v) / 2.54)).join("–");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[900px] px-5 pb-32 pt-32 md:px-12 md:pt-40">
        <div className="flex items-end justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Fit</p>
            <h1 className="serif mt-4 text-5xl font-light text-ink">Size guide</h1>
          </div>
          <div className="flex overflow-hidden border border-border">
            {(["cm", "in"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${unit === u ? "bg-ink text-background" : "text-muted-foreground hover:text-ink"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-6 text-[13px] font-light leading-relaxed text-muted-foreground">
          All measurements are body measurements in {unit}. When between sizes, we recommend sizing up for a relaxed fit.
        </p>

        <div className="mt-16 space-y-16">
          {/* Tops */}
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Tops & dresses</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {["Size", `Chest (${unit})`, `Waist (${unit})`, `Hips (${unit})`].map((h) => (
                      <th key={h} className="py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {TOPS.map((row) => (
                    <tr key={row.size}>
                      <td className="py-4 font-mono text-[12px] text-ink">{row.size}</td>
                      <td className="py-4 font-mono text-[12px] text-muted-foreground">{convert(row.chest)}</td>
                      <td className="py-4 font-mono text-[12px] text-muted-foreground">{convert(row.waist)}</td>
                      <td className="py-4 font-mono text-[12px] text-muted-foreground">{convert(row.hips)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Bottoms */}
          <section>
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">Trousers & skirts</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {["Size", `Waist (${unit})`, `Hips (${unit})`, `Inseam (${unit})`].map((h) => (
                      <th key={h} className="py-3 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {BOTTOMS.map((row) => (
                    <tr key={row.size}>
                      <td className="py-4 font-mono text-[12px] text-ink">{row.size}</td>
                      <td className="py-4 font-mono text-[12px] text-muted-foreground">{convert(row.waist)}</td>
                      <td className="py-4 font-mono text-[12px] text-muted-foreground">{convert(row.hips)}</td>
                      <td className="py-4 font-mono text-[12px] text-muted-foreground">{convert(row.inseam)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-mono text-[11px] uppercase tracking-widest text-ink">How to measure</h2>
            <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                { name: "Chest", desc: "Measure around the fullest part of your chest, keeping the tape parallel to the floor." },
                { name: "Waist", desc: "Measure around your natural waistline, the narrowest part of your torso." },
                { name: "Hips", desc: "Measure around the fullest part of your hips, approximately 20cm below your natural waist." },
              ].map((m) => (
                <div key={m.name}>
                  <p className="text-[13px] font-medium text-ink">{m.name}</p>
                  <p className="mt-2 text-[12px] font-light leading-relaxed text-muted-foreground">{m.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { searchProducts, type SearchResult } from "@/lib/search";
import { cldImg } from "@/lib/cldImage";

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  // Debounced search
  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchProducts({ data: { q: query } });
        setResults(r);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const trimmed = q.trim();

  return (
    <div className="fixed inset-0 z-[120]">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-x-0 top-0 max-h-[100dvh] overflow-y-auto bg-background shadow-2xl">
        <div className="mx-auto max-w-[1600px] px-5 py-5 md:px-12 md:py-7">
          {/* Search bar */}
          <div className="flex items-center gap-4 border-b border-border pb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ink/50">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pieces…"
              className="w-full bg-transparent text-[18px] text-ink outline-none placeholder:text-muted-foreground/40 md:text-[22px]"
            />
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center text-ink/50 transition-colors hover:text-ink"
              aria-label="Close search"
            >
              <svg width="16" height="16" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
                <line x1="1" y1="1" x2="13" y2="13" />
                <line x1="13" y1="1" x2="1" y2="13" />
              </svg>
            </button>
          </div>

          {/* Results */}
          <div className="py-6">
            {trimmed.length < 2 ? (
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                Type at least 2 characters to search.
              </p>
            ) : loading ? (
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">Searching…</p>
            ) : results.length === 0 ? (
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50">
                No pieces found for “{trimmed}”.
              </p>
            ) : (
              <>
                <p className="mb-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {results.length} {results.length === 1 ? "result" : "results"}
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {results.map((p) => (
                    <Link
                      key={p.id}
                      to="/shop/$slug"
                      params={{ slug: p.slug }}
                      onClick={onClose}
                      className="group"
                    >
                      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                        {p.coverImage ? (
                          <img
                            src={cldImg(p.coverImage, 400)}
                            alt={p.name}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-500 ease-out md:group-hover:scale-[1.04]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">No image</span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-start justify-between gap-2">
                        <h3 className="serif text-[14px] leading-tight text-ink">{p.name}</h3>
                        <p className="shrink-0 font-mono text-[11px] text-ink/70">{p.price} €</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

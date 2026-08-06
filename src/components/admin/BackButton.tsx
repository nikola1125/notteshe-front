import { useRouter } from "@tanstack/react-router";

export function BackButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.history.back()}
      className="mb-6 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] active:opacity-60"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M8 2L4 6l4 4" />
      </svg>
      Back
    </button>
  );
}

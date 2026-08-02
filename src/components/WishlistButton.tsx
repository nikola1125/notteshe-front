import { useState } from "react";
import { useWishlist } from "@/store/wishlistStore";
import { useAuthStore } from "@/store/authStore";
import { useSession } from "@/lib/auth/client";

interface WishlistButtonProps {
  productId: string;
  className?: string;
}

const PARTICLES = [
  { tx: "-22px", ty: "-20px" },
  { tx: "0px",   ty: "-28px" },
  { tx: "22px",  ty: "-20px" },
  { tx: "-24px", ty: "8px"   },
  { tx: "24px",  ty: "8px"   },
  { tx: "0px",   ty: "18px"  },
];

export function WishlistButton({ productId, className = "" }: WishlistButtonProps) {
  const { toggle, has } = useWishlist();
  const liked = has(productId);
  const [burst, setBurst] = useState(false);
  const { data: session } = useSession();
  const { openAuthModal } = useAuthStore();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user) {
      openAuthModal("login");
      return;
    }

    if (!liked) {
      setBurst(true);
      setTimeout(() => setBurst(false), 700);
    }
    toggle(productId);
  }

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {burst && PARTICLES.map((p, i) => (
        <span
          key={i}
          className="pointer-events-none absolute"
          style={{
            "--tx": p.tx,
            "--ty": p.ty,
            animation: `heart-particle 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${i * 40}ms both`,
          } as React.CSSProperties}
        >
          <svg width="5" height="5" viewBox="0 0 24 24" fill="currentColor" className="text-clay">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </span>
      ))}

      <button
        onClick={handleClick}
        aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
        className="flex items-center justify-center"
        style={burst ? { animation: "heart-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both" } : undefined}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-colors duration-200 ${liked ? "text-clay" : "text-ink/50 group-hover:text-ink/80"}`}
          style={!burst ? {
            transform: liked ? "scale(1.15)" : "scale(1)",
            transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), color 0.2s ease",
          } : undefined}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>
    </div>
  );
}

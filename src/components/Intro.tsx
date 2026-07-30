import { useEffect, useState } from "react";
import introImg from "@/assets/intro.jpg";

const LETTERS = "NOTTESHE".split("");
type Phase = "enter" | "walk" | "hold" | "exit";

export function Intro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<Phase>("enter");

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const timers = [
      // Letters finish sweeping → leopard starts walking in
      setTimeout(() => setPhase("walk"), 1300),
      // Leopard reaches position and sits
      setTimeout(() => setPhase("hold"), 2700),
      // Close
      setTimeout(() => setPhase("exit"), 3900),
      setTimeout(() => {
        document.body.style.overflow = "";
        onComplete();
      }, 4800),
    ];

    return () => {
      timers.forEach(clearTimeout);
      document.body.style.overflow = "";
    };
  }, [onComplete]);

  const isExiting = phase === "exit";

  // Image slides in from right simulating the leopard walking into position
  const imageTransform = (() => {
    if (phase === "enter") return "translateX(55%) translateY(1%)";
    if (phase === "walk")  return "translateX(3%)  translateY(0.3%)";
    return                        "translateX(0)    translateY(0)";
  })();

  const imageTransition = (() => {
    if (phase === "enter") return "none";
    if (phase === "walk")
      // Smooth deceleration — leopard strides in
      return "opacity 0.5s ease, transform 1.5s cubic-bezier(0.25, 0.1, 0.25, 1)";
    // Gentle spring — leopard settles / sits
    return "opacity 0.4s ease, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)";
  })();

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-background"
      style={{
        transform: isExiting ? "translateY(-100%)" : "translateY(0)",
        transition: isExiting ? "transform 0.9s cubic-bezier(0.76, 0, 0.24, 1)" : "none",
      }}
    >
      {/* intro.jpg — slides in from right as leopard "walks", settles into position */}
      <img
        src={introImg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{
          opacity: phase === "enter" ? 0 : 1,
          transform: imageTransform,
          transition: imageTransition,
        }}
      />

      {/* Animated letters — sweep up first, then fade as image takes over */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: phase === "hold" || phase === "exit" ? 0 : 1,
          transition: "opacity 0.7s ease",
          pointerEvents: "none",
        }}
      >
        <div className="flex items-end">
          {LETTERS.map((letter, i) => (
            <span key={i} className="inline-block overflow-hidden leading-none">
              <span
                className="serif inline-block"
                style={{
                  fontSize: "clamp(34px, 9vw, 112px)",
                  fontWeight: 300,
                  letterSpacing: "0.18em",
                  color: "var(--color-ink)",
                  transform: phase === "enter" ? "translateY(110%)" : "translateY(0)",
                  transition: `transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.055}s`,
                }}
              >
                {letter}
              </span>
            </span>
          ))}
          {/* Period */}
          <span className="inline-block overflow-hidden leading-none">
            <span
              className="serif inline-block"
              style={{
                fontSize: "clamp(34px, 9vw, 112px)",
                fontWeight: 300,
                color: "var(--color-clay)",
                transform: phase === "enter" ? "translateY(110%)" : "translateY(0)",
                transition: `transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${LETTERS.length * 0.055}s`,
              }}
            >
              .
            </span>
          </span>
        </div>
      </div>

      {/* Tagline + line — appear once leopard has settled */}
      <div className="absolute bottom-14 left-1/2 -translate-x-1/2 text-center">
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "10px",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "var(--color-muted-foreground)",
            opacity: phase === "hold" ? 1 : 0,
            transform: phase === "hold" ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 0.7s ease 0.3s, transform 0.7s ease 0.3s",
          }}
        >
          Considered essentials · AW26
        </p>
        <div
          className="mx-auto mt-4"
          style={{
            width: phase === "hold" ? "60px" : "0px",
            height: "1px",
            background: "var(--color-border)",
            transition: "width 0.9s ease 0.5s",
          }}
        />
      </div>
    </div>
  );
}

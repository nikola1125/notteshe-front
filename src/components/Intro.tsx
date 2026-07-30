import { useEffect, useState } from "react";
import introImg from "@/assets/intro.jpg";

const LETTERS = "NOTTESHE".split("");

export function Intro({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const timers = [
      setTimeout(() => setPhase("hold"), 1200),
      setTimeout(() => setPhase("exit"), 2600),
      setTimeout(() => {
        document.body.style.overflow = "";
        onComplete();
      }, 3500),
    ];

    return () => {
      timers.forEach(clearTimeout);
      document.body.style.overflow = "";
    };
  }, [onComplete]);

  const isExiting = phase === "exit";

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden bg-background"
      style={{
        transform: isExiting ? "translateY(-100%)" : "translateY(0)",
        transition: isExiting ? "transform 0.9s cubic-bezier(0.76, 0, 0.24, 1)" : "none",
      }}
    >
      {/* Full-screen intro image — fades and scales in */}
      <img
        src={introImg}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        style={{
          opacity: phase === "enter" ? 0 : 1,
          transform: phase === "enter" ? "scale(1.06)" : "scale(1)",
          transition: "opacity 1.1s ease, transform 1.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />

      {/* Letters sweep up over the image */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{
          opacity: phase === "hold" ? 0 : 1,
          transition: "opacity 0.5s ease",
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

      {/* Tagline — appears during hold phase */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 text-center">
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
            transition: "width 0.8s ease 0.5s",
          }}
        />
      </div>
    </div>
  );
}

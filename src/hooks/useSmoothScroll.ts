import { useEffect } from "react";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

let lenis: Lenis | null = null;

export function useSmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });

    // Keep GSAP ScrollTrigger in sync
    lenis.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis!.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis?.destroy();
      lenis = null;
      gsap.ticker.remove((time) => lenis?.raf(time * 1000));
    };
  }, []);
}

// Expose lenis instance for programmatic scrollTo calls elsewhere
export function getLenis() {
  return lenis;
}

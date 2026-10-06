import Lenis from "lenis";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function createLenis(
  wrapper: HTMLElement,
  content?: HTMLElement,
): { lenis: Lenis; destroy: () => void } | null {
  if (typeof window === "undefined") return null;

  const reducedMotion = prefersReducedMotion();

  const lenis = new Lenis({
    wrapper,
    content: content ?? wrapper,
    duration: reducedMotion ? 0 : 0.8,
    smoothWheel: !reducedMotion,
    prevent: (node) => {
      if (node instanceof HTMLElement && node.closest("[data-lenis-prevent]")) {
        return true;
      }
      return false;
    },
  });

  let rafId: number;
  const raf = (time: number) => {
    lenis.raf(time);
    rafId = requestAnimationFrame(raf);
  };
  rafId = requestAnimationFrame(raf);

  const destroy = () => {
    cancelAnimationFrame(rafId);
    lenis.destroy();
  };

  return { lenis, destroy };
}

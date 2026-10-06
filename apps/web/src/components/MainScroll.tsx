import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type Lenis from "lenis";
import { createLenis } from "@/lib/lenis";

interface ScrollContextValue {
  scrollElement: HTMLElement | null;
  lenis: Lenis | null;
}

const ScrollContext = createContext<ScrollContextValue>({
  scrollElement: null,
  lenis: null,
});

export function useMainScroll() {
  return useContext(ScrollContext);
}

export function MainScroll({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const [lenisInstance, setLenisInstance] = useState<Lenis | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    setScrollElement(wrapper);

    const instance = createLenis(wrapper, contentRef.current ?? undefined);
    if (instance) {
      setLenisInstance(instance.lenis);
    }

    return () => {
      instance?.destroy();
      setLenisInstance(null);
    };
  }, []);

  return (
    <ScrollContext.Provider value={{ scrollElement, lenis: lenisInstance }}>
      <div
        ref={wrapperRef}
        data-slot="main-scroll-wrapper"
        // No flex-1: as a flex-col child it overrides the fixed height, the wrapper grows to
        // content, and Lenis swallows wheel events on a box with nothing to scroll.
        className="h-[calc(100dvh-3.5rem)] overflow-y-auto overflow-x-hidden"
      >
        <div ref={contentRef} data-slot="main-scroll-content" className="min-h-full">
          {children}
        </div>
      </div>
    </ScrollContext.Provider>
  );
}

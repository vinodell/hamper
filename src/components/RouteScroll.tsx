import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/** Keep native section links working after a client-side or lazy route change. */
export function RouteScroll() {
  const { hash, key, pathname } = useLocation();
  const previousPath = useRef(pathname);

  useEffect(() => {
    const changedPage = previousPath.current !== pathname;
    previousPath.current = pathname;
    if (!hash) {
      if (changedPage) window.scrollTo({ top: 0, behavior: "instant" });
      return;
    }

    let targetId: string;
    try {
      targetId = decodeURIComponent(hash.slice(1));
    } catch {
      return;
    }

    // The shared Suspense boundary commits this effect with the lazy page DOM.
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      target?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, key, pathname]);

  return null;
}

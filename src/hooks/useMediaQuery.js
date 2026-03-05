import { useEffect, useState } from "react";

export function useMediaQuery(query) {
  const getMatches = () => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQueryList = window.matchMedia(query);
    const handler = () => setMatches(mediaQueryList.matches);

    handler();

    // Safari antigo usa addListener/removeListener
    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener("change", handler);
      return () => mediaQueryList.removeEventListener("change", handler);
    } else {
      mediaQueryList.addListener(handler);
      return () => mediaQueryList.removeListener(handler);
    }
  }, [query]);

  return matches;
}

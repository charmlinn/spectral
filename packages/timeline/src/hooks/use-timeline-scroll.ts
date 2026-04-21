import { useEffect } from "react";

export function useTimelineScroll(
  ref: React.RefObject<HTMLElement | null>,
  onScrollChange?: (scrollLeft: number) => void,
) {
  useEffect(() => {
    const element = ref.current;

    if (!element || !onScrollChange) {
      return;
    }

    const handleScroll = () => {
      onScrollChange(element.scrollLeft);
    };

    element.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      element.removeEventListener("scroll", handleScroll);
    };
  }, [onScrollChange, ref]);
}

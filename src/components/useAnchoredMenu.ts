import { useCallback, useEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Positions a dropdown menu against its trigger on screen (position: fixed), so it can be
 * rendered in a portal and never be clipped by a scrolling table or an overflow-hidden card.
 * Call `anchor()` in the click handler that opens the menu: it measures the trigger then.
 * Hangs from the trigger's left edge, or its right edge when the menu would run off screen.
 * Closes on scroll or resize, since the trigger moves and the menu would be left behind.
 */
export function useAnchoredMenu(
  open: boolean,
  triggerRef: RefObject<HTMLElement | null>,
  menuWidth: number,
  onClose: () => void,
): { menuStyle: CSSProperties; anchor: () => void } {
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});

  const anchor = useCallback(() => {
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    const gap = 6;
    const fitsRight = r.left + menuWidth <= window.innerWidth - 8;
    setMenuStyle({
      position: "fixed",
      top: r.bottom + gap,
      left: fitsRight ? r.left : Math.max(8, r.right - menuWidth),
      width: menuWidth,
    });
  }, [triggerRef, menuWidth]);

  useEffect(() => {
    if (!open) return;
    const close = () => onClose();
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open, onClose]);

  return { menuStyle, anchor };
}

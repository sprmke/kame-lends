export function scrollFieldIntoView(
  id: string,
  options?: { block?: ScrollLogicalPosition; focus?: boolean },
): boolean {
  if (typeof document === "undefined") return false;
  const el = document.getElementById(id);
  if (!el) return false;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({
    behavior: reduce ? "auto" : "smooth",
    block: options?.block ?? "center",
  });
  if (options?.focus) {
    const focusable = el.matches("input, button, select, textarea")
      ? (el as HTMLElement)
      : el.querySelector<HTMLElement>(
          'button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
        );
    focusable?.focus({ preventScroll: true });
  }
  return true;
}

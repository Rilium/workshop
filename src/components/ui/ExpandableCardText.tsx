import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

export function ExpandableCardText({
  text,
  lines = 2,
  className = "",
}: {
  text: string;
  lines?: number;
  className?: string;
}) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const expandedRef = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  expandedRef.current = expanded;

  useLayoutEffect(() => {
    setExpanded(false);
    setCanExpand(false);
    const textElement = textRef.current;
    if (!textElement) return;
    let cancelled = false;
    let frame = 0;

    const measure = () => {
      const element = textRef.current;
      if (!element || cancelled) return;

      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight);
      const collapsedHeight = Number.isFinite(lineHeight) ? lineHeight * lines : element.clientHeight;
      const overflows = element.scrollHeight > collapsedHeight + 2;

      setCanExpand(overflows);
      if (!overflows && expandedRef.current) {
        expandedRef.current = false;
        setExpanded(false);
      }
    };

    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(textElement);
    document.fonts?.ready.then(scheduleMeasure);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [lines, text]);

  return (
    <div className={`expandable-card-text ${expanded ? "expanded" : ""} ${className}`.trim()}>
      <p ref={textRef} style={{ "--card-copy-lines": lines } as CSSProperties}>{text}</p>
      {canExpand && (
        <button
          type="button"
          className="expandable-card-text-toggle"
          aria-expanded={expanded}
          aria-label={expanded ? "Mostra meno testo" : "Mostra tutto il testo"}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "meno" : "..."}
        </button>
      )}
    </div>
  );
}

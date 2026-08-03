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

    const measure = () => {
      if (!expandedRef.current && textRef.current) {
        const overflows = textRef.current.scrollHeight > textRef.current.clientHeight + 1;
        setCanExpand((current) => current || overflows);
      }
    };
    const frame = window.requestAnimationFrame(measure);
    const settledMeasure = window.setTimeout(measure, 250);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settledMeasure);
      window.removeEventListener("resize", measure);
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

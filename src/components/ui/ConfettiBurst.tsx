import React, { useEffect, useMemo, useState } from "react";

type ConfettiPiece = {
  id: string;
  left: string;
  delay: string;
  duration: string;
  size: string;
  rotate: string;
  hue: string;
  shape: "rect" | "circle";
};

function buildPieces(count: number): ConfettiPiece[] {
  const palette = ["#1cafb9", "#f0a314", "#ef6f9b", "#4c9aff", "#7f8cff", "#23a26b"];
  return Array.from({ length: count }, (_, index) => {
    const size = 8 + Math.floor(Math.random() * 10);
    return {
      id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 0.7}s`,
      duration: `${1.8 + Math.random() * 1.6}s`,
      size: `${size}px`,
      rotate: `${Math.floor(Math.random() * 360)}deg`,
      hue: palette[index % palette.length],
      shape: index % 5 === 0 ? "circle" : "rect",
    };
  });
}

export function ConfettiBurst({ active, pieces = 42, onDone }: { active: boolean; pieces?: number; onDone?: () => void }) {
  const [visible, setVisible] = useState(active);
  const confettiPieces = useMemo(() => (active ? buildPieces(pieces) : []), [active, pieces]);

  useEffect(() => {
    if (!active) return;
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 2600);
    return () => window.clearTimeout(timer);
  }, [active, onDone]);

  if (!visible) return null;

  return (
    <div className="confetti-burst" aria-hidden="true">
      {confettiPieces.map((piece) => (
        <span
          key={piece.id}
          className={`confetti-piece confetti-piece--${piece.shape}`}
          style={
            {
              left: piece.left,
              "--confetti-duration": piece.duration,
              "--confetti-delay": piece.delay,
              "--confetti-size": piece.size,
              "--confetti-rotate": piece.rotate,
              "--confetti-color": piece.hue,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

import React from "react";
import type { Toast } from "../../types/domain";

export function FeedbackToastStack({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  const visibleToasts = toasts.slice(-2);
  const hiddenCount = Math.max(0, toasts.length - visibleToasts.length);
  return (
    <div className="feedback-toast-stack" aria-live="polite">
      {hiddenCount > 0 && (
        <div
          className="feedback-toast-overflow"
          style={{
            "--toast-y": `${visibleToasts.length * -10}px`,
            "--toast-x": `${visibleToasts.length * -8}px`,
            "--toast-z": 1,
          } as React.CSSProperties}
          aria-label={`${hiddenCount} notifiche precedenti`}
        >
          <span>...</span>
          <strong>+{hiddenCount}</strong>
        </div>
      )}
      {visibleToasts.map((toast, index) => {
        const stackIndex = visibleToasts.length - index - 1;
        return (
          <FeedbackToast
            key={toast.id}
            toast={toast}
            style={{
              "--toast-y": `${stackIndex * -10}px`,
              "--toast-x": `${stackIndex * -8}px`,
              "--toast-scale": String(1 - stackIndex * 0.035),
              "--toast-z": 10 - stackIndex,
            } as React.CSSProperties}
            onClose={() => onClose(toast.id)}
          />
        );
      })}
    </div>
  );
}

export function FeedbackToast({ toast, style, onClose }: { toast: Toast; style?: React.CSSProperties; onClose: () => void }) {
  return (
    <aside className="feedback-toast" style={style}>
      <div>
        <strong>{toast.title}</strong>
        <button onClick={onClose} aria-label="Chiudi notifica">
          x
        </button>
      </div>
      <span>{toast.body}</span>
    </aside>
  );
}

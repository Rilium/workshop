import { useEffect, useState } from "react";
import type { Toast } from "../types/domain";

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = (title: string, body: string) => {
    const id = Date.now() + Math.round(Math.random() * 1000);
    setToasts((current) => [...current.slice(-3), { id, title, body }]);
  };

  const closeToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    if (toasts.length === 0) return;
    const timeout = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 4200);
    return () => window.clearTimeout(timeout);
  }, [toasts]);

  return { toasts, notify, closeToast };
}

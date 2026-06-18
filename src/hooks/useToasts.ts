import { useEffect, useRef, useState } from "react";
import type { AppNotification, AppNotificationRole, NotifyOptions, Role, Toast } from "../types/domain";

const NOTIFICATION_STORAGE_KEY = "funnifin_notifications_v1";
const TOAST_DURATION_MS = 4200;
const NON_CLIENT_ROLES: AppNotificationRole[] = ["FunniFin", "Esperto", "Brand"];

function isNotificationRole(role: Role | null | undefined): role is AppNotificationRole {
  return role === "FunniFin" || role === "Esperto" || role === "Brand";
}

function readStoredNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AppNotification[]) : [];
  } catch {
    return [];
  }
}

function writeStoredNotifications(notifications: AppNotification[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications.slice(0, 120)));
  } catch {
    // localStorage pieno o non disponibile — ignora silenziosamente
  }
}

function compactAudience(audience: AppNotificationRole[] | undefined): AppNotificationRole[] {
  // Solo le notify() con audience esplicito finiscono nel centro notifiche.
  // Quelle senza audience sono toast fuggevoli e non inquinano la lista.
  if (!audience?.length) return [];
  return Array.from(new Set(audience.filter((r) => NON_CLIENT_ROLES.includes(r))));
}

export function useToasts(role: Role) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(readStoredNotifications);

  // ── Per-toast timers: un timeout dedicato per ID, nessuna race condition ──
  const toastTimers = useRef<Map<number, number>>(new Map());

  // ── Debounce localStorage: scrivi solo dopo 400ms di quiete ──
  const lsTimer = useRef<number | null>(null);
  const pendingNotifications = useRef<AppNotification[]>(notifications);

  const scheduleLsWrite = (next: AppNotification[]) => {
    pendingNotifications.current = next;
    if (lsTimer.current) clearTimeout(lsTimer.current);
    lsTimer.current = window.setTimeout(() => {
      writeStoredNotifications(pendingNotifications.current);
    }, 400);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      toastTimers.current.forEach((t) => clearTimeout(t));
      if (lsTimer.current) clearTimeout(lsTimer.current);
    };
  }, []);

  // ── Sync localStorage quando notifications cambia ──
  useEffect(() => {
    scheduleLsWrite(notifications);
  }, [notifications]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissToast = (id: number) => {
    const existing = toastTimers.current.get(id);
    if (existing) {
      clearTimeout(existing);
      toastTimers.current.delete(id);
    }
    setToasts((current) => current.filter((t) => t.id !== id));
  };

  const scheduleToastDismiss = (id: number) => {
    if (toastTimers.current.has(id)) return; // già schedulato
    const timer = window.setTimeout(() => {
      toastTimers.current.delete(id);
      setToasts((current) => current.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS) as unknown as number;
    toastTimers.current.set(id, timer);
  };

  const notify = (title: string, body: string, options: NotifyOptions = {}) => {
    const id = Date.now() + Math.round(Math.random() * 1000);

    // Aggiungi toast e schedula il suo dismiss individuale
    setToasts((current) => {
      const next = [...current.slice(-3), { id, title, body }];
      return next;
    });
    scheduleToastDismiss(id);

    // Persisti nel centro notifiche solo se c'è audience esplicito
    const audience = compactAudience(options.audience);
    if (options.persist === false || audience.length === 0) return;

    const now = new Date().toISOString();
    const notification: AppNotification = {
      id: `n-${id}`,
      toastId: id,
      title,
      body,
      createdAt: now,
      updatedAt: now,
      sourceRole: role,
      audience,
      priority: options.priority ?? "info",
      category: options.category ?? "feedback",
      status: "open",
      readBy: [],
      action: options.action,
    };

    setNotifications((current) => [notification, ...current].slice(0, 120));
  };

  const closeToast = (id: number) => dismissToast(id);

  const closeNotification = (id: string) => {
    setNotifications((current) =>
      current.map((n) =>
        n.id === id ? { ...n, status: "closed", updatedAt: new Date().toISOString() } : n,
      ),
    );
  };

  const reopenNotification = (id: string) => {
    setNotifications((current) =>
      current.map((n) =>
        n.id === id ? { ...n, status: "open", updatedAt: new Date().toISOString() } : n,
      ),
    );
  };

  const markNotificationRead = (id: string, readerRole: AppNotificationRole) => {
    setNotifications((current) =>
      current.map((n) =>
        n.id === id && !n.readBy.includes(readerRole)
          ? { ...n, readBy: [...n.readBy, readerRole], updatedAt: new Date().toISOString() }
          : n,
      ),
    );
  };

  // Segna tutte le notifiche visibili per il ruolo come lette — un solo setState
  const markVisibleNotificationsRead = (readerRole: AppNotificationRole) => {
    setNotifications((current) => {
      const now = new Date().toISOString();
      let changed = false;
      const next = current.map((n) => {
        if (n.audience.includes(readerRole) && !n.readBy.includes(readerRole)) {
          changed = true;
          return { ...n, readBy: [...n.readBy, readerRole], updatedAt: now };
        }
        return n;
      });
      return changed ? next : current; // evita re-render se nulla è cambiato
    });
  };

  // Segna tutte le aperte per il ruolo come lette — un solo setState
  const markAllNotificationsRead = (readerRole: AppNotificationRole) => {
    setNotifications((current) => {
      const now = new Date().toISOString();
      let changed = false;
      const next = current.map((n) => {
        if (n.status === "open" && n.audience.includes(readerRole) && !n.readBy.includes(readerRole)) {
          changed = true;
          return { ...n, readBy: [...n.readBy, readerRole], updatedAt: now };
        }
        return n;
      });
      return changed ? next : current;
    });
  };

  const clearClosedNotifications = (readerRole: AppNotificationRole) => {
    setNotifications((current) =>
      current.filter((n) => !(n.status === "closed" && n.audience.includes(readerRole))),
    );
  };

  return {
    toasts,
    notifications,
    notify,
    closeToast,
    closeNotification,
    reopenNotification,
    markNotificationRead,
    markVisibleNotificationsRead,
    markAllNotificationsRead,
    clearClosedNotifications,
  };
}

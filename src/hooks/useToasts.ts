import { useEffect, useState } from "react";
import type { AppNotification, AppNotificationRole, NotifyOptions, Role, Toast } from "../types/domain";

const NOTIFICATION_STORAGE_KEY = "funnifin_notifications_v1";
const NON_CLIENT_ROLES: AppNotificationRole[] = ["FunniFin", "Esperto", "Brand"];

function isNotificationRole(role: Role | null | undefined): role is AppNotificationRole {
  return role === "FunniFin" || role === "Esperto" || role === "Brand";
}

function readStoredNotifications() {
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
  window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications.slice(0, 120)));
}

function compactAudience(audience: AppNotificationRole[] | undefined) {
  // Solo le notify() con audience esplicito finiscono nel centro notifiche.
  // Quelle senza audience sono toast fuggevoli e non inquinano la lista.
  const next = audience?.length ? audience : [];
  return Array.from(new Set(next.filter((role): role is AppNotificationRole => NON_CLIENT_ROLES.includes(role as AppNotificationRole))));
}

export function useToasts(role: Role) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => readStoredNotifications());

  const notify = (title: string, body: string, options: NotifyOptions = {}) => {
    const id = Date.now() + Math.round(Math.random() * 1000);
    setToasts((current) => [...current.slice(-3), { id, title, body }]);

    const audience = compactAudience(options.audience);
    if (options.persist === false || audience.length === 0) return;

    const now = new Date().toISOString();
    const notification: AppNotification = {
      id: `notification-${id}`,
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

  const closeToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const closeNotification = (id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, status: "closed", updatedAt: new Date().toISOString() }
          : notification,
      ),
    );
  };

  const reopenNotification = (id: string) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? { ...notification, status: "open", updatedAt: new Date().toISOString() }
          : notification,
      ),
    );
  };

  const markNotificationRead = (id: string, readerRole: AppNotificationRole) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id
          ? {
              ...notification,
              readBy: notification.readBy.includes(readerRole) ? notification.readBy : [...notification.readBy, readerRole],
              updatedAt: new Date().toISOString(),
            }
          : notification,
      ),
    );
  };

  const markVisibleNotificationsRead = (readerRole: AppNotificationRole) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.audience.includes(readerRole)
          ? {
              ...notification,
              readBy: notification.readBy.includes(readerRole) ? notification.readBy : [...notification.readBy, readerRole],
              updatedAt: new Date().toISOString(),
            }
          : notification,
      ),
    );
  };

  const clearClosedNotifications = (readerRole: AppNotificationRole) => {
    setNotifications((current) =>
      current.filter((notification) => !(notification.status === "closed" && notification.audience.includes(readerRole))),
    );
  };

  useEffect(() => {
    if (toasts.length === 0) return;
    const timeout = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 4200);
    return () => window.clearTimeout(timeout);
  }, [toasts]);

  useEffect(() => {
    writeStoredNotifications(notifications);
  }, [notifications]);

  return {
    toasts,
    notifications,
    notify,
    closeToast,
    closeNotification,
    reopenNotification,
    markNotificationRead,
    markVisibleNotificationsRead,
    clearClosedNotifications,
  };
}

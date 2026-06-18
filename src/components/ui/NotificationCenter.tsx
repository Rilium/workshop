import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ClipboardCheck,
  History,
  Mail,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import type { AppNotification, AppNotificationRole, NotificationCategory, NotificationPriority, Role } from "../../types/domain";

type NotificationTab = "task" | "recent" | "important" | "closed";
type NotificationFilter = "all" | NotificationPriority | NotificationCategory;

const tabs: Array<{ id: NotificationTab; label: string; emptyTitle: string; emptyBody: string }> = [
  { id: "task", label: "Da fare", emptyTitle: "Tutto fatto", emptyBody: "Nessuna azione in attesa." },
  { id: "recent", label: "Recenti", emptyTitle: "Nessuna notifica", emptyBody: "Le nuove notifiche appariranno qui." },
  { id: "important", label: "Critiche", emptyTitle: "Nessuna critica", emptyBody: "Nessun alert urgente al momento." },
  { id: "closed", label: "Chiuse", emptyTitle: "Nessuna chiusa", emptyBody: "Le notifiche archiviate appariranno qui." },
];

const filterGroups: Array<{ id: NotificationFilter; label: string }> = [
  { id: "all", label: "Tutte" },
  { id: "critical", label: "🔴 Critiche" },
  { id: "task", label: "✅ Task" },
  { id: "mail", label: "✉️ Mail" },
  { id: "system", label: "⚙️ Sistema" },
];

function isNotificationRole(role: Role): role is AppNotificationRole {
  return role === "FunniFin" || role === "Esperto" || role === "Brand";
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Adesso";
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Ieri";
  if (days < 7) return `${days}g fa`;
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(date);
}

function formatAbsoluteTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function notificationIcon(notification: AppNotification) {
  if (notification.priority === "critical") return <AlertTriangle size={16} />;
  if (notification.category === "mail") return <Mail size={16} />;
  if (notification.category === "task") return <ClipboardCheck size={16} />;
  return <History size={16} />;
}

function notificationMatchesTab(notification: AppNotification, tab: NotificationTab) {
  if (tab === "closed") return notification.status === "closed";
  if (notification.status === "closed") return false;
  if (tab === "important") return notification.priority === "critical";
  if (tab === "task") return notification.priority === "task" || notification.category === "task" || notification.category === "mail";
  return true;
}

function notificationMatchesFilter(notification: AppNotification, filter: NotificationFilter) {
  if (filter === "all") return true;
  return notification.priority === filter || notification.category === filter;
}

function unreadForRole(notification: AppNotification, role: AppNotificationRole) {
  return notification.status === "open" && !notification.readBy.includes(role);
}

export function NotificationCenter({
  role,
  notifications,
  onCloseNotification,
  onReopenNotification,
  onMarkRead,
  onMarkVisibleRead,
  onAction,
  onClearClosed,
}: {
  role: Role;
  notifications: AppNotification[];
  onCloseNotification: (id: string) => void;
  onReopenNotification: (id: string) => void;
  onMarkRead: (id: string, role: AppNotificationRole) => void;
  onMarkVisibleRead: (role: AppNotificationRole) => void;
  onAction: (notification: AppNotification) => void;
  onClearClosed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>("task");
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const notificationRole = isNotificationRole(role) ? role : null;

  const roleNotifications = useMemo(
    () => (notificationRole ? notifications.filter((n) => n.audience.includes(notificationRole)) : []),
    [notifications, notificationRole],
  );

  if (!notificationRole) return null;

  const unreadCount = roleNotifications.filter((n) => unreadForRole(n, notificationRole)).length;
  const openCount = roleNotifications.filter((n) => n.status === "open").length;
  const taskCount = roleNotifications.filter((n) => n.status === "open" && (n.priority === "task" || n.category === "task" || n.category === "mail")).length;
  const criticalCount = roleNotifications.filter((n) => n.status === "open" && n.priority === "critical").length;
  const closedCount = roleNotifications.filter((n) => n.status === "closed").length;

  const tabCount = (tab: NotificationTab) => {
    if (tab === "task") return taskCount;
    if (tab === "recent") return openCount;
    if (tab === "important") return criticalCount;
    if (tab === "closed") return closedCount;
    return 0;
  };

  const filteredNotifications = roleNotifications
    .filter((n) => notificationMatchesTab(n, activeTab))
    .filter((n) => notificationMatchesFilter(n, activeFilter))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const openPanel = () => {
    setOpen(true);
    onMarkVisibleRead(notificationRole);
  };

  const handleAction = (notification: AppNotification) => {
    onMarkRead(notification.id, notificationRole);
    onAction(notification);
    setOpen(false);
  };

  const handleMarkAllRead = () => {
    roleNotifications
      .filter((n) => unreadForRole(n, notificationRole))
      .forEach((n) => onMarkRead(n.id, notificationRole));
  };

  const activeTabMeta = tabs.find((t) => t.id === activeTab)!;
  const hasClosedItems = closedCount > 0;

  const panel = open ? (
    <div className="nc-shell" role="dialog" aria-modal="true" aria-labelledby="nc-title">
      <button className="nc-scrim" type="button" onClick={() => setOpen(false)} aria-label="Chiudi notifiche" />
      <aside className="nc-panel">

        {/* ── Header ── */}
        <header className="nc-head">
          <div className="nc-head-top">
            <div className="nc-head-left">
              <div className="nc-head-icon">
                <Bell size={16} />
              </div>
              <div>
                <p className="nc-head-eyebrow">Centro notifiche</p>
                <h2 className="nc-head-title" id="nc-title">
                  {openCount > 0 ? `${openCount} attive` : "Aggiornamenti"}
                </h2>
              </div>
            </div>
            <div className="nc-head-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="nc-action-btn"
                  onClick={handleMarkAllRead}
                  title="Segna tutte come lette"
                >
                  <CheckCheck size={15} />
                  <span>Lette</span>
                </button>
              )}
              <button
                type="button"
                className="nc-close-btn"
                onClick={() => setOpen(false)}
                aria-label="Chiudi"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Stats pills */}
          <div className="nc-stats">
            <span className={`nc-stat ${criticalCount > 0 ? "nc-stat--critical" : ""}`}>
              <AlertTriangle size={12} />
              {criticalCount} {criticalCount === 1 ? "critica" : "critiche"}
            </span>
            <span className="nc-stat">
              <ClipboardCheck size={12} />
              {taskCount} task
            </span>
            <span className="nc-stat nc-stat--muted">
              {roleNotifications.length} totali
            </span>
          </div>
        </header>

        {/* ── Tabs ── */}
        <div className="nc-tabs" role="tablist" aria-label="Sezioni notifiche">
          {tabs.map((tab) => {
            const count = tabCount(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={`nc-tab ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`nc-tab-badge ${tab.id === "important" ? "urgent" : ""}`}>
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Filters (only when list is non-empty) ── */}
        {filteredNotifications.length > 0 && (
          <div className="nc-filters" aria-label="Filtri">
            {filterGroups.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`nc-filter-chip ${activeFilter === f.id ? "active" : ""}`}
                onClick={() => setActiveFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* ── List ── */}
        <div className="nc-list" role="tabpanel">
          {filteredNotifications.length === 0 ? (
            <div className="nc-empty">
              <div className="nc-empty-icon">
                {activeTab === "task" ? <CheckCheck size={24} /> : <Bell size={24} />}
              </div>
              <strong>{activeTabMeta.emptyTitle}</strong>
              <span>{activeTabMeta.emptyBody}</span>
            </div>
          ) : (
            filteredNotifications.map((notification) => {
              const isUnread = unreadForRole(notification, notificationRole);
              const isHovered = hoveredId === notification.id;
              return (
                <article
                  key={notification.id}
                  className={[
                    "nc-item",
                    `priority-${notification.priority}`,
                    `cat-${notification.category}`,
                    isUnread ? "unread" : "",
                    notification.status === "closed" ? "closed" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onMouseEnter={() => setHoveredId(notification.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="nc-item-accent" />

                  <div className="nc-item-body">
                    <div className="nc-item-row1">
                      <span className="nc-item-icon">{notificationIcon(notification)}</span>
                      <strong className="nc-item-title">{notification.title}</strong>
                      <time
                        className="nc-item-time"
                        dateTime={notification.createdAt}
                        title={formatAbsoluteTime(notification.createdAt)}
                      >
                        {formatRelativeTime(notification.createdAt)}
                      </time>
                      {isUnread && <span className="nc-unread-dot" aria-label="Non letta" />}
                    </div>

                    <p className="nc-item-body-text">{notification.body}</p>

                    <div className="nc-item-tags">
                      <span className={`nc-tag nc-tag--cat-${notification.category}`}>
                        {notification.category}
                      </span>
                      {notification.priority !== "info" && (
                        <span className={`nc-tag nc-tag--priority-${notification.priority}`}>
                          {notification.priority}
                        </span>
                      )}
                      {notification.sourceRole && (
                        <span className="nc-tag nc-tag--source">da {notification.sourceRole}</span>
                      )}
                    </div>

                    <div className={`nc-item-actions ${isHovered ? "visible" : ""}`}>
                      {notification.action && (
                        <button
                          type="button"
                          className="nc-btn-primary"
                          onClick={() => handleAction(notification)}
                        >
                          {notification.action.label}
                          <ArrowRight size={14} />
                        </button>
                      )}
                      {notification.status === "open" ? (
                        <button
                          type="button"
                          className="nc-btn-ghost"
                          onClick={() => onCloseNotification(notification.id)}
                        >
                          <Check size={14} />
                          Archivia
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="nc-btn-ghost"
                          onClick={() => onReopenNotification(notification.id)}
                        >
                          <RotateCcw size={14} />
                          Riapri
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        {activeTab === "closed" && hasClosedItems && onClearClosed && (
          <footer className="nc-footer">
            <button type="button" className="nc-btn-danger" onClick={onClearClosed}>
              <Trash2 size={14} />
              Svuota archivio
            </button>
          </footer>
        )}
      </aside>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className={[
          "nc-bell",
          open ? "active" : "",
          criticalCount > 0 ? "urgent" : "",
          unreadCount > 0 ? "has-unread" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={openPanel}
        aria-label={unreadCount > 0 ? `${unreadCount} notifiche non lette` : "Apri notifiche"}
        aria-expanded={open}
        title="Notifiche"
      >
        {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {openCount > 0 && (
          <span className="nc-bell-badge">{openCount > 9 ? "9+" : openCount}</span>
        )}
        {criticalCount > 0 && <span className="nc-bell-pulse" />}
      </button>

      {panel && typeof document !== "undefined" && createPortal(panel, document.body)}
    </>
  );
}

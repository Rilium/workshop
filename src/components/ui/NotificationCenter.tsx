import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Bell,
  BellRing,
  CheckCheck,
  ClipboardCheck,
  History,
  Mail,
  RotateCcw,
  Trash2,
  X,
} from "../../components/ui/FaIcons";
import type { AppNotification, AppNotificationRole, NotificationCategory, NotificationPriority, Role } from "../../types/domain";

type NotificationTab = "task" | "recent" | "important" | "closed";
type NotificationFilter = "all" | NotificationPriority | NotificationCategory;

const tabs: Array<{ id: NotificationTab; label: string; emptyTitle: string; emptyBody: string }> = [
  { id: "task",      label: "Da fare",  emptyTitle: "Tutto fatto",       emptyBody: "Nessuna azione in attesa." },
  { id: "recent",    label: "Recenti",  emptyTitle: "Nessuna notifica",  emptyBody: "Le nuove notifiche appariranno qui." },
  { id: "important", label: "Critiche", emptyTitle: "Nessuna critica",   emptyBody: "Nessun alert urgente al momento." },
  { id: "closed",    label: "Chiuse",   emptyTitle: "Nessuna chiusa",    emptyBody: "Le notifiche archiviate appariranno qui." },
];

const filterGroups: Array<{ id: NotificationFilter; label: string }> = [
  { id: "all",      label: "Tutte" },
  { id: "critical", label: "🔴 Critiche" },
  { id: "task",     label: "✅ Task" },
  { id: "mail",     label: "✉️ Mail" },
  { id: "system",   label: "⚙️ Sistema" },
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
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function notificationIcon(n: AppNotification) {
  if (n.priority === "critical") return <AlertTriangle size={15} />;
  if (n.category === "mail")     return <Mail size={15} />;
  if (n.category === "task")     return <ClipboardCheck size={15} />;
  return <History size={15} />;
}

function matchesTab(n: AppNotification, tab: NotificationTab): boolean {
  if (tab === "closed")    return n.status === "closed";
  if (n.status === "closed") return false;
  if (tab === "important") return n.priority === "critical";
  if (tab === "task")      return n.priority === "task" || n.category === "task" || n.category === "mail";
  return true;
}

function matchesFilter(n: AppNotification, filter: NotificationFilter): boolean {
  if (filter === "all") return true;
  return n.priority === filter || n.category === filter;
}

function isUnread(n: AppNotification, role: AppNotificationRole): boolean {
  return n.status === "open" && !n.readBy.includes(role);
}

function isUnreadForViewer(n: AppNotification, role: AppNotificationRole, userId?: string): boolean {
  if (userId) return n.status === "open" && !(n.readByUserIds ?? []).includes(userId);
  return isUnread(n, role);
}

function isVisibleForViewer(n: AppNotification, role: AppNotificationRole | null, userId?: string, email?: string): boolean {
  if (!role || !n.audience.includes(role)) return false;
  const normalizedEmail = email?.toLowerCase();
  const matchesUser = !n.audienceUserIds?.length || (userId ? n.audienceUserIds.includes(userId) : false);
  const matchesEmail = !n.audienceEmails?.length || (normalizedEmail ? n.audienceEmails.includes(normalizedEmail) : false);
  return matchesUser && matchesEmail;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationCenter({
  role,
  currentUserId,
  currentUserEmail,
  notifications,
  onCloseNotification,
  onReopenNotification,
  onDeleteNotification,
  onMarkRead,
  onMarkVisibleRead,
  onMarkAllRead,
  onAction,
  onClearClosed,
}: {
  role: Role;
  currentUserId?: string;
  currentUserEmail?: string;
  notifications: AppNotification[];
  onCloseNotification: (id: string) => void;
  onReopenNotification: (id: string) => void;
  onDeleteNotification: (id: string, role: AppNotificationRole, userId?: string, email?: string) => void;
  onMarkRead: (id: string, role: AppNotificationRole, userId?: string) => void;
  onMarkVisibleRead: (role: AppNotificationRole, userId?: string, email?: string) => void;
  onMarkAllRead: (role: AppNotificationRole, userId?: string, email?: string) => void;
  onAction: (notification: AppNotification) => void;
  onClearClosed?: () => void;
}) {
  const [open, setOpen]             = useState(false);
  const [activeTab, setActiveTab]   = useState<NotificationTab>("task");
  const [activeFilter, setFilter]   = useState<NotificationFilter>("all");

  const notificationRole = isNotificationRole(role) ? role : null;

  // ── Derivazioni memoizzate ──
  const roleNotifications = useMemo(
    () => notifications.filter((n) => isVisibleForViewer(n, notificationRole, currentUserId, currentUserEmail)),
    [notifications, notificationRole, currentUserId, currentUserEmail],
  );

  const counts = useMemo(() => ({
    unread:   roleNotifications.filter((n) => notificationRole && isUnreadForViewer(n, notificationRole, currentUserId)).length,
    open:     roleNotifications.filter((n) => n.status === "open").length,
    task:     roleNotifications.filter((n) => n.status === "open" && (n.priority === "task" || n.category === "task" || n.category === "mail")).length,
    critical: roleNotifications.filter((n) => n.status === "open" && n.priority === "critical").length,
    closed:   roleNotifications.filter((n) => n.status === "closed").length,
  }), [roleNotifications, notificationRole, currentUserId]);

  const filteredNotifications = useMemo(
    () =>
      roleNotifications
        .filter((n) => matchesTab(n, activeTab))
        .filter((n) => matchesFilter(n, activeFilter))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [roleNotifications, activeTab, activeFilter],
  );

  const tabCount = (tab: NotificationTab) => {
    if (tab === "task")      return counts.task;
    if (tab === "recent")    return counts.open;
    if (tab === "important") return counts.critical;
    if (tab === "closed")    return counts.closed;
    return 0;
  };

  if (!notificationRole) return null;

  // ── Handlers ──
  const openPanel = () => {
    setOpen(true);
    onMarkVisibleRead(notificationRole, currentUserId, currentUserEmail);
  };

  const closePanel = () => setOpen(false);

  const handleAction = (n: AppNotification) => {
    onMarkRead(n.id, notificationRole, currentUserId);
    onAction(n);
    closePanel();
  };

  const activeTabMeta = tabs.find((t) => t.id === activeTab)!;

  // ── Panel ──
  const panel = open ? (
    <div className="nc-shell" role="dialog" aria-modal="true" aria-labelledby="nc-title">
      <button className="nc-scrim" type="button" onClick={closePanel} aria-label="Chiudi notifiche" />
      <aside className="nc-panel">

        {/* Header */}
        <header className="nc-head">
          <div className="nc-head-top">
            <div className="nc-head-left">
              <div className="nc-head-icon"><Bell size={16} /></div>
              <div>
                <p className="nc-head-eyebrow">Centro notifiche</p>
                <h2 className="nc-head-title" id="nc-title">
                  {counts.open > 0 ? `${counts.open} attive` : "Aggiornamenti"}
                </h2>
              </div>
            </div>
            <div className="nc-head-actions">
              {counts.unread > 0 && (
                <button
                  type="button"
                  className="nc-action-btn"
                  onClick={() => onMarkAllRead(notificationRole)}
                  title="Segna tutte come lette"
                >
                  <CheckCheck size={15} />
                  <span>Lette</span>
                </button>
              )}
              <button type="button" className="nc-close-btn" onClick={closePanel} aria-label="Chiudi">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="nc-stats">
            <span className={`nc-stat ${counts.critical > 0 ? "nc-stat--critical" : ""}`}>
              <AlertTriangle size={12} />
              {counts.critical} {counts.critical === 1 ? "critica" : "critiche"}
            </span>
            <span className="nc-stat">
              <ClipboardCheck size={12} />
              {counts.task} task
            </span>
            <span className="nc-stat nc-stat--muted">
              {roleNotifications.length} totali
            </span>
          </div>
        </header>

        {/* Tabs */}
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

        {/* Filtri — solo se la lista ha elementi */}
        {filteredNotifications.length > 0 && (
          <div className="nc-filters" aria-label="Filtri">
            {filterGroups.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`nc-filter-chip ${activeFilter === f.id ? "active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* Lista */}
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
            filteredNotifications.map((n) => {
              const unread = isUnreadForViewer(n, notificationRole, currentUserId);
              return (
                <article
                  key={n.id}
                  className={[
                    "nc-item",
                    `priority-${n.priority}`,
                    `cat-${n.category}`,
                    unread ? "unread" : "",
                    n.status === "closed" ? "closed" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <div className="nc-item-body">
                    <div className="nc-item-row1">
                      <span className="nc-item-icon">{notificationIcon(n)}</span>
                      <strong className="nc-item-title">{n.title}</strong>
                      <time
                        className="nc-item-time"
                        dateTime={n.createdAt}
                        title={formatAbsoluteTime(n.createdAt)}
                      >
                        {formatRelativeTime(n.createdAt)}
                      </time>
                      {unread && <span className="nc-unread-dot" aria-label="Non letta" />}
                    </div>

                    <p className="nc-item-body-text">{n.body}</p>

                    <div className="nc-item-tags">
                      <span className={`nc-tag nc-tag--cat-${n.category}`}>{n.category}</span>
                      {n.priority !== "info" && (
                        <span className={`nc-tag nc-tag--priority-${n.priority}`}>{n.priority}</span>
                      )}
                      {n.sourceRole && (
                        <span className="nc-tag nc-tag--source">da {n.sourceRole}</span>
                      )}
                    </div>

                    <div className="nc-item-actions">
                      {n.action && (
                        <button type="button" className="nc-btn-primary" onClick={() => handleAction(n)}>
                          {n.action.label}
                          <ArrowRight size={14} />
                        </button>
                      )}
                      {n.status === "open" ? (
                        <button type="button" className="nc-btn-ghost" onClick={() => onCloseNotification(n.id)} title="Archivia notifica">
                          <Archive size={14} />
                          Archivia
                        </button>
                      ) : (
                        <>
                          <button type="button" className="nc-btn-ghost" onClick={() => onReopenNotification(n.id)} title="Riapri notifica">
                            <RotateCcw size={14} />
                            Riapri
                          </button>
                          <button
                            type="button"
                            className="nc-btn-danger"
                            onClick={() => onDeleteNotification(n.id, notificationRole, currentUserId, currentUserEmail)}
                            title="Elimina notifica archiviata"
                          >
                            <Trash2 size={14} />
                            Elimina
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>

        {/* Footer */}
        {activeTab === "closed" && counts.closed > 0 && onClearClosed && (
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
          open             ? "active"     : "",
          counts.critical > 0 ? "urgent" : "",
          counts.unread > 0   ? "has-unread" : "",
        ].filter(Boolean).join(" ")}
        onClick={openPanel}
        aria-label={counts.unread > 0 ? `${counts.unread} notifiche non lette` : "Apri notifiche"}
        aria-expanded={open}
        title="Notifiche"
      >
        {counts.unread > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {counts.open > 0 && (
          <span className="nc-bell-badge">{counts.open > 9 ? "9+" : counts.open}</span>
        )}
        {counts.critical > 0 && <span className="nc-bell-pulse" />}
      </button>

      {panel && typeof document !== "undefined" && createPortal(panel, document.body)}
    </>
  );
}

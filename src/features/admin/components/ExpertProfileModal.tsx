import { Trash2 } from "../../../components/ui/FaIcons";
import type { ExpertProfile } from "../../../types/domain";
import { AppButton } from "../../../components/ui/AppButton";
import { ActionIconButton } from "../../../components/ui/IconButton";

export function ExpertProfileModal({
  expert,
  topics,
  onClose,
  onDelete,
  onChange,
  onSave,
  saving = false,
  deleting = false,
}: {
  expert: ExpertProfile;
  topics: Array<{ id: string; title: string }>;
  onClose: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<ExpertProfile>) => void;
  onSave: () => void;
  saving?: boolean;
  deleting?: boolean;
}) {
  const fullName = `${expert.firstName} ${expert.lastName}`.trim();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="expert-profile-title">
      <section className="custom-modal expert-profile-modal">
        <header className="modal-header expert-profile-header">
          <div className="expert-modal-title">
            <div className="expert-avatar large">{expert.photo ? <img src={expert.photo} alt="" /> : `${expert.firstName[0] ?? ""}${expert.lastName[0] ?? ""}`}</div>
            <div>
              <span className="topic-badge">Pool esperti</span>
              <h2 id="expert-profile-title">Modifica profilo</h2>
              <em>{fullName || "Nuovo esperto"} · {expert.email}</em>
            </div>
          </div>
          <div className="row-actions compact-actions">
            <ActionIconButton variant="danger" onClick={onDelete} loading={deleting} disabled={saving || deleting} label="Elimina esperto">
              <Trash2 size={17} />
            </ActionIconButton>
            <button className="modal-close" onClick={onClose} aria-label="Chiudi">
              x
            </button>
          </div>
        </header>
        <div className="modal-body">
          <div className="modal-stack">
            <div className="contact-grid">
              <label>
                Nome
                <input value={expert.firstName} onChange={(event) => onChange({ firstName: event.target.value })} />
              </label>
              <label>
                Cognome
                <input value={expert.lastName} onChange={(event) => onChange({ lastName: event.target.value })} />
              </label>
              <label>
                Email utenza
                <input value={expert.email} onChange={(event) => onChange({ email: event.target.value })} />
              </label>
              <label>
                Foto URL
                <input value={expert.photo} onChange={(event) => onChange({ photo: event.target.value })} />
              </label>
              <label>
                Disponibilita
                <input value={expert.availability} onChange={(event) => onChange({ availability: event.target.value })} />
              </label>
              <label>
                Google Calendar ID
                <input
                  value={expert.calendarId ?? ""}
                  onChange={(event) => onChange({ calendarId: event.target.value })}
                  placeholder="nome@group.calendar.google.com"
                />
              </label>
            </div>
            <label className="full-field">
              Breve descrizione
              <textarea value={expert.bio} onChange={(event) => onChange({ bio: event.target.value })} />
            </label>
            <div className="expert-association-block">
              <strong>Topic associati</strong>
              <p>Definiscono quali workshop possono essere assegnati automaticamente a questo esperto.</p>
              <div className="catalog-topic-pills">
                {topics.map((topic) => {
                  const active = expert.topicIds.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className={active ? "active" : ""}
                      onClick={() =>
                        onChange({
                          topicIds: active ? expert.topicIds.filter((id) => id !== topic.id) : [...expert.topicIds, topic.id],
                          themeIds: [],
                        })
                      }
                    >
                      {topic.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onClose} disabled={saving || deleting}>
            Annulla
          </AppButton>
          <AppButton variant="primary" onClick={onSave} loading={saving} disabled={deleting}>
            Salva profilo
          </AppButton>
        </footer>
      </section>
    </div>
  );
}

# Implementation Plan — Pagina Cliente
> Ordinato per ROI UX: impatto sul comportamento utente / effort di implementazione.
> NON eseguire fino a revisione e approvazione del piano.

---

## Quick Wins
*Impatto alto, effort ≤ 2h ciascuno. Nessun redesign, solo CSS o piccole prop aggiunte.*

### QW-1 · Fix newline nel caveat sconto (Problema #11)
**File:** `src/features/client/ClientView.tsx`
**Modifica:** Sostituire `` `Aggiungi ${n} workshop\nper sconto del 20%` `` con `` `Aggiungi ${n} workshop per sconto del 20%` ``
**ROI:** Il nudge allo sconto quantità è un driver di conversione. Se non si legge, si perde.

---

### QW-2 · Hint disabled sul bottone Avanti (Problema #1)
**File:** `src/components/layout/BottomActionBar.tsx`
**Modifica:** Aggiungere prop opzionale `primaryHint?: string`. Quando `primaryDisabled === true` e `primaryHint` è definito, renderizzare `<small className="bottom-bar-hint">{primaryHint}</small>` sotto il bottone.
**File:** `src/features/client/ClientView.tsx`
**Modifica:** Passare `primaryHint` per ogni step:
- Interessi: `"Seleziona almeno un interesse per continuare"`
- Workshop: `"Aggiungi almeno un workshop al percorso"`
- Date: `"Scegli la data per tutti i workshop"`
**ROI:** Elimina la frustrazione del bottone grigio silenzioso. Zero refactoring.

---

### QW-3 · Sticky command bar workshop (Problema #7)
**File:** `src/styles/workshop.css` o `src/styles/client.css`
**Modifica:** Aggiungere `.workshop-command-bar { position: sticky; top: 0; z-index: 10; background: var(--bg-surface); }` (o equivalente con token CSS esistente).
**ROI:** La search è sempre accessibile mentre si scrolla la griglia workshop.

---

### QW-4 · Stato data proposta vs confermata (Problema #8)
**File:** `src/features/client/ClientView.tsx`
**Modifica:** Nello step Date, aggiungere logica per il terzo stato:
```tsx
const hasDate = Boolean(selection.date);
const isConfirmed = selection.dateConfirmed;
const icon = isConfirmed ? <Check size={16} /> : hasDate ? <CalendarCheck size={16} /> : <Clock3 size={16} />;
const label = isConfirmed
  ? `${selection.date} · ${selection.time} · ${selection.duration}`
  : hasDate
    ? `${selection.date} · ${selection.time} — in attesa di conferma`
    : "Data non ancora scelta";
```
**File:** `src/styles/client.css`
**Modifica:** Aggiungere classe `.date-action-card.proposed` con colore distinto da `done` e da vuoto.
**ROI:** Elimina la confusione principale del cliente nell'ultimo step operativo prima dell'invio.

---

### QW-5 · Checklist label coerente — Brand (fuori scope Cliente, annullato)
*Rimandato: scope solo Cliente.*

---

## Medium Impact
*Impatto alto, effort 2–6h. Richiedono modifiche a componenti esistenti senza crearne di nuovi.*

### MI-1 · WorkshopCard — Stato selected leggibile (Problema #5)
**File:** `src/components/workshop/WorkshopCard.tsx`
**Modifica:** Cambiare il bottone selezionato da `dangerIcon` (cestino) a testo `"Nel percorso ✓"` con variante `outline`. Spostare il Trash2 come azione secondaria dentro un `<div class="card-remove-action">` visibile solo su hover/focus della card (gestibile in CSS con `.workshop-card:hover .card-remove-action { opacity: 1 }`).
**ROI:** L'utente scansiona la griglia e vede immediatamente quali workshop sono nel percorso senza leggere ogni bordo/colore.

---

### MI-2 · Topic Card — Riduzione densità e separazione azioni (Problema #2)
**File:** `src/features/client/ClientView.tsx`
**Modifica:**
1. Theme pill visibili di default solo in stato `selected`. Prima della selezione: nascosti o collassati.
2. Aggiungere `<div class="topic-theme-label">Temi inclusi</div>` come separatore sopra i pill.
3. Contatore temi/workshop: aggiungere classe `topic-card-meta` e ridurre font-size in CSS (non cambia struttura).
**File:** `src/styles/client.css`
**Modifica:** `.topic-card:not(.selected) .topic-theme-preview { display: none; }` oppure opacity/height transition.
**ROI:** Le card non selezionate sono più scannable. Il click principale è inequivocabile.

---

### MI-3 · Card "Tutto il catalogo" — Segnalare comportamento diverso (Problema #3)
**File:** `src/features/client/ClientView.tsx`
**Modifica:** Aggiungere alla card una riga testuale sotto il titolo:
```tsx
<small>Vai direttamente al catalogo completo →</small>
```
Aggiungere in CSS: `.all-topics-card { border-style: dashed; }` per differenziarla visivamente senza cambio di struttura.
**ROI:** Il cliente capisce che questa card è un'uscita dal percorso guidato, non una selezione cumulativa.

---

### MI-4 · Validazione in linea form contatto (Problema #12)
**File:** `src/features/client/ClientView.tsx`
**Modifica:**
1. Aggiungere stato `contactTouched: boolean` (false di default, true dopo il primo tentativo di submit).
2. Quando `contactTouched === true`, aggiungere classe `has-error` ai `<label>` i cui campi non passano la validazione.
3. Aggiungere `<small class="field-error">Campo obbligatorio</small>` sotto ogni campo in errore.
**File:** `src/styles/client.css`
**Modifica:** `.has-error input { border-color: var(--color-danger); }` `.field-error { color: var(--color-danger); font-size: 0.75rem; }`
**ROI:** L'utente capisce esattamente quale campo manca prima di cliccare submit. Riduce drop-off all'ultimo step.

---

### MI-5 · Consigliati — Contatore "già nel percorso" condizionale (Problema #4)
**File:** `src/features/client/ClientView.tsx`
**Modifica:**
```tsx
// Sostituire
<em>{selectedRecommendationCount}/{recommendedWorkshops.length} gia nel percorso</em>
// Con
{selectedRecommendationCount > 0
  ? <em>{selectedRecommendationCount}/{recommendedWorkshops.length} già nel percorso</em>
  : <em>Aggiungi questi {recommendedWorkshops.length} workshop con un clic</em>
}
```
**ROI:** Il copy cambia da descrittivo a call-to-action. Migliora la chiarezza dell'azione disponibile.

---

### MI-6 · Submit — Rimuovere CTA duplicata nel Panel Invio (Problema #9)
**File:** `src/features/client/ClientView.tsx`
**Modifica:** Rimuovere il `<button className="primary-btn" onClick={submitRequest}>Invia richiesta</button>` dall'`approval-card` nel Panel Step Invio. Lasciare solo il riepilogo dati e rimandare all'azione nella BottomActionBar.
**ROI:** Un solo punto di submit. Riduce rischio double-submit e confusione su quale bottone ha effetto.

---

## High Impact
*Richiedono più sessioni di lavoro. Da pianificare dopo i Quick Wins.*

### HI-1 · Stepper mobile — Label compresse (Problema #13)
**File:** `src/styles/responsive.css`
**Modifica:** A `max-width: 768px`:
- `.ff-tab-label { display: none; }` per i tab non attivi.
- Aggiungere `.ff-tab--active .ff-tab-label { display: block; }`.
- Per i tab non attivi: mostrare solo indicatore numerico/check.
- Testare su viewport reale (iPhone 14, Galaxy S22).
**ROI:** Su mobile il percorso diventa leggibile. È il device più usato dai clienti per la prima esplorazione.

---

### HI-2 · Sidebar EcommerceCart — Stato vuoto con guidance (Problema #10)
**File:** `src/components/workshop/EcommerceCart.tsx`
**Modifica:** Aggiungere branch per `rows.length === 0`:
```tsx
if (rows.length === 0) {
  return (
    <div className="cart-empty">
      <strong>Il tuo percorso è vuoto</strong>
      <span>Aggiungi workshop dal catalogo per vedere il riepilogo.</span>
    </div>
  );
}
```
**ROI:** La sidebar ha sempre un contenuto utile. L'utente non si chiede se la sidebar è rotta.

---

### HI-3 · Header — Status chip con colore semantico (Problema #14)
**File:** `src/styles/base.css` o `src/styles/layout.css`
**Modifica:** Aggiungere classi CSS per ogni macro-gruppo di stato:
```css
.request-status-chip.draft { background: var(--color-neutral-100); }
.request-status-chip.active { background: var(--color-warning-100); color: var(--color-warning-700); }
.request-status-chip.confirmed { background: var(--color-success-100); color: var(--color-success-700); }
```
**File:** `src/components/layout/Topbar.tsx`
**Modifica:** Derivare la classe dal `projectStatus`:
```tsx
const statusTone = ["confermato"].includes(projectStatus) ? "confirmed"
  : ["draft_cliente"].includes(projectStatus) ? "draft"
  : "active";
<span className={`request-status-chip ${statusTone}`}>
```
**ROI:** Il cliente capisce in 2 secondi se il suo progetto è in bozza, in lavorazione o confermato, senza leggere il testo.

---

## Note operative

- I Quick Wins possono essere eseguiti in ordine qualsiasi, sono indipendenti tra loro.
- MI-1 (WorkshopCard) e MI-2 (TopicCard) richiedono verifica visiva dopo la modifica CSS.
- HI-3 (status chip colori) richiede conferma dei token CSS disponibili in `tokens.css`.
- Nessuna di queste modifiche tocca la struttura del router, i servizi Google, il data layer o l'autenticazione.

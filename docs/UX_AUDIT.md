# UX Audit — Pagina Cliente
> Scope: solo area Cliente (stepper, interessi, consigliati, workshop, personalizza, date, materiali, invio, sidebar, bottom bar).
> Regola: nessun redesign, nessun cambio architettura. Solo gerarchia, chiarezza, velocità decisionale.

---

## Legenda priorità
- **P1** — Blocca o confonde la decisione principale. Da risolvere prima di tutto.
- **P2** — Causa errori frequenti o abbandono di step.
- **P3** — Rallenta l'operatività senza bloccarla.
- **P4** — Migliora leggibilità e comfort senza impatto funzionale.

---

## 1. Stepper — Evidenza del passo corrente e avanzamento

| Campo | Valore |
|---|---|
| **Pagina** | Tutti gli step (stepper globale) |
| **Priorità** | P1 |

**Problema**
Il tab attivo dello stepper (classe `ff-tab--active`) è l'unico segnale del passo corrente. Non c'è nessun messaggio persistente che spieghi *perché* il pulsante "Avanti" nella BottomActionBar è disabilitato.

**Evidenza nel codice**
```tsx
// BottomActionBar riceve primaryDisabled ma non primaryHint
primaryDisabled={clientMainAction.disabled}
onPrimary={clientMainAction.action}
// Non è passato alcun testo contestuale per lo stato disabled
```
Il motivo del blocco esiste nella logica (`activeTopics.length === 0`, `selectedWorkshopRows.length === 0`, `!allDatesSelected`) ma non viene mai esposto visivamente vicino al bottone.

**Impatto**
L'utente clicca il bottone disabilitato, non succede nulla, non capisce cosa manca. Abbandono o frustrazione.

**Proposta**
Aggiungere una prop `primaryHint` a `BottomActionBar` che mostra una riga di testo sotto il bottone quando `primaryDisabled === true`. I valori sono già calcolati dalla logica `clientMainAction`:
- Step Interessi: "Seleziona almeno un interesse per continuare"
- Step Workshop: "Aggiungi almeno un workshop al percorso"
- Step Date: "Scegli la data per tutti i workshop"

---

## 2. Topic Card — Densità informativa eccessiva

| Campo | Valore |
|---|---|
| **Pagina** | Step Interessi |
| **Priorità** | P1 |

**Problema**
Ogni `topic-card` contiene simultaneamente: icona, badge, titolo, descrizione, contatore temi, contatore workshop, fino a N theme pills espandibili con `...` / `meno`. Il click principale (seleziona interesse) è su `topic-card-main`, ma i theme pill hanno click indipendente sopra. L'utente non sa dove cliccare e cosa fa ogni azione.

**Evidenza nel codice**
```tsx
<article className={`topic-card ...`}>
  <button className="topic-card-main" onClick={() => toggleTopic(topicItem)}>
    <span className="topic-icon">{iconFor(topicItem.icon)}</span>
    <strong>{topicItem.title}</strong>
    <small>{topicItem.description}</small>
    <em>{topicItem.themes.length} temi · {count} workshop</em>
  </button>
  {topicItem.badge !== "base" && <span className="topic-badge">{topicItem.badge}</span>}
  <div className="topic-theme-preview">
    {/* theme pills: ogni pill è un click handler separato */}
  </div>
</article>
```

**Impatto**
L'utente tocca un theme pill credendo di selezionare il topic. Oppure seleziona il topic e non capisce che i pill sotto sono temi individuali. La gerarchia tra "seleziona interesse" e "aggiungi tema singolo" è invisibile.

**Proposta**
- Rendere il contatore temi/workshop secondario (font-size ridotto, opacity 0.6) rispetto al titolo e alla descrizione.
- Separare visivamente le theme pill dall'area clickable principale con un divider o una label "Temi inclusi →".
- Nascondere i theme pill di default; mostrarli solo dopo la selezione del topic (stato `selected`). Questo riduce il rumore e dà feedback all'azione principale.

---

## 3. Card "Tutto il catalogo" — Comportamento divergente non segnalato

| Campo | Valore |
|---|---|
| **Pagina** | Step Interessi |
| **Priorità** | P2 |

**Problema**
La card "Tutto il catalogo" è visivamente identica alle topic card ma ha un comportamento completamente diverso: salta lo step Consigliati e va direttamente a Workshop (`setClientStep("Workshop")`). L'utente non lo sa.

**Evidenza nel codice**
```tsx
<button className="topic-card all-topics-card topic-color-all" onClick={selectAllTopics}>
  <span className="topic-badge">vedi tutti</span>
  <strong>Tutto il catalogo</strong>
  <small>Mostra tutti gli interessi, i temi e i workshop disponibili.</small>
  <em>{allThemes.length} temi catalogo · {workshops.length} workshop</em>
</button>
// selectAllTopics → setClientStep("Workshop")
// Le topic card normali → setActiveTopics/Themes senza avanzare step
```

**Impatto**
L'utente pensa di "aggiungere tutti gli interessi" ma invece salta uno step del percorso guidato. Quando torna indietro trova già tutto selezionato senza capire perché.

**Proposta**
- Aggiungere alla card una micro-label "Vai al catalogo completo →" che indica l'azione di navigazione, non di selezione.
- Oppure separare visivamente questa card dal grid (bordo tratteggiato, icona freccia, posizione in fondo alla griglia) per indicare che è un'uscita dal flusso, non una selezione.

---

## 4. Step Consigliati — Metrica recommendation non leggibile

| Campo | Valore |
|---|---|
| **Pagina** | Step Consigliati |
| **Priorità** | P2 |

**Problema**
Il blocco `recommendation-meter` mostra: "N interessi · 3 consigli · X/3 già nel percorso". Il contatore "già nel percorso" appare anche quando è 0/3 e non è chiaro cosa significhi se l'utente non ha ancora aggiunto nulla.

**Evidenza nel codice**
```tsx
<div className="recommendation-meter">
  <span>{selectedTopics.length} interessi</span>
  <strong>{recommendedWorkshops.length} consigli</strong>
  <em>{selectedRecommendationCount}/{recommendedWorkshops.length} gia nel percorso</em>
</div>
```

**Impatto**
L'utente vede "0/3 già nel percorso" e pensa che debba fare qualcosa per sbloccarli. Confusione sul senso dell'azione principale ("Aggiungi consigliati").

**Proposta**
- Mostrare il contatore `X/Y già nel percorso` solo quando `selectedRecommendationCount > 0`.
- Quando è 0/3, sostituire con un testo azione: "Aggiungi questi 3 workshop con un clic" o simile.
- La CTA principale nella BottomActionBar ("Aggiungi consigliati") è già corretta ma il suo stato disabled (`recommendedWorkshops.length === 0`) non genera hint visivo (vedi problema #1).

---

## 5. Step Workshop — WorkshopCard: asimmetria add/remove

| Campo | Valore |
|---|---|
| **Pagina** | Step Workshop |
| **Priorità** | P2 |

**Problema**
Il bottone di aggiunta usa label testuale "Aggiungi al percorso" (`variant="secondary"`). Il bottone di rimozione usa solo icona cestino (`variant="dangerIcon"`). L'asimmetria rende difficile confrontare lo stato delle card in una griglia.

**Evidenza nel codice**
```tsx
<AppButton
  variant={selection ? "dangerIcon" : "secondary"}
  onClick={onToggle}
  aria-label={selection ? `Rimuovi ${workshop.title}` : `Aggiungi ${workshop.title} al percorso`}
>
  {selection ? <Trash2 size={18} /> : "Aggiungi al percorso"}
</AppButton>
```

**Impatto**
In una griglia densa, l'utente non vede a colpo d'occhio quali workshop sono già nel percorso. La card `selected` ha una classe CSS ma dipende dal contrasto del tema.

**Proposta**
- Mantenere il bottone a testo per entrambi gli stati: "Aggiungi" → "Nel percorso ✓" (con icona Check, stile outline/ghost).
- Il cestino può restare come azione secondaria *dentro* la card, non come CTA principale.
- Questo rende lo stato "selezionato" leggibile senza dipendere solo dal colore di bordo.

---

## 6. Step Workshop — Meta-grid sempre visibile su ogni card

| Campo | Valore |
|---|---|
| **Pagina** | Step Workshop |
| **Priorità** | P3 |

**Problema**
Ogni card mostra sempre 3 righe di meta (durata, formato+livello, partecipanti). Su una griglia con molti workshop, questo crea un muro informativo. La maggior parte delle informazioni (partecipanti, livello) è rilevante solo dopo la selezione.

**Evidenza nel codice**
```tsx
<div className="meta-grid">
  <span><Clock3 size={15} /> {workshop.durationOptions.join(" / ")}</span>
  <span><Video size={15} /> {workshop.formatOptions.join(" / ")} · {workshop.level.toUpperCase()}</span>
  <span><UsersRound size={15} /> {workshop.participants}</span>
</div>
```

**Impatto**
Le card sono visivamente pesanti. L'utente fatica a scansionare titolo e breve descrizione nella griglia.

**Proposta**
- Mostrare solo durata e formato prima della selezione (info necessarie per decidere).
- Mostrare partecipanti e livello nella `config-row` (già visibile solo quando `selection` esiste).
- Alternativa più leggera: ridurre la dimensione del font meta-grid e portarla a una singola riga concatenata.

---

## 7. Step Workshop — Search bar visibilità

| Campo | Valore |
|---|---|
| **Pagina** | Step Workshop |
| **Priorità** | P3 |

**Problema**
La search bar è dentro `workshop-command-bar` che è sopra i filtri. È tecnicamente sopra al contenuto ma dipende dall'altezza del browser e dello stepper: su schermi piccoli potrebbe essere fuori viewport iniziale.

**Evidenza nel codice**
```tsx
<label className="search-field" aria-label="Cerca workshop">
  <Search size={20} />
  <input value={searchQuery} ... placeholder="Cerca workshop, tema o descrizione" />
</label>
```

**Impatto**
Se l'utente non vede la search, esplora la griglia a mano. Operatività rallentata.

**Proposta**
- Verificare che `workshop-command-bar` sia sticky con `position: sticky; top: 0` nel CSS.
- Se non lo è, aggiungere sticky alla command bar in `workshop.css`. È un cambiamento CSS di una riga, non un redesign.

---

## 8. Step Date — Stato "data non scelta" non distinto da "data scelta ma non approvata"

| Campo | Valore |
|---|---|
| **Pagina** | Step Date |
| **Priorità** | P2 |

**Problema**
Le `date-action-card` mostrano due stati con icone: `<Check>` per confermato, `<Clock3>` per non confermato. Ma "non confermato" copre sia "data non ancora inserita" sia "data inserita ma in attesa di approvazione FunniFin". L'utente non sa se deve ancora fare qualcosa.

**Evidenza nel codice**
```tsx
<div className={`date-action-card ${selection.dateConfirmed ? "done" : ""}`}>
  <span className="date-status">
    {selection.dateConfirmed ? <Check size={16} /> : <Clock3 size={16} />}
  </span>
  <div>
    <strong>{workshop.title}</strong>
    <span>
      {selection.dateConfirmed
        ? `${selection.date} · ${selection.time} · ${selection.duration}`
        : "Date non ancora scelte"}
    </span>
  </div>
  <AppButton variant={selection.dateConfirmed ? "outline" : "secondary"}>
    {selection.dateConfirmed ? "Modifica" : "Scegli"}
  </AppButton>
```
`selection.dateConfirmed` è true solo se la data è confermata da FunniFin. Il cliente può aver inserito la data senza che sia ancora approvata — in quel caso `dateConfirmed` è false ma i dati esistono.

**Impatto**
Il cliente crede di dover ancora scegliere la data anche se l'ha già proposta. Frustra e genera richieste di supporto.

**Proposta**
Aggiungere un terzo stato visivo: "data proposta, in attesa di conferma" con icona orologio diversa (es. `CalendarCheck` vs `Clock3`) e testo "In attesa di conferma FunniFin". Questo richiede verificare quando `selection.date` è valorizzato ma `selection.dateConfirmed` è false.

---

## 9. BottomActionBar — Doppia CTA per l'invio

| Campo | Valore |
|---|---|
| **Pagina** | Step Invio, tutte le pagine |
| **Priorità** | P2 |

**Problema**
Il submit finale viene chiamato da tre punti: il bottone nell'`approval-card` dentro il Panel, il `primaryAction` nella `BottomActionBar`, e il `QuoteStrip.onCta`. Tre entry point per la stessa azione critica.

**Evidenza nel codice**
```tsx
// QuoteStrip riceve onCta={submitRequest}
<QuoteStrip ... onCta={submitRequest} />

// BottomActionBar Step Invio
clientMainAction = { label: "Invia richiesta", action: submitRequest }

// Nel Panel Step Invio
<button className="primary-btn" onClick={submitRequest} disabled={sendingRequest}>
  Invia richiesta
</button>
```

**Impatto**
L'utente può cliccare in tre punti diversi con la stessa aspettativa. Se uno è in stato di loading e l'altro non lo è, genera confusione. Aumenta il rischio di doppio submit.

**Proposta**
- Rimuovere il `primary-btn` dentro il Panel Step Invio: il submit avviene solo dalla BottomActionBar (unico punto operativo coerente con gli altri step).
- `QuoteStrip.onCta` può restare ma solo come navigazione allo step Invio, non come submit diretto.

---

## 10. Sidebar EcommerceCart — Stato vuoto non incoraggiante

| Campo | Valore |
|---|---|
| **Pagina** | Tutti gli step con sidebar |
| **Priorità** | P3 |

**Problema**
Quando il percorso è vuoto, la sidebar mostra un carrello vuoto. Non è chiaro se questo è il comportamento atteso o se qualcosa è andato storto. Non c'è un messaggio di guidance ("Aggiungi workshop dal catalogo").

**Evidenza**
`EcommerceCart` riceve `rows={selectedWorkshopRows}`. Quando vuoto, il comportamento dipende dal componente (`EcommerceCart.tsx` non letto, ma deducibile dal nome e dai props).

**Impatto**
L'utente guarda la sidebar vuota e non è sicuro se sta usando correttamente l'interfaccia.

**Proposta**
- In stato vuoto, la sidebar mostra: "Aggiungi workshop al percorso per vedere il riepilogo qui."
- Un link testuale "Vai al catalogo →" che naviga allo Step Workshop.

---

## 11. QuoteStrip — Visibilità del risparmio

| Campo | Valore |
|---|---|
| **Pagina** | Tutti gli step |
| **Priorità** | P4 |

**Problema**
`QuoteStrip` mostra `coveredTopics`, `coveredThemes`, `totalHours`, quote. Il messaggio di sconto ("Aggiungi X workshop per sconto 20%") è nella `BottomActionBar.caveat` con newline nel codice sorgente — rende incerta la resa su tutti i device.

**Evidenza nel codice**
```tsx
caveat={
  selectedWorkshopRows.length > 0 && selectedWorkshopRows.length < 3
    ? `Aggiungi ${3 - selectedWorkshopRows.length} workshop\nper sconto del 20%`
    : undefined
}
```

**Impatto**
Il nudge allo sconto quantità è uno dei driver di acquisto principali. Se non si legge correttamente, si perde.

**Proposta**
- Sostituire `\n` con uno spazio. Il caveat deve essere una singola riga o gestito con CSS white-space.
- Oppure usare un `<span>` dedicato con stile `display: block` nel componente BottomActionBar.

---

## 12. Step Invio — Form contatto: nessun validazione in linea

| Campo | Valore |
|---|---|
| **Pagina** | Step Invio |
| **Priorità** | P3 |

**Problema**
Il form contatto (nome, cognome, email, azienda, telefono) non ha validazione in linea. L'utente compila tutto, clicca "Invia richiesta", e solo a quel punto scopre che qualcosa manca (via `notify`).

**Evidenza nel codice**
```tsx
const contactReady =
  contact.firstName.trim() &&
  contact.lastName.trim() &&
  contact.company.trim() &&
  contact.phone.trim() &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim());
// contactReady è calcolato ma non usato per mostrare feedback in linea sui singoli campi
```

**Impatto**
Friction all'ultimo step, il più critico. L'utente che ha già compilato tutto il percorso viene bloccato alla fine senza capire quale campo è sbagliato.

**Proposta**
- Aggiungere stile CSS `input:invalid` o classe `has-error` sui singoli campi dopo il primo tentativo di submit (pattern `touched`).
- La logica di validazione esiste già: `contactReady` basta dividerla per campo e associarla allo stato di ogni `<input>`.

---

## 13. Stepper — 7 step su riga orizzontale

| Campo | Valore |
|---|---|
| **Pagina** | Tutti gli step |
| **Priorità** | P3 |

**Problema**
7 tab (`ff-stepper-tabs`) su una riga orizzontale. Su viewport ≤ 768px la label testuale di ogni step è probabilmente troncata o va in overflow.

**Evidenza nel codice**
```tsx
const clientSteps = ["Interessi", "Consigliati", "Workshop", "Personalizza", "Date", "Materiali", "Invio"];
// Tutti renderizzati con ff-tab-label visibile
```

**Impatto**
Mobile: lo stepper è illeggibile o scrollabile orizzontalmente senza feedback chiaro.

**Proposta**
- Non cambiare il numero di step (architettura preservata).
- In CSS responsive (`≤ 768px`): mostrare solo il numero e la label dello step attivo + indicatori compatti (punti o mini-check) per gli altri.
- Alternativa: truncate le label a 3 caratteri su mobile ("Int.", "Con.", "Wor.", ecc.) con `abbr` per accessibilità.

---

## 14. Header — Contesto vs Stato progetto indistinguibili

| Campo | Valore |
|---|---|
| **Pagina** | Header globale (Topbar) |
| **Priorità** | P3 |

**Problema**
`Topbar` mostra in sequenza: brand title → role badge → context string → status chip. Il `context` è una stringa libera (passata da App.tsx), il `status chip` è lo stato progetto. Sulla stessa riga, senza separazione semantica chiara.

**Evidenza nel codice**
```tsx
<div className="brand-subline">
  <span>{context}</span>
  <span className="request-status-chip" title={statusDescription[projectStatus]}>
    <strong>{statusLabel[projectStatus]}</strong>
    <button ... ><InfoIcon size={14} /></button>
  </span>
</div>
```

**Impatto**
Il Cliente vede "Step 3 — Workshop · Richiesta in bozza" sulla stessa riga e non capisce subito dove si trova e qual è lo stato del suo progetto.

**Proposta**
- Dare al `request-status-chip` un colore di sfondo semantico (verde = confermato, arancio = in verifica, grigio = bozza) in CSS tramite class derivata dallo status.
- Separare context e status chip con un separatore visibile o su righe distinte su mobile.


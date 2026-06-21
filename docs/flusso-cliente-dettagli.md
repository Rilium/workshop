# Flusso Cliente FunniFin

Allegato separato al manuale utente. Perimetro: solo vista Cliente, senza login, console FunniFin, esperto, brand o backend operativo.

## Sequenza

## 1. Interessi

![1. Interessi](manual-screenshots/client-flow/01-cliente-interessi.png)

### Cosa succede

- Il cliente entra nella vista pubblica, senza autenticazione e senza elementi riservati.
- Seleziona uno o piu interessi; i temi collegati vengono attivati e possono essere raffinati.
- La CTA resta bloccata finche non esiste almeno una scelta utile per generare il percorso.

### Controlli

- Stepper visibile sul percorso cliente.
- Bottom bar con stato, totale e hint di avanzamento.
- Accesso area riservata separato dal percorso pubblico.

### Immagini riprese dal manuale utente

![fig-02-cliente-partenza-vuota.png](manual-screenshots/annotated/fig-02-cliente-partenza-vuota.png)

![fig-04-cliente-interessi-temi.png](manual-screenshots/annotated/fig-04-cliente-interessi-temi.png)

![fig-05-cliente-filtri-temi.png](manual-screenshots/annotated/fig-05-cliente-filtri-temi.png)

## 2. Consigliati

![2. Consigliati](manual-screenshots/client-flow/02-cliente-consigliati.png)

### Cosa succede

- Il sistema propone una prima combinazione di workshop coerente con interessi e temi scelti.
- Il cliente puo aggiungere tutti i consigli con un clic oppure saltare al catalogo manuale.
- I workshop consigliati non entrano nel carrello finche il cliente non conferma.

### Controlli

- Numero interessi e numero consigli esplicitati.
- Card con prezzo, durata, formato e azione Aggiungi.
- Azione secondaria Scegli manualmente disponibile nel footer.

### Immagini riprese dal manuale utente

![fig-03-cliente-stepper-e-stato.png](manual-screenshots/annotated/fig-03-cliente-stepper-e-stato.png)

![fig-06-cliente-workshop-preventivo.png](manual-screenshots/annotated/fig-06-cliente-workshop-preventivo.png)

## 3. Workshop

![3. Workshop](manual-screenshots/client-flow/03-cliente-workshop.png)

### Cosa succede

- Il cliente rivede catalogo, carrello e preventivo aggiornato in tempo reale.
- Puo cercare workshop, aprire filtri per interesse/tema/formato e rimuovere o aggiungere elementi.
- Le scelte alimentano riepilogo e-commerce, sconti e CTA verso la personalizzazione.

### Controlli

- Catalogo filtrato dagli interessi, salvo ricerca o apertura catalogo completo.
- Carrello laterale con totale percorso.
- Bottom action bar sempre raggiungibile.

### Immagini riprese dal manuale utente

![fig-06-cliente-workshop-preventivo.png](manual-screenshots/annotated/fig-06-cliente-workshop-preventivo.png)

![fig-07-cliente-catalogo-card.png](manual-screenshots/annotated/fig-07-cliente-catalogo-card.png)

![fig-08-cliente-prezzo-sconti.png](manual-screenshots/annotated/fig-08-cliente-prezzo-sconti.png)

## 4. Personalizza

![4. Personalizza](manual-screenshots/client-flow/04-cliente-personalizza.png)

### Cosa succede

- Il cliente decide se trasformare ogni workshop in una versione su misura.
- La personalizzazione aggiunge co-design FunniFin, note e costo extra per il singolo workshop.
- La rimozione dal percorso resta disponibile anche in questa fase.

### Controlli

- Lista dei workshop selezionati.
- Toggle Rendi su misura per ogni riga.
- Preventivo aggiornabile in tempo reale.

### Immagini riprese dal manuale utente

![fig-06-cliente-workshop-preventivo.png](manual-screenshots/annotated/fig-06-cliente-workshop-preventivo.png)

![fig-11-bottom-sheet-fisso.png](manual-screenshots/annotated/fig-11-bottom-sheet-fisso.png)

## 5. Date

![5. Date](manual-screenshots/client-flow/05-cliente-date.png)

### Cosa succede

- Il cliente propone una data per ogni workshop selezionato.
- Il selettore calendario permette scelta rapida con Adesso, navigazione mese e conferma proposta.
- La CTA Carica materiali si abilita solo quando tutti i workshop hanno una data confermata.

### Controlli

- Stato data per ogni workshop: non scelta, proposta o confermata.
- Data, orario e durata visibili nella card dopo conferma.
- Hint nel footer se manca almeno una data.

### Immagini riprese dal manuale utente

![fig-09-cliente-date-picker.png](manual-screenshots/annotated/fig-09-cliente-date-picker.png)

![fig-10-cliente-date-picker-closeup.png](manual-screenshots/annotated/fig-10-cliente-date-picker-closeup.png)

## 6. Materiali

![6. Materiali](manual-screenshots/client-flow/06-cliente-materiali.png)

### Cosa succede

- Il cliente puo allegare logo, brand guideline e note platea.
- L'upload prepara una cartella Drive draft intestata al cliente; se il flusso viene abbandonato prima dell'invio, la cartella draft viene cestinata.
- Lo step e opzionale: il cliente puo procedere all'invio anche senza materiali.

### Controlli

- Comando Carica materiali visibile.
- Messaggio sul comportamento della cartella draft.
- Azione Vai all'invio disponibile nel footer.

### Immagini riprese dal manuale utente

![fig-11-bottom-sheet-fisso.png](manual-screenshots/annotated/fig-11-bottom-sheet-fisso.png)

![fig-12-bottom-sheet-disabled.png](manual-screenshots/annotated/fig-12-bottom-sheet-disabled.png)

## 7. Invio

![7. Invio](manual-screenshots/client-flow/07-cliente-invio.png)

### Cosa succede

- Il cliente inserisce i dati di contatto solo alla fine del percorso.
- Il pannello di readiness ricapitola workshop selezionati e segnala eventuali date mancanti.
- L'invio salva la richiesta e prepara il recap email per cliente e FunniFin.

### Controlli

- Campi obbligatori: nome, cognome, email aziendale, azienda, telefono.
- Preventivo finale e materiali collegati vengono associati alla richiesta.
- Se l'email non parte, la richiesta resta comunque tracciata come salvata.

### Immagini riprese dal manuale utente

![fig-25-email-richiesta-cliente.png](manual-screenshots/annotated/fig-25-email-richiesta-cliente.png)

![fig-26-email-workflow.png](manual-screenshots/annotated/fig-26-email-workflow.png)

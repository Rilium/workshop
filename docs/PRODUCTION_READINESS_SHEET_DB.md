# FunniFin production readiness mantenendo Google Sheet come DB

Data: 2026-06-22

## Decisione vincolante

Google Sheet resta il database operativo. Non serve migrare a Postgres/Firebase per andare in produzione, ma lo Sheet non puo essere trattato come un file di appoggio: deve essere protetto, versionato, monitorato e usato tramite Apps Script come backend applicativo.

Architettura target:

- Frontend statico Vite/React su Vercel.
- Backend unico: Google Apps Script Web App.
- Database: Google Sheet con tab operative (`Requests`, `RequestEvents`, `UtentiClienti`, `AuthUsers`, `AccessRequests`, `AuthSessions`, `CatalogTopics`, `CatalogWorkshops`, `PricingRules`, `Experts`, `Settings`).
- Integrazioni: Drive, Calendar, MailApp via account esecutore Apps Script.
- Config prod: Vercel env + Apps Script Properties + tab `Settings`, non valori hardcoded nel codice.

## Strategia ambienti

Decisione operativa: finche non ci sono clienti esterni attivi, l'ambiente attuale puo essere usato come ambiente di hardening prod-like. Non lo consideriamo "produzione vera" finche non supera i gate P0/P1 e finche non esiste una separazione pulita degli ambienti.

Durante l'hardening possiamo usare dati operativi reali inseriti manualmente da FunniFin: utenti, catalogo, prezzi, esperti, recipient, richieste interne o clienti creati a mano. La regola e che questi dati devono vivere nello Sheet, nelle tab `Settings`, in Vercel env o nelle Apps Script Properties. Non devono essere hardcodati nel codice.

Sequenza consigliata:

1. **Hardening sull'ambiente attuale**
   - Chiudere sicurezza, auth, upload, lock Sheet, backup, privacy, mail e monitoraggio.
   - Usare dati operativi reali inseriti da FunniFin nello Sheet/UI/config, se utili al test.
   - Non usare clienti esterni attivi finche privacy, backup, permessi e recovery non sono pronti.
   - Accettare iterazioni rapide per sistemare fondamenta e flusso end-to-end.

2. **Freeze della baseline**
   - Quando i gate P0 sono verdi, congelare configurazione, Apps Script, Sheet schema, Drive tree e checklist manuale.
   - Salvare una baseline documentata: commit, deploy Apps Script, env Vercel, schema Sheet, folder IDs.

3. **Creazione ambienti standard**
   - Clonare la baseline in `staging`/`pre-prod`: Sheet, Drive, Calendar, Apps Script deployment, Vercel Preview/branch.
   - Creare `prod` pulito con Sheet e cartelle senza dati locali/test hardcoded. I dati operativi reali vanno reinseriti o migrati in modo controllato.
   - Da quel momento il flusso diventa: locale -> staging/pre-prod -> prod.

4. **Regola dopo go-live**
   - Nessuna modifica diretta in prod.
   - Ogni fix passa da staging/pre-prod con build, smoke live e checklist manuale minima.
   - Prod riceve solo configurazioni validate e deploy promossi.

## Cosa dice il prodotto

Dal manuale utente v2.2 del 19 giugno 2026 il prodotto non e solo un configuratore cliente. Il perimetro reale include:

- Cliente pubblico: interessi, catalogo, preventivo, date, materiali, invio richiesta.
- FunniFin: coda operativa, verifica date, assegnazione esperti, catalogo, prezzi, backend Google, utenti/inviti.
- Esperto: opportunita, candidature, incarichi, upload/selezione deck.
- Brand: revisione materiali, approvazione, richiesta modifiche, abilitazione deck finale.
- Flusso end-to-end: richiesta cliente -> verifica FunniFin -> date -> esperto -> deck -> brand -> evento Calendar provvisorio/confermato.

Quindi "prod" significa che ogni passaggio deve essere tracciabile, recuperabile e protetto. Non basta che la UI funzioni in demo.

## Stato attuale verificato

Punti gia buoni:

- Build production passa con `npm run build`.
- Il frontend chiama Apps Script per richieste, auth, catalogo, prezzi, esperti, settings, Drive, Calendar e MailApp.
- Le azioni admin principali richiedono sessione server-side verificata su Sheet.
- Esiste uno smoke live Google (`npm run test:e2e:live`) con lifecycle Sheet e sessione reale.
- Esiste un manuale utente abbastanza completo da usare come base di regressione.
- I dati personali/test hardcoded sono stati rimossi da `src`, `google-workspace`, `tests`, docs operative e `.env.example`.
- I dati locali di test ora stanno in `config/local-test-settings.json`.

Problemi ancora da chiudere prima del go-live reale:

- Alcune azioni pubbliche Drive/upload sono troppo aperte per un ambiente pubblico.
- Le scritture Sheet non usano ancora un lock applicativo sistematico.
- Non c'e una procedura automatica di backup/restore dello Sheet.
- Non c'e ancora separazione formalizzata staging/prod per Apps Script, Sheet, Drive e Calendar. Va creata dopo l'hardening della baseline e prima di aprire a clienti esterni.
- Non c'e rate limiting/anti-abuso per form cliente, login code e upload.
- La gestione privacy/GDPR e retention e solo implicita.
- Il monitoraggio e ancora manuale tramite health panel/smoke, non ha alert.

## Gate P0: blocchi veri prima del go-live

1. Definire baseline prod-like sull'ambiente attuale.
   - Trattare l'ambiente attuale come hardening/pre-prod finche non ci sono clienti esterni attivi.
   - Consentire dati operativi reali gestiti da FunniFin nello Sheet/UI/config.
   - Vietare dati hardcoded nel codice e vietare uso pubblico con clienti esterni fino a completamento P0.
   - Documentare endpoint Apps Script, Sheet ID, cartelle Drive, Calendar ID e Vercel env usati durante hardening.
   - Quando P0 e verde, clonare in staging/pre-prod e prod puliti.
   - Dopo il go-live, lavorare solo con flusso locale -> staging/pre-prod -> prod.

2. Blindare configurazione.
   - Nessuna email, folder ID, calendar ID o recipient personale nel codice.
   - Prod legge recipient da `Settings`, Vercel env o Apps Script Properties.
   - Test locale legge solo `config/local-test-settings.json`.
   - Documentare chi puo modificare Script Properties e tab `Settings`.

3. Proteggere azioni pubbliche.
   - `createWorkshopRequest` puo restare pubblico, ma deve validare payload, dimensioni e campi obbligatori server-side.
   - `requestLoginCode` deve avere rate limit per email/IP-ish fingerprint quando possibile.
   - `createAssetDraftFolder` e `uploadAssetFile` non devono restare upload libero verso Drive senza token draft o sessione.
   - Aggiungere limite file: estensioni, MIME, dimensione massima, numero file per draft, nome sanitizzato.

4. Consistenza dati Sheet.
   - Usare `LockService` intorno a create/update/delete che toccano Sheet e RequestEvents.
   - Rendere idempotenti le operazioni critiche con `clientMutationId`.
   - Vietare update generici che possono sovrascrivere campi non previsti dal ruolo.
   - Validare transizioni stato: un Esperto non deve poter saltare a `confermato`, Brand non deve poter alterare prezzo, Cliente non deve modificare record gia inviati senza flusso dedicato.

5. Backup e recovery.
   - Backup automatico giornaliero dello Sheet prod in Drive.
   - Retention minima: 30 giorni giornalieri + 12 mensili.
   - Runbook restore: come copiare tab, come ripuntare `REQUEST_SPREADSHEET_ID`, come verificare conteggi.
   - Export CSV periodico per tab critiche.

6. Auth prod.
   - Primo utente FunniFin configurato via `INITIAL_FUNNIFIN_EMAIL` o `AUTH_SEED_USERS_JSON`, non hardcoded.
   - Codici login: scadenza gia presente, aggiungere limite tentativi e invalidazione codice dopo verifica.
   - Sessioni: aggiungere revoca/logout server-side o cleanup sessioni scadute.
   - Vietare impersonificazione a ruoli non FunniFin lato server, non solo UI.

7. Email.
   - Definire mittente, reply-to, CC interno, destinatari workflow in `Settings`.
   - Se MailApp fallisce, la richiesta resta salvata ma deve produrre evento `email_failed` e notifica FunniFin.
   - Evitare che fallback/opaque sembri consegna certa.
   - Verificare quota MailApp sull'account esecutore Apps Script.

8. Privacy e compliance.
   - Informativa privacy nel flusso Cliente prima dell'invio.
   - Consenso/acknowledgement salvato nello Sheet con timestamp e versione testo.
   - Retention per richieste, materiali Drive, sessioni, codici accesso.
   - Procedura cancellazione cliente/materiali.
   - Accessi Drive limitati all'account operativo e utenti necessari.

## Gate P1: subito dopo P0, prima di vendere seriamente

1. Monitoraggio.
   - Health check Apps Script programmato.
   - Alert email/Slack quando `googleHealth` fallisce, quota MailApp bassa, Sheet non leggibile, Drive non configurato.
   - Log eventi con requestId/action/user/role/outcome.

2. Performance e limiti Apps Script.
   - Cache per letture catalogo/prezzi/settings.
   - Evitare scansioni complete Sheet su ogni chiamata quando le righe crescono.
   - Timeout ragionevoli lato frontend gia parzialmente presenti, ma servono messaggi operativi coerenti.

3. Qualita dati.
   - Validazione tab catalogo: topic/theme esistenti, price numerici, state/active coerenti, masterSlide valido.
   - Validazione esperti: email, topic/theme, active, expertId collegato agli utenti Esperto.
   - Tool di audit da eseguire prima del deploy.

4. Test prod-like.
   - `npm run build` obbligatorio.
   - `npm run test:e2e:local` obbligatorio su fallback.
   - `npm run test:e2e:live` obbligatorio su staging Google.
   - Checklist manuale dal manuale utente: Cliente, FunniFin, Esperto, Brand, mail, notifiche, Calendar, Drive.

5. Runbook operativo.
   - Come creare nuovo workshop.
   - Come invitare utenti.
   - Come recuperare richiesta bloccata.
   - Come correggere email non partita.
   - Come ripubblicare Apps Script.
   - Come rollbackare frontend Vercel.

## Gate P2: hardening e crescita

- Code splitting frontend: il bundle JS supera 500 kB minificato.
- Admin audit trail leggibile in UI, non solo tab eventi.
- Dashboard export commerciale.
- Miglior gestione allegati con virus scanning esterno se il volume cresce.
- Versionamento configurazioni catalogo/prezzi.
- Test automatici per transizioni stato e permessi ruolo.

## Checklist go-live secca

- [ ] Sheet prod creato e accessi limitati.
- [ ] Apps Script prod deployato come Web App con account operativo corretto.
- [ ] Script Properties prod compilate senza dati test.
- [ ] Vercel Production env compilate e diverse da Preview.
- [ ] `VITE_ALLOW_LOCAL_FALLBACKS=false`.
- [ ] `VITE_STRICT_GOOGLE_BACKEND=true`.
- [ ] Primo utente FunniFin creato da config, non hardcoded.
- [ ] `config/local-test-settings.json` usato solo da test/script locali.
- [ ] Upload Drive protetto con token draft/sessione e limiti file.
- [ ] LockService aggiunto alle scritture Sheet critiche.
- [ ] Backup automatico Sheet attivo e restore provato.
- [ ] Privacy notice + consenso salvato.
- [ ] Rate limit login code e form cliente.
- [ ] Mail workflow configurate in `Settings`.
- [ ] `npm run check:no-hardcoded-test-data` verde.
- [ ] `npm run build` verde.
- [ ] Smoke live staging verde.
- [ ] Checklist manuale manuale utente verde su staging.
- [ ] Piano rollback Vercel + Apps Script scritto.

## Nota sul file test locale

I dati finti/locali devono stare in:

```text
config/local-test-settings.json
```

Regola: se un dato e personale, di test o di demo non deve entrare in `src/secretSettings.ts`, `google-workspace/apps-script/Code.gs`, seed prod, README operativo o componenti UI. Se serve al test, si legge da quel JSON o da env locali.

Il controllo e agganciato alla build: `npm run build` esegue prima `npm run check:no-hardcoded-test-data`. Se qualcuno reintroduce recipient personali o test hardcoded fuori dai file ammessi, la build deve fallire.

Verifica meccanica usata oggi:

```bash
npm run check:no-hardcoded-test-data
npm run build
```

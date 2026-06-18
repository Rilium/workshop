# FunniFin Google Workspace setup

## Apps Script

1. Crea un nuovo progetto Apps Script su https://script.google.com.
2. Incolla `apps-script/Code.gs` e copia anche `apps-script/appsscript.json` nel manifest del progetto.
3. In **Services** abilita **Calendar API** advanced service.
4. Nel Google Cloud project collegato abilita **Google Calendar API**.
5. In **Project Settings > Script properties** aggiungi:
   - `FUNNIFIN_CALENDAR_ID`: `c3ee95ee617eaacb9155f9c0deff2e226eb78f1c2ab2dca6a972523682928da1@group.calendar.google.com`.
   - `SLIDES_ROOT_FOLDER_ID`: ID della cartella presentazioni, per test `1KAI-xet3nfj15gv9fdRNS4Gg0DPI8tJG`.
   - `DRIVE_ROOT_FOLDER_ID`: opzionale, root Drive generale se diversa dalla root Slides.
   - `REQUEST_SPREADSHEET_ID`: opzionale. Se non lo imposti, lo script usa lo spreadsheet creato per il progetto: `1g0BWyyVw6Fz5krVc1Edd-iTlmYS2CQVUdMgk78veBPs`.
   - `EXPERT_CALENDAR_IDS`: lista separata da virgole degli ID calendario esperti.
   - `INTERNAL_RECIPIENT`: `rinaldi.rilio@gmail.com`.
   - `SETUP_SECRET`: stringa privata usata solo da `npm run google:seed` per il seed iniziale senza sessione browser.
6. Deploy > New deployment > Web app:
   - Execute as: **Me**.
   - Who has access: **Anyone with the link** per test, oppure dominio Workspace quando disponibile.
7. Esegui una volta `listWorkshopRequests` o `getRequestsSpreadsheet` dall'editor Apps Script e accetta i permessi richiesti, inclusi Spreadsheet, Drive, Calendar e invio mail.
8. Copia la Web App URL in `VITE_APPS_SCRIPT_DEPLOYMENT_URL`.

## Vercel env

Imposta almeno:

```bash
VITE_APPS_SCRIPT_DEPLOYMENT_URL=https://script.google.com/macros/s/XXX/exec
VITE_ALLOW_LOCAL_FALLBACKS=false
VITE_STRICT_GOOGLE_BACKEND=true
ADMIN_SETUP_SECRET=stesso-valore-di-SETUP_SECRET
VITE_FUNNIFIN_CALENDAR_ID=c3ee95ee617eaacb9155f9c0deff2e226eb78f1c2ab2dca6a972523682928da1@group.calendar.google.com
VITE_SLIDES_TEMPLATE_FOLDER_ID=1KAI-xet3nfj15gv9fdRNS4Gg0DPI8tJG
```

Poi redeploy.

## Cosa testa l'app

- Cliente: proposta date chiama `freeBusy` via Apps Script se `VITE_APPS_SCRIPT_DEPLOYMENT_URL` esiste.
- FunniFin: `Verifica FreeBusy` legge i calendari reali.
- FunniFin: `Conferma evento` crea evento Calendar con Meet se il formato include webinar/ibrido.
- Cliente: invio richiesta manda email al cliente e a FunniFin tramite Apps Script.
- Cliente: invio richiesta crea prima un record reale su Google Sheet (`Requests`) e poi manda il recap email.
- FunniFin: la coda progetti legge `listWorkshopRequests`; status, date, esperto e calendario aggiornano lo stesso record tramite `updateWorkshopRequest`.
- FunniFin: catalogo, regole prezzo, pool esperti e settings operative possono essere salvati su Google Sheet tramite `listCatalogConfig`, `updateCatalogTopic`, `listPricingRules`, `updatePricingRule`, `listExperts`, `updateExpert`, `listWorkspaceSettings` e `updateWorkspaceSetting`.
- FunniFin: la tab Google controlla `googleHealth` per Sheets, Calendar, Drive e quota MailApp.
- FunniFin: le azioni di fase possono aprire una modal e inviare template HTML ai destinatari test:
  - Cliente: `rinaldi.rilio+2@gmail.com`
  - FunniFin: `rinaldi.rilio+1@gmail.com`
  - Esperto: `rinaldi.rilio+3@gmail.com`
  - Brand: `rinaldi.rilio+4@gmail.com`
- FunniFin: la conferma evento puo creare un evento Calendar `provvisorio` o `definitivo`; il titolo diventa `[PROVVISORIO] ...` o `[CONFERMATO] ...`.

Le azioni admin ora richiedono una sessione FunniFin valida. Per testarle a mano prendi `sessionToken` dal localStorage dopo il login FunniFin e aggiungilo alla query.

Per controllare che lo script veda i calendari:

```text
https://script.google.com/macros/s/XXX/exec?action=calendarLookup&all=1&sessionToken=TOKEN
```

Per controllare che legga la cartella presentazioni:

```text
https://script.google.com/macros/s/XXX/exec?action=driveFolder&folderId=1KAI-xet3nfj15gv9fdRNS4Gg0DPI8tJG&sessionToken=TOKEN
```

Per controllare il registro richieste:

```text
https://script.google.com/macros/s/XXX/exec?action=listWorkshopRequests&sessionToken=TOKEN
```

Per creare nella root vuota le sottocartelle operative, fai una POST allo stesso URL con:

```json
{
  "action": "ensurePresentationStructure",
  "payload": {
    "sessionToken": "TOKEN",
    "folderId": "1KAI-xet3nfj15gv9fdRNS4Gg0DPI8tJG"
  }
}
```

Google raccomanda di creare un Meet univoco per ogni evento tramite `conferenceData.createRequest` e `conferenceDataVersion=1`; lo script fa cosi.

## Seed iniziale admin

Dopo aver caricato `apps-script/Code.gs`, impostato `SETUP_SECRET` nelle Script properties e creato un nuovo deploy Apps Script, popola o riallinea tutti i fogli operativi con:

```bash
npm run google:seed
```

Il seed aggiorna:

- `CatalogTopics`
- `CatalogWorkshops`
- `PricingRules`
- `Experts`
- `Settings`

e chiude con una lettura `googleHealth`.

Se il comando dice `Apps Script deployment is missing actions`, il deploy live non e ancora il `Code.gs` aggiornato: crea un nuovo deploy Apps Script e rilancia il seed.

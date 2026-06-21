function envString(key: string) {
  return (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[key] || "";
}

// Prod config must come from env, Script Properties, or Sheet Settings.
// Local/demo identities belong only in config/local-test-settings.json.
export const SECRET_SETTINGS = {
  google: {
    env: {
      clientId: "VITE_GOOGLE_CLIENT_ID",
      apiKey: "VITE_GOOGLE_API_KEY",
      appScriptDeploymentUrl: "VITE_APPS_SCRIPT_DEPLOYMENT_URL",
      funnifinCalendarName: "VITE_FUNNIFIN_CALENDAR_NAME",
      funnifinCalendarId: "VITE_FUNNIFIN_CALENDAR_ID",
      expertsCalendarIds: "VITE_EXPERTS_CALENDAR_IDS",
      driveRootFolderId: "VITE_DRIVE_ROOT_FOLDER_ID",
      slidesTemplateFolderId: "VITE_SLIDES_TEMPLATE_FOLDER_ID",
      clientMaterialsFolderId: "VITE_CLIENT_MATERIALS_FOLDER_ID",
      finalDecksFolderId: "VITE_FINAL_DECKS_FOLDER_ID",
    },
    scopes: [
      "https://www.googleapis.com/auth/calendar.freebusy",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/presentations",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
    endpoints: {
      freeBusy: "https://www.googleapis.com/calendar/v3/freeBusy",
      calendarEvents: (calendarId: string) =>
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
      driveCopyFile: (fileId: string) => `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/copy`,
      driveFiles: "https://www.googleapis.com/drive/v3/files",
    },
    workspace: {
      timezone: "Europe/Rome",
      driveRootFolderName: "FunniFin Workshop Planner",
      slidesMasterFolderName: "Presentazioni master FunniFin",
      projectFolderPattern: "Cliente - {company}/{yearMonth} Percorso {pathName}",
      projectTree: [
        "01 Logo e materiali cliente",
        "02 Presentazioni master",
        "03 Presentazioni esperto",
        "04 Revisione brand",
        "05 Versioni finali",
        "06 Archivio",
      ],
      defaultWorkshopDurationMinutes: 60,
      qAndAMinutes: 10,
      createMeetForFormats: ["webinar", "ibrido"],
      calendarSlotStartHour: 8,
      calendarSlotEndHour: 23,
    },
    email: {
      internalRecipient: envString("VITE_INTERNAL_RECIPIENT"),
      roleRecipients: {
        client: envString("VITE_CLIENT_RECIPIENT"),
        funnifin: envString("VITE_FUNNIFIN_RECIPIENT"),
        expert: envString("VITE_EXPERT_RECIPIENT"),
        brand: envString("VITE_BRAND_RECIPIENT"),
      },
      fromName: "FunniFin Workshop Planner",
      actions: {
        sendWorkshopRequest: "sendWorkshopRequestEmail",
        sendWorkflowNotification: "sendWorkflowNotification",
      },
    },
    workshopMasterSlides: {
      "ws-budget-step": { env: "VITE_SLIDE_MASTER_BUDGET_STEP", fallbackName: "Budgeting personale step by step" },
      "ws-fondo-emergenza": { env: "VITE_SLIDE_MASTER_FONDO_EMERGENZA", fallbackName: "Come creare un fondo di emergenza" },
      "ws-liquidita-conto": { env: "VITE_SLIDE_MASTER_LIQUIDITA_CONTO", fallbackName: "La gestione della liquidita sul conto corrente" },
      "ws-mutui-prestiti": { env: "VITE_SLIDE_MASTER_MUTUI_PRESTITI", fallbackName: "Mutui e prestiti" },
      "ws-pac-etf": { env: "VITE_SLIDE_MASTER_PAC_ETF", fallbackName: "Come avviare un PAC in ETF" },
      "ws-abc-investimenti": { env: "VITE_SLIDE_MASTER_ABC_INVESTIMENTI", fallbackName: "ABC degli investimenti" },
      "ws-tfr-previdenza": { env: "VITE_SLIDE_MASTER_TFR_PREVIDENZA", fallbackName: "TFR e previdenza complementare" },
      "ws-bonus-detrazioni": { env: "VITE_SLIDE_MASTER_BONUS_DETRAZIONI", fallbackName: "Bonus detrazioni agevolazioni fiscali" },
      "ws-legge-bilancio": { env: "VITE_SLIDE_MASTER_LEGGE_BILANCIO", fallbackName: "Legge di bilancio" },
      "ws-genitorialita": { env: "VITE_SLIDE_MASTER_GENITORIALITA", fallbackName: "Congedi maternita paternita" },
      "ws-amore-soldi": { env: "VITE_SLIDE_MASTER_AMORE_SOLDI", fallbackName: "Amore e soldi" },
      "ws-merenda-finanziaria": { env: "VITE_SLIDE_MASTER_MERENDA_FINANZIARIA", fallbackName: "Merenda con educazione finanziaria" },
    },
  },
} as const;

const SETTINGS = {
  timezone: "Europe/Rome",
  calendarId: PropertiesService.getScriptProperties().getProperty("FUNNIFIN_CALENDAR_ID") || "",
  calendarName: PropertiesService.getScriptProperties().getProperty("FUNNIFIN_CALENDAR_NAME") || "",
  slidesRootFolderId: PropertiesService.getScriptProperties().getProperty("SLIDES_ROOT_FOLDER_ID") || "",
  driveRootFolderId: PropertiesService.getScriptProperties().getProperty("DRIVE_ROOT_FOLDER_ID") || "",
  requestSpreadsheetId: PropertiesService.getScriptProperties().getProperty("REQUEST_SPREADSHEET_ID") || "1g0BWyyVw6Fz5krVc1Edd-iTlmYS2CQVUdMgk78veBPs",
  expertCalendarIds: (PropertiesService.getScriptProperties().getProperty("EXPERT_CALENDAR_IDS") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  internalRecipient: PropertiesService.getScriptProperties().getProperty("INTERNAL_RECIPIENT") || "rinaldi.rilio@gmail.com",
};

function authorizeFunniFinSetup() {
  const spreadsheet = getRequestsSpreadsheet();
  getRequestsSheet();
  getRequestEventsSheet();

  DriveApp.getFileById(spreadsheet.getId()).getName();
  if (SETTINGS.calendarId) {
    CalendarApp.getCalendarById(SETTINGS.calendarId);
  }
  MailApp.getRemainingDailyQuota();

  return {
    ok: true,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    mailQuota: MailApp.getRemainingDailyQuota(),
  };
}

function doGet(event) {
  try {
    return handleGet(event);
  } catch (error) {
    return errorResponse(error);
  }
}

function handleGet(event) {
  const action = event.parameter.action;
  if (action === "freeBusy") {
    return jsonResponse(handleFreeBusy(event.parameter));
  }
  if (action === "calendarLookup") {
    return jsonResponse(lookupCalendars(event.parameter));
  }
  if (action === "driveFolder") {
    return jsonResponse(listDriveFolder(event.parameter));
  }
  if (action === "brandPresentations") {
    return jsonResponse(listBrandPresentations(event.parameter));
  }
  if (action === "listWorkshopRequests") {
    return jsonResponse(listWorkshopRequests(event.parameter));
  }
  if (action === "createAssetDraftFolder") {
    return jsonResponse(createAssetDraftFolder(event.parameter));
  }
  if (action === "deleteAssetDraftFolder") {
    return jsonResponse(deleteAssetDraftFolder(event.parameter));
  }
  return jsonResponse({
    ok: true,
    service: "FunniFin Workshop Planner",
    actions: ["freeBusy", "calendarLookup", "driveFolder", "brandPresentations", "listWorkshopRequests", "createWorkshopRequest", "updateWorkshopRequest", "createAssetDraftFolder", "deleteAssetDraftFolder", "uploadAssetFile", "createCalendarEvent", "ensurePresentationStructure", "sendWorkshopRequestEmail", "sendWorkflowNotification"],
  });
}

function doPost(event) {
  try {
    return handlePost(event);
  } catch (error) {
    return errorResponse(error);
  }
}

function handlePost(event) {
  const body = parsePostBody(event);
  if (body.action === "createWorkshopRequest") {
    return jsonResponse(createWorkshopRequest(body.payload || {}));
  }
  if (body.action === "updateWorkshopRequest") {
    return jsonResponse(updateWorkshopRequest(body.payload || {}));
  }
  if (body.action === "createCalendarEvent") {
    return jsonResponse(createCalendarEvent(body.payload));
  }
  if (body.action === "sendWorkshopRequestEmail") {
    return jsonResponse(sendWorkshopRequestEmail(body));
  }
  if (body.action === "sendWorkflowNotification") {
    return jsonResponse(sendWorkflowNotification(body.payload));
  }
  if (body.action === "ensurePresentationStructure") {
    return jsonResponse(ensurePresentationStructure(body.payload || {}));
  }
  if (body.action === "uploadAssetFile") {
    return jsonResponse(uploadAssetFile(body.payload || {}));
  }
  throw new Error("Unknown action");
}

function parsePostBody(event) {
  const raw = event.postData && event.postData.contents ? event.postData.contents : "{}";
  const candidates = [
    raw,
    raw.replace(/=+$/, ""),
    decodeURIComponent(raw).replace(/=+$/, ""),
  ];

  for (let index = 0; index < candidates.length; index += 1) {
    try {
      return JSON.parse(candidates[index]);
    } catch (error) {
      // Try the next body shape. Apps Script can add form suffixes depending on the caller.
    }
  }

  throw new Error(`Invalid JSON body: ${raw.slice(0, 200)}`);
}

function handleFreeBusy(params) {
  const date = params.date;
  const duration = params.duration === "2h" ? 120 : 60;
  const calendars = buildCalendarIds(params.expertIds);
  const slots = buildSlots(date, duration, calendars);
  return { source: "google-freebusy", slots };
}

function createCalendarEvent(payload) {
  const calendarId = resolveCalendarId();
  const eventMode = payload.eventMode === "tentative" ? "tentative" : "confirmed";
  const firstWorkshop = payload.workshops[0];
  const start = parseDateTime(firstWorkshop.date, firstWorkshop.time);
  const totalMinutes = payload.workshops.reduce((sum, workshop) => sum + (workshop.duration === "2h" ? 120 : 60), 0);
  const end = new Date(start.getTime() + Math.max(totalMinutes, 60) * 60 * 1000);
  const hasOnlineWorkshop = payload.workshops.some((workshop) => workshop.format === "webinar" || workshop.format === "ibrido");
  const requestId = `funnifin-${payload.projectId}-${Date.now()}`;
  const event = {
    summary: `${eventMode === "tentative" ? "[PROVVISORIO]" : "[CONFERMATO]"} FunniFin Workshop - ${payload.company}`,
    status: eventMode,
    description: buildEventDescription(payload),
    start: { dateTime: start.toISOString(), timeZone: SETTINGS.timezone },
    end: { dateTime: end.toISOString(), timeZone: SETTINGS.timezone },
    attendees: [
      { email: payload.managerEmail, displayName: payload.manager },
      { email: SETTINGS.internalRecipient, displayName: "FunniFin" },
    ],
    extendedProperties: {
      private: {
        projectId: payload.projectId,
        company: payload.company,
      },
    },
  };

  if (hasOnlineWorkshop) {
    event.conferenceData = {
      createRequest: {
        requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const created = insertCalendarEvent(event, calendarId, start, end, payload);

  return {
    source: "google-calendar",
    id: created.id,
    mode: eventMode,
    htmlLink: created.htmlLink,
    meetLink: created.hangoutLink || extractMeetLink(created) || "",
    calendarId,
    fallback: Boolean(created.fallback),
    fallbackReason: created.fallbackReason || "",
    createdAt: Utilities.formatDate(new Date(), SETTINGS.timezone, "dd/MM/yyyy, HH:mm"),
    workshops: payload.workshops.length,
  };
}

function insertCalendarEvent(event, calendarId, start, end, payload) {
  try {
    return Calendar.Events.insert(event, calendarId, {
      conferenceDataVersion: 1,
      sendUpdates: "all",
    });
  } catch (error) {
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      throw new Error(`Calendario non trovato: ${calendarId}. Errore originale: ${error.message || error}`);
    }
    const fallback = calendar.createEvent(event.summary, start, end, {
      description: event.description,
      guests: [payload.managerEmail, SETTINGS.internalRecipient].filter(Boolean).join(","),
      sendInvites: true,
    });
    fallback.setTag("projectId", payload.projectId);
    fallback.setTag("company", payload.company);
    return {
      id: fallback.getId(),
      htmlLink: fallback.getHtmlLink(),
      hangoutLink: "",
      conferenceData: null,
      fallback: true,
      fallbackReason: String(error.message || error),
    };
  }
}

function sendWorkshopRequestEmail(body) {
  MailApp.sendEmail({
    to: body.to,
    cc: body.cc || SETTINGS.internalRecipient,
    subject: body.subject,
    htmlBody: body.html,
    name: "FunniFin Workshop Planner",
  });
  return { sent: true };
}

function sendWorkflowNotification(payload) {
  const recipients = Array.isArray(payload.to) ? payload.to.filter(Boolean) : [];
  if (!recipients.length) {
    throw new Error("Missing notification recipients");
  }

  const subject = buildWorkflowSubject(payload);
  const html = buildWorkflowEmailHtml(payload);
  MailApp.sendEmail({
    to: recipients.join(","),
    subject,
    htmlBody: html,
    name: "FunniFin Workshop Planner",
  });
  return { sent: true, subject, recipients };
}

function createWorkshopRequest(payload) {
  if (!payload.contact || !payload.contact.email || !payload.contact.company) {
    throw new Error("Missing request contact");
  }

  const now = new Date();
  const request = normalizeWorkshopRequest({
    id: payload.id || buildRequestId(payload.contact.company, now),
    contact: payload.contact,
    company: payload.contact.company,
    manager: [payload.contact.firstName, payload.contact.lastName].filter(Boolean).join(" ").trim() || payload.contact.email,
    email: payload.contact.email,
    phone: payload.contact.phone || "",
    status: "richiesta_inviata",
    quoteTotal: Number(payload.quote && payload.quote.total ? payload.quote.total : 0),
    workshopIds: (payload.workshops || []).map((workshop) => workshop.workshopId).filter(Boolean),
    dateCount: (payload.workshops || []).filter((workshop) => workshop.date).length,
    contact: payload.contact,
    workshops: payload.workshops || [],
    quote: payload.quote || {},
    materials: payload.materials || {},
    createdAt: formatTimestamp(now),
    updatedAt: formatTimestamp(now),
  });

  const sheet = getRequestsSheet();
  sheet.appendRow(requestToRow(request));
  appendRequestEvent(request.id, "request_created", `Richiesta cliente creata per ${request.company}`, request);

  return {
    ok: true,
    source: "google-sheet",
    request,
  };
}

function listWorkshopRequests(params) {
  const sheet = getRequestsSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { ok: true, source: "google-sheet", requests: [] };

  const requests = rows.slice(1)
    .map(rowToRequest)
    .filter(Boolean)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));

  const status = params && params.status ? String(params.status) : "";
  return {
    ok: true,
    source: "google-sheet",
    requests: status ? requests.filter((request) => request.status === status) : requests,
  };
}

function updateWorkshopRequest(payload) {
  if (!payload.requestId) throw new Error("Missing requestId");

  const sheet = getRequestsSheet();
  const rows = sheet.getDataRange().getValues();
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === payload.requestId);
  if (rowIndex < 1) throw new Error(`Request not found: ${payload.requestId}`);

  const current = rowToRequest(rows[rowIndex]);
  const merged = normalizeWorkshopRequest(Object.assign({}, current, payload.patch || {}, {
    updatedAt: formatTimestamp(new Date()),
  }));
  sheet.getRange(rowIndex + 1, 1, 1, REQUEST_HEADERS.length).setValues([requestToRow(merged)]);

  if (payload.event) {
    appendRequestEvent(
      merged.id,
      payload.event.type || "request_updated",
      payload.event.note || `Richiesta aggiornata: ${merged.status}`,
      payload.event.payload || payload.patch || {},
    );
  } else {
    appendRequestEvent(merged.id, "request_updated", `Richiesta aggiornata: ${merged.status}`, payload.patch || {});
  }

  return {
    ok: true,
    source: "google-sheet",
    request: merged,
  };
}

const REQUEST_HEADERS = [
  "id",
  "company",
  "manager",
  "email",
  "phone",
  "status",
  "quoteTotal",
  "workshopIds",
  "dateCount",
  "assignedExpert",
  "createdAt",
  "updatedAt",
  "payloadJson",
];

const REQUEST_EVENT_HEADERS = [
  "timestamp",
  "requestId",
  "type",
  "note",
  "payloadJson",
];

function getRequestsSpreadsheet() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = SETTINGS.requestSpreadsheetId || properties.getProperty("REQUEST_SPREADSHEET_ID") || "";
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  const spreadsheet = SpreadsheetApp.create("FunniFin Workshop Requests");
  spreadsheetId = spreadsheet.getId();
  properties.setProperty("REQUEST_SPREADSHEET_ID", spreadsheetId);
  SETTINGS.requestSpreadsheetId = spreadsheetId;
  return spreadsheet;
}

function getRequestsSheet() {
  const spreadsheet = getRequestsSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, "Requests", REQUEST_HEADERS);
  ensureHeaderRow(sheet, REQUEST_HEADERS);
  return sheet;
}

function getRequestEventsSheet() {
  const spreadsheet = getRequestsSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, "Events", REQUEST_EVENT_HEADERS);
  ensureHeaderRow(sheet, REQUEST_EVENT_HEADERS);
  return sheet;
}

function getOrCreateSheet(spreadsheet, name, headers) {
  const existing = spreadsheet.getSheetByName(name);
  const sheet = existing || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);
  return sheet;
}

function ensureHeaderRow(sheet, headers) {
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const matches = headers.every((header, index) => current[index] === header);
  if (!matches) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

function requestToRow(request) {
  return [
    sheetText(request.id),
    sheetText(request.company),
    sheetText(request.manager),
    sheetText(request.email),
    sheetText(request.phone),
    sheetText(request.status),
    request.quoteTotal,
    sheetText((request.workshopIds || []).join(",")),
    request.dateCount,
    sheetText(request.assignedExpert || ""),
    sheetText(request.createdAt),
    sheetText(request.updatedAt),
    sheetText(JSON.stringify(request)),
  ];
}

function sheetText(value) {
  const text = String(value == null ? "" : value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function rowToRequest(row) {
  try {
    const payload = row[12] ? JSON.parse(row[12]) : {};
    return normalizeWorkshopRequest(Object.assign({}, payload, {
      id: row[0] || payload.id,
      company: row[1] || payload.company,
      manager: row[2] || payload.manager,
      email: row[3] || payload.email,
      phone: payload.phone || row[4],
      status: row[5] || payload.status,
      quoteTotal: Number(row[6] || payload.quoteTotal || 0),
      workshopIds: row[7] ? String(row[7]).split(",").filter(Boolean) : payload.workshopIds,
      dateCount: Number(row[8] || payload.dateCount || 0),
      assignedExpert: row[9] || payload.assignedExpert || "",
      createdAt: row[10] || payload.createdAt,
      updatedAt: row[11] || payload.updatedAt,
    }));
  } catch (error) {
    return null;
  }
}

function normalizeWorkshopRequest(request) {
  const workshops = (request.workshops || []).map((workshop) => ({
    workshopId: workshop.workshopId || workshop.id || "",
    title: workshop.title || "",
    duration: workshop.duration || "1h",
    format: workshop.format || "webinar",
    date: workshop.date || "",
    time: workshop.time || "",
    price: Number(workshop.price || 0),
    custom: Boolean(workshop.custom),
    customNote: workshop.customNote || "",
    status: workshop.status || "selezionato",
    approval: workshop.approval || "pending",
    expertName: workshop.expertName || "",
  }));
  const contact = request.contact || {};
  const quote = request.quote || {};
  return {
    id: request.id || buildRequestId(contact.company || request.company || "cliente", new Date()),
    company: request.company || contact.company || "Cliente",
    manager: request.manager || [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || contact.email || "Referente",
    email: request.email || contact.email || "",
    phone: request.phone || contact.phone || "",
    status: request.status || "richiesta_inviata",
    quoteTotal: Number(request.quoteTotal || quote.total || 0),
    workshopIds: request.workshopIds && request.workshopIds.length ? request.workshopIds : workshops.map((workshop) => workshop.workshopId).filter(Boolean),
    dateCount: Number(request.dateCount || workshops.filter((workshop) => workshop.date).length),
    assignedExpert: request.assignedExpert || "",
    createdAt: request.createdAt || formatTimestamp(new Date()),
    updatedAt: request.updatedAt || formatTimestamp(new Date()),
    contact: {
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      email: contact.email || request.email || "",
      company: contact.company || request.company || "",
      phone: contact.phone || request.phone || "",
    },
    workshops,
    quote: {
      gross: Number(quote.gross || 0),
      discount: Number(quote.discount || 0),
      promoDiscount: Number(quote.promoDiscount || 0),
      customTotal: Number(quote.customTotal || 0),
      total: Number(quote.total || request.quoteTotal || 0),
      saved: Number(quote.saved || 0),
      packageName: quote.packageName || "",
    },
    materials: request.materials || {},
    calendarEvent: request.calendarEvent || null,
  };
}

function appendRequestEvent(requestId, type, note, payload) {
  const sheet = getRequestEventsSheet();
  sheet.appendRow([
    formatTimestamp(new Date()),
    requestId,
    type,
    note || "",
    JSON.stringify(payload || {}),
  ]);
}

function buildRequestId(company, date) {
  const normalizedCompany = sanitizeDriveName(company || "cliente")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "cliente";
  return `${normalizedCompany}-${Utilities.formatDate(date, SETTINGS.timezone, "yyyyMMdd-HHmmss")}`;
}

function formatTimestamp(date) {
  return Utilities.formatDate(date, SETTINGS.timezone, "yyyy-MM-dd HH:mm:ss");
}

function buildCalendarIds(expertIds) {
  const requested = (expertIds || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const calendars = [resolveCalendarId()].concat(requested.length ? requested : SETTINGS.expertCalendarIds);
  return Array.from(new Set(calendars));
}

function resolveCalendarId() {
  if (SETTINGS.calendarId) {
    return SETTINGS.calendarId;
  }

  if (SETTINGS.calendarName) {
    const matches = CalendarApp.getCalendarsByName(SETTINGS.calendarName);
    if (matches.length) {
      return matches[0].getId();
    }
    const normalizedTarget = normalizeCalendarName(SETTINGS.calendarName);
    const normalizedMatch = CalendarApp.getAllCalendars().find((calendar) => normalizeCalendarName(calendar.getName()) === normalizedTarget);
    if (normalizedMatch) {
      return normalizedMatch.getId();
    }
  }

  throw new Error("Missing FUNNIFIN_CALENDAR_ID");
}

function lookupCalendars(params) {
  const listAll = params.all === "1" || params.all === "true";
  const name = listAll ? "" : params.name || SETTINGS.calendarName;
  const calendars = listAll ? CalendarApp.getAllCalendars() : CalendarApp.getCalendarsByName(name);
  const normalizedTarget = name ? normalizeCalendarName(name) : "";
  const normalizedMatches = name
    ? CalendarApp.getAllCalendars().filter((calendar) => normalizeCalendarName(calendar.getName()) === normalizedTarget)
    : [];
  const merged = calendars.concat(normalizedMatches).filter((calendar, index, list) =>
    list.findIndex((item) => item.getId() === calendar.getId()) === index,
  );
  return {
    source: "google-calendar",
    query: name || "all",
    calendars: merged.map((calendar) => ({
      id: calendar.getId(),
      name: calendar.getName(),
      timezone: calendar.getTimeZone(),
    })),
  };
}

function normalizeCalendarName(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function sanitizeDriveName(value) {
  return String(value || "file")
    .replace(/[\\/:*?"<>|#%{}~&]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function listDriveFolder(params) {
  const folderId = params.folderId || SETTINGS.slidesRootFolderId || SETTINGS.driveRootFolderId;
  if (!folderId) {
    throw new Error("Missing folderId or SLIDES_ROOT_FOLDER_ID");
  }

  const folder = DriveApp.getFolderById(folderId);
  const folders = [];
  const files = [];
  const childFolders = folder.getFolders();
  const childFiles = folder.getFiles();

  while (childFolders.hasNext()) {
    const child = childFolders.next();
    folders.push({
      id: child.getId(),
      name: child.getName(),
      url: child.getUrl(),
      type: "folder",
      role: classifyDriveItem(child.getName()),
    });
  }

  while (childFiles.hasNext()) {
    const child = childFiles.next();
    files.push({
      id: child.getId(),
      name: child.getName(),
      url: child.getUrl(),
      mimeType: child.getMimeType(),
      type: child.getMimeType() === MimeType.GOOGLE_SLIDES ? "presentation" : "file",
      role: classifyDriveItem(child.getName()),
    });
  }

  return {
    source: "google-drive",
    folder: {
      id: folder.getId(),
      name: folder.getName(),
      url: folder.getUrl(),
    },
    folders,
    files,
  };
}

function ensurePresentationStructure(payload) {
  const rootId = payload.folderId || SETTINGS.slidesRootFolderId || SETTINGS.driveRootFolderId;
  if (!rootId) {
    throw new Error("Missing folderId or SLIDES_ROOT_FOLDER_ID");
  }

  const root = DriveApp.getFolderById(rootId);
  const names = payload.folders || [
    "01 Master workshop",
    "02 Preparazione esperti",
    "03 Revisione brand",
    "04 Versioni finali",
    "05 Archivio",
  ];

  const folders = names.map((name) => {
    const existing = root.getFoldersByName(name);
    const folder = existing.hasNext() ? existing.next() : root.createFolder(name);
    return {
      id: folder.getId(),
      name: folder.getName(),
      url: folder.getUrl(),
      role: classifyDriveItem(folder.getName()),
    };
  });

  return {
    source: "google-drive",
    rootFolderId: root.getId(),
    rootFolderUrl: root.getUrl(),
    folders,
  };
}

function createAssetDraftFolder(params) {
  const parentId = params.parentId || SETTINGS.driveRootFolderId || SETTINGS.slidesRootFolderId;
  if (!parentId) {
    throw new Error("Missing DRIVE_ROOT_FOLDER_ID or SLIDES_ROOT_FOLDER_ID");
  }

  const parent = DriveApp.getFolderById(parentId);
  const clientName = sanitizeDriveName(params.clientName || "cliente");
  const dateStamp = Utilities.formatDate(new Date(), SETTINGS.timezone, "dd-MM-yyyy");
  const folderName = `${clientName} ${dateStamp}`;
  const folder = parent.createFolder(folderName);

  return {
    source: "google-drive",
    id: folder.getId(),
    name: folder.getName(),
    url: folder.getUrl(),
  };
}

function uploadAssetFile(payload) {
  if (!payload.folderId || !payload.fileName || !payload.data) {
    throw new Error("Missing folderId, fileName or data");
  }

  const folder = DriveApp.getFolderById(payload.folderId);
  const bytes = Utilities.base64Decode(payload.data);
  const blob = Utilities.newBlob(bytes, payload.mimeType || "application/octet-stream", sanitizeDriveName(payload.fileName));
  const file = folder.createFile(blob);

  return {
    source: "google-drive",
    id: file.getId(),
    name: file.getName(),
    url: file.getUrl(),
    folderId: folder.getId(),
  };
}

function deleteAssetDraftFolder(params) {
  if (!params.folderId) {
    throw new Error("Missing folderId");
  }

  const folder = DriveApp.getFolderById(params.folderId);
  folder.setTrashed(true);
  return {
    source: "google-drive",
    deleted: true,
    folderId: params.folderId,
  };
}

function listBrandPresentations(params) {
  const folderId = params.folderId || SETTINGS.slidesRootFolderId || SETTINGS.driveRootFolderId;
  if (!folderId) {
    throw new Error("Missing folderId or SLIDES_ROOT_FOLDER_ID");
  }

  const root = DriveApp.getFolderById(folderId);
  const seenIds = {};
  const presentations = collectPresentations(root, 0, root.getName())
    .filter((presentation) => {
      if (seenIds[presentation.id]) return false;
      seenIds[presentation.id] = true;
      return true;
    })
    .sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")),
  );

  return {
    source: "google-drive",
    folder: {
      id: root.getId(),
      name: root.getName(),
      url: root.getUrl(),
    },
    presentations,
  };
}

function collectPresentations(folder, depth, folderPath) {
  if (depth > 4) return [];

  const presentations = [];
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const deckFile = resolveDeckAsset(file);
    if (deckFile) {
      presentations.push(buildPresentationRecord(deckFile, folder.getName(), folderPath));
    }
  }

  const folders = folder.getFolders();
  while (folders.hasNext()) {
    const child = folders.next();
    presentations.push.apply(presentations, collectPresentations(child, depth + 1, `${folderPath} / ${child.getName()}`));
  }

  return presentations;
}

function resolveDeckAsset(file) {
  if (isDeckAsset(file)) return file;
  if (file.getMimeType() !== "application/vnd.google-apps.shortcut") return null;

  try {
    const targetId = file.getTargetId();
    if (!targetId) return null;
    const target = DriveApp.getFileById(targetId);
    return isDeckAsset(target) ? target : null;
  } catch (error) {
    return null;
  }
}

function isDeckAsset(file) {
  const mimeType = file.getMimeType();
  return [
    MimeType.GOOGLE_SLIDES,
    "application/vnd.google-apps.presentation",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    "application/pdf",
  ].indexOf(mimeType) !== -1;
}

function buildPresentationRecord(file, folderName, folderPath) {
  const title = file.getName();
  const parsed = parsePresentationName(title);
  const mimeType = file.getMimeType();
  const isGoogleSlides = mimeType === MimeType.GOOGLE_SLIDES || mimeType === "application/vnd.google-apps.presentation";
  return {
    id: file.getId(),
    title,
    client: parsed.client,
    workshop: parsed.workshop,
    expert: parsed.expert,
    status: inferBrandPresentationStatus(title, folderName, folderPath),
    version: parsed.version,
    url: file.getUrl(),
    mimeType,
    previewUrl: isGoogleSlides
      ? `https://docs.google.com/presentation/d/${file.getId()}/preview`
      : `https://drive.google.com/file/d/${file.getId()}/preview`,
    folderName,
    folderPath,
    updatedAt: Utilities.formatDate(file.getLastUpdated(), SETTINGS.timezone, "dd/MM/yyyy, HH:mm"),
  };
}

function parsePresentationName(name) {
  const clean = String(name || "").replace(/\.[^.]+$/, "").trim();
  const versionMatch = clean.match(/(?:^|[_\-\s])v(?:ersione)?\s?(\d{1,2})(?:$|[_\-\s])/i);
  const version = versionMatch ? Number(versionMatch[1]) : 1;
  const tokens = clean
    .replace(/(?:^|[_\-\s])v(?:ersione)?\s?\d{1,2}(?:$|[_\-\s])/i, " ")
    .split(/[_\-|]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    client: tokens[1] || tokens[0] || "Cliente da file",
    workshop: tokens[0] || clean || "Presentazione",
    expert: tokens[2] || "Da assegnare",
    version,
  };
}

function inferBrandPresentationStatus(title, folderName, folderPath) {
  const normalized = `${title} ${folderName} ${folderPath}`.toLowerCase();
  if (normalized.includes("archiv")) return "archived";
  if (normalized.includes("final") || normalized.includes("approv")) return "approved";
  if (normalized.includes("correg") || normalized.includes("modific") || normalized.includes("change")) return "changes_requested";
  return "in_review";
}

function classifyDriveItem(name) {
  const normalized = String(name || "").toLowerCase();
  if (normalized.includes("master")) return "master";
  if (normalized.includes("brand") || normalized.includes("[rev]") || normalized.includes("revisione")) return "brand_review";
  if (normalized.includes("esper") || normalized.includes("[doing]") || normalized.includes("[to do]") || normalized.includes("preparazione")) return "expert_working";
  if (normalized.includes("final")) return "final";
  if (normalized.includes("archiv")) return "archive";
  return "general";
}

function buildSlots(date, durationMinutes, calendars) {
  const items = calendars.map((id) => ({ id }));
  const timeMin = new Date(`${date}T08:00:00+01:00`);
  const timeMax = new Date(`${date}T23:59:00+01:00`);
  const busy = Calendar.Freebusy.query({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    timeZone: SETTINGS.timezone,
    items,
  }).calendars;

  const slots = [];
  for (let hour = 8; hour <= 23; hour += 1) {
    const slotStart = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+01:00`);
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
    const isBusy = Object.keys(busy).some((calendarId) =>
      (busy[calendarId].busy || []).some((range) => overlaps(slotStart, slotEnd, new Date(range.start), new Date(range.end))),
    );
    slots.push({
      time: `${String(hour).padStart(2, "0")}:00`,
      status: isBusy ? "busy" : isPromoSlot(slotStart) ? "promo" : "available",
    });
  }
  return slots;
}

function parseDateTime(date, time) {
  return new Date(`${date}T${time || "10:00"}:00+01:00`);
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

function isPromoSlot(date) {
  const day = date.getDay();
  const hour = date.getHours();
  return (day === 2 && hour < 12) || (day === 5 && hour >= 14);
}

function buildEventDescription(payload) {
  const workshops = payload.workshops
    .map((workshop) => `- ${workshop.title} (${workshop.duration}, ${workshop.format}) - ${workshop.expertName || "esperto da confermare"}`)
    .join("\n");
  return [
    `Cliente: ${payload.company}`,
    `Referente: ${payload.manager} - ${payload.managerEmail} - ${payload.managerPhone}`,
    `Preventivo: ${payload.quoteTotal} EUR + IVA`,
    "",
    "Workshop:",
    workshops,
    payload.driveFolderUrl ? `\nDrive: ${payload.driveFolderUrl}` : "",
    payload.finalDeckUrl ? `Deck finale: ${payload.finalDeckUrl}` : "",
  ].filter(Boolean).join("\n");
}

function buildWorkflowSubject(payload) {
  const labels = {
    request_received: "Richiesta ricevuta",
    request_updated: "Richiesta modificata",
    dates_approved: "Date approvate",
    date_change_requested: "Modifica date richiesta",
    candidacies_open: "Candidature esperti aperte",
    expert_assigned: "Esperto assegnato",
    brand_review: "Revisione brand avviata",
    final_approval: "Approvazione finale",
    event_tentative: "Evento provvisorio creato",
    event_confirmed: "Evento confermato",
  };
  return `FunniFin - ${labels[payload.phase] || "Aggiornamento progetto"} - ${payload.project.company}`;
}

function buildWorkflowEmailHtml(payload) {
  const copy = workflowCopy(payload);
  const workshops = (payload.workshops || [])
    .map((workshop) => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e0e3e3;">
          <strong style="color:#171d1d;">${escapeHtml(workshop.title)}</strong><br>
          <span style="color:#747878;">${escapeHtml(workshop.date || "data da definire")} · ${escapeHtml(workshop.time || "")} · ${escapeHtml(workshop.duration)} · ${escapeHtml(workshop.format)}</span>
        </td>
        <td style="padding:12px;border-bottom:1px solid #e0e3e3;text-align:right;color:#004f54;font-family:Caveat,Nunito,Arial,sans-serif;font-size:24px;font-weight:700;">${escapeHtml(workshop.expertName || "da assegnare")}</td>
      </tr>
    `)
    .join("");
  const eventBlock = payload.event && (payload.event.htmlLink || payload.event.meetLink)
    ? `
      <div style="margin-top:18px;padding:16px;border-radius:18px;background:#e8f8f9;">
        <strong style="display:block;margin-bottom:8px;color:#004f54;">Evento ${payload.event.mode === "tentative" ? "provvisorio" : "definitivo"}</strong>
        ${payload.event.htmlLink ? `<a style="color:#15969e;font-weight:800;" href="${payload.event.htmlLink}">Apri evento Calendar</a><br>` : ""}
        ${payload.event.meetLink ? `<a style="color:#15969e;font-weight:800;" href="${payload.event.meetLink}">Apri Google Meet</a>` : ""}
      </div>
    `
    : "";

  return `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap');
    </style>
    <div style="margin:0;padding:24px;background:#f5fafb;font-family:Nunito,Arial,sans-serif;color:#171d1d;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d4edf2;border-radius:24px;overflow:hidden;">
        <tr>
          <td style="padding:28px;background:#e8f8f9;">
            <div style="width:48px;height:48px;border-radius:16px;background:#1cafb9;color:white;display:inline-block;text-align:center;line-height:48px;font-weight:900;font-size:26px;">F</div>
            <h1 style="margin:16px 0 6px;font-size:28px;line-height:1.1;color:#004f54;">${escapeHtml(copy.title)}</h1>
            <p style="margin:0;color:#444748;">${escapeHtml(copy.subtitle)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <h2 style="margin:0 0 12px;font-size:18px;color:#004f54;">${escapeHtml(payload.project.company)}</h2>
            <p style="margin:0 0 18px;color:#444748;">
              Referente: ${escapeHtml(payload.project.manager)} · ${escapeHtml(payload.project.email)}<br>
              Stato: ${escapeHtml(payload.project.status)} · Preventivo: ${escapeHtml(String(payload.project.quoteTotal))} EUR + IVA
            </p>
            <div style="margin:0 0 18px;padding:16px;border-radius:18px;background:#fff8dd;color:#444748;">
              ${escapeHtml(copy.body)}
              ${payload.note ? `<br><br><strong>Nota:</strong> ${escapeHtml(payload.note)}` : ""}
            </div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e0e3e3;border-radius:16px;overflow:hidden;">
              ${workshops}
            </table>
            ${eventBlock}
          </td>
        </tr>
      </table>
    </div>`;
}

function workflowCopy(payload) {
  const map = {
    request_received: {
      title: "Richiesta workshop ricevuta",
      subtitle: "FunniFin ha preso in carico la richiesta.",
      body: "Il team verifica workshop, prezzo, date e fattibilita operativa.",
    },
    request_updated: {
      title: "Richiesta workshop aggiornata",
      subtitle: "FunniFin ha modificato la configurazione operativa.",
      body: "Il team ha aggiornato workshop, date o preventivo della richiesta. La versione attuale e quella riportata qui sotto.",
    },
    dates_approved: {
      title: "Date approvate",
      subtitle: "Le date proposte sono state validate.",
      body: "Il progetto puo avanzare verso la selezione degli esperti compatibili.",
    },
    date_change_requested: {
      title: "Serve una modifica alle date",
      subtitle: "Una o piu date richiedono una nuova proposta.",
      body: "FunniFin ha richiesto una modifica prima di aprire le candidature agli esperti.",
    },
    candidacies_open: {
      title: "Candidature esperti aperte",
      subtitle: "Gli esperti compatibili possono candidarsi.",
      body: "FunniFin raccogliera le disponibilita e procedera con l'assegnazione.",
    },
    expert_assigned: {
      title: "Esperto assegnato",
      subtitle: "Il workshop ha un esperto incaricato.",
      body: "L'esperto riceve date, contesto cliente e materiali necessari alla preparazione.",
    },
    brand_review: {
      title: "Revisione brand avviata",
      subtitle: "Il materiale passa al controllo qualita.",
      body: "Brand/design puo revisionare, richiedere modifiche o approvare la versione.",
    },
    final_approval: {
      title: "Approvazione finale",
      subtitle: "La versione finale e pronta per il controllo conclusivo.",
      body: "FunniFin e cliente possono validare la versione finale prima della conferma evento.",
    },
    event_tentative: {
      title: "Evento provvisorio creato",
      subtitle: "La data e stata bloccata a calendario.",
      body: "L'evento resta provvisorio fino alla conferma finale.",
    },
    event_confirmed: {
      title: "Evento confermato",
      subtitle: "Il workshop e confermato a calendario.",
      body: "L'evento contiene invitati, link Meet e riferimenti ai materiali.",
    },
  };
  return map[payload.phase] || map.request_received;
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function extractMeetLink(event) {
  const points = event.conferenceData && event.conferenceData.entryPoints ? event.conferenceData.entryPoints : [];
  const meet = points.find((point) => point.entryPointType === "video");
  return meet ? meet.uri : "";
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(error) {
  return jsonResponse({
    ok: false,
    error: error && error.message ? error.message : String(error),
  });
}

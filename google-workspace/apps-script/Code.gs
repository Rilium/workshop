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

const AUTH_SEED_USERS = [
  {
    id: "user-funnifin",
    email: "rinaldi.rilio@gmail.com",
    actualRole: "FunniFin",
    displayName: "Team FunniFin",
    createdAt: "2024-01-01T00:00:00",
    disabled: false,
  },
  {
    id: "user-esperto-laura",
    email: "rinaldi.rilio+3@gmail.com",
    actualRole: "Esperto",
    expertId: "laura-bianchi",
    displayName: "Laura Bianchi",
    createdAt: "2024-01-01T00:00:00",
    disabled: false,
  },
  {
    id: "user-brand",
    email: "rinaldi.rilio+4@gmail.com",
    actualRole: "Brand",
    displayName: "Brand Review",
    createdAt: "2024-01-01T00:00:00",
    disabled: false,
  },
];

function authorizeFunniFinSetup() {
  const spreadsheet = getRequestsSpreadsheet();
  getRequestsSheet();
  getRequestEventsSheet();
  getAuthUsersSheet();
  getAccessRequestsSheet();
  getAuthSessionsSheet();
  getCatalogTopicsSheet();
  getCatalogWorkshopsSheet();
  getPricingRulesSheet();
  getExpertsSheet();
  getSettingsSheet();
  seedAuthUsersIfNeeded();

  DriveApp.getFileById(spreadsheet.getId()).getName();
  const runtimeCalendarId = getRuntimeCalendarId();
  if (runtimeCalendarId) {
    CalendarApp.getCalendarById(runtimeCalendarId);
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
    requireFunniFinSession(event.parameter);
    return jsonResponse(lookupCalendars(event.parameter));
  }
  if (action === "driveFolder") {
    requireSession(event.parameter, ["FunniFin", "Brand", "Esperto"]);
    return jsonResponse(listDriveFolder(event.parameter));
  }
  if (action === "brandPresentations") {
    requireSession(event.parameter, ["FunniFin", "Brand"]);
    return jsonResponse(listBrandPresentations(event.parameter));
  }
  if (action === "listWorkshopRequests") {
    requireSession(event.parameter, ["FunniFin", "Esperto", "Brand"]);
    return jsonResponse(listWorkshopRequests(event.parameter));
  }
  if (action === "listCatalogConfig") {
    requireFunniFinSession(event.parameter);
    return jsonResponse(listCatalogConfig());
  }
  if (action === "listCatalogWorkshops") {
    requireFunniFinSession(event.parameter);
    return jsonResponse(listCatalogWorkshops());
  }
  if (action === "listPricingRules") {
    requireFunniFinSession(event.parameter);
    return jsonResponse(listPricingRules());
  }
  if (action === "listExperts") {
    requireSession(event.parameter, ["FunniFin", "Esperto"]);
    return jsonResponse(listExperts());
  }
  if (action === "listWorkspaceSettings") {
    requireFunniFinSession(event.parameter);
    return jsonResponse(listWorkspaceSettings());
  }
  if (action === "listAuthUsers") {
    requireFunniFinSession(event.parameter);
    return jsonResponse(listAuthUsers());
  }
  if (action === "listAccessRequests") {
    requireFunniFinSession(event.parameter);
    return jsonResponse(listAccessRequests());
  }
  if (action === "googleHealth") {
    requireFunniFinSession(event.parameter);
    return jsonResponse(getGoogleHealth(event.parameter));
  }
  if (action === "listAdminConfig") {
    requireFunniFinSession(event.parameter);
    return jsonResponse(listAdminConfig());
  }
  if (action === "createAssetDraftFolder") {
    return jsonResponse(createAssetDraftFolder(event.parameter));
  }
  if (action === "deleteAssetDraftFolder") {
    requireSession(event.parameter, ["FunniFin", "Esperto", "Brand"]);
    return jsonResponse(deleteAssetDraftFolder(event.parameter));
  }
  return jsonResponse({
    ok: true,
    service: "FunniFin Workshop Planner",
    actions: ["freeBusy", "calendarLookup", "driveFolder", "brandPresentations", "listWorkshopRequests", "listCatalogConfig", "listCatalogWorkshops", "listPricingRules", "listExperts", "listWorkspaceSettings", "listAuthUsers", "listAccessRequests", "googleHealth", "listAdminConfig", "createWorkshopRequest", "updateWorkshopRequest", "updateCatalogTopic", "updateCatalogWorkshop", "updatePricingRule", "updateExpert", "deleteExpert", "updateWorkspaceSetting", "seedAdminConfig", "createAssetDraftFolder", "deleteAssetDraftFolder", "uploadAssetFile", "createCalendarEvent", "ensurePresentationStructure", "sendWorkshopRequestEmail", "sendWorkflowNotification", "requestLoginCode", "verifyLoginCode", "reviewAccessRequest", "updateAuthUser"],
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
    requireSession(body.payload || {}, ["FunniFin", "Esperto", "Brand"]);
    return jsonResponse(updateWorkshopRequest(body.payload || {}));
  }
  if (body.action === "updateCatalogTopic") {
    requireFunniFinSession(body.payload || {});
    return jsonResponse(updateCatalogTopic(body.payload || {}));
  }
  if (body.action === "updateCatalogWorkshop") {
    requireFunniFinSession(body.payload || {});
    return jsonResponse(updateCatalogWorkshop(body.payload || {}));
  }
  if (body.action === "updatePricingRule") {
    requireFunniFinSession(body.payload || {});
    return jsonResponse(updatePricingRule(body.payload || {}));
  }
  if (body.action === "updateExpert") {
    requireFunniFinSession(body.payload || {});
    return jsonResponse(updateExpert(body.payload || {}));
  }
  if (body.action === "deleteExpert") {
    requireFunniFinSession(body.payload || {});
    return jsonResponse(deleteExpert(body.payload || {}));
  }
  if (body.action === "updateWorkspaceSetting") {
    requireFunniFinSession(body.payload || {});
    return jsonResponse(updateWorkspaceSetting(body.payload || {}));
  }
  if (body.action === "seedAdminConfig") {
    requireFunniFinSessionOrSetupSecret(body.payload || {});
    return jsonResponse(seedAdminConfig(body.payload || {}));
  }
  if (body.action === "createCalendarEvent") {
    requireFunniFinSession(body.payload || {});
    return jsonResponse(createCalendarEvent(body.payload));
  }
  if (body.action === "sendWorkshopRequestEmail") {
    return jsonResponse(sendWorkshopRequestEmail(body));
  }
  if (body.action === "sendWorkflowNotification") {
    requireSession(body.payload || {}, ["FunniFin", "Esperto", "Brand"]);
    return jsonResponse(sendWorkflowNotification(body.payload));
  }
  if (body.action === "requestLoginCode") {
    return jsonResponse(requestLoginCode(body.payload || {}));
  }
  if (body.action === "verifyLoginCode") {
    return jsonResponse(verifyLoginCode(body.payload || {}));
  }
  if (body.action === "reviewAccessRequest") {
    requireFunniFinSession(body.payload || {});
    return jsonResponse(reviewAccessRequest(body.payload || {}));
  }
  if (body.action === "updateAuthUser") {
    requireFunniFinSession(body.payload || {});
    return jsonResponse(updateAuthUser(body.payload || {}));
  }
  if (body.action === "ensurePresentationStructure") {
    requireFunniFinSession(body.payload || {});
    return jsonResponse(ensurePresentationStructure(body.payload || {}));
  }
  if (body.action === "uploadAssetFile") {
    return jsonResponse(uploadAssetFile(body.payload || {}));
  }
  throw new Error("Unknown action");
}

function parsePostBody(event) {
  const raw = event.postData && event.postData.contents ? event.postData.contents : "{}";
  const candidates = [raw, raw.replace(/=+$/, "")];
  try {
    candidates.push(decodeURIComponent(raw).replace(/=+$/, ""));
  } catch (error) {
    // Plain JSON bodies can legitimately contain percent signs in HTML/CSS.
  }

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
  const existingEventId = payload.existingEventId || payload.eventId || "";
  const firstWorkshop = payload.workshops[0];
  const start = parseDateTime(firstWorkshop.date, firstWorkshop.time);
  const totalMinutes = payload.workshops.reduce((sum, workshop) => sum + (workshop.duration === "2h" ? 120 : 60), 0);
  const end = new Date(start.getTime() + Math.max(totalMinutes, 60) * 60 * 1000);
  const hasOnlineWorkshop = payload.workshops.some((workshop) => workshop.format === "webinar" || workshop.format === "ibrido");
  const event = buildCalendarEvent(payload, eventMode, start, end, hasOnlineWorkshop, existingEventId);
  const created = existingEventId ? updateCalendarEvent(existingEventId, event, calendarId, payload) : insertCalendarEvent(event, calendarId, start, end, payload);

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

function buildCalendarEvent(payload, eventMode, start, end, hasOnlineWorkshop, existingEventId) {
  const requestId = `funnifin-${payload.projectId}-${Date.now()}`;
  const event = {
    summary: `${eventMode === "tentative" ? "[PROVVISORIO]" : "[CONFERMATO]"} FunniFin Workshop - ${payload.company}`,
    status: eventMode,
    description: buildEventDescription(payload),
    start: { dateTime: start.toISOString(), timeZone: SETTINGS.timezone },
    end: { dateTime: end.toISOString(), timeZone: SETTINGS.timezone },
    attendees: [
      ...(payload.includeClientInCalendar === false ? [] : [{ email: payload.managerEmail, displayName: payload.manager }]),
      { email: getRuntimeInternalRecipient(), displayName: "FunniFin" },
    ],
    extendedProperties: {
      private: {
        projectId: payload.projectId,
        company: payload.company,
      },
    },
  };

  if (eventMode === "confirmed" && hasOnlineWorkshop) {
    event.conferenceData = {
      createRequest: {
        requestId: existingEventId ? `${requestId}-confirm` : requestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  return event;
}

function insertCalendarEvent(event, calendarId, start, end, payload) {
  const sendCalendarInvites = Boolean(payload.sendCalendarInvites);
  try {
    return Calendar.Events.insert(event, calendarId, {
      conferenceDataVersion: 1,
      sendUpdates: sendCalendarInvites ? "all" : "none",
    });
  } catch (error) {
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      throw new Error(`Calendario non trovato: ${calendarId}. Errore originale: ${error.message || error}`);
    }
    const fallback = calendar.createEvent(event.summary, start, end, {
      description: event.description,
      guests: [payload.includeClientInCalendar === false ? "" : payload.managerEmail, getRuntimeInternalRecipient()].filter(Boolean).join(","),
      sendInvites: sendCalendarInvites,
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

function updateCalendarEvent(eventId, event, calendarId, payload) {
  const sendCalendarInvites = Boolean(payload.sendCalendarInvites);
  const existing = Calendar.Events.get(calendarId, eventId);
  const patch = {
    summary: event.summary,
    status: event.status,
    description: event.description,
    start: event.start,
    end: event.end,
    attendees: event.attendees,
    extendedProperties: event.extendedProperties,
  };
  if (event.conferenceData) {
    patch.conferenceData = event.conferenceData;
  }
  try {
    return Calendar.Events.patch(patch, calendarId, eventId, {
      conferenceDataVersion: 1,
      sendUpdates: sendCalendarInvites ? "all" : "none",
    });
  } catch (error) {
    if (!existing) {
      throw new Error(`Evento non trovato: ${eventId}. Errore originale: ${error.message || error}`);
    }
    existing.setTitle(event.summary);
    existing.setDescription(event.description);
    existing.setTime(new Date(event.start.dateTime), new Date(event.end.dateTime));
    return {
      id: existing.getId(),
      htmlLink: existing.getHtmlLink(),
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
    cc: body.cc || getRuntimeInternalRecipient(),
    subject: body.subject,
    body: body.text || stripHtml(body.html || ""),
    htmlBody: body.html,
    name: body.fromName || getSettingValue("mail.fromName", "FunniFin Workshop Planner"),
  });
  return { sent: true };
}

function sendWorkflowNotification(payload) {
  const recipients = Array.isArray(payload.to) ? payload.to.filter(Boolean) : [];
  if (!recipients.length) {
    throw new Error("Missing notification recipients");
  }

  const subject = buildWorkflowSubject(payload);
  const roles = Array.isArray(payload.recipientLabels) ? payload.recipientLabels : [];
  const sentRecipients = [];

  recipients.forEach(function(recipient, index) {
    const role = roles[index] || "";
    const rolePayload = withMailActionForRole(payload, role);
    MailApp.sendEmail({
      to: recipient,
      subject,
      body: buildWorkflowEmailText(rolePayload),
      htmlBody: buildWorkflowEmailHtml(rolePayload),
      name: payload.fromName || getSettingValue("mail.fromName", "FunniFin Workshop Planner"),
    });
    sentRecipients.push(recipient);
  });
  return { sent: true, subject, recipients: sentRecipients };
}

function stripHtml(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatMailMoney(value) {
  const amount = Number(value || 0);
  return amount.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function appUrlForRole(role) {
  if (role === "funnifin") return FUNNIFIN_SITE_URL + "#funnifin";
  if (role === "expert") return FUNNIFIN_SITE_URL + "#esperto-candidature";
  if (role === "brand") return FUNNIFIN_SITE_URL + "#brand";
  return FUNNIFIN_SITE_URL + "#login";
}

function appActionLabelForRole(role) {
  if (role === "funnifin") return "Apri la console FunniFin";
  if (role === "expert") return "Apri l'area Esperto";
  if (role === "brand") return "Apri l'area Brand";
  return "Apri FunniFin";
}

function withMailActionForRole(payload, role) {
  const next = Object.assign({}, payload);
  if (role && role !== "client") {
    next.actionUrl = payload.actionUrl || appUrlForRole(role);
    next.actionLabel = payload.actionLabel || appActionLabelForRole(role);
  } else if (role === "client") {
    next.actionUrl = "";
    next.actionLabel = "";
  }
  return next;
}

function mailDataCell(label, value, href, topBorder) {
  var safeValue = escapeHtml(value || "-");
  var content = href
    ? "<a href=\"" + escapeHtml(href) + "\" style=\"color:#004f54;text-decoration:none;font-weight:800;\">" + safeValue + "</a>"
    : safeValue;
  return "<td width=\"50%\" style=\"width:50%;padding:10px 12px;" + (topBorder ? "border-top:1px solid #e0f2f4;" : "") + "vertical-align:top;\">" +
    "<span style=\"display:block;margin:0 0 4px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#6b8a8c;font-weight:800;\">" + escapeHtml(label) + "</span>" +
    "<strong style=\"display:block;color:#171d1d;font-size:14px;line-height:1.35;font-weight:800;word-break:break-word;\">" + content + "</strong>" +
  "</td>";
}

function mailDataGrid(rows) {
  return "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border:1px solid #cce8ec;border-radius:12px;overflow:hidden;background:#ffffff;\">" +
    rows.map(function(row, rowIndex) {
      return "<tr>" + row.map(function(item) {
        return mailDataCell(item.label, item.value, item.href, rowIndex > 0);
      }).join("") + "</tr>";
    }).join("") +
  "</table>";
}

function buildWorkflowEmailText(payload) {
  const copy = workflowCopy(payload);
  const workshops = (payload.workshops || [])
    .map(function (workshop) {
      return [
        "- " + (workshop.title || "Workshop"),
        workshop.duration || "",
        workshop.format || "",
        [workshop.date || "data da confermare", workshop.time || ""].join(" ").trim(),
        workshop.expertName || "",
      ].filter(Boolean).join(" · ");
    })
    .join("\n");
  return [
    copy.title,
    copy.subtitle,
    "",
    "Progetto: " + (payload.project && payload.project.company ? payload.project.company : ""),
    "Referente: " + (payload.project && payload.project.manager ? payload.project.manager : ""),
    "Email: " + (payload.project && payload.project.email ? payload.project.email : ""),
    "Punto del percorso: " + (payload.project && payload.project.status ? payload.project.status : ""),
    "Preventivo: " + formatMailMoney(payload.project && payload.project.quoteTotal ? payload.project.quoteTotal : 0) + " + IVA",
    "",
    copy.body,
    "",
    "Workshop:",
    workshops,
    payload.note ? "\nNota: " + payload.note : "",
    payload.actionUrl ? "\n" + (payload.actionLabel || "Apri") + ": " + payload.actionUrl : "",
    payload.event && payload.event.htmlLink ? "\nEvento: " + payload.event.htmlLink : "",
    payload.event && payload.event.meetLink ? "Meet: " + payload.event.meetLink : "",
  ].filter(Boolean).join("\n");
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

function listCatalogConfig() {
  const sheet = getCatalogTopicsSheet();
  const rows = sheet.getDataRange().getValues();
  const topics = rows.length <= 1 ? [] : rows.slice(1).map(rowToCatalogTopic).filter(Boolean);
  return {
    ok: true,
    source: "google-sheet",
    topics,
  };
}

function updateCatalogTopic(payload) {
  if (!payload.id) throw new Error("Missing topic id");

  const now = formatTimestamp(new Date());
  const topic = {
    id: String(payload.id),
    title: String(payload.title || ""),
    description: String(payload.description || ""),
    badge: String(payload.badge || ""),
    active: payload.active !== false,
    updatedAt: now,
  };

  upsertSheetRow(getCatalogTopicsSheet(), CATALOG_TOPIC_HEADERS, topic.id, catalogTopicToRow(topic));
  appendRequestEvent("catalog", "catalog_topic_updated", `Topic catalogo aggiornato: ${topic.title || topic.id}`, topic);

  return {
    ok: true,
    source: "google-sheet",
    topic,
  };
}

function listCatalogWorkshops() {
  const sheet = getCatalogWorkshopsSheet();
  const rows = sheet.getDataRange().getValues();
  const workshops = rows.length <= 1 ? [] : rows.slice(1).map(rowToCatalogWorkshop).filter(Boolean).filter((workshop) => workshop.active !== false);
  return {
    ok: true,
    source: "google-sheet",
    workshops,
  };
}

function updateCatalogWorkshop(payload) {
  if (!payload.id) throw new Error("Missing workshop id");

  const now = formatTimestamp(new Date());
  const workshop = {
    id: String(payload.id),
    topicId: String(payload.topicId || ""),
    themeId: String(payload.themeId || ""),
    title: String(payload.title || ""),
    short: String(payload.short || ""),
    long: String(payload.long || ""),
    durationOptions: normalizeStringList(payload.durationOptions),
    formatOptions: normalizeStringList(payload.formatOptions),
    level: String(payload.level || "base"),
    target: String(payload.target || ""),
    participants: String(payload.participants || ""),
    price1h: Number(payload.price1h || 0),
    price2h: Number(payload.price2h || 0),
    packageAvailable: payload.packageAvailable !== false,
    customAvailable: payload.customAvailable !== false,
    customExtra: Number(payload.customExtra || 0),
    masterSlide: String(payload.masterSlide || ""),
    experts: normalizeStringList(payload.experts),
    state: String(payload.state || "attivo"),
    active: payload.active !== false && payload.state !== "nascosto",
    updatedAt: now,
  };

  upsertSheetRow(getCatalogWorkshopsSheet(), CATALOG_WORKSHOP_HEADERS, workshop.id, catalogWorkshopToRow(workshop));
  appendRequestEvent("catalog", "catalog_workshop_updated", `Workshop catalogo aggiornato: ${workshop.title || workshop.id}`, workshop);

  return {
    ok: true,
    source: "google-sheet",
    workshop,
  };
}

function catalogWorkshopToRow(workshop) {
  return [
    sheetText(workshop.id),
    sheetText(workshop.topicId),
    sheetText(workshop.themeId),
    sheetText(workshop.title),
    sheetText(workshop.short),
    sheetText(workshop.long),
    sheetText((workshop.durationOptions || []).join(",")),
    sheetText((workshop.formatOptions || []).join(",")),
    sheetText(workshop.level),
    sheetText(workshop.target),
    sheetText(workshop.participants),
    workshop.price1h,
    workshop.price2h,
    workshop.packageAvailable ? "TRUE" : "FALSE",
    workshop.customAvailable ? "TRUE" : "FALSE",
    workshop.customExtra,
    sheetText(workshop.masterSlide),
    sheetText((workshop.experts || []).join(",")),
    sheetText(workshop.state),
    workshop.active === false ? "FALSE" : "TRUE",
    sheetText(workshop.updatedAt),
    sheetText(JSON.stringify(workshop)),
  ];
}

function rowToCatalogWorkshop(row) {
  try {
    const payload = row[21] ? JSON.parse(row[21]) : {};
    return {
      id: String(row[0] || payload.id || ""),
      topicId: String(row[1] || payload.topicId || ""),
      themeId: String(row[2] || payload.themeId || ""),
      title: String(row[3] || payload.title || ""),
      short: String(row[4] || payload.short || ""),
      long: String(row[5] || payload.long || ""),
      durationOptions: row[6] ? String(row[6]).split(",").filter(Boolean) : normalizeStringList(payload.durationOptions),
      formatOptions: row[7] ? String(row[7]).split(",").filter(Boolean) : normalizeStringList(payload.formatOptions),
      level: String(row[8] || payload.level || "base"),
      target: String(row[9] || payload.target || ""),
      participants: String(row[10] || payload.participants || ""),
      price1h: Number(row[11] || payload.price1h || 0),
      price2h: Number(row[12] || payload.price2h || 0),
      packageAvailable: String(row[13] || payload.packageAvailable).toUpperCase() !== "FALSE",
      customAvailable: String(row[14] || payload.customAvailable).toUpperCase() !== "FALSE",
      customExtra: Number(row[15] || payload.customExtra || 0),
      masterSlide: String(row[16] || payload.masterSlide || ""),
      experts: row[17] ? String(row[17]).split(",").filter(Boolean) : normalizeStringList(payload.experts),
      state: String(row[18] || payload.state || "attivo"),
      active: String(row[19] || payload.active).toUpperCase() !== "FALSE",
      updatedAt: String(row[20] || payload.updatedAt || ""),
    };
  } catch (error) {
    return null;
  }
}

function listPricingRules() {
  const sheet = getPricingRulesSheet();
  const rows = sheet.getDataRange().getValues();
  const rules = rows.length <= 1 ? [] : rows.slice(1).map(rowToPricingRule).filter(Boolean);
  return {
    ok: true,
    source: "google-sheet",
    rules,
  };
}

function updatePricingRule(payload) {
  if (!payload.id) throw new Error("Missing pricing rule id");

  const now = formatTimestamp(new Date());
  const rule = {
    id: String(payload.id),
    name: String(payload.name || ""),
    min: Number(payload.min || 1),
    max: Number(payload.max || 1),
    discountPercent: Number(payload.discountPercent || 0),
    specialQuote: Boolean(payload.specialQuote),
    updatedAt: now,
  };

  upsertSheetRow(getPricingRulesSheet(), PRICING_RULE_HEADERS, rule.id, pricingRuleToRow(rule));
  appendRequestEvent("pricing", "pricing_rule_updated", `Regola prezzo aggiornata: ${rule.name || rule.id}`, rule);

  return {
    ok: true,
    source: "google-sheet",
    rule,
  };
}

function upsertSheetRow(sheet, headers, id, row) {
  const rows = sheet.getDataRange().getValues();
  const rowIndex = rows.findIndex((item, index) => index > 0 && item[0] === id);
  if (rowIndex > 0) {
    sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([row]);
    return;
  }
  sheet.appendRow(row);
}

function catalogTopicToRow(topic) {
  return [
    sheetText(topic.id),
    sheetText(topic.title),
    sheetText(topic.description),
    sheetText(topic.badge),
    topic.active === false ? "FALSE" : "TRUE",
    sheetText(topic.updatedAt),
    sheetText(JSON.stringify(topic)),
  ];
}

function rowToCatalogTopic(row) {
  try {
    const payload = row[6] ? JSON.parse(row[6]) : {};
    return {
      id: String(row[0] || payload.id || ""),
      title: String(row[1] || payload.title || ""),
      description: String(row[2] || payload.description || ""),
      badge: String(row[3] || payload.badge || ""),
      active: String(row[4] || payload.active).toUpperCase() !== "FALSE",
      updatedAt: String(row[5] || payload.updatedAt || ""),
    };
  } catch (error) {
    return null;
  }
}

function pricingRuleToRow(rule) {
  return [
    sheetText(rule.id),
    sheetText(rule.name),
    rule.min,
    rule.max,
    rule.discountPercent,
    rule.specialQuote ? "TRUE" : "FALSE",
    sheetText(rule.updatedAt),
    sheetText(JSON.stringify(rule)),
  ];
}

function rowToPricingRule(row) {
  try {
    const payload = row[7] ? JSON.parse(row[7]) : {};
    return {
      id: String(row[0] || payload.id || ""),
      name: String(row[1] || payload.name || ""),
      min: Number(row[2] || payload.min || 1),
      max: Number(row[3] || payload.max || 1),
      discountPercent: Number(row[4] || payload.discountPercent || 0),
      specialQuote: String(row[5] || payload.specialQuote).toUpperCase() === "TRUE",
      updatedAt: String(row[6] || payload.updatedAt || ""),
    };
  } catch (error) {
    return null;
  }
}

function listExperts() {
  const sheet = getExpertsSheet();
  const rows = sheet.getDataRange().getValues();
  const experts = rows.length <= 1 ? [] : rows.slice(1).map(rowToExpert).filter(Boolean).filter((expert) => expert.active !== false);
  return {
    ok: true,
    source: "google-sheet",
    experts,
  };
}

function updateExpert(payload) {
  if (!payload.id) throw new Error("Missing expert id");

  const now = formatTimestamp(new Date());
  const expert = {
    id: String(payload.id),
    firstName: String(payload.firstName || ""),
    lastName: String(payload.lastName || ""),
    email: String(payload.email || ""),
    photo: String(payload.photo || ""),
    bio: String(payload.bio || ""),
    topicIds: normalizeStringList(payload.topicIds),
    themeIds: normalizeStringList(payload.themeIds),
    availability: String(payload.availability || ""),
    active: payload.active !== false,
    updatedAt: now,
  };

  upsertSheetRow(getExpertsSheet(), EXPERT_HEADERS, expert.id, expertToRow(expert));
  appendRequestEvent("experts", "expert_updated", `Esperto aggiornato: ${expert.firstName} ${expert.lastName}`.trim(), expert);

  return {
    ok: true,
    source: "google-sheet",
    expert,
  };
}

function deleteExpert(payload) {
  const expertId = payload.expertId || payload.id;
  if (!expertId) throw new Error("Missing expert id");

  const sheet = getExpertsSheet();
  const rows = sheet.getDataRange().getValues();
  const rowIndex = rows.findIndex((item, index) => index > 0 && item[0] === expertId);
  if (rowIndex > 0) {
    const current = rowToExpert(rows[rowIndex]) || { id: expertId };
    const next = Object.assign({}, current, { active: false, updatedAt: formatTimestamp(new Date()) });
    sheet.getRange(rowIndex + 1, 1, 1, EXPERT_HEADERS.length).setValues([expertToRow(next)]);
  }
  appendRequestEvent("experts", "expert_deleted", `Esperto rimosso: ${expertId}`, { expertId });

  return {
    ok: true,
    source: "google-sheet",
    deleted: true,
    expertId: String(expertId),
  };
}

function expertToRow(expert) {
  return [
    sheetText(expert.id),
    sheetText(expert.firstName),
    sheetText(expert.lastName),
    sheetText(expert.email),
    sheetText(expert.availability),
    sheetText((expert.topicIds || []).join(",")),
    sheetText((expert.themeIds || []).join(",")),
    expert.active === false ? "FALSE" : "TRUE",
    sheetText(expert.updatedAt || ""),
    sheetText(JSON.stringify(expert)),
  ];
}

function rowToExpert(row) {
  try {
    const payload = row[9] ? JSON.parse(row[9]) : {};
    return {
      id: String(row[0] || payload.id || ""),
      firstName: String(row[1] || payload.firstName || ""),
      lastName: String(row[2] || payload.lastName || ""),
      email: String(row[3] || payload.email || ""),
      photo: String(payload.photo || ""),
      bio: String(payload.bio || ""),
      availability: String(row[4] || payload.availability || ""),
      topicIds: row[5] ? String(row[5]).split(",").filter(Boolean) : normalizeStringList(payload.topicIds),
      themeIds: row[6] ? String(row[6]).split(",").filter(Boolean) : normalizeStringList(payload.themeIds),
      active: String(row[7] || payload.active).toUpperCase() !== "FALSE",
      updatedAt: String(row[8] || payload.updatedAt || ""),
    };
  } catch (error) {
    return null;
  }
}

function listWorkspaceSettings() {
  const sheet = getSettingsSheet();
  const rows = sheet.getDataRange().getValues();
  const settings = rows.length <= 1 ? [] : rows.slice(1).map(rowToSetting).filter(Boolean);
  return {
    ok: true,
    source: "google-sheet",
    settings,
  };
}

function updateWorkspaceSetting(payload) {
  if (!payload.key) throw new Error("Missing setting key");

  const setting = {
    key: String(payload.key),
    value: String(payload.value == null ? "" : payload.value),
    group: String(payload.group || "general"),
    label: String(payload.label || payload.key),
    updatedAt: formatTimestamp(new Date()),
  };
  upsertSheetRow(getSettingsSheet(), SETTING_HEADERS, setting.key, settingToRow(setting));
  appendRequestEvent("settings", "setting_updated", `Setting aggiornata: ${setting.key}`, setting);

  return {
    ok: true,
    source: "google-sheet",
    setting,
  };
}

function getSettingValue(key, fallback) {
  try {
    const sheet = getSettingsSheet();
    const rows = sheet.getDataRange().getValues();
    for (let index = 1; index < rows.length; index += 1) {
      if (String(rows[index][0] || "") === key) {
        const value = String(rows[index][1] || "");
        return value || fallback;
      }
    }
  } catch (error) {
    return fallback;
  }
  return fallback;
}

function getRuntimeCalendarId() {
  return getSettingValue("calendar.id", SETTINGS.calendarId);
}

function getRuntimeCalendarName() {
  return getSettingValue("calendar.name", SETTINGS.calendarName);
}

function getRuntimeDriveRootFolderId() {
  return getSettingValue("drive.rootFolderId", SETTINGS.driveRootFolderId);
}

function getRuntimeSlidesRootFolderId() {
  return getSettingValue("drive.slidesRootFolderId", SETTINGS.slidesRootFolderId);
}

function getRuntimeInternalRecipient() {
  return getSettingValue("mail.internalRecipient", SETTINGS.internalRecipient);
}

function settingToRow(setting) {
  return [
    sheetText(setting.key),
    sheetText(setting.value),
    sheetText(setting.group),
    sheetText(setting.label),
    sheetText(setting.updatedAt),
    sheetText(JSON.stringify(setting)),
  ];
}

function rowToSetting(row) {
  try {
    const payload = row[5] ? JSON.parse(row[5]) : {};
    return {
      key: String(row[0] || payload.key || ""),
      value: String(row[1] || payload.value || ""),
      group: String(row[2] || payload.group || "general"),
      label: String(row[3] || payload.label || row[0] || ""),
      updatedAt: String(row[4] || payload.updatedAt || ""),
    };
  } catch (error) {
    return null;
  }
}

function getGoogleHealth(params) {
  const cache = CacheService.getScriptCache();
  const cacheKey = "funnifin_google_health_v1";
  const forceRefresh = params && String(params.refresh || "") === "1";
  if (!forceRefresh) {
    const cachedHealth = cache.get(cacheKey);
    if (cachedHealth) {
      try {
        const health = JSON.parse(cachedHealth);
        health.cached = true;
        return health;
      } catch (error) {
        cache.remove(cacheKey);
      }
    }
  }
  const spreadsheet = getRequestsSpreadsheet();
  const calendarId = getRuntimeCalendarId();
  const calendarName = getRuntimeCalendarName();
  const driveRootFolderId = getRuntimeDriveRootFolderId();
  const slidesRootFolderId = getRuntimeSlidesRootFolderId();
  const health = {
    ok: true,
    source: "google-workspace",
    spreadsheet: {
      id: spreadsheet.getId(),
      url: spreadsheet.getUrl(),
      requests: Math.max(0, getRequestsSheet().getLastRow() - 1),
      events: Math.max(0, getRequestEventsSheet().getLastRow() - 1),
      authUsers: Math.max(0, getAuthUsersSheet().getLastRow() - 1),
      accessRequests: Math.max(0, getAccessRequestsSheet().getLastRow() - 1),
      catalogTopics: Math.max(0, getCatalogTopicsSheet().getLastRow() - 1),
      catalogWorkshops: Math.max(0, getCatalogWorkshopsSheet().getLastRow() - 1),
      pricingRules: Math.max(0, getPricingRulesSheet().getLastRow() - 1),
      experts: Math.max(0, getExpertsSheet().getLastRow() - 1),
      settings: Math.max(0, getSettingsSheet().getLastRow() - 1),
    },
    calendar: {
      configured: Boolean(calendarId || calendarName),
      id: calendarId,
      name: calendarName,
    },
    drive: {
      configured: Boolean(driveRootFolderId || slidesRootFolderId),
      rootFolderId: driveRootFolderId,
      slidesRootFolderId,
    },
    mail: {
      remainingDailyQuota: MailApp.getRemainingDailyQuota(),
    },
    checkedAt: formatTimestamp(new Date()),
    cached: false,
  };
  cache.put(cacheKey, JSON.stringify(health), 60);
  return health;
}

function listAdminConfig() {
  return {
    ok: true,
    source: "google-sheet",
    catalogTopics: listCatalogConfig().topics,
    catalogWorkshops: listCatalogWorkshops().workshops,
    pricingRules: listPricingRules().rules,
    experts: listExperts().experts,
    settings: listWorkspaceSettings().settings,
    health: getGoogleHealth(),
  };
}

function seedAdminConfig(payload) {
  const result = {
    catalogTopics: 0,
    catalogWorkshops: 0,
    pricingRules: 0,
    experts: 0,
    settings: 0,
  };

  (payload.catalogTopics || payload.topics || []).forEach((topic) => {
    updateCatalogTopic(topic);
    result.catalogTopics += 1;
  });
  (payload.catalogWorkshops || payload.workshops || []).forEach((workshop) => {
    updateCatalogWorkshop(workshop);
    result.catalogWorkshops += 1;
  });
  (payload.pricingRules || payload.rules || []).forEach((rule) => {
    updatePricingRule(rule);
    result.pricingRules += 1;
  });
  (payload.experts || []).forEach((expert) => {
    updateExpert(expert);
    result.experts += 1;
  });
  (payload.settings || []).forEach((setting) => {
    updateWorkspaceSetting(setting);
    result.settings += 1;
  });

  appendRequestEvent("admin", "admin_config_seeded", "Configurazione admin riallineata da seed batch.", result);

  return {
    ok: true,
    source: "google-sheet",
    seeded: result,
    health: getGoogleHealth(),
  };
}

function normalizeStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
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

const CATALOG_TOPIC_HEADERS = [
  "id",
  "title",
  "description",
  "badge",
  "active",
  "updatedAt",
  "payloadJson",
];

const CATALOG_WORKSHOP_HEADERS = [
  "id",
  "topicId",
  "themeId",
  "title",
  "short",
  "long",
  "durationOptions",
  "formatOptions",
  "level",
  "target",
  "participants",
  "price1h",
  "price2h",
  "packageAvailable",
  "customAvailable",
  "customExtra",
  "masterSlide",
  "experts",
  "state",
  "active",
  "updatedAt",
  "payloadJson",
];

const PRICING_RULE_HEADERS = [
  "id",
  "name",
  "min",
  "max",
  "discountPercent",
  "specialQuote",
  "updatedAt",
  "payloadJson",
];

const EXPERT_HEADERS = [
  "id",
  "firstName",
  "lastName",
  "email",
  "availability",
  "topicIds",
  "themeIds",
  "active",
  "updatedAt",
  "payloadJson",
];

const SETTING_HEADERS = [
  "key",
  "value",
  "group",
  "label",
  "updatedAt",
  "payloadJson",
];

const AUTH_USER_HEADERS = [
  "id",
  "email",
  "actualRole",
  "expertId",
  "displayName",
  "invitedBy",
  "createdAt",
  "disabled",
  "updatedAt",
  "payloadJson",
];

const ACCESS_REQUEST_HEADERS = [
  "id",
  "email",
  "requestedRole",
  "status",
  "sendMail",
  "code",
  "codeStatus",
  "codeExpiresAt",
  "createdAt",
  "updatedAt",
  "reviewedAt",
  "reviewedBy",
  "verifiedAt",
  "refCode",
  "payloadJson",
];

const AUTH_SESSION_HEADERS = [
  "token",
  "userId",
  "email",
  "actualRole",
  "createdAt",
  "expiresAt",
  "revokedAt",
  "payloadJson",
];

function getAuthUsersSheet() {
  const spreadsheet = getRequestsSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, "AuthUsers", AUTH_USER_HEADERS);
  ensureHeaderRow(sheet, AUTH_USER_HEADERS);
  return sheet;
}

function getAccessRequestsSheet() {
  const spreadsheet = getRequestsSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, "AccessRequests", ACCESS_REQUEST_HEADERS);
  ensureHeaderRow(sheet, ACCESS_REQUEST_HEADERS);
  return sheet;
}

function getAuthSessionsSheet() {
  const spreadsheet = getRequestsSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, "AuthSessions", AUTH_SESSION_HEADERS);
  ensureHeaderRow(sheet, AUTH_SESSION_HEADERS);
  return sheet;
}

function seedAuthUsersIfNeeded() {
  const sheet = getAuthUsersSheet();
  const rows = sheet.getDataRange().getValues();
  if (rows.length > 1) return;
  AUTH_SEED_USERS.forEach((user) => {
    upsertSheetRow(sheet, AUTH_USER_HEADERS, user.id, authUserToRow(user));
  });
}

function listAuthUsers() {
  seedAuthUsersIfNeeded();
  const sheet = getAuthUsersSheet();
  const rows = sheet.getDataRange().getValues();
  const users = rows.length <= 1 ? [] : rows.slice(1).map(rowToAuthUser).filter(Boolean);
  return {
    ok: true,
    source: "google-sheet",
    users,
  };
}

function listAccessRequests() {
  const sheet = getAccessRequestsSheet();
  const rows = sheet.getDataRange().getValues();
  const requests = rows.length <= 1 ? [] : rows.slice(1).map(rowToAccessRequest).filter(Boolean).sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))).map(publicAccessRequest);
  return {
    ok: true,
    source: "google-sheet",
    requests,
  };
}

function requestLoginCode(payload) {
  const email = String(payload.email || "").trim().toLowerCase();
  if (!email) throw new Error("Missing email");

  seedAuthUsersIfNeeded();
  if (payload.requestedRole) {
    requireFunniFinSession(payload);
  }
  const usersSheet = getAuthUsersSheet();
  const requestsSheet = getAccessRequestsSheet();
  const rows = usersSheet.getDataRange().getValues();
  const users = rows.length <= 1 ? [] : rows.slice(1).map(rowToAuthUser).filter(Boolean);
  const user = users.find((item) => String(item.email || "").toLowerCase() === email) || null;
  const sendMail = payload.sendMail !== false;
  const now = new Date();

  if (payload.requestedRole) {
    const invitedUser = {
      id: (user && user.id) || payload.id || buildAuthUserId(email),
      email,
      actualRole: String(payload.requestedRole || "Brand"),
      expertId: String(payload.expertId || (user && user.expertId) || ""),
      displayName: String(payload.displayName || (user && user.displayName) || email),
      invitedBy: String(payload.invitedBy || (user && user.invitedBy) || "FunniFin"),
      createdAt: String((user && user.createdAt) || formatTimestamp(now)),
      disabled: false,
    };
    upsertSheetRow(usersSheet, AUTH_USER_HEADERS, invitedUser.id, authUserToRow(invitedUser));
  }

  const issuingUser = rowToAuthUser(findAuthUserRowByEmail(email, usersSheet)) || user || null;
  if (issuingUser && issuingUser.disabled) {
    const request = appendAccessRequest({
      email,
      requestedRole: String(payload.requestedRole || issuingUser.actualRole || ""),
      status: "pending",
      sendMail,
      code: "",
      codeStatus: "pending",
      codeExpiresAt: "",
      reviewedBy: String(payload.invitedBy || "FunniFin"),
      refCode: String(payload.refCode || ""),
      createdAt: formatTimestamp(now),
      updatedAt: formatTimestamp(now),
    });
    return {
      ok: true,
      source: "google-sheet",
      sent: true,
      pending: true,
      request: publicAccessRequest(request),
    };
  }

  const existingCodeRequest = findLatestAccessRequestWithCodeByEmail(email, requestsSheet);
  const code = existingCodeRequest && existingCodeRequest.code ? existingCodeRequest.code : buildAuthCode();
  const request = appendAccessRequest({
    email,
    requestedRole: String(payload.requestedRole || issuingUser?.actualRole || ""),
    status: "approved",
    sendMail,
    code,
    codeStatus: sendMail ? "sent" : "queued",
    codeExpiresAt: "",
    reviewedAt: formatTimestamp(now),
    reviewedBy: String(payload.invitedBy || "FunniFin"),
    verifiedAt: "",
    refCode: String(payload.refCode || ""),
    createdAt: formatTimestamp(now),
    updatedAt: formatTimestamp(now),
  });

  if (sendMail) {
    MailApp.sendEmail({
      to: email,
      cc: payload.cc || SETTINGS.internalRecipient,
      subject: `Invito FunniFin - codice accesso`,
      name: String(payload.fromName || "FunniFin Workshop Planner"),
      htmlBody: buildAuthInviteHtml({ email, code, requestedRole: String(payload.requestedRole || issuingUser?.actualRole || ""), displayName: String(payload.displayName || email) }),
      body: buildAuthInviteText({ email, code, requestedRole: String(payload.requestedRole || issuingUser?.actualRole || ""), displayName: String(payload.displayName || email) }),
    });
  }

  return {
    ok: true,
    source: "google-sheet",
    sent: true,
    pending: false,
    request: publicAccessRequest(request),
    user: issuingUser || rowToAuthUser(findAuthUserRowByEmail(email, usersSheet)) || null,
  };
}

function verifyLoginCode(payload) {
  const email = String(payload.email || "").trim().toLowerCase();
  const code = String(payload.code || "").trim();
  if (!email) throw new Error("Missing email");
  if (!code) throw new Error("Missing code");

  seedAuthUsersIfNeeded();
  const usersSheet = getAuthUsersSheet();
  const request = findAccessRequestByEmailAndCode(email, code, getAccessRequestsSheet());
  const user = rowToAuthUser(findAuthUserRowByEmail(email, usersSheet));

  if (!user || user.disabled) {
    throw new Error("Codice non valido.");
  }

  if (!request) {
    throw new Error("Codice non valido.");
  }

  const verified = Object.assign({}, request, {
    codeStatus: "verified",
    verifiedAt: formatTimestamp(new Date()),
    updatedAt: formatTimestamp(new Date()),
  });
  saveAccessRequest(verified);

  const session = {
    userId: user.id,
    token: Utilities.getUuid(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    effectiveRole: user.actualRole,
    user: user,
  };
  saveAuthSession(session);

  return {
    ok: true,
    source: "google-sheet",
    session: session,
    user: user,
  };
}

function reviewAccessRequest(payload) {
  const requestId = String(payload.requestId || payload.id || "");
  if (!requestId) throw new Error("Missing requestId");

  const sheet = getAccessRequestsSheet();
  const rows = sheet.getDataRange().getValues();
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === requestId);
  if (rowIndex < 1) throw new Error(`Access request not found: ${requestId}`);

  const current = rowToAccessRequest(rows[rowIndex]);
  const now = new Date();
  const next = Object.assign({}, current, {
    status: String(payload.status || current.status || "pending"),
    sendMail: payload.sendMail == null ? current.sendMail : payload.sendMail !== false,
    reviewedAt: formatTimestamp(now),
    reviewedBy: String(payload.reviewedBy || "FunniFin"),
    updatedAt: formatTimestamp(now),
  });

  if (next.status === "approved") {
    const usersSheet = getAuthUsersSheet();
    const existingUserRow = findAuthUserRowByEmail(next.email, usersSheet);
    if (!existingUserRow && String(next.requestedRole || "").trim()) {
      const invitedUser = {
        id: buildAuthUserId(next.email),
        email: next.email,
        actualRole: String(next.requestedRole || "Brand"),
        expertId: "",
        displayName: String(next.email),
        invitedBy: String(next.reviewedBy || "FunniFin"),
        createdAt: next.createdAt || formatTimestamp(now),
        disabled: false,
        updatedAt: formatTimestamp(now),
      };
      upsertSheetRow(usersSheet, AUTH_USER_HEADERS, invitedUser.id, authUserToRow(invitedUser));
    }
    const code = next.code || buildAuthCode();
    next.code = code;
    next.codeStatus = next.sendMail === false ? "queued" : "sent";
    next.codeExpiresAt = "";
    if (next.sendMail !== false) {
      MailApp.sendEmail({
        to: next.email,
        cc: payload.cc || SETTINGS.internalRecipient,
        subject: `Invito FunniFin - codice accesso`,
        name: String(payload.fromName || "FunniFin Workshop Planner"),
        htmlBody: buildAuthInviteHtml({ email: next.email, code, requestedRole: String(next.requestedRole || ""), displayName: String(payload.displayName || next.email) }),
        body: buildAuthInviteText({ email: next.email, code, requestedRole: String(next.requestedRole || ""), displayName: String(payload.displayName || next.email) }),
      });
    }
  } else {
    next.code = "";
    next.codeStatus = "pending";
    next.codeExpiresAt = "";
  }

  sheet.getRange(rowIndex + 1, 1, 1, ACCESS_REQUEST_HEADERS.length).setValues([accessRequestToRow(next)]);

  const user = rowToAuthUser(findAuthUserRowByEmail(next.email, getAuthUsersSheet()));
  return {
    ok: true,
    source: "google-sheet",
    request: publicAccessRequest(next),
    user: user,
    codeSent: next.status === "approved" && next.sendMail !== false,
  };
}

function appendAccessRequest(request) {
  const sheet = getAccessRequestsSheet();
  const normalized = Object.assign({}, request, {
    id: request.id || buildAuthRequestId(request.email || "user", new Date()),
    createdAt: request.createdAt || formatTimestamp(new Date()),
    updatedAt: request.updatedAt || formatTimestamp(new Date()),
  });
  sheet.appendRow(accessRequestToRow(normalized));
  appendRequestEvent("auth", "access_request_updated", `Accesso aggiornato per ${normalized.email}`, normalized);
  return normalized;
}

function saveAccessRequest(request) {
  const sheet = getAccessRequestsSheet();
  const rows = sheet.getDataRange().getValues();
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === request.id);
  if (rowIndex < 1) {
    sheet.appendRow(accessRequestToRow(request));
    return request;
  }
  sheet.getRange(rowIndex + 1, 1, 1, ACCESS_REQUEST_HEADERS.length).setValues([accessRequestToRow(request)]);
  return request;
}

function findLatestAccessRequestByEmail(email, sheet) {
  const rows = sheet.getDataRange().getValues();
  const requests = rows.length <= 1 ? [] : rows.slice(1).map(rowToAccessRequest).filter(Boolean).filter((request) => String(request.email || "").toLowerCase() === email);
  if (!requests.length) return null;
  return requests.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0];
}

function findLatestAccessRequestWithCodeByEmail(email, sheet) {
  const rows = sheet.getDataRange().getValues();
  const requests = rows.length <= 1 ? [] : rows.slice(1).map(rowToAccessRequest).filter(Boolean).filter((request) => {
    return String(request.email || "").toLowerCase() === email && String(request.code || "").trim();
  });
  if (!requests.length) return null;
  return requests.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0];
}

function findAccessRequestByEmailAndCode(email, code, sheet) {
  const rows = sheet.getDataRange().getValues();
  const requests = rows.length <= 1 ? [] : rows.slice(1).map(rowToAccessRequest).filter(Boolean).filter((request) => {
    return String(request.email || "").toLowerCase() === email && String(request.code || "").trim() === String(code || "").trim();
  });
  if (!requests.length) return null;
  return requests.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")))[0];
}

function findAuthUserRowByEmail(email, sheet) {
  const rows = sheet.getDataRange().getValues();
  const target = String(email || "").toLowerCase();
  for (let index = 1; index < rows.length; index += 1) {
    const user = rowToAuthUser(rows[index]);
    if (user && String(user.email || "").toLowerCase() === target) {
      return rows[index];
    }
  }
  return null;
}

function saveAuthSession(session) {
  const sheet = getAuthSessionsSheet();
  upsertSheetRow(sheet, AUTH_SESSION_HEADERS, session.token, authSessionToRow(session));
}

function authSessionToRow(session) {
  const user = session.user || {};
  return [
    sheetText(session.token),
    sheetText(session.userId),
    sheetText(user.email || session.email || ""),
    sheetText(user.actualRole || session.actualRole || ""),
    sheetText(session.createdAt || ""),
    sheetText(session.expiresAt || ""),
    sheetText(session.revokedAt || ""),
    sheetText(JSON.stringify(session)),
  ];
}

function rowToAuthSession(row) {
  try {
    if (!row) return null;
    const payload = row[7] ? JSON.parse(row[7]) : {};
    return {
      token: String(row[0] || payload.token || ""),
      userId: String(row[1] || payload.userId || ""),
      email: String(row[2] || payload.email || payload.user?.email || ""),
      actualRole: String(row[3] || payload.actualRole || payload.user?.actualRole || ""),
      createdAt: String(row[4] || payload.createdAt || ""),
      expiresAt: String(row[5] || payload.expiresAt || ""),
      revokedAt: String(row[6] || payload.revokedAt || ""),
      user: payload.user,
    };
  } catch (error) {
    return null;
  }
}

function findAuthSessionByToken(token) {
  const target = String(token || "");
  if (!target) return null;
  const rows = getAuthSessionsSheet().getDataRange().getValues();
  for (let index = 1; index < rows.length; index += 1) {
    const session = rowToAuthSession(rows[index]);
    if (session && session.token === target) return session;
  }
  return null;
}

function requireFunniFinSession(source) {
  return requireSession(source, ["FunniFin"]);
}

function requireFunniFinSessionOrSetupSecret(source) {
  const setupSecret = PropertiesService.getScriptProperties().getProperty("SETUP_SECRET") || "";
  const providedSecret = String((source && source.setupSecret) || "");
  if (setupSecret && providedSecret && setupSecret === providedSecret) {
    return { setupSecret: true };
  }
  return requireFunniFinSession(source);
}

function requireSession(source, allowedRoles) {
  const token = String((source && (source.sessionToken || source.token)) || "");
  const session = findAuthSessionByToken(token);
  if (!session || session.revokedAt) throw new Error("Sessione non valida.");
  if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) throw new Error("Sessione scaduta.");

  const user = rowToAuthUser(findAuthUserRowByEmail(session.email, getAuthUsersSheet()));
  if (!user || user.disabled) throw new Error("Utente non autorizzato.");
  if (allowedRoles && allowedRoles.length && allowedRoles.indexOf(user.actualRole) === -1) {
    throw new Error("Permessi insufficienti.");
  }
  return { session, user };
}

function publicAccessRequest(request) {
  if (!request) return request;
  const copy = Object.assign({}, request);
  if (copy.code) copy.code = "";
  return copy;
}

function findAuthUserRowById(userId, sheet) {
  const rows = sheet.getDataRange().getValues();
  const target = String(userId || "");
  for (let index = 1; index < rows.length; index += 1) {
    const user = rowToAuthUser(rows[index]);
    if (user && String(user.id || "") === target) {
      return rows[index];
    }
  }
  return null;
}

function buildAuthUserId(email) {
  const normalized = String(email || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "user";
  return `user-${normalized}`;
}

function buildAuthRequestId(email, date) {
  const normalized = String(email || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "user";
  return `auth-${normalized}-${Utilities.formatDate(date, SETTINGS.timezone, "yyyyMMdd-HHmmss")}`;
}

function buildAuthCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function authUserToRow(user) {
  return [
    sheetText(user.id),
    sheetText(user.email),
    sheetText(user.actualRole),
    sheetText(user.expertId || ""),
    sheetText(user.displayName || ""),
    sheetText(user.invitedBy || ""),
    sheetText(user.createdAt || formatTimestamp(new Date())),
    user.disabled === false ? "FALSE" : "TRUE",
    sheetText(user.updatedAt || ""),
    sheetText(JSON.stringify(user)),
  ];
}

function updateAuthUser(payload) {
  const userId = String(payload.userId || payload.id || "");
  if (!userId) throw new Error("Missing userId");

  seedAuthUsersIfNeeded();
  const usersSheet = getAuthUsersSheet();
  const rows = usersSheet.getDataRange().getValues();
  const rowIndex = rows.findIndex((row, index) => index > 0 && row[0] === userId);
  const existingRow = rowIndex >= 1 ? rows[rowIndex] : null;
  if (!existingRow) throw new Error("Auth user not found");
  const current = rowToAuthUser(existingRow);
  const next = Object.assign({}, current, {
    email: String(payload.email || current.email || "").trim().toLowerCase(),
    actualRole: String(payload.actualRole || current.actualRole || "Brand"),
    expertId: String(payload.expertId == null ? current.expertId || "" : payload.expertId),
    displayName: String(payload.displayName || current.displayName || payload.email || current.email || ""),
    invitedBy: String(payload.invitedBy || current.invitedBy || "FunniFin"),
    disabled: payload.disabled == null ? current.disabled : payload.disabled === true,
    updatedAt: formatTimestamp(new Date()),
  });
  usersSheet.getRange(rowIndex + 1, 1, 1, AUTH_USER_HEADERS.length).setValues([authUserToRow(next)]);
  return {
    ok: true,
    source: "google-sheet",
    user: next,
  };
}

function rowToAuthUser(row) {
  try {
    if (!row) return null;
    const payload = row[9] ? JSON.parse(row[9]) : {};
    return {
      id: String(row[0] || payload.id || ""),
      email: String(row[1] || payload.email || ""),
      actualRole: String(row[2] || payload.actualRole || "Brand"),
      expertId: String(row[3] || payload.expertId || ""),
      displayName: String(row[4] || payload.displayName || row[1] || ""),
      invitedBy: String(row[5] || payload.invitedBy || ""),
      createdAt: String(row[6] || payload.createdAt || ""),
      disabled: String(row[7] || payload.disabled).toUpperCase() === "TRUE",
      updatedAt: String(row[8] || payload.updatedAt || ""),
    };
  } catch (error) {
    return null;
  }
}

function accessRequestToRow(request) {
  return [
    sheetText(request.id),
    sheetText(request.email),
    sheetText(request.requestedRole || ""),
    sheetText(request.status || "pending"),
    request.sendMail === false ? "FALSE" : "TRUE",
    sheetText(request.code || ""),
    sheetText(request.codeStatus || "pending"),
    sheetText(request.codeExpiresAt || ""),
    sheetText(request.createdAt || formatTimestamp(new Date())),
    sheetText(request.updatedAt || formatTimestamp(new Date())),
    sheetText(request.reviewedAt || ""),
    sheetText(request.reviewedBy || ""),
    sheetText(request.verifiedAt || ""),
    sheetText(request.refCode || ""),
    sheetText(JSON.stringify(request)),
  ];
}

function rowToAccessRequest(row) {
  try {
    if (!row) return null;
    const payload = row[14] ? JSON.parse(row[14]) : {};
    return {
      id: String(row[0] || payload.id || ""),
      email: String(row[1] || payload.email || ""),
      requestedRole: String(row[2] || payload.requestedRole || ""),
      status: String(row[3] || payload.status || "pending"),
      sendMail: String(row[4] || payload.sendMail).toUpperCase() !== "FALSE",
      code: String(row[5] || payload.code || ""),
      codeStatus: String(row[6] || payload.codeStatus || "pending"),
      codeExpiresAt: String(row[7] || payload.codeExpiresAt || ""),
      createdAt: String(row[8] || payload.createdAt || ""),
      updatedAt: String(row[9] || payload.updatedAt || ""),
      reviewedAt: String(row[10] || payload.reviewedAt || ""),
      reviewedBy: String(row[11] || payload.reviewedBy || ""),
      verifiedAt: String(row[12] || payload.verifiedAt || ""),
      refCode: String(row[13] || payload.refCode || ""),
    };
  } catch (error) {
    return null;
  }
}

function buildAuthInviteText(payload) {
  return [
    "Il tuo accesso FunniFin è pronto",
    "",
    `Benvenuto, ${payload.displayName || payload.email}`,
    `Ciao ${payload.displayName || payload.email},`,
    `abbiamo preparato il tuo accesso${payload.requestedRole ? ` come ${payload.requestedRole}` : ""}.`,
    "",
    `Email: ${payload.email}`,
    `Codice: ${payload.code}`,
    "",
    "Apri FunniFin e inserisci il codice nella schermata di accesso:",
    FUNNIFIN_SITE_URL + "#login",
  ].join("\n");
}

function buildAuthInviteHtml(payload) {
  const displayName = escapeHtml(payload.displayName || payload.email);
  const requestedRole = payload.requestedRole ? " come " + escapeHtml(payload.requestedRole) : "";
  const email = escapeHtml(payload.email);
  const code = escapeHtml(payload.code);
  const appUrl = FUNNIFIN_SITE_URL + "#login";
  return [
    '<div style="margin:0;padding:32px 16px;background:#f5fafb;font-family:Nunito,Arial,sans-serif;color:#171d1d;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #d4edf2;border-radius:18px;overflow:hidden;box-shadow:0 14px 38px rgba(0,79,84,0.10);">',
    '<tr><td style="padding:32px;background:#004f54;text-align:center;">',
    `<p style="margin:0 0 8px;font-family:Caveat,cursive;font-size:38px;line-height:1;color:#1cafb9;font-weight:700;">Benvenuto, ${displayName}</p>`,
    '<h1 style="margin:0;font-size:24px;line-height:1.18;color:#fff;">Il tuo accesso FunniFin è pronto</h1>',
    `<p style="margin:12px auto 0;color:#c8f0f3;font-size:14px;line-height:1.6;max-width:440px;">Ciao ${displayName}, abbiamo preparato il tuo accesso${requestedRole}.</p>`,
    '</td></tr>',
    '<tr><td style="padding:24px;">',
    `<p style="margin:0 0 12px;color:#444748;font-size:14px;line-height:1.6;">Usa questa email per entrare: <strong>${email}</strong></p>`,
    `<div style="padding:18px;border-radius:14px;background:#fff8dd;border:1px solid #f5cf45;font-size:24px;color:#004f54;font-weight:800;letter-spacing:0.14em;text-align:center;">${code}</div>`,
    '<p style="margin:14px 0 0;color:#444748;font-size:14px;line-height:1.6;">Apri FunniFin e inserisci il codice nella schermata di accesso. Il codice serve solo per completare questo accesso.</p>',
    `<p style="margin:18px 0 0;text-align:center;"><a href="${appUrl}" style="display:inline-block;padding:12px 26px;background:#004f54;color:#ffffff;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;">Apri FunniFin</a></p>`,
    `<p style="margin:12px 0 0;color:#7b9698;font-size:12px;line-height:1.5;text-align:center;">Se il bottone non funziona, copia questo link:<br><a href="${appUrl}" style="color:#1cafb9;">${appUrl}</a></p>`,
    '</td></tr>',
    '<tr><td style="padding:18px 24px;background:#f8fcfc;border-top:1px solid #e0f2f4;text-align:center;">',
    '<p style="margin:0;color:#7b9698;font-size:11px;line-height:1.6;">FunniFin Workshop Planner<br>Email di servizio inviata per gestire gli accessi.</p>',
    '</td></tr>',
    '</table>',
    '</div>',
  ].join("");
}

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

function getCatalogTopicsSheet() {
  const spreadsheet = getRequestsSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, "CatalogTopics", CATALOG_TOPIC_HEADERS);
  ensureHeaderRow(sheet, CATALOG_TOPIC_HEADERS);
  return sheet;
}

function getCatalogWorkshopsSheet() {
  const spreadsheet = getRequestsSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, "CatalogWorkshops", CATALOG_WORKSHOP_HEADERS);
  ensureHeaderRow(sheet, CATALOG_WORKSHOP_HEADERS);
  return sheet;
}

function getPricingRulesSheet() {
  const spreadsheet = getRequestsSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, "PricingRules", PRICING_RULE_HEADERS);
  ensureHeaderRow(sheet, PRICING_RULE_HEADERS);
  return sheet;
}

function getExpertsSheet() {
  const spreadsheet = getRequestsSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, "Experts", EXPERT_HEADERS);
  ensureHeaderRow(sheet, EXPERT_HEADERS);
  return sheet;
}

function getSettingsSheet() {
  const spreadsheet = getRequestsSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet, "Settings", SETTING_HEADERS);
  ensureHeaderRow(sheet, SETTING_HEADERS);
  return sheet;
}

function getOrCreateSheet(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    try {
      sheet = spreadsheet.insertSheet(name);
    } catch (error) {
      sheet = spreadsheet.getSheetByName(name);
      if (!sheet) throw error;
    }
  }
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
  const calendarId = getRuntimeCalendarId();
  const calendarName = getRuntimeCalendarName();
  if (calendarId) {
    return calendarId;
  }

  if (calendarName) {
    const matches = CalendarApp.getCalendarsByName(calendarName);
    if (matches.length) {
      return matches[0].getId();
    }
    const normalizedTarget = normalizeCalendarName(calendarName);
    const normalizedMatch = CalendarApp.getAllCalendars().find((calendar) => normalizeCalendarName(calendar.getName()) === normalizedTarget);
    if (normalizedMatch) {
      return normalizedMatch.getId();
    }
  }

  throw new Error("Missing FUNNIFIN_CALENDAR_ID");
}

function lookupCalendars(params) {
  const listAll = params.all === "1" || params.all === "true";
  const name = listAll ? "" : params.name || getRuntimeCalendarName();
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
  const folderId = params.folderId || getRuntimeSlidesRootFolderId() || getRuntimeDriveRootFolderId();
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
  const rootId = payload.folderId || getRuntimeSlidesRootFolderId() || getRuntimeDriveRootFolderId();
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
  const parentId = params.parentId || getRuntimeDriveRootFolderId() || getRuntimeSlidesRootFolderId();
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
  const folderId = params.folderId || getRuntimeSlidesRootFolderId() || getRuntimeDriveRootFolderId();
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
    `Preventivo: ${formatMailMoney(payload.quoteTotal)} + IVA`,
    "",
    "Workshop:",
    workshops,
    payload.driveFolderUrl ? `\nDrive: ${payload.driveFolderUrl}` : "",
    payload.finalDeckUrl ? `Deck finale${payload.finalDeckTitle ? ` (${payload.finalDeckTitle})` : ""}: ${payload.finalDeckUrl}` : "",
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

var FUNNIFIN_LOGO_URL = "https://funnifin-workshop-planner.vercel.app/Logo.png";
var FUNNIFIN_SITE_URL = "https://funnifin-workshop-planner.vercel.app";

function emailBaseTemplate(innerRows) {
  return "<!DOCTYPE html><html lang=\"it\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>FunniFin</title></head>" +
  "<body style=\"margin:0;padding:0;background:#f5fafb;font-family:Nunito,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;\">" +
  "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#f5fafb;padding:32px 16px;\"><tr><td align=\"center\">" +
  "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width:640px;background:#ffffff;border:1px solid #d4edf2;border-radius:18px;overflow:hidden;box-shadow:0 14px 38px rgba(0,79,84,0.10);\">" +
  innerRows +
  "<tr><td style=\"padding:20px 32px 24px;background:#f8fcfc;border-top:1px solid #e0f2f4;text-align:center;\">" +
  "<p style=\"margin:0;font-size:11px;color:#7b9698;line-height:1.6;\">FunniFin Workshop Planner<br>Email di servizio inviata per seguire la richiesta workshop.</p>" +
  "</td></tr>" +
  "</table></td></tr></table></body></html>";
}

function buildWorkflowEmailHtml(payload) {
  const copy = workflowCopy(payload);
  const requesterGrid = mailDataGrid([
    [
      { label: "Nome", value: payload.project.manager || "Referente" },
      { label: "Azienda", value: payload.project.company || "-" },
    ],
    [
      { label: "Email", value: payload.project.email || "-", href: payload.project.email ? "mailto:" + payload.project.email : "" },
      { label: "Telefono", value: payload.project.phone || "-" },
    ],
    [
      { label: "Preventivo", value: formatMailMoney(payload.project.quoteTotal) + " + IVA" },
      { label: "Stato", value: payload.project.status || "-" },
    ],
  ]);

  const workshopRows = (payload.workshops || [])
    .map(function(w, i) {
      var borderTop = i > 0 ? "border-top:1px solid #e0f2f4;" : "";
      var expertLabel = w.expertName
        ? "<span style=\"display:inline-block;padding:3px 10px;border-radius:20px;background:#e8f8f9;color:#004f54;font-size:11px;font-weight:700;\">" + escapeHtml(w.expertName) + "</span>"
        : "<span style=\"display:inline-block;padding:3px 10px;border-radius:20px;background:#f5fafb;color:#6b8a8c;font-size:11px;font-weight:700;\">in assegnazione</span>";
      return "<tr>" +
        "<td style=\"padding:15px 16px;" + borderTop + "\">" +
          "<strong style=\"display:block;color:#171d1d;font-size:15px;line-height:1.35;margin-bottom:6px;\">" + escapeHtml(w.title) + "</strong>" +
          "<span style=\"display:inline-block;margin-right:6px;padding:3px 9px;border-radius:999px;background:#e8f8f9;color:#004f54;font-size:11px;font-weight:700;\">" + escapeHtml(w.duration) + "</span>" +
          "<span style=\"display:inline-block;margin-right:6px;padding:3px 9px;border-radius:999px;background:#f5fafb;color:#5a7a7c;font-size:11px;font-weight:700;\">" + escapeHtml(w.format) + "</span>" +
          "<span style=\"color:#6b8a8c;font-size:12px;\">" + escapeHtml(w.date || "data da concordare") + (w.time ? " &middot; " + escapeHtml(w.time) : "") + "</span>" +
        "</td>" +
        "<td align=\"right\" style=\"padding:15px 16px;" + borderTop + "vertical-align:middle;\">" + expertLabel + "</td>" +
      "</tr>";
    })
    .join("") || "<tr><td style=\"padding:15px 16px;color:#6b8a8c;font-size:13px;\">I workshop saranno aggiunti al riepilogo appena disponibili.</td></tr>";

  const eventBlock = payload.event && (payload.event.htmlLink || payload.event.meetLink)
    ? "<tr><td style=\"padding:0 32px 20px;\">" +
        "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#e8f8f9;border:1px solid #cce8ec;border-radius:12px;padding:16px 20px;\">" +
          "<tr><td>" +
            "<p style=\"margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#1cafb9;\">Evento " + (payload.event.mode === "tentative" ? "in attesa di conferma" : "confermato") + "</p>" +
            (payload.event.htmlLink ? "<a href=\"" + payload.event.htmlLink + "\" style=\"display:inline-block;margin-bottom:6px;color:#004f54;font-weight:700;font-size:13px;\">Apri in Google Calendar</a><br>" : "") +
            (payload.event.meetLink ? "<a href=\"" + payload.event.meetLink + "\" style=\"color:#004f54;font-weight:700;font-size:13px;\">Apri Google Meet</a>" : "") +
          "</td></tr>" +
        "</table>" +
      "</td></tr>"
    : "";

  const ctaBlock = payload.actionUrl
    ? "<tr><td align=\"center\" style=\"padding:0 32px 24px;\">" +
        "<a href=\"" + payload.actionUrl + "\" style=\"display:inline-block;padding:12px 26px;background:#004f54;color:#ffffff;border-radius:999px;font-size:14px;font-weight:800;text-decoration:none;\">" +
          escapeHtml(payload.actionLabel || "Apri il progetto") +
        "</a>" +
      "</td></tr>"
    : "";

  var headerGradient = copy.accent === "warning"
    ? "#7a5c00"
    : copy.accent === "success"
    ? "#005a3a"
    : "#004f54";
  var subtitleColor = copy.accent === "warning" ? "#fff2c2" : copy.accent === "success" ? "#cdf5e6" : "#c8f0f3";

  var innerRows =
    "<tr><td style=\"padding:32px 32px 26px;background:" + headerGradient + ";text-align:center;\">" +
      "<img src=\"" + FUNNIFIN_LOGO_URL + "\" alt=\"FunniFin\" height=\"44\" style=\"display:block;margin:0 auto 18px;max-width:160px;object-fit:contain;\" />" +
      "<h1 style=\"margin:0 0 10px;font-size:24px;line-height:1.18;color:#ffffff;font-weight:800;\">" + escapeHtml(copy.title) + "</h1>" +
      "<p style=\"margin:0 auto;color:" + subtitleColor + ";font-size:14px;line-height:1.6;max-width:440px;\">" + escapeHtml(copy.subtitle) + "</p>" +
    "</td></tr>" +

    "<tr><td style=\"padding:26px 32px 0;\">" +
      "<p style=\"margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#1cafb9;\">Dati richiedente</p>" +
      requesterGrid +
    "</td></tr>" +

    "<tr><td style=\"padding:16px 32px 0;\">" +
      "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"background:#fff8dd;border:1px solid #f5cf45;border-radius:12px;padding:16px 20px;\">" +
        "<tr><td style=\"font-size:13px;color:#5a5200;line-height:1.7;\">" +
          "<strong style=\"display:block;margin-bottom:6px;color:#7a5c00;\">Cosa succede ora</strong>" +
          escapeHtml(copy.body) +
          (payload.note ? "<br><br><strong>Nota:</strong> " + escapeHtml(payload.note) : "") +
        "</td></tr>" +
      "</table>" +
    "</td></tr>" +

    "<tr><td style=\"padding:16px 32px " + (ctaBlock || eventBlock ? "0" : "28px") + ";\">" +
      "<p style=\"margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#1cafb9;\">Workshop collegati</p>" +
      "<table role=\"presentation\" width=\"100%\" cellspacing=\"0\" cellpadding=\"0\" style=\"border:1px solid #cce8ec;border-radius:12px;overflow:hidden;background:#ffffff;\">" +
        workshopRows +
      "</table>" +
    "</td></tr>" +

    eventBlock +
    ctaBlock;

  return emailBaseTemplate(innerRows);
}

function workflowCopy(payload) {
  var map = {
    request_received: {
      title: "Richiesta ricevuta",
      subtitle: "Abbiamo preso in carico la richiesta di workshop.",
      body: "Verifichiamo workshop, preventivo e date proposte. Se manca qualcosa, ti scriviamo noi; altrimenti riceverai il prossimo aggiornamento appena il percorso avanza.",
      accent: "default",
    },
    request_updated: {
      title: "Richiesta aggiornata",
      subtitle: "Abbiamo aggiornato il riepilogo del percorso.",
      body: "Workshop, date o preventivo sono stati ritoccati dal team FunniFin. Qui sotto trovi la versione più recente da tenere come riferimento.",
      accent: "default",
    },
    dates_approved: {
      title: "Date approvate",
      subtitle: "Le date proposte vanno bene.",
      body: "Possiamo passare alla scelta degli esperti più adatti. Ti aggiorniamo quando avremo completato l'assegnazione.",
      accent: "success",
    },
    date_change_requested: {
      title: "Serve una nuova data",
      subtitle: "Una o più date non sono disponibili.",
      body: "Prima di andare avanti abbiamo bisogno di una nuova proposta di data o fascia oraria. Il referente FunniFin ti aiuta a trovare l'opzione migliore.",
      accent: "warning",
    },
    candidacies_open: {
      title: "Stiamo scegliendo gli esperti",
      subtitle: "Gli esperti compatibili possono confermare disponibilità e interesse.",
      body: "Raccogliamo le disponibilità e abbiniamo ogni workshop alla persona più adatta. Ti avvisiamo appena l'assegnazione è pronta.",
      accent: "default",
    },
    expert_assigned: {
      title: "Esperto assegnato",
      subtitle: "Il workshop ha una persona incaricata.",
      body: "L'esperto riceve date, brief e materiali utili alla preparazione. Il prossimo passaggio è la revisione dei contenuti.",
      accent: "success",
    },
    brand_review: {
      title: "Materiali in revisione",
      subtitle: "Il deck passa al controllo brand.",
      body: "Il team brand verifica tono, impaginazione e coerenza dei materiali. Se servono ritocchi li raccogliamo prima della conferma finale.",
      accent: "default",
    },
    final_approval: {
      title: "Approvazione finale",
      subtitle: "La versione finale è pronta per l'ultimo controllo.",
      body: "Prima della conferma a calendario puoi fare l'ultimo giro di verifica. Se qualcosa non torna, segnaliamolo ora così lo sistemiamo prima dell'evento.",
      accent: "default",
    },
    event_tentative: {
      title: "Evento creato in bozza",
      subtitle: "La data è stata bloccata a calendario.",
      body: "Abbiamo creato un evento provvisorio per tenere libera la data. La conferma definitiva arriverà dopo l'ultimo controllo sui materiali.",
      accent: "default",
    },
    event_confirmed: {
      title: "Evento confermato",
      subtitle: "Il workshop è ufficialmente confermato a calendario.",
      body: "L'invito contiene data, partecipanti, link Meet se previsto e riferimenti ai materiali. Ora il workshop è pronto per essere svolto.",
      accent: "success",
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

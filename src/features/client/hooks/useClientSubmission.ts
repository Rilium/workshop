import { useState, type Dispatch, type SetStateAction } from "react";
import { isLargeWorkshopRequest, WORKSHOP_REQUEST_MAX } from "../../../config/workshopRequestLimits";
import { sendWorkshopRequestEmail } from "../../../emailService";
import type { AssetDraftFolder, UploadedAsset } from "../../../driveAssetService";
import {
  createWorkshopRequest,
  type RequestWorkshopRecord,
  type WorkshopRequestRecord,
} from "../../../requestService";
import type {
  ClientContact,
  CommercialConfig,
  ProjectStatus,
  Quote,
  Selection,
  SurveyProfile,
  Workshop,
} from "../../../types/domain";
import { getWorkshopSelectionPrice } from "../../../utils/workshop";
import { clearClientDraft } from "../clientDraft";
import { clearClientSubmissionIdentity } from "../clientSubmissionIdentity";
import type { ClientStep } from "../clientFlowState";

export type SelectedWorkshopRow = { selection: Selection; workshop: Workshop };

type ClientSubmissionOptions = {
  selectedWorkshopRows: SelectedWorkshopRow[];
  allDatesSelected: boolean;
  datesDeferred: boolean;
  contact: ClientContact;
  contactReady: boolean;
  privacyAccepted: boolean;
  quote: Quote;
  commercialConfig: CommercialConfig;
  selectedSurveyProfile: SurveyProfile | null;
  assetFolder: AssetDraftFolder | null;
  uploadedAssets: UploadedAsset[];
  privacyNoticeVersion: string;
  setClientStep: Dispatch<SetStateAction<ClientStep>>;
  setDateSubmitGateOpen: Dispatch<SetStateAction<boolean>>;
  setContactTouched: Dispatch<SetStateAction<boolean>>;
  setProjectStatus: (status: ProjectStatus, title: string, body: string) => void;
  notify: (title: string, body: string) => void;
  onRequestCreated: (request: WorkshopRequestRecord) => void;
};

export function useClientSubmission({
  selectedWorkshopRows,
  allDatesSelected,
  datesDeferred,
  contact,
  contactReady,
  privacyAccepted,
  quote,
  commercialConfig,
  selectedSurveyProfile,
  assetFolder,
  uploadedAssets,
  privacyNoticeVersion,
  setClientStep,
  setDateSubmitGateOpen,
  setContactTouched,
  setProjectStatus,
  notify,
  onRequestCreated,
}: ClientSubmissionOptions) {
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestFinalized, setRequestFinalized] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [emailDeliveryMode, setEmailDeliveryMode] = useState<"pending" | "sent" | "not_sent">("pending");

  const submitRequest = async (deferMissingDates = false) => {
    if (selectedWorkshopRows.length === 0) {
      setClientStep("Workshop");
      notify("Aggiungi almeno un workshop", "Scegli un workshop dal catalogo prima di inviare la richiesta.");
      return;
    }
    if (!allDatesSelected && !datesDeferred && !deferMissingDates) {
      setDateSubmitGateOpen(true);
      return;
    }
    if (!contactReady) {
      setContactTouched(true);
      setClientStep("Invio");
      notify("Dati contatto mancanti", "Compila nome, cognome, azienda e una mail aziendale valida per ricevere il recap.");
      return;
    }
    if (!privacyAccepted) {
      setContactTouched(true);
      setClientStep("Invio");
      notify("Consenso privacy mancante", "Conferma il trattamento dei dati per inviare la richiesta.");
      return;
    }

    if (selectedWorkshopRows.length > WORKSHOP_REQUEST_MAX) {
      setClientStep("Workshop");
      notify("Troppi workshop", `Puoi inviare al massimo ${WORKSHOP_REQUEST_MAX} workshop nella stessa richiesta.`);
      return;
    }
    if (isLargeWorkshopRequest(selectedWorkshopRows.length)) {
      notify(
        "Richiesta molto ampia",
        `Stai inviando ${selectedWorkshopRows.length} workshop. FunniFin verificherà con te pianificazione e fattibilità.`,
      );
    }

    setSendingRequest(true);
    try {
      const requestWorkshops: RequestWorkshopRecord[] = selectedWorkshopRows.map(({ selection, workshop }) => ({
        workshopId: workshop.id,
        title: workshop.title,
        duration: selection.duration,
        format: selection.format,
        date: selection.dateConfirmed ? selection.date : "",
        time: selection.dateConfirmed && selection.date ? selection.time : "",
        price: getWorkshopSelectionPrice(workshop, selection, commercialConfig).total,
        custom: selection.custom,
        recordingIncluded: selection.recordingIncluded !== false,
        promo: selection.promo,
        bundleId: selection.bundleId,
        bundleIds: selection.bundleIds,
        customNote: selection.customNote,
        status: selection.status,
        approval: selection.dateConfirmed ? "pending" : undefined,
      }));
      const request = await createWorkshopRequest({
        contact,
        workshops: requestWorkshops,
        quote: {
          gross: quote.gross,
          discount: quote.quantityDiscount,
          promoDiscount: quote.promoDiscount,
          customTotal: quote.customTotal,
          total: quote.total,
          saved: quote.saved,
          packageName: quote.rule.name,
          recordingDiscount: quote.recordingDiscount,
        },
        surveyProfile: selectedSurveyProfile ?? undefined,
        datesDeferred: datesDeferred || deferMissingDates,
        materials: assetFolder
          ? {
              folderId: assetFolder.id,
              folderName: assetFolder.name,
              folderUrl: assetFolder.url,
              fileCount: uploadedAssets.length,
              draftToken: assetFolder.draftToken,
            }
          : undefined,
        privacy: {
          accepted: true,
          acceptedAt: new Date().toISOString(),
          version: privacyNoticeVersion,
        },
      });
      onRequestCreated(request);
      setProjectStatus(
        "richiesta_inviata",
        "Richiesta salvata",
        "La richiesta è al sicuro. Stiamo inviando il recap email in background.",
      );
      setSubmittedEmail(contact.email.trim());
      setEmailDeliveryMode("pending");
      setRequestFinalized(true);
      clearClientDraft();
      clearClientSubmissionIdentity();
      setSendingRequest(false);

      void sendWorkshopRequestEmail({
        requestId: request.id,
        clientMutationId: request.clientMutationId || "",
        contact: request.contact,
        workshops: request.workshops.map((workshop) => ({
          title: workshop.title,
          duration: workshop.duration,
          format: workshop.format,
          date: workshop.date,
          time: workshop.time,
          price: workshop.price,
          custom: workshop.custom,
          recordingIncluded: workshop.recordingIncluded,
        })),
        quote: request.quote,
      }).then(() => {
        setEmailDeliveryMode("sent");
        setProjectStatus(
          "richiesta_inviata",
          "Richiesta inviata",
          "Il recap è stato inviato. FunniFin verificherà disponibilità e fattibilità.",
        );
      }).catch((error) => {
        const message = error instanceof Error ? error.message : "Email non inviata.";
        setEmailDeliveryMode("not_sent");
        setProjectStatus(
          "richiesta_inviata",
          "Richiesta salvata",
          "La richiesta è al sicuro, ma il recap email non è partito. Il team FunniFin ti ricontatterà.",
        );
        notify("Email non inviata", `${message} La richiesta è comunque salvata.`);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Salvataggio richiesta o invio email non riuscito.";
      notify("Richiesta non completata", `${message} Controlla Apps Script e riprova: non marco questa richiesta come reale finché non viene salvata.`);
    } finally {
      setSendingRequest(false);
    }
  };

  return { sendingRequest, requestFinalized, submittedEmail, emailDeliveryMode, submitRequest };
}

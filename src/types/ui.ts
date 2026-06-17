import type { WorkflowNotificationRecipientRole } from "../emailService";
import type { DateDecision } from "./domain";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "dangerIcon" | "icon";

export type AdminActionModalState =
  | { type: "edit_request" }
  | { type: "date"; workshopId: string; decision: DateDecision }
  | { type: "expert"; workshopId?: string; expertName: string; mode: "assign" | "reassign" }
  | { type: "open_candidacies" }
  | { type: "brand_handoff" }
  | { type: "confirm_event" }
  | { type: "price"; ruleId: string };

export type NotificationChoice = {
  send: boolean;
  recipients: WorkflowNotificationRecipientRole[];
  note: string;
  eventMode?: "tentative" | "confirmed";
  addClientToCalendar?: boolean;
};

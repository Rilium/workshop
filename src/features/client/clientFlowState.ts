import { useReducer, type SetStateAction } from "react";
import type { ClientContact, SurveyProfile } from "../../types/domain";

export type ClientStep = "Interessi" | "Consigliati" | "Workshop" | "Personalizza" | "Date" | "Materiali" | "Invio";
export type ClientJourneyStage = "loader" | "choice" | "survey" | "generating" | "result" | "manual";
export type CatalogSort = "editorial" | "price-asc" | "price-desc" | "title-asc" | "title-desc" | "level-asc" | "duration-asc";

export const ALL_CLIENT_STEPS: ClientStep[] = ["Interessi", "Consigliati", "Workshop", "Personalizza", "Date", "Materiali", "Invio"];

export type ClientFlowState = {
  clientStep: ClientStep;
  clientJourneyStage: ClientJourneyStage;
  choiceSheet: "guided" | "catalog" | null;
  surveyIndex: number;
  surveyAnswers: Record<string, string[]>;
  workshopFilters: { topics: string[]; format: string };
  catalogSort: CatalogSort;
  filtersOpen: boolean;
  surveyCompleted: boolean;
  surveyGateStep: "Interessi" | "Consigliati" | null;
  preserveCatalogAfterSurvey: boolean;
  searchQuery: string;
  catalogMode: "none" | "all" | "bundles" | "workshops";
  datesDeferred: boolean;
  datePlanningMode: "now" | "later" | null;
  selectedSurveyProfile: SurveyProfile | null;
  contactTouched: boolean;
  privacyAccepted: boolean;
  contact: ClientContact;
};

const INITIAL_CLIENT_FLOW_STATE: ClientFlowState = {
  clientStep: "Interessi",
  clientJourneyStage: "loader",
  choiceSheet: null,
  surveyIndex: 0,
  surveyAnswers: {},
  workshopFilters: { topics: [], format: "all" },
  catalogSort: "editorial",
  filtersOpen: false,
  surveyCompleted: false,
  surveyGateStep: null,
  preserveCatalogAfterSurvey: false,
  searchQuery: "",
  catalogMode: "none",
  datesDeferred: false,
  datePlanningMode: null,
  selectedSurveyProfile: null,
  contactTouched: false,
  privacyAccepted: false,
  contact: {
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    phone: "",
  },
};

export type ClientFlowAction = {
  type: "set";
  key: keyof ClientFlowState;
  value: SetStateAction<ClientFlowState[keyof ClientFlowState]>;
};

export function clientFlowReducer(state: ClientFlowState, action: ClientFlowAction): ClientFlowState {
  const previous = state[action.key];
  const value = typeof action.value === "function"
    ? (action.value as (current: typeof previous) => typeof previous)(previous)
    : action.value;
  return { ...state, [action.key]: value };
}

export function createInitialClientFlowState(saved?: Partial<ClientFlowState>): ClientFlowState {
  return {
    ...INITIAL_CLIENT_FLOW_STATE,
    ...saved,
    workshopFilters: {
      ...INITIAL_CLIENT_FLOW_STATE.workshopFilters,
      ...(saved?.workshopFilters ?? {}),
    },
    contact: {
      ...INITIAL_CLIENT_FLOW_STATE.contact,
      ...(saved?.contact ?? {}),
    },
  };
}

export function useClientFlowState(saved?: Partial<ClientFlowState>) {
  const [state, dispatch] = useReducer(clientFlowReducer, saved, createInitialClientFlowState);
  const setter = <Key extends keyof ClientFlowState>(key: Key) =>
    (value: SetStateAction<ClientFlowState[Key]>) => dispatch({
      type: "set",
      key,
      value: value as SetStateAction<ClientFlowState[keyof ClientFlowState]>,
    });

  return {
    state,
    ...state,
    setClientStep: setter("clientStep"),
    setClientJourneyStage: setter("clientJourneyStage"),
    setChoiceSheet: setter("choiceSheet"),
    setSurveyIndex: setter("surveyIndex"),
    setSurveyAnswers: setter("surveyAnswers"),
    setWorkshopFilters: setter("workshopFilters"),
    setCatalogSort: setter("catalogSort"),
    setFiltersOpen: setter("filtersOpen"),
    setSurveyCompleted: setter("surveyCompleted"),
    setSurveyGateStep: setter("surveyGateStep"),
    setPreserveCatalogAfterSurvey: setter("preserveCatalogAfterSurvey"),
    setSearchQuery: setter("searchQuery"),
    setCatalogMode: setter("catalogMode"),
    setDatesDeferred: setter("datesDeferred"),
    setDatePlanningMode: setter("datePlanningMode"),
    setSelectedSurveyProfile: setter("selectedSurveyProfile"),
    setContactTouched: setter("contactTouched"),
    setPrivacyAccepted: setter("privacyAccepted"),
    setContact: setter("contact"),
  };
}

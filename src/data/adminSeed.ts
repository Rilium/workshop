import type { ExpertProfile } from "../types/domain";

export const initialExpertProfiles: ExpertProfile[] = [
  {
    id: "laura-bianchi",
    firstName: "Laura",
    lastName: "Bianchi",
    email: "",
    photo: "",
    bio: "Profilo esperto FunniFin associato ai topic del catalogo.",
    topicIds: ["risparmio", "pensione", "investimenti"],
    themeIds: [],
    availability: "3 slot liberi",
  },
  {
    id: "marco-serra",
    firstName: "Marco",
    lastName: "Serra",
    email: "",
    photo: "",
    bio: "Profilo esperto FunniFin associato ai topic del catalogo.",
    topicIds: ["fiscalita", "finanziamenti", "famiglia"],
    themeIds: [],
    availability: "2 slot liberi",
  },
  {
    id: "giulia-riva",
    firstName: "Giulia",
    lastName: "Riva",
    email: "",
    photo: "",
    bio: "Profilo esperto FunniFin associato ai topic del catalogo.",
    topicIds: ["risparmio", "assicurazione", "extra"],
    themeIds: [],
    availability: "5 slot liberi",
  },
  {
    id: "andrea-conti",
    firstName: "Andrea",
    lastName: "Conti",
    email: "",
    photo: "",
    bio: "Profilo esperto FunniFin associato ai topic del catalogo.",
    topicIds: ["investimenti", "finanziamenti", "pensione"],
    themeIds: [],
    availability: "1 slot libero",
  },
];

export const canvaCatalogSource = {
  url: "https://canva.link/q4s0wnx4ot4jmrg",
  fileName: "Catalogo workshop.pdf",
  pages: 9,
  workshopCards: 17,
  singleWorkshopCards: 16,
  specialOffers: 3,
  label: "Catalogo visuale Canva",
};

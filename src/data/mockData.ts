import type { Role } from "../types/domain";

export const roleOptions: Role[] = ["Cliente", "FunniFin", "Esperto", "Brand"];
export const roleIdentities: Record<Exclude<Role, "Cliente">, { name: string; email: string; role: string; note: string }> = {
  FunniFin: {
    name: "Team FunniFin",
    email: "rinaldi.rilio@gmail.com",
    role: "Operations",
    note: "Gestione richieste, calendario, esperti e avanzamento progetto.",
  },
  Esperto: {
    name: "Laura Bianchi",
    email: "rinaldi.rilio+3@gmail.com",
    role: "Esperto",
    note: "Candidature, disponibilita e deck assegnati.",
  },
  Brand: {
    name: "Brand Review",
    email: "rinaldi.rilio+4@gmail.com",
    role: "Brand",
    note: "Revisione materiali, versioni e approvazioni finali.",
  },
};

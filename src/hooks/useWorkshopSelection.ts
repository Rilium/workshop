import { useState } from "react";
import type { Selection, Workshop } from "../types/domain";

export function useWorkshopSelection(workshops: Workshop[], notify: (title: string, body: string) => void) {
  const [selections, setSelections] = useState<Selection[]>([]);

  const toggleWorkshop = (workshopId: string) => {
    const workshop = workshops.find((item) => item.id === workshopId)!;
    const alreadySelected = selections.some((selection) => selection.workshopId === workshopId);
    setSelections((current) => {
      if (current.some((selection) => selection.workshopId === workshopId)) {
        return current.filter((selection) => selection.workshopId !== workshopId);
      }
      return [
        ...current,
        {
          workshopId,
          duration: workshop.durationOptions[0],
          format: workshop.formatOptions[0],
          custom: false,
          promo: false,
          date: "",
          time: "10:00",
          dateConfirmed: false,
          status: "selezionato",
        },
      ];
    });
    notify(
      alreadySelected ? "Workshop rimosso" : "Workshop aggiunto",
      alreadySelected
        ? workshop.title + " non e piu nel preventivo."
        : workshop.title + " e stato aggiunto. Ora scegli date e formato.",
    );
  };

  const addWorkshops = (workshopIds: string[]) => {
    const uniqueIds = Array.from(new Set(workshopIds));
    setSelections((current) => {
      const selectedIds = new Set(current.map((selection) => selection.workshopId));
      const additions = uniqueIds
        .filter((id) => !selectedIds.has(id))
        .map((id) => {
          const workshop = workshops.find((item) => item.id === id);
          if (!workshop) return null;
          return {
            workshopId: id,
            duration: workshop.durationOptions[0],
            format: workshop.formatOptions[0],
            custom: false,
            promo: false,
            date: "",
            time: "10:00",
            dateConfirmed: false,
            status: "selezionato",
          } satisfies Selection;
        })
        .filter(Boolean) as Selection[];
      return [...current, ...additions];
    });
  };

  const updateSelection = (workshopId: string, patch: Partial<Selection>) => {
    setSelections((current) =>
      current.map((selection) => (selection.workshopId === workshopId ? { ...selection, ...patch } : selection)),
    );
    if (patch.date || patch.time || patch.format || patch.duration || patch.promo !== undefined) {
      notify("Configurazione aggiornata", "Preventivo e prossima azione sono stati aggiornati.");
    }
  };

  return { selections, setSelections, toggleWorkshop, addWorkshops, updateSelection };
}

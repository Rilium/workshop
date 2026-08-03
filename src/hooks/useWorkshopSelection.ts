import { useState } from "react";
import type { CatalogBundle, Format, Selection, Workshop } from "../types/domain";

export function useWorkshopSelection(
  workshops: Workshop[],
  notify: (title: string, body: string) => void,
  recordingDefault = true,
) {
  const [selections, setSelections] = useState<Selection[]>([]);
  const debugNotify = (title: string, body: string) => {
    if (import.meta.env.DEV) notify(title, body);
  };

  const toggleWorkshop = (workshopId: string) => {
    const workshop = workshops.find((item) => item.id === workshopId)!;
    const alreadySelected = selections.some((selection) => selection.workshopId === workshopId);
    setSelections((current) => {
      const currentSelection = current.find((selection) => selection.workshopId === workshopId);
      if (currentSelection) {
        return current
          .filter((selection) => selection.workshopId !== workshopId)
          .map((selection) =>
            currentSelection.bundleId && selection.bundleId === currentSelection.bundleId
              ? { ...selection, bundleId: undefined }
              : selection,
          );
      }
      return [
        ...current,
        {
          workshopId,
          duration: workshop.durationOptions[0],
          format: workshop.formatOptions[0],
          custom: false,
          recordingIncluded: recordingDefault,
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
        ? selections.find((selection) => selection.workshopId === workshopId)?.bundleId
          ? `${workshop.title} è stato rimosso. Il prezzo del pacchetto non è più applicato e il totale è stato ricalcolato sui workshop rimasti.`
          : workshop.title + " non e piu nel preventivo."
        : workshop.title + " e stato aggiunto. Ora scegli date e formato.",
    );
  };

  const addWorkshops = (workshopIds: string[], options?: { bundleId?: string; format?: Format }) => {
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
            bundleId: options?.bundleId,
            duration: workshop.durationOptions[0],
            format: options?.format ?? workshop.formatOptions[0],
            custom: false,
            recordingIncluded: recordingDefault,
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

  const selectBundle = (bundle: CatalogBundle, format?: Format) => {
    const memberIds = new Set(bundle.workshopIds);
    setSelections((current) => {
      const byId = new Map<string, Selection>(
        current.map((selection) => [selection.workshopId, { ...selection, bundleId: undefined }]),
      );
      bundle.workshopIds.forEach((workshopId) => {
        const workshop = workshops.find((item) => item.id === workshopId);
        if (!workshop) return;
        const existing = byId.get(workshopId);
        byId.set(workshopId, {
          workshopId,
          bundleId: bundle.id,
          duration: existing?.duration ?? workshop.durationOptions[0],
          format: format ?? existing?.format ?? workshop.formatOptions[0],
          custom: existing?.custom ?? false,
          customNote: existing?.customNote,
          recordingIncluded: existing?.recordingIncluded ?? recordingDefault,
          promo: existing?.promo ?? false,
          date: existing?.date ?? "",
          time: existing?.time ?? "10:00",
          dateConfirmed: existing?.dateConfirmed ?? false,
          status: existing?.status ?? "selezionato",
        });
      });
      return Array.from(byId.values()).filter((selection) => memberIds.has(selection.workshopId) || !selection.bundleId);
    });
    notify("Pacchetto aggiunto", `${bundle.title} è ora il pacchetto principale del percorso.`);
  };

  const updateSelection = (workshopId: string, patch: Partial<Selection>) => {
    setSelections((current) =>
      current.map((selection) => (selection.workshopId === workshopId ? { ...selection, ...patch } : selection)),
    );
    if (patch.date || patch.time || patch.format || patch.duration || patch.promo !== undefined) {
      debugNotify("Configurazione aggiornata", "Preventivo e prossima azione sono stati aggiornati.");
    }
  };

  const clearSelections = () => {
    if (selections.length === 0) return;
    setSelections([]);
    notify("Carrello svuotato", "Tutti i workshop sono stati rimossi dal percorso.");
  };

  return { selections, setSelections, toggleWorkshop, addWorkshops, selectBundle, updateSelection, clearSelections };
}

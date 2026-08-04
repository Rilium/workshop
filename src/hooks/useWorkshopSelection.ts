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
    const selectedWorkshop = selections.find((selection) => selection.workshopId === workshopId);
    const alreadySelected = Boolean(selectedWorkshop);
    const invalidatedBundleIds = selectedWorkshop?.bundleIds ?? (selectedWorkshop?.bundleId ? [selectedWorkshop.bundleId] : []);
    setSelections((current) => {
      const currentSelection = current.find((selection) => selection.workshopId === workshopId);
      if (currentSelection) {
        const invalidatedBundleIds = currentSelection.bundleIds ?? (currentSelection.bundleId ? [currentSelection.bundleId] : []);
        return current
          .filter((selection) => selection.workshopId !== workshopId)
          .map((selection) => {
            const remainingBundleIds = (selection.bundleIds ?? (selection.bundleId ? [selection.bundleId] : []))
              .filter((bundleId) => !invalidatedBundleIds.includes(bundleId));
            return { ...selection, bundleId: remainingBundleIds[0], bundleIds: remainingBundleIds };
          });
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
        ? invalidatedBundleIds.length > 0
          ? `${workshop.title} è stato rimosso. ${invalidatedBundleIds.length === 1 ? "Il pacchetto collegato non è più completo" : `${invalidatedBundleIds.length} pacchetti collegati non sono più completi`} e il totale è stato ricalcolato sui workshop rimasti.`
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
            bundleIds: options?.bundleId ? [options.bundleId] : [],
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
    const absorbedStandaloneCount = bundle.workshopIds.filter((workshopId) => {
      const selection = selections.find((item) => item.workshopId === workshopId);
      return selection && !(selection.bundleIds?.length || selection.bundleId);
    }).length;
    const sharedBundleCount = bundle.workshopIds.filter((workshopId) => {
      const selection = selections.find((item) => item.workshopId === workshopId);
      return Boolean(selection?.bundleIds?.length || selection?.bundleId);
    }).length;
    setSelections((current) => {
      const byId = new Map<string, Selection>(
        current.map((selection) => [selection.workshopId, selection]),
      );
      bundle.workshopIds.forEach((workshopId) => {
        const workshop = workshops.find((item) => item.id === workshopId);
        if (!workshop) return;
        const existing = current.find((selection) => selection.workshopId === workshopId);
        const bundleIds = Array.from(new Set([
          ...(existing?.bundleIds ?? (existing?.bundleId ? [existing.bundleId] : [])),
          bundle.id,
        ]));
        byId.set(workshopId, {
          workshopId,
          bundleId: bundleIds[0],
          bundleIds,
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
      return Array.from(byId.values());
    });
    if (absorbedStandaloneCount > 0 || sharedBundleCount > 0) {
      const details = [
        absorbedStandaloneCount > 0
          ? `${absorbedStandaloneCount} ${absorbedStandaloneCount === 1 ? "workshop singolo già presente è stato assorbito" : "workshop singoli già presenti sono stati assorbiti"}`
          : "",
        sharedBundleCount > 0
          ? `${sharedBundleCount} ${sharedBundleCount === 1 ? "workshop è condiviso" : "workshop sono condivisi"} con altri pacchetti`
          : "",
      ].filter(Boolean).join("; ");
      notify("Pacchetto aggiunto senza doppioni", `${bundle.title}: ${details}. Il preventivo è stato ricalcolato automaticamente.`);
    } else {
      notify("Pacchetto aggiunto", `${bundle.title} è stato aggiunto al percorso.`);
    }
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

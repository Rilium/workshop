import { useEffect, useState } from "react";
import { isLargeWorkshopRequest, WORKSHOP_REQUEST_MAX } from "../config/workshopRequestLimits";
import type { CatalogBundle, Format, Selection, Workshop } from "../types/domain";

export function useWorkshopSelection(
  workshops: Workshop[],
  notify: (title: string, body: string) => void,
  recordingDefault = true,
  initialSelections: Selection[] = [],
) {
  const [selections, setSelections] = useState<Selection[]>(() => initialSelections);
  const debugNotify = (title: string, body: string) => {
    if (import.meta.env.DEV) notify(title, body);
  };

  const toggleWorkshop = (workshopId: string) => {
    const workshop = workshops.find((item) => item.id === workshopId)!;
    const selectedWorkshop = selections.find((selection) => selection.workshopId === workshopId);
    const alreadySelected = Boolean(selectedWorkshop);
    const nextCount = selections.length + (alreadySelected ? -1 : 1);
    if (!alreadySelected && nextCount > WORKSHOP_REQUEST_MAX) {
      notify("Limite workshop raggiunto", `Puoi inserire fino a ${WORKSHOP_REQUEST_MAX} workshop nella stessa richiesta.`);
      return;
    }
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
          time: "",
          dateConfirmed: false,
          status: "selezionato",
        },
      ];
    });
    if (!alreadySelected && isLargeWorkshopRequest(nextCount)) {
      notify(
        "Richiesta molto ampia",
        `Hai selezionato ${nextCount} workshop. Puoi continuare fino a ${WORKSHOP_REQUEST_MAX}; FunniFin verificherà con te pianificazione e fattibilità.`,
      );
      return;
    }
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
    const selectedIds = new Set(selections.map((selection) => selection.workshopId));
    const newValidIds = uniqueIds.filter((id) => !selectedIds.has(id) && workshops.some((workshop) => workshop.id === id));
    const nextCount = selections.length + newValidIds.length;
    if (nextCount > WORKSHOP_REQUEST_MAX) {
      notify("Limite workshop raggiunto", `Questa aggiunta porterebbe il percorso a ${nextCount} workshop. Il massimo per richiesta è ${WORKSHOP_REQUEST_MAX}.`);
      return;
    }
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
            time: "",
            dateConfirmed: false,
            status: "selezionato",
          } satisfies Selection;
        })
        .filter(Boolean) as Selection[];
      return [...current, ...additions];
    });
    if (newValidIds.length > 0 && isLargeWorkshopRequest(nextCount)) {
      notify(
        "Richiesta molto ampia",
        `Il percorso contiene ${nextCount} workshop. Puoi continuare fino a ${WORKSHOP_REQUEST_MAX}; FunniFin verificherà con te pianificazione e fattibilità.`,
      );
    }
  };

  const selectBundle = (bundle: CatalogBundle, format?: Format) => {
    const selectedIds = new Set(selections.map((selection) => selection.workshopId));
    const newValidIds = bundle.workshopIds.filter((id) => !selectedIds.has(id) && workshops.some((workshop) => workshop.id === id));
    const nextCount = selections.length + newValidIds.length;
    if (nextCount > WORKSHOP_REQUEST_MAX) {
      notify("Limite workshop raggiunto", `Questo pacchetto porterebbe il percorso a ${nextCount} workshop. Il massimo per richiesta è ${WORKSHOP_REQUEST_MAX}.`);
      return;
    }
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
          time: existing?.time ?? "",
          dateConfirmed: existing?.dateConfirmed ?? false,
          status: existing?.status ?? "selezionato",
        });
      });
      return Array.from(byId.values());
    });
    if (newValidIds.length > 0 && isLargeWorkshopRequest(nextCount)) {
      notify(
        "Richiesta molto ampia",
        `Il percorso contiene ${nextCount} workshop. Puoi continuare fino a ${WORKSHOP_REQUEST_MAX}; FunniFin verificherà con te pianificazione e fattibilità.`,
      );
    } else if (absorbedStandaloneCount > 0 || sharedBundleCount > 0) {
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

  const removeBundle = (bundle: CatalogBundle) => {
    setSelections((current) => current.flatMap((selection) => {
      const bundleIds = (selection.bundleIds ?? (selection.bundleId ? [selection.bundleId] : []))
        .filter((bundleId) => bundleId !== bundle.id);
      if (!bundle.workshopIds.includes(selection.workshopId)) return [selection];
      if (bundleIds.length === 0) return [];
      return [{ ...selection, bundleId: bundleIds[0], bundleIds }];
    }));
    notify("Pacchetto rimosso", `${bundle.title} è stato rimosso dal percorso.`);
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

  useEffect(() => {
    if (workshops.length === 0) return;
    const workshopById = new Map(workshops.map((workshop) => [workshop.id, workshop]));
    setSelections((current) => current
      .filter((selection) => workshopById.has(selection.workshopId))
      .map((selection) => {
        const workshop = workshopById.get(selection.workshopId)!;
        const duration = workshop.durationOptions.includes(selection.duration)
          ? selection.duration
          : workshop.durationOptions[0];
        const format = workshop.formatOptions.includes(selection.format)
          ? selection.format
          : workshop.formatOptions.includes("webinar") ? "webinar" : workshop.formatOptions[0];
        return duration === selection.duration && format === selection.format
          ? selection
          : { ...selection, duration, format };
      }));
  }, [workshops]);

  return { selections, setSelections, toggleWorkshop, addWorkshops, selectBundle, removeBundle, updateSelection, clearSelections };
}

import { BookOpen, Check, ChevronDown, Plus, Sparkles } from "../ui/FaIcons";
import type { CatalogBundle, CommercialConfig, Workshop } from "../../types/domain";
import { money } from "../../utils/money";
import { getBundlePrice } from "../../utils/workshop";
import { AppButton } from "../ui/AppButton";
import { ExpandableCardText } from "../ui/ExpandableCardText";

export function BundleCard({
  bundle,
  workshops,
  selected,
  onSelect,
  onOpenWorkshop,
  commercialConfig,
}: {
  bundle: CatalogBundle;
  workshops: Workshop[];
  selected: boolean;
  onSelect: () => void;
  onOpenWorkshop: (workshop: Workshop) => void;
  commercialConfig: CommercialConfig;
}) {
  const members = bundle.workshopIds
    .map((workshopId) => workshops.find((workshop) => workshop.id === workshopId))
    .filter(Boolean) as Workshop[];
  const listPrice = members.length * commercialConfig.workshopBasePrice;
  const fixedPrice = getBundlePrice(bundle, commercialConfig);
  const pathwayLabel = bundle.size === 3 ? "Percorso essenziale" : bundle.size === 6 ? "Percorso avanzato" : "Percorso completo";

  return (
    <article id={`bundle-${bundle.id}`} className={`bundle-card ${selected ? "selected" : ""}`}>
      <div className="bundle-card-heading">
        <span className="bundle-kicker">
          <Sparkles size={14} /> {pathwayLabel}
        </span>
        {selected && <span className="bundle-selected-label"><Check size={14} /> Nel percorso</span>}
      </div>
      <div className="bundle-card-copy">
        <strong>{bundle.title}</strong>
        <ExpandableCardText text={bundle.description || "Un percorso editoriale FunniFin già composto e ordinato per accompagnare l’apprendimento."} />
      </div>
      <div className="bundle-price-row">
        <div>
          <strong>{money(fixedPrice)}</strong>
          <span>invece di {money(listPrice)}</span>
        </div>
        <em>Risparmi {money(Math.max(0, listPrice - fixedPrice))}</em>
      </div>
      <details className="bundle-member-disclosure">
        <summary>
          <span><BookOpen size={16} /> Contenuti del percorso</span>
          <ChevronDown size={16} />
        </summary>
        <ol>
          {members.map((workshop, index) => (
            <li key={workshop.id}>
              <span>{index + 1}</span>
              <button type="button" onClick={() => onOpenWorkshop(workshop)}>
                <strong>{workshop.title}</strong>
                <small>{workshop.short}</small>
              </button>
            </li>
          ))}
        </ol>
      </details>
      <AppButton variant={selected ? "outline" : "secondary"} onClick={onSelect} disabled={selected}>
        {selected ? <Check size={16} /> : <Plus size={16} />}
        {selected ? "Pacchetto selezionato" : "Aggiungi il pacchetto"}
      </AppButton>
    </article>
  );
}

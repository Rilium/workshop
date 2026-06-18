import { Moon, Sun } from "lucide-react";

export function DarkModeToggle({
  isDark,
  onToggle,
}: {
  isDark: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={"dark-mode-toggle" + (isDark ? " dark-mode-toggle--dark" : "")}
      onClick={onToggle}
      aria-label={isDark ? "Attiva modalità chiara" : "Attiva modalità scura"}
      title={isDark ? "Modalità chiara" : "Modalità scura"}
    >
      <span className="dark-mode-toggle__track">
        <span className="dark-mode-toggle__thumb">
          <Sun className="dark-mode-toggle__icon dark-mode-toggle__icon--sun" size={13} />
          <Moon className="dark-mode-toggle__icon dark-mode-toggle__icon--moon" size={13} />
        </span>
      </span>
    </button>
  );
}

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "funnifin_theme_preference_v2";
const LIGHT_THEME_COLOR = "#f6faf8";
const DARK_THEME_COLOR = "#141c1c";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return stored === "dark" || stored === "light" ? stored : "light";
}

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return getInitialTheme();
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    themeColor?.setAttribute("content", theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }, [theme]);

  const toggle = () => setTheme((current) => {
    const next = current === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // La preferenza resta attiva per la sessione anche senza storage disponibile.
    }
    return next;
  });

  return { theme, toggle, isDark: theme === "dark" };
}

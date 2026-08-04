try {
  if (localStorage.getItem("funnifin_theme_preference_v2") === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#141c1c");
  }
} catch {
  document.documentElement.setAttribute("data-theme", "light");
}

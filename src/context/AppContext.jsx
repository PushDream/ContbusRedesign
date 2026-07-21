import { createContext, useContext, useMemo, useState } from "react";
import { copy } from "../data/content.js";
import { useDarkMode } from "../lib/useDarkMode.js";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [language, setLanguage] = useState("pl");
  const [dark, setDark] = useDarkMode();
  const t = useMemo(() => copy[language], [language]);

  return (
    <AppContext.Provider value={{ language, setLanguage, dark, setDark, t }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

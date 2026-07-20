"use client";

import { createContext, useContext, useEffect, useMemo } from "react";

type PortalTheme = "lime";

type ThemeContextValue = {
  theme: PortalTheme;
  toggleTheme: () => void;
};

const DashboardThemeContext = createContext<ThemeContextValue | null>(null);

export function useDashboardTheme() {
  const value = useContext(DashboardThemeContext);

  if (!value) {
    return {
      theme: "lime",
      toggleTheme: () => {},
    };
  }

  return value;
}

export default function DashboardThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.portalTheme = "lime";
    window.localStorage.removeItem("ar360_customer_portal_theme");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: "lime",
      toggleTheme: () => {},
    }),
    []
  );

  return <DashboardThemeContext.Provider value={value}>{children}</DashboardThemeContext.Provider>;
}

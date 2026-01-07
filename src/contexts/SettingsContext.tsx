import React, { createContext, useContext, useEffect, useState } from "react";
import { CloudProvider } from "@/lib/cloud-providers";

interface Settings {
  fontSize: number;
  lineNumbers: boolean;
  wordWrap: boolean;
  defaultImageUploadProvider: CloudProvider | null;
}

interface SettingsContextType extends Settings {
  updateSettings: (newSettings: Partial<Settings>) => void;
}

const DEFAULT_SETTINGS: Settings = {
  fontSize: 14,
  lineNumbers: true,
  wordWrap: true,
  defaultImageUploadProvider: null,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem("md-editor-settings");
    return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem("md-editor-settings", JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <SettingsContext.Provider value={{ ...settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
};

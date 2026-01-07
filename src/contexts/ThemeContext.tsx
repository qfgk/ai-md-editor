import * as React from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(defaultTheme);

  React.useEffect(() => {
    // 禁用过渡动画，实现瞬间切换
    document.documentElement.style.setProperty('color-scheme', theme);
    const root = document.documentElement;

    // 添加禁用过渡的类
    root.classList.add('theme-switching');

    // 使用 requestAnimationFrame 确保在下一帧应用主题变化
    requestAnimationFrame(() => {
      root.classList.remove("light", "dark");
      root.classList.add(theme);

      // 在主题应用后，短暂延迟后移除禁用类
      setTimeout(() => {
        root.classList.remove('theme-switching');
      }, 50);
    });
  }, [theme]);

  const toggleTheme = () => {
    if (switchable) {
      setTheme((prev) => (prev === "light" ? "dark" : "light"));
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}


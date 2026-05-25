import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSetting, setSetting } from '@/database';
import { Themes, ThemeId } from '@/constants/theme';

interface ThemeContextType {
  themeId: ThemeId;
  colors: typeof Themes[ThemeId]['colors'];
  setThemeId: (id: ThemeId) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  themeId: 'catppuccin-mocha',
  colors: Themes['catppuccin-mocha'].colors,
  setThemeId: async () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState<ThemeId>('catppuccin-mocha');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await getSetting('theme_id', 'catppuccin-mocha');
        if (Themes[saved as ThemeId]) {
          setThemeIdState(saved as ThemeId);
        }
      } catch (e) {
        // ignore
      } finally {
        setIsLoaded(true);
      }
    }
    loadTheme();
  }, []);

  const setThemeId = async (id: ThemeId) => {
    if (Themes[id]) {
      setThemeIdState(id);
      await setSetting('theme_id', id);
    }
  };

  if (!isLoaded) return null;

  return (
    <ThemeContext.Provider value={{ themeId, colors: Themes[themeId].colors, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

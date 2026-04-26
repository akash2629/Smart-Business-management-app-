import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

export type ThemeMode = 'light' | 'dark' | 'forest' | 'eye-comfort';

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
  updateColors: (newColors: Partial<ThemeColors>) => Promise<void>;
  resetTheme: () => Promise<void>;
}

const defaultColors: ThemeColors = {
  primary: '#0f172a',
  secondary: '#64748b',
  accent: '#10b981',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('app-theme-mode');
    return (saved as ThemeMode) || 'forest';
  });
  const [colors, setColors] = useState<ThemeColors>(defaultColors);

  // Sync mode with document class
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'forest', 'eye-comfort');
    root.classList.add(mode);
    localStorage.setItem('app-theme-mode', mode);
  }, [mode]);

  // Sync colors with CSS variables
  useEffect(() => {
    const root = window.document.documentElement;
    root.style.setProperty('--brand-primary', colors.primary);
    root.style.setProperty('--brand-secondary', colors.secondary);
    root.style.setProperty('--brand-accent', colors.accent);
  }, [colors]);

  // Fetch settings from Firestore
  useEffect(() => {
    if (!user) {
      setColors(defaultColors);
      return;
    }

    const fetchTheme = async () => {
      try {
        const themeDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'theme'));
        if (themeDoc.exists()) {
          const data = themeDoc.data() as ThemeColors;
          setColors({
            primary: data.primary || defaultColors.primary,
            secondary: data.secondary || defaultColors.secondary,
            accent: data.accent || defaultColors.accent,
          });
        }
      } catch (error) {
        console.error('Error fetching theme:', error);
      }
    };

    fetchTheme();
  }, [user]);

  const updateColors = async (newColors: Partial<ThemeColors>) => {
    const updated = { ...colors, ...newColors };
    setColors(updated);

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'settings', 'theme'), updated);
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    }
  };

  const resetTheme = async () => {
    setColors(defaultColors);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'settings', 'theme'), defaultColors);
      } catch (error) {
        console.error('Error resetting theme:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, setMode, colors, updateColors, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

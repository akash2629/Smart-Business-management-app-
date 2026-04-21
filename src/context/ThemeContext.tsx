import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface ThemeContextType {
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
  const [colors, setColors] = useState<ThemeColors>(defaultColors);

  useEffect(() => {
    // Apply colors to CSS variables
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', colors.primary);
    root.style.setProperty('--brand-secondary', colors.secondary);
    root.style.setProperty('--brand-accent', colors.accent);
  }, [colors]);

  useEffect(() => {
    if (!user) {
      setColors(defaultColors);
      return;
    }

    const themeDoc = doc(db, 'user_settings', user.uid);
    
    const unsubscribe = onSnapshot(themeDoc, (docSnap) => {
      if (docSnap.exists() && docSnap.data().theme) {
        setColors({ ...defaultColors, ...docSnap.data().theme });
      } else {
        setColors(defaultColors);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const updateColors = async (newColors: Partial<ThemeColors>) => {
    const updated = { ...colors, ...newColors };
    setColors(updated);

    if (user) {
      try {
        await setDoc(doc(db, 'user_settings', user.uid), {
          theme: updated
        }, { merge: true });
      } catch (error) {
        console.error('Failed to save theme:', error);
      }
    }
  };

  const resetTheme = async () => {
    setColors(defaultColors);
    if (user) {
      try {
        await setDoc(doc(db, 'user_settings', user.uid), {
          theme: defaultColors
        }, { merge: true });
      } catch (error) {
        console.error('Failed to reset theme:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ colors, updateColors, resetTheme }}>
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

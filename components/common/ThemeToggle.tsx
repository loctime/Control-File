'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/common/ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex h-8 w-16 items-center rounded-full bg-secondary transition-colors duration-300 ease-in-out hover:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:bg-secondary"
      role="switch"
      aria-checked={theme === 'dark'}
      aria-label="Cambiar modo oscuro"
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform duration-300 ease-in-out ${
          theme === 'dark' ? 'translate-x-8' : 'translate-x-1'
        }`}
      >
        {theme === 'light' ? (
          <Sun className="h-4 w-4 text-yellow-500 m-1" />
        ) : (
          <Moon className="h-4 w-4 text-blue-400 m-1" />
        )}
      </span>
    </button>
  );
}

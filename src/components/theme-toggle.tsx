"use client";

import * as React from "react";
import { Moon, Sun, Monitor, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={`h-9 w-9 rounded-xl text-slate-500 ${className || ""}`}
        aria-label="Changer de thème"
      >
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const currentIcon =
    theme === "dark" ? (
      <Moon className="h-4 w-4 text-sky-400 transition-transform hover:scale-110" />
    ) : theme === "light" ? (
      <Sun className="h-4 w-4 text-amber-500 transition-transform hover:scale-110" />
    ) : (
      <Monitor className="h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform hover:scale-110" />
    );

  const themeLabel =
    theme === "dark" ? "Sombre" : theme === "light" ? "Clair" : "Automatique";

  return (
    <div className="relative inline-block" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={`h-9 w-9 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 ${className || ""}`}
        title={`Thème d'affichage : ${themeLabel} (cliquer pour changer)`}
        aria-label="Choisir le thème d'affichage"
      >
        {currentIcon}
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-40 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1 z-50 text-xs font-medium animate-in fade-in-50 zoom-in-95">
          <button
            type="button"
            onClick={() => {
              setTheme("light");
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${
              theme === "light"
                ? "bg-blue-50 dark:bg-blue-950/40 text-[#1E3A5F] dark:text-sky-300 font-bold"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" />
              <span>Clair</span>
            </div>
            {theme === "light" && <Check className="h-3.5 w-3.5 text-[#1E3A5F] dark:text-sky-400" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("dark");
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${
              theme === "dark"
                ? "bg-blue-50 dark:bg-blue-950/40 text-[#1E3A5F] dark:text-sky-300 font-bold"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4 text-sky-400" />
              <span>Sombre</span>
            </div>
            {theme === "dark" && <Check className="h-3.5 w-3.5 text-[#1E3A5F] dark:text-sky-400" />}
          </button>

          <button
            type="button"
            onClick={() => {
              setTheme("system");
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg transition-colors ${
              theme === "system"
                ? "bg-blue-50 dark:bg-blue-950/40 text-[#1E3A5F] dark:text-sky-300 font-bold"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Système</span>
            </div>
            {theme === "system" && <Check className="h-3.5 w-3.5 text-[#1E3A5F] dark:text-sky-400" />}
          </button>
        </div>
      )}
    </div>
  );
}

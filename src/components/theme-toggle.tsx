"use client";

import * as React from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

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

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const getLabel = () => {
    if (theme === "dark") return "Mode sombre actif (cliquer pour Système)";
    if (theme === "light") return "Mode clair actif (cliquer pour Sombre)";
    return "Mode système actif (cliquer pour Clair)";
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className={`h-9 w-9 rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 ${className || ""}`}
      title={getLabel()}
      aria-label={getLabel()}
    >
      {theme === "dark" ? (
        <Moon className="h-4 w-4 text-sky-400 transition-transform hover:scale-110" />
      ) : theme === "light" ? (
        <Sun className="h-4 w-4 text-amber-500 transition-transform hover:scale-110" />
      ) : (
        <Monitor className="h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform hover:scale-110" />
      )}
    </Button>
  );
}

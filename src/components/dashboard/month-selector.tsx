"use client";

import { useUIStore } from "@/lib/store/ui-store";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

export function MonthSelector() {
  const { activeMonth, setActiveMonth } = useUIStore();
  const now = new Date();
  const currentRealYear = now.getFullYear();
  const currentRealMonth = now.getMonth() + 1;

  const isCurrentRealMonth = 
    activeMonth.year === currentRealYear && activeMonth.month === currentRealMonth;

  // Format month name (long for desktop, short for mobile)
  const dateObj = new Date(activeMonth.year, activeMonth.month - 1, 1);
  const formattedMonth = dateObj.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const capitalizedMonth = formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1);

  const shortMonth = dateObj.toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
  });
  const capitalizedShortMonth = shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1);

  const handlePrev = () => {
    if (activeMonth.month === 1) {
      setActiveMonth(activeMonth.year - 1, 12);
    } else {
      setActiveMonth(activeMonth.year, activeMonth.month - 1);
    }
  };

  const handleNext = () => {
    if (activeMonth.month === 12) {
      setActiveMonth(activeMonth.year + 1, 1);
    } else {
      setActiveMonth(activeMonth.year, activeMonth.month + 1);
    }
  };

  const handleResetToCurrent = () => {
    setActiveMonth(currentRealYear, currentRealMonth);
  };

  return (
    <div className="inline-flex items-center gap-0.5 sm:gap-1.5 bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 rounded-xl p-1 shadow-xs transition-colors">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
        title="Mois précédent"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1 sm:gap-1.5 px-1 sm:px-2.5 py-1 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 select-none">
        <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#1E3A5F] dark:text-sky-400 shrink-0" />
        <span className="sm:hidden">{capitalizedShortMonth}</span>
        <span className="hidden sm:inline">{capitalizedMonth}</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
        title="Mois suivant"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrentRealMonth && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetToCurrent}
          className="h-7 text-[11px] sm:text-xs text-blue-600 dark:text-sky-400 border-blue-200 dark:border-sky-500/30 hover:bg-blue-50 dark:hover:bg-sky-500/10 px-1.5 sm:px-2 ml-0.5 sm:ml-1 rounded-lg"
        >
          Ce mois
        </Button>
      )}
    </div>
  );
}

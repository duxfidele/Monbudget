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

  // Format month name
  const dateObj = new Date(activeMonth.year, activeMonth.month - 1, 1);
  const formattedMonth = dateObj.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
  const capitalizedMonth = formattedMonth.charAt(0).toUpperCase() + formattedMonth.slice(1);

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
    <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-xl p-1 shadow-xs">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
        title="Mois précédent"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex items-center gap-1.5 px-2.5 py-1 text-sm font-semibold text-slate-800 select-none">
        <Calendar className="h-4 w-4 text-[#1E3A5F]" />
        <span>{capitalizedMonth}</span>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
        title="Mois suivant"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrentRealMonth && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetToCurrent}
          className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 px-2 ml-1 rounded-lg"
        >
          Ce mois
        </Button>
      )}
    </div>
  );
}

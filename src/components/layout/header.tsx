"use client";

import { User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { useUIStore } from "@/lib/store/ui-store";

export const Header = () => {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="flex items-center justify-between px-2 sm:px-4 md:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 h-16 transition-colors">
      {/* Mobile : Menu hamburger + Logo compact */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-9 w-9 text-[#1E3A5F] dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          aria-label="Ouvrir le menu de navigation"
          id="mobile-menu-trigger"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Link href="/dashboard" className="flex items-center ml-0.5">
          <div className="relative w-8 h-8 mr-1.5 flex items-center justify-center bg-[#1E3A5F] dark:bg-sky-500 rounded-lg shadow-xs">
            <span className="text-white dark:text-slate-950 font-bold text-sm">MB</span>
          </div>
          <span className="text-base font-bold text-[#1E3A5F] dark:text-white tracking-tight hidden sm:inline">
            MonBudget
          </span>
        </Link>
      </div>

      {/* Global Month Selector */}
      <div className="flex items-center">
        <MonthSelector />
      </div>
      
      {/* User Actions & Theme Toggle */}
      <div className="flex items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <Link href="/settings">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Paramètres"
            aria-label="Paramètres du compte"
          >
            <User className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </header>
  );
};

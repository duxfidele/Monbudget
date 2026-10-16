"use client";

import { User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { useUIStore } from "@/lib/store/ui-store";

export const Header = () => {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="flex items-center justify-between px-3 md:px-8 border-b bg-white/90 backdrop-blur-md sticky top-0 z-30 h-16">
      {/* Mobile : Menu hamburger (les trois traits en haut à gauche) + Logo */}
      <div className="flex items-center gap-1.5 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-10 w-10 text-[#1E3A5F] hover:bg-slate-100 rounded-xl -ml-1 transition-colors"
          aria-label="Ouvrir le menu de navigation"
          id="mobile-menu-trigger"
        >
          <Menu className="h-6 w-6 text-[#1E3A5F]" />
        </Button>

        <Link href="/" className="flex items-center ml-0.5">
          <div className="relative w-8 h-8 mr-2 flex items-center justify-center bg-[#1E3A5F] rounded-lg shadow-xs">
            <span className="text-white font-bold text-sm">MB</span>
          </div>
          <span className="text-lg font-bold text-[#1E3A5F] tracking-tight">MonBudget</span>
        </Link>
      </div>

      {/* Global Month Selector */}
      <div className="flex items-center">
        <MonthSelector />
      </div>
      
      {/* User Actions */}
      <div className="flex items-center gap-2">
        <Link href="/settings">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            title="Paramètres"
          >
            <User className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </header>
  );
};

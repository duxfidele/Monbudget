"use client";

import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MonthSelector } from "@/components/dashboard/month-selector";

export const Header = () => {
  return (
    <header className="flex items-center justify-between px-4 md:px-8 border-b bg-white/80 backdrop-blur-md sticky top-0 z-30 h-16">
      {/* Mobile Logo */}
      <div className="md:hidden flex items-center">
        <Link href="/" className="flex items-center">
          <div className="relative w-8 h-8 mr-2 flex items-center justify-center bg-[#1E3A5F] rounded-lg shadow-xs">
            <span className="text-white font-bold text-sm">MB</span>
          </div>
          <span className="text-lg font-bold text-[#1E3A5F]">MonBudget</span>
        </Link>
      </div>

      {/* Global Month Selector */}
      <div className="flex items-center">
        <MonthSelector />
      </div>
      
      {/* User Actions */}
      <div className="flex items-center gap-2">
        <Link href="/settings">
          <Button variant="ghost" size="icon" className="rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100">
            <User className="h-5 w-5" />
          </Button>
        </Link>
      </div>
    </header>
  );
};

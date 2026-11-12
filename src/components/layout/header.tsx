"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";
import { MonthSelector } from "@/components/dashboard/month-selector";
import { ThemeToggle } from "@/components/theme-toggle";
import { NetworkStatus } from "@/components/pwa/network-status";
import { InstallButton } from "@/components/pwa/install-button";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { useUIStore } from "@/lib/store/ui-store";

export const Header = () => {
  const { toggleSidebar } = useUIStore();

  return (
    <header className="flex items-center justify-between gap-1.5 sm:gap-3 px-2 sm:px-4 md:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md sticky top-0 z-30 h-16 transition-colors min-w-0">
      {/* Mobile : Menu hamburger + Logo compact */}
      <div className="flex items-center gap-1 sm:gap-1.5 md:hidden shrink-0">
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

        <Link href="/dashboard" className="flex items-center gap-2 group">
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden shrink-0 shadow-xs">
            <Image
              src="/logo.png"
              alt="Logo MonBudget"
              width={32}
              height={32}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <span className="text-base font-bold text-[#1E3A5F] dark:text-white tracking-tight hidden sm:inline">
            Mon<span className="text-emerald-500">Budget</span>
          </span>
        </Link>
      </div>

      {/* Global Month Selector */}
      <div className="flex items-center min-w-0">
        <MonthSelector />
      </div>
      
      {/* User Actions, PWA Install, Network Status, Notifications & Theme Toggle */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <NetworkStatus />
        <InstallButton variant="header" />
        <NotificationsBell />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
};

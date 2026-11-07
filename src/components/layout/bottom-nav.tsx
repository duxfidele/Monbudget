"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Wallet, ArrowRightLeft, PiggyBank } from "lucide-react";
import { QuickAddTransactionDialog } from "@/components/transactions/quick-add-transaction-dialog";

export const BottomNav = () => {
  const pathname = usePathname();

  const primaryLeftRoutes = [
    {
      label: "Accueil",
      icon: LayoutDashboard,
      href: "/dashboard",
      color: "text-sky-500",
    },
    {
      label: "Budget",
      icon: Wallet,
      href: "/budget",
      color: "text-emerald-500",
    },
  ];

  const primaryRightRoutes = [
    {
      label: "Mouvements",
      icon: ArrowRightLeft,
      href: "/transactions",
      color: "text-violet-500",
    },
    {
      label: "Épargne",
      icon: PiggyBank,
      href: "/savings",
      color: "text-pink-600",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 md:hidden pb-safe transition-colors">
      <div className="grid h-full max-w-lg grid-cols-5 mx-auto font-medium items-center">
        {/* Onglets Gauche */}
        {primaryLeftRoutes.map((route) => {
          const isActive = pathname === route.href;
          return (
            <Link
              key={route.href}
              href={route.href}
              className="inline-flex flex-col items-center justify-center px-1 h-full hover:bg-slate-50 dark:hover:bg-slate-800/60 group transition-colors active:scale-95"
            >
              <route.icon
                className={cn(
                  "w-5 h-5 mb-1 transition-all",
                  isActive ? route.color : "text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                )}
              />
              <span
                className={cn(
                  "text-[10px] leading-tight transition-colors",
                  isActive ? "text-slate-900 dark:text-white font-bold" : "text-slate-500 dark:text-slate-400"
                )}
              >
                {route.label}
              </span>
            </Link>
          );
        })}

        {/* Bouton Central Surélevé d'Ajout Rapide (+) */}
        <div className="flex items-center justify-center">
          <QuickAddTransactionDialog />
        </div>

        {/* Onglets Droite */}
        {primaryRightRoutes.map((route) => {
          const isActive = pathname === route.href;
          return (
            <Link
              key={route.href}
              href={route.href}
              className="inline-flex flex-col items-center justify-center px-1 h-full hover:bg-slate-50 dark:hover:bg-slate-800/60 group transition-colors active:scale-95"
            >
              <route.icon
                className={cn(
                  "w-5 h-5 mb-1 transition-all",
                  isActive ? route.color : "text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200"
                )}
              />
              <span
                className={cn(
                  "text-[10px] leading-tight transition-colors",
                  isActive ? "text-slate-900 dark:text-white font-bold" : "text-slate-500 dark:text-slate-400"
                )}
              >
                {route.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

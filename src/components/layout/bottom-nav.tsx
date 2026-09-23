"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Wallet, ArrowRightLeft, PiggyBank } from "lucide-react";

const routes = [
  {
    label: "Accueil",
    icon: LayoutDashboard,
    href: "/",
    color: "text-sky-500",
  },
  {
    label: "Budget",
    icon: Wallet,
    href: "/budget",
    color: "text-emerald-500",
  },
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
    color: "text-pink-700",
  },
];

export const BottomNav = () => {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-white border-t border-slate-200 md:hidden pb-safe">
      <div className="grid h-full max-w-lg grid-cols-4 mx-auto font-medium">
        {routes.map((route) => {
          const isActive = pathname === route.href;
          return (
            <Link
              key={route.href}
              href={route.href}
              className="inline-flex flex-col items-center justify-center px-1 hover:bg-slate-50 group transition-colors"
            >
              <route.icon
                className={cn(
                  "w-5 h-5 mb-1 transition-all",
                  isActive ? route.color : "text-slate-500 group-hover:text-slate-800"
                )}
              />
              <span
                className={cn(
                  "text-[10px] leading-tight transition-colors",
                  isActive ? "text-slate-900 font-bold" : "text-slate-500 group-hover:text-slate-800"
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

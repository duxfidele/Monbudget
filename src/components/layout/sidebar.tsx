"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  PiggyBank,
  LineChart,
  Settings,
} from "lucide-react";

const routes = [
  {
    label: "Tableau de bord",
    icon: LayoutDashboard,
    href: "/",
    color: "text-sky-500",
  },
  {
    label: "Mon Budget",
    icon: Wallet,
    href: "/budget",
    color: "text-emerald-500",
  },
  {
    label: "Transactions",
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
  {
    label: "Rapports",
    icon: LineChart,
    href: "/reports",
    color: "text-orange-700",
  },
  {
    label: "Paramètres",
    icon: Settings,
    href: "/settings",
    color: "text-gray-500",
  },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-[#1E3A5F] text-white">
      <div className="px-3 py-2 flex-1">
        <Link href="/" className="flex items-center pl-3 mb-14">
          <div className="relative w-8 h-8 mr-4 flex items-center justify-center bg-white rounded-full">
            <span className="text-[#1E3A5F] font-bold text-xl">M</span>
          </div>
          <h1 className="text-2xl font-bold">MonBudget</h1>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                pathname === route.href
                  ? "text-white bg-white/10"
                  : "text-slate-300"
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Wallet, ArrowRightLeft, PiggyBank, Lock } from "lucide-react";
import { QuickAddTransactionDialog } from "@/components/transactions/quick-add-transaction-dialog";
import { useUIStore } from "@/lib/store/ui-store";
import {
  canAccessFeature,
  getSubscriptionCountdownInfo,
  ProtectedFeatureKey,
} from "@/lib/moneriz-plans";
import { toast } from "sonner";

export const BottomNav = () => {
  const pathname = usePathname();
  const {
    subscriptionHydrated,
    subscriptionPlan,
    subscriptionStatus,
    subscriptionExpiresAt,
    subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdminUser,
  } = useUIStore();

  const countdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    trialEndsAt: subscriptionTrialEndsAt,
    trialChoiceMadeAt,
    isAdmin: isAdminUser,
  });

  const primaryLeftRoutes: Array<{
    label: string;
    icon: typeof LayoutDashboard;
    href: string;
    color: string;
    feature?: ProtectedFeatureKey;
  }> = [
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

  const primaryRightRoutes: Array<{
    label: string;
    icon: typeof LayoutDashboard;
    href: string;
    color: string;
    feature?: ProtectedFeatureKey;
  }> = [
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
        feature: "savings",
      },
    ];

  const renderTab = (route: (typeof primaryLeftRoutes)[number]) => {
    const isActive = pathname === route.href;
    const isLocked =
      subscriptionHydrated &&
      Boolean(route.feature) &&
      !isAdminUser &&
      !canAccessFeature(countdown.effectivePlanId, route.feature!);
    return (
      <Link
        key={route.href}
        href={route.href}
        onClick={() => {
          if (isLocked) {
            toast.info(
              `« ${route.label} » est cadenassé — Prenez l'abonnement Particulier à 500 FCFA/mois pour le débloquer.`
            );
          }
        }}
        className="relative inline-flex flex-col items-center justify-center px-1 h-full hover:bg-slate-50 dark:hover:bg-slate-800/60 group transition-colors active:scale-95"
      >
        <div className="relative">
          <route.icon
            className={cn(
              "w-5 h-5 mb-1 transition-all",
              isActive
                ? route.color
                : "text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-200"
            )}
          />
          {isLocked && (
            <Lock className="w-2.5 h-2.5 text-amber-500 absolute -top-1 -right-1.5" />
          )}
        </div>
        <span
          className={cn(
            "text-[10px] leading-tight transition-colors truncate max-w-full",
            isActive
              ? "text-slate-900 dark:text-white font-bold"
              : "text-slate-500 dark:text-slate-400"
          )}
        >
          {route.label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Navigation rapide mobile"
      className="fixed bottom-0 left-0 z-50 w-full min-h-[4rem] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 lg:hidden pb-safe transition-colors"
    >
      <div className="grid h-16 max-w-xl grid-cols-5 mx-auto font-medium items-center">
        {/* Onglets Gauche */}
        {primaryLeftRoutes.map(renderTab)}

        {/* Bouton Central Surélevé d'Ajout Rapide (+) */}
        <div className="flex items-center justify-center">
          <QuickAddTransactionDialog />
        </div>

        {/* Onglets Droite */}
        {primaryRightRoutes.map(renderTab)}
      </div>
    </nav>
  );
};

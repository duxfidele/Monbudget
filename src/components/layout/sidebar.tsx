"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useUIStore } from "@/lib/store/ui-store";
import { getSubscriptionCountdownInfo, MONBUDGET_PLANS } from "@/lib/moneriz-plans";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  PiggyBank,
  HandCoins,
  Brain,
  LineChart,
  Settings,
  ShieldCheck,
  LifeBuoy,
  LogOut,
  User,
  Crown,
  Clock,
} from "lucide-react";

const routes = [
  {
    label: "Tableau de bord",
    icon: LayoutDashboard,
    href: "/dashboard",
    color: "text-sky-400",
  },
  {
    label: "Mon Budget",
    icon: Wallet,
    href: "/budget",
    color: "text-emerald-400",
  },
  {
    label: "Transactions",
    icon: ArrowRightLeft,
    href: "/transactions",
    color: "text-violet-400",
  },
  {
    label: "Épargne",
    icon: PiggyBank,
    href: "/savings",
    color: "text-pink-400",
  },
  {
    label: "Dettes & Créances",
    icon: HandCoins,
    href: "/debts",
    color: "text-amber-400",
  },
  {
    label: "Conseiller IA",
    icon: Brain,
    href: "/advisor",
    color: "text-cyan-400",
  },
  {
    label: "Rapports",
    icon: LineChart,
    href: "/reports",
    color: "text-orange-400",
  },
  {
    label: "Paramètres",
    icon: Settings,
    href: "/settings",
    color: "text-slate-300",
  },
  {
    label: "Aide & Support",
    icon: LifeBuoy,
    href: "/support",
    color: "text-emerald-400",
  },
];

export const Sidebar = ({ onNavigate }: { onNavigate?: () => void }) => {
  const pathname = usePathname();
  const router = useRouter();
  const {
    resetStore,
    subscriptionPlan,
    subscriptionStatus,
    subscriptionExpiresAt,
    isAdminUser,
  } = useUIStore();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        if (user.email) {
          setUserEmail(user.email);
        }
        const metaName =
          user.user_metadata?.full_name || user.user_metadata?.name || null;
        if (metaName) {
          setUserName(metaName);
        }
      }
    });
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      if (onNavigate) onNavigate();
      resetStore();
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Vous avez été déconnecté avec succès.");
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Erreur déconnexion :", error);
      toast.error("Erreur lors de la déconnexion.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const countdown = getSubscriptionCountdownInfo({
    planId: subscriptionPlan,
    status: subscriptionStatus,
    expiresAt: subscriptionExpiresAt,
    isAdmin: isAdminUser,
  });

  const planBadgeLabel = isAdminUser
    ? "Super-Admin"
    : `Plan ${MONBUDGET_PLANS[countdown.effectivePlanId]?.name || "Gratuit"}`;

  return (
    <div className="flex flex-col h-full bg-[#1E3A5F] text-white select-none">
      {/* En-tête fixe du Logo MonBudget (ne se coupe jamais au scroll) */}
      <div className="px-4 pt-5 pb-4 shrink-0 border-b border-white/10">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-3 transition-opacity hover:opacity-90 group focus:outline-none"
        >
          <div className="relative w-10 h-10 shrink-0 rounded-xl overflow-hidden bg-white/10 p-0.5 border border-white/20 shadow-md">
            <Image
              src="/logo.png"
              alt="Logo MonBudget"
              width={40}
              height={40}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight text-white leading-tight">
              Mon<span className="text-emerald-400">Budget</span>
            </span>
            <span className="text-[10px] text-slate-300 font-medium tracking-tight">
              Gérez mieux votre argent
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation principale défilante sans contour blanc disgracieux */}
      <div className="px-3 py-3 flex-1 overflow-y-auto scrollbar-none space-y-1">
        {routes.map((route) => {
          const isActive = pathname === route.href;
          return (
            <Link
              key={route.href}
              href={route.href}
              onClick={onNavigate}
              className={cn(
                "text-sm group flex p-2.5 px-3 w-full justify-start font-medium cursor-pointer rounded-xl transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/50",
                isActive
                  ? "text-white bg-white/15 font-semibold shadow-xs"
                  : "text-slate-300 hover:text-white hover:bg-white/10"
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon
                  className={cn(
                    "h-5 w-5 mr-3 shrink-0 transition-transform group-hover:scale-110",
                    route.color
                  )}
                />
                <span className="truncate">{route.label}</span>
              </div>
            </Link>
          );
        })}

        {/* Espace Administrateur visible uniquement pour le Super-Administrateur */}
        {isAdminUser && (
          <div className="pt-2.5 mt-2.5 border-t border-white/10">
            <Link
              href="/admin"
              onClick={onNavigate}
              className={cn(
                "text-sm group flex p-2.5 px-3 w-full justify-start font-medium cursor-pointer rounded-xl transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/50",
                pathname === "/admin"
                  ? "text-white bg-sky-500/25 font-semibold shadow-xs border border-sky-400/40"
                  : "text-sky-300 hover:text-white hover:bg-sky-500/15"
              )}
            >
              <div className="flex items-center justify-between flex-1">
                <div className="flex items-center">
                  <ShieldCheck className="h-5 w-5 mr-3 text-sky-400 shrink-0 transition-transform group-hover:scale-110" />
                  <span>Administration</span>
                </div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-sky-400/20 text-sky-300 border border-sky-400/30">
                  SaaS
                </span>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Section Pied de Page : Utilisateur, Badge Abonnement & Déconnexion */}
      <div className="p-3 border-t border-white/10 mt-auto bg-black/20 shrink-0 space-y-2.5">
        <div className="flex items-center gap-2.5 px-1.5 py-1">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center text-white text-xs font-extrabold shrink-0 shadow-xs">
            {userName
              ? userName.charAt(0).toUpperCase()
              : userEmail
              ? userEmail.charAt(0).toUpperCase()
              : <User className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white truncate">
              {userName || userEmail || "Mon Compte"}
            </p>
            {userName && userEmail && (
              <p className="text-[10px] text-slate-300 truncate">{userEmail}</p>
            )}
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                Connecté
              </span>
              <span className="text-slate-500 text-[10px]">•</span>
              <Link
                href={isAdminUser ? "/admin" : "/settings?tab=subscription"}
                onClick={onNavigate}
                suppressHydrationWarning
                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 hover:underline truncate focus:outline-none"
              >
                <Crown className="w-2.5 h-2.5 shrink-0" />
                <span>{planBadgeLabel}</span>
                {!isAdminUser && countdown.isPaidActive && countdown.daysRemaining !== null && (
                  <span
                    className={`ml-0.5 inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                      countdown.isExpiringSoon
                        ? "bg-rose-500/30 text-rose-200 border border-rose-400/50"
                        : "bg-emerald-500/25 text-emerald-200 border border-emerald-400/40"
                    }`}
                  >
                    <Clock className="w-2 h-2 shrink-0" />
                    {countdown.daysRemaining}j
                  </span>
                )}
                {!isAdminUser && countdown.isExpired && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-rose-500/30 text-rose-200 border border-rose-400/40">
                    Expiré
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-rose-200 hover:text-white bg-rose-500/15 hover:bg-rose-600/35 border border-rose-500/30 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50 focus:outline-none"
        >
          <LogOut className="w-4 h-4" />
          <span>{isLoggingOut ? "Déconnexion..." : "Se déconnecter"}</span>
        </button>
      </div>
    </div>
  );
};

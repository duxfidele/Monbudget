"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { isAdmin } from "@/lib/utils/admin";
import { useUIStore } from "@/lib/store/ui-store";
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
  const { resetStore } = useUIStore();
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) {
        setUserEmail(user.email);
        if (isAdmin(user.email)) {
          setIsAdminUser(true);
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
      console.error("Erreur déconnexion mobile :", error);
      toast.error("Erreur lors de la déconnexion.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="py-4 flex flex-col h-full bg-[#1E3A5F] text-white">
      <div className="px-3 py-2 flex-1 overflow-y-auto">
        <Link 
          href="/dashboard" 
          onClick={onNavigate}
          className="flex items-center pl-3 mb-10 transition-opacity hover:opacity-90"
        >
          <div className="relative w-8 h-8 mr-3 flex items-center justify-center bg-white rounded-lg shadow-xs">
            <span className="text-[#1E3A5F] font-bold text-base">MB</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white">MonBudget</span>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              onClick={onNavigate}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-xl transition",
                pathname === route.href
                  ? "text-white bg-white/15 font-semibold shadow-xs"
                  : "text-slate-300"
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon className={cn("h-5 w-5 mr-3 transition-transform group-hover:scale-110", route.color)} />
                {route.label}
              </div>
            </Link>
          ))}

          {/* Espace Administrateur visible uniquement pour l'admin */}
          {isAdminUser && (
            <div className="pt-3 mt-3 border-t border-white/10">
              <Link
                href="/admin"
                onClick={onNavigate}
                className={cn(
                  "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-xl transition",
                  pathname === "/admin"
                    ? "text-white bg-sky-500/30 font-semibold shadow-xs border border-sky-400/30"
                    : "text-sky-300 hover:text-sky-200"
                )}
              >
                <div className="flex items-center flex-1">
                  <ShieldCheck className="h-5 w-5 mr-3 text-sky-400 transition-transform group-hover:scale-110" />
                  Administration
                </div>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Section Pied de Page : Utilisateur & Déconnexion rapide */}
      <div className="p-3 border-t border-white/10 mt-auto bg-black/15 shrink-0">
        <div className="flex items-center gap-2.5 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs">
            {userEmail ? userEmail.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {userEmail || "Mon Compte"}
            </p>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
              Connecté
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-600/30 border border-rose-500/30 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <LogOut className="w-4 h-4" />
          <span>{isLoggingOut ? "Déconnexion..." : "Se déconnecter"}</span>
        </button>
      </div>
    </div>
  );
};

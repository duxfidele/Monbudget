"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Settings,
  LineChart,
  LifeBuoy,
  ShieldCheck,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUIStore } from "@/lib/store/ui-store";
import { toast } from "sonner";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { resetStore, isAdminUser } = useUIStore();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email || null);
        const metadataName = user.user_metadata?.full_name || user.user_metadata?.name;
        setUserName(metadataName || user.email?.split("@")[0] || "Membre");
      }
    });
  }, []);

  // Fermer le menu lors d'un clic à l'extérieur ou appui sur Échap
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      setIsOpen(false);
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

  const getInitials = () => {
    if (userName) {
      return userName.charAt(0).toUpperCase();
    }
    if (userEmail) {
      return userEmail.charAt(0).toUpperCase();
    }
    return "U";
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Bouton Déclencheur Profil */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 h-9 px-2 sm:px-2.5 rounded-xl text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-sky-500/50"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Menu du compte utilisateur"
        id="user-menu-trigger"
      >
        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#1E3A5F] to-sky-600 dark:from-sky-600 dark:to-cyan-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
          {getInitials()}
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Menu Déroulant (Dropdown) */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="user-menu-trigger"
          className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-[4.25rem] sm:top-full sm:mt-2 w-auto sm:w-80 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-900/15 dark:shadow-slate-950/60 p-2 z-50 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* En-tête : Informations du profil */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/50 mb-1.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#1E3A5F] dark:bg-sky-500 text-white dark:text-slate-950 flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                {getInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                  {userName || "Mon Profil"}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {userEmail || "utilisateur@monbudget.app"}
                </p>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Connecté
              </span>
              {isAdminUser && (
                <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 font-bold text-[10px] border border-sky-300 dark:border-sky-800">
                  Super-Admin
                </span>
              )}
            </div>
          </div>

          {/* Liens d'accès rapides */}
          <div className="space-y-0.5 py-1">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              role="menuitem"
            >
              <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Mon Profil & Paramètres</span>
            </Link>

            <Link
              href="/reports"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              role="menuitem"
            >
              <LineChart className="w-4 h-4 text-orange-500 dark:text-orange-400" />
              <span>Rapports & Synthèse</span>
            </Link>

            <Link
              href="/support"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              role="menuitem"
            >
              <LifeBuoy className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>Aide & Support WhatsApp</span>
            </Link>

            {isAdminUser && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors"
                role="menuitem"
              >
                <ShieldCheck className="w-4 h-4 text-sky-500" />
                <span>Administration SaaS</span>
              </Link>
            )}
          </div>

          {/* Séparateur */}
          <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

          {/* Bouton de Déconnexion */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50"
            role="menuitem"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>{isLoggingOut ? "Déconnexion en cours..." : "Se déconnecter"}</span>
          </button>
        </div>
      )}
    </div>
  );
}


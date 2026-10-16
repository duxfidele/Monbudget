"use client";

import { useUIStore } from "@/lib/store/ui-store";
import { Sidebar } from "./sidebar";
import { X } from "lucide-react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export const MobileSidebar = () => {
  const { isSidebarOpen, setSidebarOpen } = useUIStore();
  const pathname = usePathname();

  // Fermer le menu lors du changement de page
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  // Empêcher le scroll d'arrière-plan quand le menu mobile est ouvert
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  if (!isSidebarOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      {/* Arrière-plan semi-transparent cliquable */}
      <div 
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* Volet coulissant du menu depuis la gauche */}
      <div className="fixed inset-y-0 left-0 w-72 bg-[#1E3A5F] z-[101] shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
        <div className="absolute top-4 right-4 z-10">
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition"
            aria-label="Fermer le menu"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>
      </div>
    </div>
  );
};

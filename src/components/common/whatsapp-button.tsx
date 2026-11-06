"use client";

import React, { useState } from "react";
import { MessageCircle, X } from "lucide-react";

interface WhatsAppFloatButtonProps {
  phoneNumber?: string;
  defaultMessage?: string;
}

export function WhatsAppFloatButton({
  phoneNumber = "22898376101",
  defaultMessage = "Bonjour, j'ai une question concernant l'application MonBudget.",
}: WhatsAppFloatButtonProps) {
  const [showTooltip, setShowTooltip] = useState(true);

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
  const encodedMessage = encodeURIComponent(defaultMessage);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  return (
    <aside
      aria-label="Assistance WhatsApp MonBudget"
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-3 select-none"
    >
      {/* Bulle d'information interactive */}
      {showTooltip && (
        <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-medium px-3.5 py-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-right-4 duration-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline text-slate-700 dark:text-slate-200"
          >
            Besoin d&apos;aide ? <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">Discutez sur WhatsApp</strong>
          </a>
          <button
            onClick={() => setShowTooltip(false)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ml-1 p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Fermer l'infobulle WhatsApp"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bouton Flottant WhatsApp Principal */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contacter le support MonBudget sur WhatsApp (+228 98 37 61 01)"
        className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-emerald-400/40"
      >
        {/* Halo animé de pulsation */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-30 animate-ping group-hover:opacity-0 transition-opacity"></span>

        {/* Icône officielle WhatsApp SVG */}
        <svg
          className="w-7 h-7 fill-white transition-transform duration-300 group-hover:rotate-12"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>

        {/* Pastille verte en ligne */}
        <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-300 border-2 border-white rounded-full"></span>
      </a>
    </aside>
  );
}


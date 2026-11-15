"use client";

import React from "react";
import { HelpChatWidget } from "@/components/common/help-chat-widget";

interface WhatsAppFloatButtonProps {
  phoneNumber?: string;
  defaultMessage?: string;
}

/**
 * Bouton d'assistance MonBudget
 * Remplacé par la bulle d'assistance intelligente locale (HelpChatWidget)
 * avec passerelle WhatsApp intégrée (0 API IA, 100% hors-ligne).
 */
export function WhatsAppFloatButton({
  phoneNumber = "22898376101",
  defaultMessage = "Bonjour, j'ai une question concernant l'application MonBudget.",
}: WhatsAppFloatButtonProps) {
  return (
    <HelpChatWidget 
      phoneNumber={phoneNumber} 
      defaultMessage={defaultMessage} 
    />
  );
}

export { HelpChatWidget };

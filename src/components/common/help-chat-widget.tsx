"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { 
  MessageCircle, 
  X, 
  Send, 
  Sparkles, 
  Bot, 
  RotateCcw, 
  ArrowUpRight, 
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  HelpCircle
} from "lucide-react";
import { 
  KNOWLEDGE_BASE, 
  HELP_CATEGORIES, 
  searchKnowledgeBase, 
  KnowledgeArticle, 
  HelpCategory 
} from "@/lib/support/help-knowledge-base";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text?: string;
  article?: KnowledgeArticle;
  articles?: KnowledgeArticle[];
  timestamp: Date;
  showWhatsAppFallback?: boolean;
}

interface HelpChatWidgetProps {
  phoneNumber?: string;
  defaultMessage?: string;
}

/**
 * Analyseur de mise en forme inline pour convertir le Markdown (gras, italique, code)
 * en éléments HTML React sans astérisques bruts apparents (Rendu Chat Pro).
 */
function parseInlineText(text: string): React.ReactNode {
  if (!text) return "";
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    if (match[2]) {
      // **Gras**
      parts.push(
        <strong key={match.index} className="font-bold text-slate-900 dark:text-white">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // *Italique*
      parts.push(
        <em key={match.index} className="italic text-slate-700 dark:text-slate-200">
          {match[3]}
        </em>
      );
    } else if (match[4]) {
      // `Code`
      parts.push(
        <code key={match.index} className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-mono text-[11px]">
          {match[4]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

/**
 * Rendu professionnel des messages du chat :
 * - Remplace les astérisques ** par du vrai gras
 * - Met en page les listes à puces (•) et numérotées avec retrait et puces colorées
 * - Gère les sauts de ligne et paragraphes proprement
 */
function FormattedChatText({ content }: { content: string }) {
  if (!content) return null;
  const lines = content.split("\n");

  return (
    <div className="space-y-1.5 text-slate-700 dark:text-slate-300 leading-relaxed text-[12px]">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={idx} className="h-1" />;
        }

        // Ligne de liste à puces (• ou - ou *)
        if (trimmed.startsWith("•") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const itemText = trimmed.replace(/^[•\-\*]\s*/, "");
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5 my-1">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold select-none text-xs leading-5 mt-0.5">
                •
              </span>
              <div className="flex-1 text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                {parseInlineText(itemText)}
              </div>
            </div>
          );
        }

        // Ligne de liste numérotée (1., 2., etc.)
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-0.5 my-1">
              <span className="font-bold text-[#1E3A5F] dark:text-sky-400 select-none text-[11px] leading-5 shrink-0 mt-0.5">
                {numMatch[1]}.
              </span>
              <div className="flex-1 text-[11.5px] leading-relaxed text-slate-700 dark:text-slate-300">
                {parseInlineText(numMatch[2])}
              </div>
            </div>
          );
        }

        // Paragraphe standard
        return (
          <p key={idx} className="my-0.5 leading-relaxed">
            {parseInlineText(trimmed)}
          </p>
        );
      })}
    </div>
  );
}

export function HelpChatWidget({
  phoneNumber = "22898376101",
  defaultMessage = "Bonjour, j'ai une question concernant l'application MonBudget.",
}: HelpChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTooltip, setShowTooltip] = useState(true);
  const [inputQuery, setInputQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<HelpCategory["id"] | null>(null);

  const cleanPhone = phoneNumber.replace(/[^0-9]/g, "");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "bot",
      text: "Bonjour ! 👋 Je suis l'assistant d'aide MonBudget.\n\nJe réponds instantanément à toutes vos questions sur l'application (budget, enveloppes, dettes, épargne, abonnement Mobile Money, mode hors-ligne...). Aucun abonnement IA, 100 % gratuit et accessible même sans connexion !",
      timestamp: new Date(),
    },
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setShowTooltip(false);
      // Focus léger sur l'input
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query) return;

    const userMsgId = `user-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery("");

    // Vérifier si l'utilisateur demande explicitement WhatsApp ou un humain
    const lower = query.toLowerCase();
    const isAskingHuman = 
      lower.includes("whatsapp") || 
      lower.includes("humain") || 
      lower.includes("conseiller") || 
      lower.includes("parler") || 
      lower.includes("contact") || 
      lower.includes("service client") ||
      lower.includes("numero") ||
      lower.includes("appel");

    // Recherche dans la base de connaissances
    const matches = searchKnowledgeBase(query);

    setTimeout(() => {
      if (isAskingHuman) {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: "bot",
            text: "Je vous mets directement en contact avec notre équipe humaine sur WhatsApp au **+228 98 37 61 01** :",
            showWhatsAppFallback: true,
            timestamp: new Date(),
          },
        ]);
        return;
      }

      if (matches.length > 0) {
        const topMatch = matches[0].article;
        const otherMatches = matches.slice(1, 3).map((m) => m.article);

        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: "bot",
            article: topMatch,
            articles: otherMatches.length > 0 ? otherMatches : undefined,
            timestamp: new Date(),
          },
        ]);
      } else {
        // Aucune correspondance trouvée
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: "bot",
            text: "Je n'ai pas trouvé de réponse exacte à votre demande dans la documentation embarquée.\n\nVous pouvez reformuler avec des mots simples (ex: *budget*, *enveloppe*, *abonnement*, *épargne*) ou échanger directement avec notre équipe humaine sur WhatsApp :",
            showWhatsAppFallback: true,
            timestamp: new Date(),
          },
        ]);
      }
    }, 180);
  };

  const handleSelectArticle = (article: KnowledgeArticle) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        text: article.title,
        timestamp: new Date(),
      },
      {
        id: `bot-${Date.now()}`,
        sender: "bot",
        article: article,
        timestamp: new Date(),
      },
    ]);
  };

  const handleSelectCategory = (catId: HelpCategory["id"]) => {
    setSelectedCategory(catId);
    const categoryArticles = KNOWLEDGE_BASE.filter((a) => a.category === catId);
    const catInfo = HELP_CATEGORIES.find((c) => c.id === catId);

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: "user",
        text: `Afficher les guides : ${catInfo?.label || catId}`,
        timestamp: new Date(),
      },
      {
        id: `bot-${Date.now()}`,
        sender: "bot",
        text: `Voici les questions fréquentes sur **${catInfo?.label}** :`,
        articles: categoryArticles,
        timestamp: new Date(),
      },
    ]);
  };

  const handleReset = () => {
    setMessages([
      {
        id: "welcome-reset",
        sender: "bot",
        text: "Conversation réinitialisée ! Comment puis-je vous aider aujourd'hui ? Choisissez un sujet ci-dessous ou posez votre question.",
        timestamp: new Date(),
      },
    ]);
    setSelectedCategory(null);
  };

  const buildWhatsAppUrl = (customText?: string) => {
    const msg = customText || defaultMessage;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <>
      {/* ======================================================== */}
      {/* 1. Fenêtre de Chat Interactive (Ouverte)                 */}
      {/* ======================================================== */}
      {isOpen && (
        <div 
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 right-3 sm:right-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[400px] h-[520px] max-h-[82vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
          role="dialog"
          aria-label="Assistant d'aide MonBudget"
        >
          {/* En-tête de la bulle de chat */}
          <div className="bg-gradient-to-r from-[#1E3A5F] via-[#244673] to-[#1E3A5F] text-white p-3.5 px-4 flex items-center justify-between shrink-0 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 border border-white/20 text-emerald-300">
                <Bot className="w-5 h-5" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#1E3A5F] rounded-full"></span>
              </div>
              <div>
                <h3 className="text-sm font-bold flex items-center gap-1.5 leading-tight">
                  <span>Assistant MonBudget</span>
                  <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.2 rounded-full">
                    Hors-ligne
                  </span>
                </h3>
                <p className="text-[11px] text-slate-300">
                  Réponses instantanées 24/7 (0 FCFA)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                title="Effacer la conversation"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Réinitialiser le chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Fermer la bulle d'aide"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Corps de la discussion (Scrollable) */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3.5 bg-slate-50/70 dark:bg-slate-950/40 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
              >
                {/* Message Utilisateur */}
                {msg.sender === "user" && (
                  <div className="max-w-[85%] rounded-2xl rounded-tr-xs bg-[#1E3A5F] text-white p-3 shadow-xs">
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>
                )}

                {/* Message Assistant */}
                {msg.sender === "bot" && (
                  <div className="max-w-[92%] space-y-2">
                    {msg.text && (
                      <div className="rounded-2xl rounded-tl-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 p-3 shadow-xs">
                        <FormattedChatText content={msg.text} />
                      </div>
                    )}

                    {/* Article principal complet trouvé (Rendu Chat Pro sans astérisques) */}
                    {msg.article && (
                      <div className="rounded-2xl rounded-tl-xs bg-white dark:bg-slate-800 border border-emerald-200/90 dark:border-emerald-900/60 p-3.5 shadow-xs space-y-2.5">
                        <div className="flex items-start gap-2 text-emerald-800 dark:text-emerald-400 font-bold text-xs leading-snug">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                          <span>{msg.article.title}</span>
                        </div>
                        <div className="border-t border-slate-100 dark:border-slate-700/60 pt-2">
                          <FormattedChatText content={msg.article.content} />
                        </div>
                        {msg.article.action && (
                          <div className="pt-1.5">
                            <Link
                              href={msg.article.action.href}
                              onClick={() => setIsOpen(false)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold text-xs border border-emerald-200 dark:border-emerald-800 transition"
                            >
                              <span>{msg.article.action.label}</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Liste de suggestions d'articles */}
                    {msg.articles && msg.articles.length > 0 && (
                      <div className="rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 space-y-1.5 w-full">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                          Articles associés :
                        </span>
                        {msg.articles.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectArticle(item)}
                            className="w-full text-left p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-slate-700/70 border border-transparent hover:border-blue-100 dark:hover:border-slate-600 transition flex items-center justify-between gap-2 group"
                          >
                            <span className="font-semibold text-slate-700 dark:text-slate-200 text-[11px] group-hover:text-[#1E3A5F] dark:group-hover:text-sky-300 line-clamp-1">
                              {item.title}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Bouton de secours WhatsApp officiel */}
                    {msg.showWhatsAppFallback && (
                      <a
                        href={buildWhatsAppUrl("Bonjour, je souhaite parler à un conseiller concernant MonBudget.")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 w-full p-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-xs shadow-sm transition active:scale-98"
                      >
                        <svg className="w-4 h-4 fill-white" viewBox="0 0 24 24">
                          <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.044c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.1.824z" />
                        </svg>
                        <span>Discuter sur WhatsApp (+228 98 37 61 01)</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Suggestions de thématiques rapides (affichées quand peu de messages) */}
            {messages.length <= 2 && (
              <div className="pt-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-2">
                  Thématiques fréquentes :
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {HELP_CATEGORIES.slice(0, 6).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat.id)}
                      className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 hover:border-[#1E3A5F] dark:hover:border-sky-400 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-left transition font-medium text-[11px] flex items-center justify-between"
                    >
                      <span className="truncate">{cat.label}</span>
                      <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Formulaire de saisie de question */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Posez votre question (ex: comment créer une enveloppe ?)..."
              className="flex-1 h-9 px-3 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F] dark:focus:ring-sky-500"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim()}
              className="h-9 w-9 rounded-xl bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition shadow-xs"
              aria-label="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. Bouton Flottant & Infobulle (Toujours visible)         */}
      {/* ======================================================== */}
      <aside
        aria-label="Assistance & Aide MonBudget"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 right-3 sm:right-6 z-40 flex items-center gap-3 select-none"
      >
        {/* Infobulle d'invitation (fermable) */}
        {!isOpen && showTooltip && (
          <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-medium px-3.5 py-2 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-right-4 duration-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="hover:underline text-slate-700 dark:text-slate-200 text-left"
            >
              Besoin d&apos;aide ? <strong className="text-[#1E3A5F] dark:text-sky-400 font-semibold">Posez votre question</strong>
            </button>
            <button
              onClick={() => setShowTooltip(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors ml-1 p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Fermer l'infobulle d'aide"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bouton Rond Flottant d'Ouverture */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? "Fermer l'assistant MonBudget" : "Ouvrir l'assistant d'aide MonBudget"}
          className={`group relative flex items-center justify-center w-11 h-11 sm:w-14 sm:h-14 rounded-full text-white shadow-lg transition-all duration-300 focus:outline-none focus:ring-4 ${
            isOpen 
              ? "bg-slate-800 hover:bg-slate-900 focus:ring-slate-400/40 shadow-slate-900/30" 
              : "bg-gradient-to-tr from-[#1E3A5F] via-[#244673] to-emerald-600 hover:scale-105 active:scale-95 shadow-[#1E3A5F]/40 hover:shadow-xl focus:ring-[#1E3A5F]/40"
          }`}
        >
          {/* Halo animé de pulsation lorsque le chat est fermé */}
          {!isOpen && (
            <span className="absolute inset-0 rounded-full bg-emerald-500 opacity-25 animate-ping group-hover:opacity-0 transition-opacity"></span>
          )}

          {isOpen ? (
            <X className="w-5 h-5 sm:w-6 sm:h-6 transition-transform duration-200" />
          ) : (
            <div className="relative flex items-center justify-center">
              <MessageCircle className="w-5 h-5 sm:w-7 sm:h-7 transition-transform duration-300 group-hover:scale-110" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#1E3A5F] rounded-full"></span>
            </div>
          )}
        </button>
      </aside>
    </>
  );
}


"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageCircle, CheckCircle2, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function SupportContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("Assistance générale");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Veuillez indiquer votre nom.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      toast.error("Veuillez renseigner une adresse email valide.");
      return;
    }

    if (!message.trim() || message.trim().length < 5) {
      toast.error("Votre message doit contenir au moins 5 caractères.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          topic,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      setIsSent(true);
      toast.success("Votre message a été transmis avec succès !", {
        description: "Notre équipe vous répondra par email ou sur WhatsApp sous 15 minutes.",
      });

      // Reset
      setName("");
      setEmail("");
      setMessage("");
    } catch (err: any) {
      console.error("Erreur envoi ticket :", err);
      toast.error(err.message || "Impossible d'envoyer le message pour le moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const encodedWhatsAppMessage = encodeURIComponent(
    `Bonjour l'équipe MonBudget,\nJe m'appelle ${name || "[Mon Nom]"}.\nSujet : ${topic}\n\n${
      message || "J'aimerais avoir de l'aide sur l'application."
    }`
  );
  const directWhatsAppUrl = `https://wa.me/22898376101?text=${encodedWhatsAppMessage}`;

  return (
    <div className="bg-[#0A192F]/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-400" />
            Envoyer un message au Support
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Remplissez ce formulaire ou basculez sur WhatsApp à tout moment.
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hidden sm:inline">
          Réponse 7j/7
        </span>
      </div>

      {isSent ? (
        <div className="py-12 text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-white">Message bien reçu !</h4>
          <p className="text-sm text-slate-300 max-w-md mx-auto">
            Merci de nous avoir contactés. Nous traitons votre demande et vous répondrons directement par email.
          </p>
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSent(false)}
              className="text-xs border-slate-700 text-slate-300 hover:text-white"
            >
              Envoyer un autre message
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Votre Nom complet <span className="text-sky-400">*</span>
              </label>
              <Input
                type="text"
                placeholder="Ex: Frère Fidèle"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Votre Adresse Email <span className="text-sky-400">*</span>
              </label>
              <Input
                type="email"
                placeholder="Ex: fidele@monbudget.app"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-sky-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Objet de votre demande
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            >
              <option value="Assistance générale">Assistance générale</option>
              <option value="Aide configuration du budget & jour de paie">Aide configuration du budget & jour de paie</option>
              <option value="Installation de l'application sur smartphone (PWA)">Installation sur smartphone (PWA)</option>
              <option value="Question sur la sécurité et les données">Sécurité & Données personnelles</option>
              <option value="Suggestion d'amélioration ou partenariat">Suggestion d'amélioration / Partenariat</option>
              <option value="Signaler un problème technique">Signaler un problème technique</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Votre Message <span className="text-sky-400">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Expliquez-nous précisément votre question ou votre situation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              className="flex min-h-[100px] w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold px-6 h-11 rounded-xl shadow-lg shadow-sky-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Envoyer par Email
                </>
              )}
            </Button>

            <a
              href={directWhatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 h-11 px-6 rounded-xl"
              >
                <MessageCircle className="w-4 h-4 mr-2 text-emerald-400" />
                <span>Transmettre plutôt sur WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-70" />
              </Button>
            </a>
          </div>
        </form>
      )}
    </div>
  );
}

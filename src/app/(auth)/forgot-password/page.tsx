"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/utils/auth-errors";
import { HoneypotField } from "@/components/security/honeypot-field";
import { TurnstileWidget, isTurnstileConfigured } from "@/components/security/turnstile-widget";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const mountedAtRef = useRef<number>(0);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (isTurnstileConfigured && !turnstileToken) {
      const msg = "Veuillez patienter pendant la vérification de sécurité.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);

    try {
      const formLoadedAt = mountedAtRef.current;
      const antiSpamRes = await fetch("/api/auth/anti-spam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "forgot-password",
          email: email.trim(),
          honeypot,
          formLoadedAt,
          formElapsedMs: formLoadedAt > 0 ? Math.max(0, Date.now() - formLoadedAt) : 0,
          turnstileToken,
        }),
      });

      if (!antiSpamRes.ok) {
        const antiSpamData = await antiSpamRes.json().catch(() => ({}));
        const msg = antiSpamData.error || "Requête bloquée par la protection anti-spam.";
        setErrorMsg(msg);
        toast.error(msg);
        setTurnstileToken("");
        setTurnstileResetKey((k) => k + 1);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      });

      if (error) {
        const msg = translateAuthError(error.message) || error.message;
        setErrorMsg(msg);
        toast.error(msg);
        setTurnstileToken("");
        setTurnstileResetKey((k) => k + 1);
      } else {
        toast.success("Si cet email existe, un lien de réinitialisation vous a été envoyé.");
        setSent(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur réseau lors de l'envoi.";
      setErrorMsg(msg);
      toast.error(msg);
      setTurnstileToken("");
      setTurnstileResetKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-none shadow-xl">
      <CardHeader className="space-y-3 items-center">
        <Link href="/" className="flex flex-col items-center gap-2 group mb-1">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-emerald-500/10 group-hover:scale-105 transition-transform p-0.5">
            <Image
              src="/logo.png"
              alt="MonBudget Logo"
              width={64}
              height={64}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-[#1E3A5F] dark:text-white">
            Mon<span className="text-emerald-500">Budget</span>
          </span>
        </Link>
        <CardTitle className="text-2xl font-bold text-center">Mot de passe oublié</CardTitle>
        <CardDescription className="text-center">
          Entrez votre email pour réinitialiser votre mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-green-600 font-medium">Lien envoyé !</p>
            <p className="text-sm text-slate-600">
              Veuillez vérifier votre boîte de réception et vos spams.
            </p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4 relative">
            <HoneypotField value={honeypot} onChange={setHoneypot} id="mb_forgot_hp" />
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 text-red-700 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vous@exemple.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <TurnstileWidget
              resetKey={turnstileResetKey}
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken("")}
            />
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? "Envoi en cours..." : "Envoyer le lien"}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center border-t p-4">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

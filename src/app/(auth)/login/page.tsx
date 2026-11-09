"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Eye, EyeOff, X } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { GoogleAuthButton } from "@/components/auth/google-button";
import { translateAuthError } from "@/lib/utils/auth-errors";
import { HoneypotField } from "@/components/security/honeypot-field";
import { TurnstileWidget, isTurnstileConfigured } from "@/components/security/turnstile-widget";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [inputsUnlocked, setInputsUnlocked] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const mountedAtRef = useRef<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    mountedAtRef.current = Date.now();
    // Bloque le remplissage automatique agressif du navigateur au chargement initial
    const timer = setTimeout(() => setInputsUnlocked(true), 150);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const rawError = searchParams.get("error_description") || searchParams.get("error");
    if (rawError) {
      setErrorMsg(translateAuthError(rawError));
    } else if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const hashError = hashParams.get("error_description") || hashParams.get("error");
      if (hashError) {
        setErrorMsg(translateAuthError(hashError));
      }
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
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
          action: "login",
          email: email.trim(),
          honeypot,
          formLoadedAt,
          formElapsedMs: formLoadedAt > 0 ? Math.max(0, Date.now() - formLoadedAt) : 0,
          turnstileToken,
        }),
      });

      if (!antiSpamRes.ok) {
        const antiSpamData = await antiSpamRes.json().catch(() => ({}));
        const msg = antiSpamData.error || "Connexion bloquée par la protection anti-spam.";
        setErrorMsg(msg);
        toast.error(msg);
        setTurnstileToken("");
        setTurnstileResetKey((k) => k + 1);
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = translateAuthError(error.message) || error.message;
        setErrorMsg(msg);
        toast.error(msg);
        setTurnstileToken("");
        setTurnstileResetKey((k) => k + 1);
        setLoading(false);
      } else {
        toast.success("Connexion réussie ! Ouverture de MonBudget...");
        const nextParam = searchParams.get("next");
        const planParam = searchParams.get("plan");
        let redirectTarget = "/dashboard";
        if (nextParam && nextParam.startsWith("/")) {
          redirectTarget = nextParam;
        } else if (planParam) {
          redirectTarget = `/settings?tab=subscription&plan=${encodeURIComponent(planParam)}`;
        }
        window.location.href = redirectTarget;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur réseau lors de la connexion.";
      setErrorMsg(message);
      toast.error(message);
      setTurnstileToken("");
      setTurnstileResetKey((k) => k + 1);
      setLoading(false);
    }
  };

  const registerHref = searchParams.toString()
    ? `/register?${searchParams.toString()}`
    : "/register";

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
        <CardTitle className="text-2xl font-bold text-center">Bon retour !</CardTitle>
        <CardDescription className="text-center">
          Connectez-vous pour accéder à vos finances et votre budget.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} autoComplete="off" className="space-y-4 relative">
          <HoneypotField value={honeypot} onChange={setHoneypot} id="mb_login_hp" />
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 text-red-700 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <div className="relative">
              <Input
                id="login-email"
                name="mb_login_email"
                type="email"
                placeholder="vous@exemple.com"
                autoComplete="off"
                readOnly={!inputsUnlocked}
                onFocus={() => setInputsUnlocked(true)}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={email ? "pr-9" : ""}
              />
              {email && (
                <button
                  type="button"
                  onClick={() => setEmail("")}
                  aria-label="Effacer l'email"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                  tabIndex={-1}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="login-password">Mot de passe</Label>
              <Link href="/forgot-password" className="text-xs text-blue-600 dark:text-sky-400 hover:underline">
                Mot de passe oublié ?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="login-password"
                name="mb_login_password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="off"
                readOnly={!inputsUnlocked}
                onFocus={() => setInputsUnlocked(true)}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <TurnstileWidget
            resetKey={turnstileResetKey}
            onVerify={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
          />
          <Button type="submit" className="w-full bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white font-semibold h-11" disabled={loading}>
            {loading ? "Connexion en cours..." : "Se connecter"}
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 font-medium">
                Ou continuer avec
              </span>
            </div>
          </div>

          <GoogleAuthButton mode="signin" />

          <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
            En vous connectant, vous acceptez nos{" "}
            <Link href="/terms" target="_blank" className="text-blue-600 dark:text-sky-400 underline hover:text-sky-300">
              Conditions d&apos;utilisation
            </Link>{" "}
            et notre{" "}
            <Link href="/privacy" target="_blank" className="text-blue-600 dark:text-sky-400 underline hover:text-sky-300">
              Politique de confidentialité
            </Link>
            .
          </p>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Pas encore de compte ?{" "}
          <Link href={registerHref} className="text-blue-600 dark:text-sky-400 font-semibold hover:underline">
            S&apos;inscrire
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Chargement de la connexion...</div>}>
      <LoginForm />
    </Suspense>
  );
}

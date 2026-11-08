"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { GoogleAuthButton } from "@/components/auth/google-button";

function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const errorFromUrl = searchParams.get("error");
    if (errorFromUrl) {
      setErrorMsg(errorFromUrl);
    }
  }, [searchParams]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (password !== confirmPassword) {
      const msg = "Les deux mots de passe ne correspondent pas.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    if (password.length < 6) {
      const msg = "Le mot de passe doit comporter au moins 6 caractères.";
      setErrorMsg(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);

    try {
      const planParam = searchParams.get("plan");
      const nextParam = searchParams.get("next");
      let redirectNext = "/dashboard";
      if (nextParam && nextParam.startsWith("/")) {
        redirectNext = nextParam;
      } else if (planParam) {
        redirectNext = `/settings?tab=subscription&plan=${encodeURIComponent(planParam)}`;
      }

      const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(redirectNext)}`;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: name.trim(),
          },
        },
      });

      if (error) {
        let msg = error.message;
        if (error.message.includes("User already registered") || error.message.includes("already exists")) {
          msg = "Cette adresse email est déjà enregistrée. Veuillez vous connecter.";
        } else if (error.message.includes("Password should be at least")) {
          msg = "Le mot de passe doit comporter au moins 6 caractères.";
        }
        setErrorMsg(msg);
        toast.error(msg);
        setLoading(false);
      } else if (data?.user && data.user.identities && data.user.identities.length === 0) {
        // Supabase sign-up avec email déjà existant
        const msg = "Cette adresse email est déjà inscrite. Veuillez vous connecter avec votre mot de passe ou via Google.";
        setErrorMsg(msg);
        toast.info(msg);
        setLoading(false);
      } else if (data?.session) {
        toast.success("Compte créé et connecté avec succès !");
        window.location.href = redirectNext;
      } else {
        const msg = "Inscription réussie ! Un email de confirmation vous a été envoyé (vérifiez vos spams).";
        setSuccessMsg(msg);
        toast.success(msg);
        setLoading(false);
        setTimeout(() => {
          const loginHref = searchParams.toString()
            ? `/login?${searchParams.toString()}`
            : "/login";
          router.push(loginHref);
        }, 2200);
      }
    } catch (err: any) {
      const msg = err?.message || "Erreur réseau lors de l'inscription.";
      setErrorMsg(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  const loginHref = searchParams.toString()
    ? `/login?${searchParams.toString()}`
    : "/login";

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
        <CardTitle className="text-2xl font-bold text-center">Créer un compte</CardTitle>
        <CardDescription className="text-center">
          Commencez à gérer votre salaire et vos dépenses intelligemment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} method="post" className="space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-rose-950/40 border border-red-200 dark:border-rose-900/60 text-red-700 dark:text-rose-200 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nom complet</Label>
            <Input
              id="name"
              placeholder="Ex: Fidèle Atchadé"
              required
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="vous@exemple.com"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
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
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11" disabled={loading}>
            {loading ? "Création en cours..." : "S'inscrire"}
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

          <GoogleAuthButton mode="signup" />

          <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
            En créant un compte, vous acceptez nos{" "}
            <Link href="/terms" target="_blank" className="text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-500">
              Conditions d&apos;utilisation
            </Link>{" "}
            et notre{" "}
            <Link href="/privacy" target="_blank" className="text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-500">
              Politique de confidentialité
            </Link>
            .
          </p>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 p-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Vous avez déjà un compte ?{" "}
          <Link href={loginHref} className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline">
            Se connecter
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Chargement de l&apos;inscription...</div>}>
      <RegisterForm />
    </Suspense>
  );
}

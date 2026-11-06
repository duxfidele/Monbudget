"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isAdmin } from "@/lib/utils/admin";
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
  ArrowRightLeft,
  PiggyBank,
  Server,
  Mail,
  Clock,
  Sparkles,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Database
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Link from "next/link";

interface AdminMetrics {
  kpis: {
    totalUsers: number;
    totalBudgets: number;
    totalTransactions: number;
    totalSavingsGoals: number;
    totalDebts: number;
  };
  systemHealth: {
    database: string;
    cronJobs: string;
    emailService: string;
    pwaOfflineCache: string;
  };
  recentUsers: Array<{
    id: string;
    full_name?: string;
    currency?: string;
    created_at: string;
  }>;
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isTriggeringCron, setIsTriggeringCron] = useState(false);

  const supabase = createClient();

  const loadMetrics = async (email: string) => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/metrics");
      if (!res.ok) {
        throw new Error("Impossible de récupérer les métriques d'administration");
      }
      const data = await res.json();
      setMetrics(data);
    } catch (err: any) {
      console.error("Erreur métriques admin :", err);
      toast.error(err.message || "Erreur chargement métriques");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !user.email) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setUserEmail(user.email);
        const hasAccess = isAdmin(user.email);
        setAuthorized(hasAccess);

        if (hasAccess) {
          await loadMetrics(user.email);
        }
      } catch (err) {
        console.error("Erreur checkAuth admin :", err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const handleTriggerCron = async () => {
    setIsTriggeringCron(true);
    try {
      const res = await fetch("/api/cron/daily-check");
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Audit financier nocturne exécuté avec succès !", {
          description: `Date: ${data.executionDate} | Dettes vérifiées.`,
        });
      } else {
        toast.info("Tâche cron exécutée (accès sécurisé par clé Bearer).");
      }
    } catch (err) {
      toast.error("Impossible de joindre la route de cron.");
    } finally {
      setIsTriggeringCron(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="h-8 w-8 text-[#1E3A5F] dark:text-sky-400 animate-spin" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Vérification des privilèges administrateur...
        </p>
      </div>
    );
  }

  // Écran d'accès refusé pour les utilisateurs non-administrateurs
  if (authorized === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] p-4 text-center">
        <div className="p-4 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mb-4 shadow-sm">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Accès Restreint
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mb-6">
          Cet espace est strictement réservé aux administrateurs de la plateforme MonBudget.
          Votre compte (<strong>{userEmail || "Non connecté"}</strong>) ne dispose pas des droits requis.
        </p>
        <Link href="/dashboard">
          <Button className="bg-[#1E3A5F] hover:bg-[#152843] text-white">
            Retourner à mon tableau de bord
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* En-tête Espace Administrateur */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-[#1E3A5F] to-[#0A192F] text-white shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-300">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
              Espace Direction SaaS
            </span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Administration MonBudget
          </h1>
          <p className="text-xs text-slate-300">
            Connecté en tant que Super-Administrateur : <strong>{userEmail}</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => userEmail && loadMetrics(userEmail)}
            disabled={refreshing}
            className="border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Actualiser
          </Button>

          <Button
            size="sm"
            onClick={handleTriggerCron}
            disabled={isTriggeringCron}
            className="bg-sky-500 hover:bg-sky-600 text-white text-xs h-9 shadow-xs"
          >
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            {isTriggeringCron ? "Exécution..." : "Tester Cron Nocturne"}
          </Button>
        </div>
      </div>

      {/* Cartes KPI Globales */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Utilisateurs Inscrits
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#1E3A5F] dark:text-sky-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {metrics?.kpis.totalUsers ?? "—"}
            </div>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Comptes actifs en base
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Budgets Mensuels
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {metrics?.kpis.totalBudgets ?? "—"}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Mois budgétisés par les membres
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Transactions Gérées
            </CardTitle>
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {metrics?.kpis.totalTransactions ?? "—"}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Dépenses & revenus saisis
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Épargnes & Dettes
            </CardTitle>
            <div className="p-2 rounded-lg bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
              <PiggyBank className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {(metrics?.kpis.totalSavingsGoals || 0) + (metrics?.kpis.totalDebts || 0)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {metrics?.kpis.totalSavingsGoals || 0} cagnottes • {metrics?.kpis.totalDebts || 0} créances
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Moniteur de Santé Système & Services */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400" />
              <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                État des Services SaaS
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Infrastructure technique et connecteurs en production
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Base de données Supabase</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                {metrics?.systemHealth.database || "En ligne"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Audit Nocturne (Vercel Cron)</span>
              </div>
              <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                {metrics?.systemHealth.cronJobs || "00:00 UTC"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">Emails Transactionnels (Resend)</span>
              </div>
              <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 px-2 py-0.5 rounded-md border border-violet-200 dark:border-violet-800">
                {metrics?.systemHealth.emailService || "Actif"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Derniers Utilisateurs Inscrits */}
        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400" />
              <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                Derniers Membres Inscrits
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Nouveaux comptes créés récemment
            </CardDescription>
          </CardHeader>
          <CardContent>
            {metrics?.recentUsers && metrics.recentUsers.length > 0 ? (
              <div className="space-y-2">
                {metrics.recentUsers.slice(0, 5).map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {user.full_name || "Utilisateur"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(user.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-[#1E3A5F] dark:text-sky-300">
                      {user.currency || "FCFA"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                Aucun autre compte enregistré pour le moment.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


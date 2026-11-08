"use client";

import { useEffect, useState } from "react";
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
  RefreshCw,
  CheckCircle2,
  Database,
  CreditCard,
  Crown,
  Copy,
  Search,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import Link from "next/link";
import { SubscriptionPlanId } from "@/lib/moneriz-plans";
import { useUIStore } from "@/lib/store/ui-store";

interface AdminUserRow {
  id: string;
  email?: string;
  full_name?: string;
  currency?: string;
  plan_id?: SubscriptionPlanId;
  billing_cycle?: string;
  auth_provider?: string;
  created_at: string;
}

interface AdminOrderRow {
  id: string;
  reference: string;
  plan_id: string;
  billing_cycle: string;
  mode: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  user_email?: string;
}

interface AdminMetrics {
  multiUserScopeActive?: boolean;
  kpis: {
    totalUsers: number;
    totalBudgets: number;
    totalTransactions: number;
    totalSavingsGoals: number;
    totalDebts: number;
    totalRevenueXof?: number;
    paidSubscribers?: number;
    personalSubscribers?: number;
    businessSubscribers?: number;
  };
  systemHealth: {
    database: string;
    cronJobs: string;
    emailService: string;
    pwaOfflineCache: string;
    monerizGateway?: string;
    monerizWebhook?: string;
  };
  recentUsers: AdminUserRow[];
  recentOrders?: AdminOrderRow[];
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isTriggeringCron, setIsTriggeringCron] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const { refreshSubscription } = useUIStore();
  const supabase = createClient();

  const loadMetrics = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/admin/metrics", { cache: "no-store" });
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
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !user.email) {
          setAuthorized(false);
          setLoading(false);
          return;
        }

        setUserEmail(user.email);
        setCurrentUserId(user.id);
        const hasAccess = isAdmin(user.email);
        setAuthorized(hasAccess);

        if (hasAccess) {
          await loadMetrics();
        }
      } catch (err) {
        console.error("Erreur checkAuth admin :", err);
        setAuthorized(false);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch {
      toast.error("Impossible de joindre la route de cron.");
    } finally {
      setIsTriggeringCron(false);
    }
  };

  const handleChangeUserPlan = async (targetUserId: string, newPlan: SubscriptionPlanId) => {
    setUpdatingUserId(targetUserId);
    try {
      const res = await fetch("/api/admin/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUserId,
          planId: newPlan,
          billingCycle: newPlan === "free" ? "none" : "monthly",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Échec de la mise à jour du plan");
      }

      const planLabel =
        newPlan === "business"
          ? "Entreprise & Pro"
          : newPlan === "personal"
          ? "Particulier"
          : "Gratuit";

      toast.success(`Formule mise à jour vers « ${planLabel} » !`);
      await loadMetrics();

      if (targetUserId === currentUserId) {
        await refreshSubscription();
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du changement de formule.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleCopyWebhookUrl = () => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://monbudget-sable.vercel.app";
    const url = `${origin}/api/webhooks/moneriz`;
    navigator.clipboard.writeText(url);
    toast.success("URL du Webhook Moneriz copiée dans le presse-papier !", {
      description: url,
    });
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

  const filteredUsers = (metrics?.recentUsers || []).filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* En-tête Espace Administrateur */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#1E3A5F] via-[#152C4A] to-[#0A192F] text-white shadow-md">
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
            Super-Administrateur : <strong>{userEmail}</strong> • Accès intégral débloqué
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMetrics}
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

      {/* Cartes KPI Globales (2x2 sur mobile/tablette, 4 colonnes sur desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Utilisateurs Inscrits
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-[#1E3A5F] dark:text-sky-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {metrics?.kpis.totalUsers ?? "—"}
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {metrics?.kpis.paidSubscribers || 0} abonné(s) Pro/Particulier
              </span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Revenus Moneriz
            </CardTitle>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <CreditCard className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 truncate">
              {(metrics?.kpis.totalRevenueXof || 0).toLocaleString("fr-FR")} FCFA
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">
              {metrics?.kpis.personalSubscribers || 0} Particulier •{" "}
              {metrics?.kpis.businessSubscribers || 0} Entreprise
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Transactions & Budgets
            </CardTitle>
            <div className="p-2 rounded-lg bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {metrics?.kpis.totalTransactions ?? "—"}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">
              Sur {metrics?.kpis.totalBudgets || 0} mois budgétisés
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between p-4 pb-2">
            <CardTitle className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Épargnes & Dettes
            </CardTitle>
            <div className="p-2 rounded-lg bg-pink-50 dark:bg-pink-950/60 text-pink-600 dark:text-pink-400">
              <PiggyBank className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {(metrics?.kpis.totalSavingsGoals || 0) + (metrics?.kpis.totalDebts || 0)}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-1 truncate">
              {metrics?.kpis.totalSavingsGoals || 0} cagnottes • {metrics?.kpis.totalDebts || 0} créances
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grille Principale : Gestion des Membres & État des Services SaaS */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Gestion des Membres & Attribution Manuelle des Plans (7 colonnes) */}
        <Card className="lg:col-span-7 border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400" />
                  <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                    Membres Inscrits & Gestion des Abonnements
                  </CardTitle>
                </div>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  Modifiez en 1 clic la formule d&apos;un membre (Gratuit, Particulier, Entreprise).
                </CardDescription>
              </div>

              <div className="relative w-full sm:w-56">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  placeholder="Rechercher un membre..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs rounded-xl"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            {metrics && !metrics.multiUserScopeActive && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Astuce Multi-Utilisateurs :</strong> Pour afficher l&apos;intégralité des comptes inscrits au-delà du RLS, exécutez le fichier{" "}
                  <code className="font-mono text-[11px] bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded">
                    supabase/migrations/20261108_moneriz_subscriptions.sql
                  </code>{" "}
                  dans l&apos;éditeur SQL de Supabase.
                </div>
              </div>
            )}

            {filteredUsers.length > 0 ? (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {filteredUsers.map((member) => {
                  const currentPlan: SubscriptionPlanId = member.plan_id || "free";
                  return (
                    <div
                      key={member.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            {member.full_name || "Membre MonBudget"}
                          </p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 uppercase">
                            {member.auth_provider === "google" ? "Google" : "Email"}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-[#1E3A5F] dark:text-sky-300">
                            {member.currency || "FCFA"}
                          </span>
                        </div>
                        {member.email && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {member.email}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Inscrit le{" "}
                          {new Date(member.created_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>

                      {/* Sélecteur d'attribution directe de plan */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Crown
                          className={`h-4 w-4 ${
                            currentPlan === "business"
                              ? "text-amber-500"
                              : currentPlan === "personal"
                              ? "text-sky-500"
                              : "text-slate-400"
                          }`}
                        />
                        <select
                          aria-label={`Formule de ${member.full_name || member.email || "membre"}`}
                          value={currentPlan}
                          disabled={updatingUserId === member.id}
                          onChange={(e) =>
                            handleChangeUserPlan(
                              member.id,
                              e.target.value as SubscriptionPlanId
                            )
                          }
                          className="h-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                        >
                          <option value="free">Plan Gratuit (0 FCFA)</option>
                          <option value="personal">Particulier (1 000 FCFA)</option>
                          <option value="business">Entreprise (2 500 FCFA)</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                Aucun membre ne correspond à votre recherche.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Moniteur de Santé Système & Connecteur Moneriz (5 colonnes) */}
        <Card className="lg:col-span-5 border-none shadow-xs bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400" />
              <CardTitle className="text-base text-slate-900 dark:text-slate-100">
                État des Services SaaS & Moneriz
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Infrastructure technique et passerelle de paiement en production
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Base de données Supabase
                </span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                {metrics?.systemHealth.database || "online"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Passerelle Moneriz (XOF)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                {metrics?.systemHealth.monerizGateway || "en attente"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Clock className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Audit Nocturne (Vercel Cron)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                {metrics?.systemHealth.cronJobs || "00:00 UTC"}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 text-violet-600 dark:text-violet-400 shrink-0" />
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Emails Transactionnels (Resend)
                </span>
              </div>
              <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/60 px-2 py-0.5 rounded-md border border-violet-200 dark:border-violet-800">
                {metrics?.systemHealth.emailService || "Actif"}
              </span>
            </div>

            {/* Raccourci de configuration Webhook Moneriz */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
                  Endpoint Webhook Moneriz
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyWebhookUrl}
                  className="h-7 px-2 text-[11px] text-white hover:bg-white/15 gap-1"
                >
                  <Copy className="h-3 w-3" /> Copier l&apos;URL
                </Button>
              </div>
              <code className="block text-[11px] font-mono text-slate-300 break-all bg-black/40 p-2 rounded-lg">
                /api/webhooks/moneriz
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

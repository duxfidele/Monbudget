"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Plus,
  TrendingUp,
  Briefcase,
  CheckCircle2,
  Trash2,
  History,
  Calendar,
  Sparkles,
  Pause,
  Play,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Layers,
  Coins,
  Percent,
  BarChart3,
  Search,
  Filter,
  Edit3,
  Download,
  PieChart as PieChartIcon,
  RefreshCw,
  Scale,
  ShieldCheck,
  Check,
  X,
  Target,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";
import { PlanGate } from "@/components/payments/plan-gate";
import {
  formatMoney,
  formatThousands,
  parseThousands,
  getTotalExpenses,
  getRemainingToLive,
  getMonthlySavingsContributions,
  getTotalInvestedCapital,
  getTotalInvestmentReturns,
  getInvestmentROI,
  getPortfolioROI,
  getMonthlyInvestedCapital,
  getMonthlyInvestmentReturns,
  INVESTMENT_CATEGORIES,
  INVESTMENT_TEMPLATES,
  InvestmentItem,
  InvestmentOperationItem,
  getNetInvestedCapital,
  getTotalNetInvestedCapital,
  getTotalCapitalWithdrawals,
  getInvestmentCurrentValue,
  getTotalPortfolioCurrentValue,
  getInvestmentUnrealizedGain,
  getTotalPortfolioUnrealizedGain,
  getInvestmentGlobalROI,
  getPortfolioGlobalROI,
  getInvestmentPaybackPercent,
  getMonthlyCapitalWithdrawals,
} from "@/lib/utils/budget-calc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INVESTMENT_COLORS = [
  { name: "Indigo Royal", class: "bg-indigo-600" },
  { name: "Émeraude", class: "bg-emerald-600" },
  { name: "Ambre Or", class: "bg-amber-600" },
  { name: "Bleu Océan", class: "bg-blue-600" },
  { name: "Violet", class: "bg-purple-600" },
  { name: "Cyan", class: "bg-cyan-600" },
];

const SECTOR_PALETTE = [
  "#4F46E5", // Indigo
  "#10B981", // Émeraude
  "#F59E0B", // Ambre
  "#3B82F6", // Bleu
  "#8B5CF6", // Violet
  "#06B6D4", // Cyan
  "#EC4899", // Rose
  "#64748B", // Slate
];

export default function InvestmentsPage() {
  const {
    investments,
    addInvestment,
    updateInvestment,
    removeInvestment,
    updateInvestmentStatus,
    addInvestmentOperation,
    removeInvestmentOperation,
    currency,
    income,
    transactions,
    categories,
    savingsGoals,
    activeMonth,
  } = useUIStore();

  // Dialog states
  const [isNewInvOpen, setIsNewInvOpen] = useState(false);
  const [isEditInvOpen, setIsEditInvOpen] = useState(false);
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);

  // Operation Type (4 types : apport, gain encaissé, retrait, valorisation)
  const [opType, setOpType] = useState<
    "capital_outflow" | "return_inflow" | "capital_withdrawal" | "valuation_update"
  >("capital_outflow");

  // Filters, search & sort
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "capital_desc" | "roi_desc" | "target_progress">("recent");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>("all");

  // New Investment form
  const [invName, setInvName] = useState("");
  const [invCategory, setInvCategory] = useState<string>(INVESTMENT_CATEGORIES[0]);
  const [invTargetStr, setInvTargetStr] = useState("");
  const [invExpectedRoiStr, setInvExpectedRoiStr] = useState("20");
  const [invStartDate, setInvStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [invColor, setInvColor] = useState(INVESTMENT_COLORS[0].class);
  const [invNotes, setInvNotes] = useState("");

  // Edit Investment form
  const [editInvId, setEditInvId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState<string>(INVESTMENT_CATEGORIES[0]);
  const [editTargetStr, setEditTargetStr] = useState("");
  const [editExpectedRoiStr, setEditExpectedRoiStr] = useState("20");
  const [editStartDate, setEditStartDate] = useState("");
  const [editColor, setEditColor] = useState(INVESTMENT_COLORS[0].class);
  const [editNotes, setEditNotes] = useState("");
  const [editValuationStr, setEditValuationStr] = useState("");

  // Operation form
  const [opAmountStr, setOpAmountStr] = useState("");
  const [opDate, setOpDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [opNotes, setOpNotes] = useState("");

  const selectedInv: InvestmentItem | null = selectedInvId
    ? investments.find((i) => i.id === selectedInvId) || null
    : null;

  // Global Portfolio KPIs
  const totalInvested = getTotalInvestedCapital(investments);
  const totalNetInvested = getTotalNetInvestedCapital(investments);
  const totalReturns = getTotalInvestmentReturns(investments);
  const totalWithdrawals = getTotalCapitalWithdrawals(investments);
  const totalCurrentValuation = getTotalPortfolioCurrentValue(investments);
  const totalUnrealizedGains = getTotalPortfolioUnrealizedGain(investments);
  const portfolioGlobalRoi = getPortfolioGlobalROI(investments);
  const portfolioCashRoi = getPortfolioROI(investments);
  const activeCount = investments.filter((i) => i.status === "active").length;
  const completedCount = investments.filter((i) => i.status === "completed").length;

  // Monthly & Multi-Page Concordance KPIs
  const monthlyInvested = getMonthlyInvestedCapital(
    investments,
    activeMonth.year,
    activeMonth.month
  );
  const monthlyReturns = getMonthlyInvestmentReturns(
    investments,
    activeMonth.year,
    activeMonth.month
  );
  const monthlyWithdrawals = getMonthlyCapitalWithdrawals(
    investments,
    activeMonth.year,
    activeMonth.month
  );
  const monthlySavings = getMonthlySavingsContributions(
    savingsGoals,
    activeMonth.year,
    activeMonth.month
  );
  const totalExpenses = getTotalExpenses(transactions, monthlySavings);
  const availableBalance = getRemainingToLive(income, totalExpenses);
  const investmentEnvelope = categories.find(
    (c) => c.name.trim().toLowerCase() === "investissement"
  );

  // Allocation sectorielle pour le Donut Chart
  const allocationData = useMemo(() => {
    const map: Record<string, number> = {};
    investments.forEach((inv) => {
      const val = getInvestmentCurrentValue(inv);
      map[inv.category] = (map[inv.category] || 0) + val;
    });
    const totalVal = Object.values(map).reduce((a, b) => a + b, 0);
    return Object.entries(map)
      .filter(([_, val]) => val > 0)
      .map(([name, value], idx) => ({
        name,
        value,
        percentage: totalVal > 0 ? Math.round((value / totalVal) * 1000) / 10 : 0,
        color: SECTOR_PALETTE[idx % SECTOR_PALETTE.length],
      }));
  }, [investments]);

  // Filtrage et Tri des Investissements
  const filteredInvestments = useMemo(() => {
    return investments
      .filter((inv) => {
        // Filtre Statut
        if (statusFilter === "active" && inv.status !== "active") return false;
        if (statusFilter === "paused" && inv.status !== "paused") return false;
        if (statusFilter === "completed" && inv.status !== "completed") return false;

        // Filtre Catégorie
        if (categoryFilter !== "all" && inv.category !== categoryFilter) return false;

        // Recherche textuelle
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = inv.name.toLowerCase().includes(q);
          const matchNotes = (inv.notes || "").toLowerCase().includes(q);
          const matchCat = inv.category.toLowerCase().includes(q);
          if (!matchName && !matchNotes && !matchCat) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "capital_desc") {
          return (b.investedAmount || 0) - (a.investedAmount || 0);
        }
        if (sortBy === "roi_desc") {
          return getInvestmentGlobalROI(b) - getInvestmentGlobalROI(a);
        }
        if (sortBy === "target_progress") {
          const progA = a.targetAmount > 0 ? a.investedAmount / a.targetAmount : 1;
          const progB = b.targetAmount > 0 ? b.investedAmount / b.targetAmount : 1;
          return progB - progA;
        }
        // "recent" par défaut
        return (
          (new Date(b.createdAt || b.startDate || 0).getTime() || 0) -
          (new Date(a.createdAt || a.startDate || 0).getTime() || 0)
        );
      });
  }, [investments, statusFilter, categoryFilter, searchQuery, sortBy]);

  // Export CSV
  const exportToCsv = (filename: string, rows: string[][]) => {
    const processRow = (row: string[]) =>
      row
        .map((val) => {
          const clean = (val ?? "").toString().replace(/"/g, '""');
          return `"${clean}"`;
        })
        .join(";");

    const csvContent = "\uFEFF" + rows.map(processRow).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPortfolio = () => {
    if (investments.length === 0) {
      toast.error("Aucun investissement à exporter.");
      return;
    }
    const header = [
      "Date",
      "Projet",
      "Catégorie",
      "Statut",
      "Type d'opération",
      `Montant (${currency})`,
      "Notes / Détails",
    ];
    const rows: string[][] = [header];

    investments.forEach((inv) => {
      (inv.operations || []).forEach((op) => {
        let typeLabel = "Apport de capital";
        if (op.type === "return_inflow") typeLabel = "Gain / Rendement";
        if (op.type === "capital_withdrawal") typeLabel = "Retrait de capital";
        if (op.type === "valuation_update") typeLabel = "Actualisation valorisation";

        rows.push([
          op.date,
          inv.name,
          inv.category,
          inv.status === "active" ? "Actif" : inv.status === "paused" ? "En pause" : "Clôturé",
          typeLabel,
          String(op.amount),
          op.notes || "",
        ]);
      });
    });

    const dateStr = new Date().toISOString().split("T")[0];
    exportToCsv(`monbudget_portefeuille_investissements_${dateStr}.csv`, rows);
    toast.success("Journal complet du portefeuille exporté en CSV !");
  };

  const handleExportSingleInvestment = (inv: InvestmentItem) => {
    const header = [
      "Date",
      "Projet",
      "Type d'opération",
      `Montant (${currency})`,
      "Notes / Détails",
    ];
    const rows: string[][] = [header];

    (inv.operations || []).forEach((op) => {
      let typeLabel = "Apport de capital";
      if (op.type === "return_inflow") typeLabel = "Gain / Rendement";
      if (op.type === "capital_withdrawal") typeLabel = "Retrait de capital";
      if (op.type === "valuation_update") typeLabel = "Actualisation valorisation";

      rows.push([op.date, inv.name, typeLabel, String(op.amount), op.notes || ""]);
    });

    const cleanProjectName = inv.name.toLowerCase().replace(/[^a-z0-9]/gi, "_");
    const dateStr = new Date().toISOString().split("T")[0];
    exportToCsv(`monbudget_${cleanProjectName}_operations_${dateStr}.csv`, rows);
    toast.success(`Historique de « ${inv.name} » exporté en CSV !`);
  };

  // Actions Modales
  const handleOpenCreateModal = () => {
    setInvName("");
    setInvCategory(INVESTMENT_CATEGORIES[0]);
    setInvTargetStr("");
    setInvExpectedRoiStr("20");
    setInvStartDate(new Date().toISOString().split("T")[0]);
    setInvColor(INVESTMENT_COLORS[0].class);
    setInvNotes("");
    setIsNewInvOpen(true);
  };

  const handleCreateInvestment = async () => {
    const cleanName = invName.trim();
    const targetAmount = parseThousands(invTargetStr);
    const expectedReturnPercent = Math.max(0, Number(invExpectedRoiStr) || 0);

    if (!cleanName) {
      toast.error("Veuillez indiquer le nom de votre projet d'investissement.");
      return;
    }
    if (targetAmount <= 0) {
      toast.error("Veuillez indiquer un capital cible supérieur à 0.");
      return;
    }

    await addInvestment({
      name: cleanName,
      category: invCategory,
      targetAmount,
      expectedReturnPercent,
      startDate: invStartDate || undefined,
      color: invColor,
      notes: invNotes.trim() || undefined,
    });

    setIsNewInvOpen(false);
    toast.success(`Projet d'investissement « ${cleanName} » créé avec succès !`);
  };

  const handleOpenEditModal = (inv: InvestmentItem) => {
    setEditInvId(inv.id);
    setEditName(inv.name);
    setEditCategory(inv.category);
    setEditTargetStr(formatThousands(inv.targetAmount));
    setEditExpectedRoiStr(String(inv.expectedReturnPercent || 0));
    setEditStartDate(inv.startDate || new Date().toISOString().split("T")[0]);
    setEditColor(inv.color || INVESTMENT_COLORS[0].class);
    setEditNotes(inv.notes || "");
    setEditValuationStr(
      inv.currentValuation !== undefined ? formatThousands(inv.currentValuation) : ""
    );
    setIsEditInvOpen(true);
  };

  const handleUpdateInvestment = async () => {
    if (!editInvId) return;
    const cleanName = editName.trim();
    const targetAmount = parseThousands(editTargetStr);
    const expectedReturnPercent = Math.max(0, Number(editExpectedRoiStr) || 0);
    const currentValuation =
      editValuationStr.trim() !== "" ? parseThousands(editValuationStr) : undefined;

    if (!cleanName) {
      toast.error("Le nom du projet d'investissement ne peut être vide.");
      return;
    }
    if (targetAmount <= 0) {
      toast.error("Veuillez indiquer un capital cible valide.");
      return;
    }

    await updateInvestment(editInvId, {
      name: cleanName,
      category: editCategory,
      targetAmount,
      expectedReturnPercent,
      startDate: editStartDate || undefined,
      color: editColor,
      notes: editNotes.trim() || undefined,
      currentValuation,
    });

    setIsEditInvOpen(false);
    toast.success(`Projet « ${cleanName} » mis à jour avec succès !`);
  };

  const handleOpenOpModal = (
    inv: InvestmentItem,
    defaultType: "capital_outflow" | "return_inflow" | "capital_withdrawal" | "valuation_update"
  ) => {
    setSelectedInvId(inv.id);
    setOpType(defaultType);
    setOpAmountStr("");
    setOpDate(new Date().toISOString().split("T")[0]);
    setOpNotes("");
    setIsOpModalOpen(true);
  };

  const handleOpenHistoryModal = (inv: InvestmentItem) => {
    setSelectedInvId(inv.id);
    setHistoryTypeFilter("all");
    setIsHistoryOpen(true);
  };

  const handleSubmitOperation = async () => {
    if (!selectedInv) return;
    const amount = parseThousands(opAmountStr);
    if (amount <= 0) {
      toast.error("Veuillez saisir un montant valide supérieur à 0.");
      return;
    }

    await addInvestmentOperation(
      selectedInv.id,
      opType,
      amount,
      opNotes.trim() || undefined,
      opDate
    );

    if (opType === "capital_outflow") {
      toast.success(`Capital de ${formatMoney(amount, currency)} placé !`, {
        description: `Ajouté à « ${selectedInv.name} » et synchronisé avec l'enveloppe Investissement.`,
      });
    } else if (opType === "return_inflow") {
      toast.success(`Gain de +${formatMoney(amount, currency)} encaissé !`, {
        description: `Ajouté à « ${selectedInv.name} » et crédité dans votre Revenu Réel.`,
      });
    } else if (opType === "capital_withdrawal") {
      toast.success(`Retrait de ${formatMoney(amount, currency)} effectué !`, {
        description: `Capital récupéré de « ${selectedInv.name} » et réinjecté dans votre Solde disponible.`,
      });
    } else {
      toast.success(`Valeur marchande actualisée à ${formatMoney(amount, currency)} !`, {
        description: `La valorisation de « ${selectedInv.name} » a été mise à jour dans votre patrimoine.`,
      });
    }

    setIsOpModalOpen(false);
  };

  const handleDeleteOperation = async (operationId: string) => {
    if (!selectedInv) return;
    await removeInvestmentOperation(operationId, selectedInv.id);
    toast.success("Opération annulée et synchronisée avec votre budget.");
  };

  return (
    <PlanGate
      feature="investments"
      featureTitle="Portefeuille d'Investissements & Suivi Patrimonial"
      featureDescription="Pilotez vos projets d'investissement (Commerce, Agriculture, Immobilier, Transport, BRVM...), suivez apports, gains, retraits et valorisations avec concordance 100 % automatique sur votre budget."
    >
      <div className="flex flex-col gap-6 pb-12">
        {/* =========================================================================
            1. MODALE CRÉATION D'UN PROJET D'INVESTISSEMENT
        ========================================================================== */}
        <Dialog open={isNewInvOpen} onOpenChange={setIsNewInvOpen}>
          <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Nouveau Projet d&apos;Investissement
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Créez un actif productif pour faire fructifier votre capital et suivre sa valeur.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Modèles rapides */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Idées d&apos;investissements fréquents (clic rapide)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {INVESTMENT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      type="button"
                      onClick={() => {
                        setInvName(tpl.name);
                        setInvCategory(tpl.category);
                        setInvTargetStr(formatThousands(tpl.suggestedTarget));
                        setInvExpectedRoiStr(String(tpl.expectedReturnPercent));
                        setInvColor(tpl.color);
                      }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition ${
                        invName === tpl.name
                          ? "bg-indigo-600 text-white border-indigo-600 font-semibold"
                          : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {tpl.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Nom du projet d&apos;investissement
                </label>
                <Input
                  placeholder="Ex: Boutique cosmétiques, Élevage de poulets, Terrain..."
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Secteur / Catégorie
                  </label>
                  <select
                    value={invCategory}
                    onChange={(e) => setInvCategory(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {INVESTMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Date de démarrage
                  </label>
                  <Input
                    type="date"
                    value={invStartDate}
                    onChange={(e) => setInvStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Capital cible à investir ({currency})
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 500 000"
                    value={invTargetStr}
                    onChange={(e) => setInvTargetStr(formatThousands(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Rendement espéré (ROI visé %)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="1000"
                    placeholder="Ex: 25"
                    value={invExpectedRoiStr}
                    onChange={(e) => setInvExpectedRoiStr(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Notes ou objectifs de rentabilité (optionnel)
                </label>
                <Input
                  placeholder="Ex: Revente prévue dans 6 mois, dividendes mensuels..."
                  value={invNotes}
                  onChange={(e) => setInvNotes(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Couleur d&apos;identification
                </label>
                <div className="flex items-center gap-2.5 pt-1">
                  {INVESTMENT_COLORS.map((c) => (
                    <button
                      key={c.class}
                      type="button"
                      onClick={() => setInvColor(c.class)}
                      className={`w-7 h-7 rounded-full ${c.class} transition-transform ${
                        invColor === c.class
                          ? "ring-2 ring-offset-2 ring-slate-800 scale-110"
                          : "opacity-80 hover:opacity-100"
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsNewInvOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleCreateInvestment}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                Créer l&apos;investissement
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            2. MODALE MODIFICATION D'UN PROJET D'INVESTISSEMENT
        ========================================================================== */}
        <Dialog open={isEditInvOpen} onOpenChange={setIsEditInvOpen}>
          <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Edit3 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Modifier le Projet d&apos;Investissement
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Ajustez les paramètres, la cible ou la valorisation marchande actuelle.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Nom du projet
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nom de l'actif ou du projet"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Secteur / Catégorie
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {INVESTMENT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Date de démarrage
                  </label>
                  <Input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Capital cible ({currency})
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={editTargetStr}
                    onChange={(e) => setEditTargetStr(formatThousands(e.target.value))}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    ROI visé (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="1000"
                    value={editExpectedRoiStr}
                    onChange={(e) => setEditExpectedRoiStr(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>Valeur marchande actuelle estimée ({currency})</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">optionnel</span>
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: valeur de revente estimée du terrain ou du stock"
                  value={editValuationStr}
                  onChange={(e) => setEditValuationStr(formatThousands(e.target.value))}
                />
                <p className="text-[11px] text-slate-500">
                  Laissez vide pour aligner automatiquement sur le capital net engagé.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Notes et stratégie
                </label>
                <Input
                  placeholder="Notes, objectifs ou détails..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Couleur d&apos;identification
                </label>
                <div className="flex items-center gap-2.5 pt-1">
                  {INVESTMENT_COLORS.map((c) => (
                    <button
                      key={c.class}
                      type="button"
                      onClick={() => setEditColor(c.class)}
                      className={`w-7 h-7 rounded-full ${c.class} transition-transform ${
                        editColor === c.class
                          ? "ring-2 ring-offset-2 ring-slate-800 scale-110"
                          : "opacity-80 hover:opacity-100"
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsEditInvOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleUpdateInvestment}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                Enregistrer les modifications
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            3. MODALE D'OPÉRATION (Apport, Gain, Retrait, Valorisation)
        ========================================================================== */}
        <Dialog open={isOpModalOpen} onOpenChange={setIsOpModalOpen}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                {opType === "capital_outflow" && (
                  <>
                    <ArrowUpRight className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Apport de capital : {selectedInv?.name}
                  </>
                )}
                {opType === "return_inflow" && (
                  <>
                    <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Encaisser un gain : {selectedInv?.name}
                  </>
                )}
                {opType === "capital_withdrawal" && (
                  <>
                    <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    Retirer du capital : {selectedInv?.name}
                  </>
                )}
                {opType === "valuation_update" && (
                  <>
                    <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    Valorisation marchande : {selectedInv?.name}
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                {opType === "capital_outflow" &&
                  "Déduit de votre Solde disponible et synchronisé avec l'enveloppe Investissement."}
                {opType === "return_inflow" &&
                  "Ajouté directement à votre Revenu Réel du mois et augmente votre Solde disponible."}
                {opType === "capital_withdrawal" &&
                  "Récupère du capital de ce projet et le réinjecte dans votre compte (augmente le Solde)."}
                {opType === "valuation_update" &&
                  "Actualise la valeur marchande estimée sans impacter votre trésorerie liquide."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Sélecteur 4 types d'opérations */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setOpType("capital_outflow")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    opType === "capital_outflow"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Apport capital
                </button>
                <button
                  type="button"
                  onClick={() => setOpType("return_inflow")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    opType === "return_inflow"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  Gain encaissé
                </button>
                <button
                  type="button"
                  onClick={() => setOpType("capital_withdrawal")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    opType === "capital_withdrawal"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  <Coins className="h-3.5 w-3.5" />
                  Retrait capital
                </button>
                <button
                  type="button"
                  onClick={() => setOpType("valuation_update")}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 ${
                    opType === "valuation_update"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Valorisation
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  {opType === "valuation_update" ? "Nouvelle valeur estimée" : "Montant"} ({currency})
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 50 000"
                  value={opAmountStr}
                  onChange={(e) => setOpAmountStr(formatThousands(e.target.value))}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Date de l&apos;opération
                </label>
                <Input
                  type="date"
                  value={opDate}
                  onChange={(e) => setOpDate(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Détail / Note (optionnel)
                </label>
                <Input
                  placeholder={
                    opType === "capital_outflow"
                      ? "Ex: Achat premier stock, avance terrain..."
                      : opType === "return_inflow"
                      ? "Ex: Bénéfice ventes du mois, dividende BRVM..."
                      : opType === "capital_withdrawal"
                      ? "Ex: Vente partielle du stock, récupération mise..."
                      : "Ex: Évaluation marchande terrain suite aménagement..."
                  }
                  value={opNotes}
                  onChange={(e) => setOpNotes(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setIsOpModalOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSubmitOperation}
                className={
                  opType === "capital_outflow"
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                    : opType === "return_inflow"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    : opType === "capital_withdrawal"
                    ? "bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                    : "bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                }
              >
                {opType === "capital_outflow" && "Confirmer l'apport"}
                {opType === "return_inflow" && "Encaisser ce gain"}
                {opType === "capital_withdrawal" && "Enregistrer le retrait"}
                {opType === "valuation_update" && "Mettre à jour la valeur"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            4. MODALE HISTORIQUE & JOURNAL DES OPÉRATIONS
        ========================================================================== */}
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 max-h-[88vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 pr-6">
                <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  Journal d&apos;opérations : {selectedInv?.name}
                </DialogTitle>
                {selectedInv && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportSingleInvestment(selectedInv)}
                    className="h-8 gap-1.5 text-xs border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Export CSV
                  </Button>
                )}
              </div>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Suivi chronologique des apports, gains perçus, retraits et valorisations.
              </DialogDescription>
            </DialogHeader>

            {/* Bilan Synthétique en haut de l'historique */}
            {selectedInv && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 text-xs">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">
                    Capital net engagé
                  </span>
                  <strong className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {formatMoney(getNetInvestedCapital(selectedInv), currency)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">
                    Gains perçus (Cash)
                  </span>
                  <strong className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                    +{formatMoney(selectedInv.totalReturns || 0, currency)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">
                    Valeur actuelle
                  </span>
                  <strong className="text-sm font-extrabold text-indigo-600 dark:text-indigo-400">
                    {formatMoney(getInvestmentCurrentValue(selectedInv), currency)}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase">
                    ROI Global Net
                  </span>
                  <strong
                    className={`text-sm font-extrabold ${
                      getInvestmentGlobalROI(selectedInv) >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600"
                    }`}
                  >
                    {getInvestmentGlobalROI(selectedInv) >= 0 ? "+" : ""}
                    {getInvestmentGlobalROI(selectedInv)}%
                  </strong>
                </div>
              </div>
            )}

            {/* Filtre interne par type d'opération */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 text-[11px] font-semibold uppercase pr-1">Filtre :</span>
              {[
                { id: "all", label: "Toutes" },
                { id: "capital_outflow", label: "Apports" },
                { id: "return_inflow", label: "Gains" },
                { id: "capital_withdrawal", label: "Retraits" },
                { id: "valuation_update", label: "Valorisations" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHistoryTypeFilter(f.id)}
                  className={`px-2.5 py-1 rounded-full font-medium transition shrink-0 ${
                    historyTypeFilter === f.id
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Liste chronologique des opérations */}
            <div className="flex-1 overflow-y-auto space-y-2 py-1 pr-1">
              {selectedInv &&
              selectedInv.operations &&
              selectedInv.operations.filter((o) =>
                historyTypeFilter === "all" ? true : o.type === historyTypeFilter
              ).length > 0 ? (
                selectedInv.operations
                  .filter((o) => (historyTypeFilter === "all" ? true : o.type === historyTypeFilter))
                  .map((op) => {
                    const isReturn = op.type === "return_inflow";
                    const isWithdrawal = op.type === "capital_withdrawal";
                    const isValuation = op.type === "valuation_update";

                    let badgeBg = "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300";
                    let badgeLabel = "Apport capital";
                    let amountColor = "text-indigo-700 dark:text-indigo-300";
                    let prefix = "-";

                    if (isReturn) {
                      badgeBg = "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
                      badgeLabel = "Gain perçu";
                      amountColor = "text-emerald-700 dark:text-emerald-400";
                      prefix = "+";
                    } else if (isWithdrawal) {
                      badgeBg = "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
                      badgeLabel = "Retrait capital";
                      amountColor = "text-amber-700 dark:text-amber-400";
                      prefix = "+";
                    } else if (isValuation) {
                      badgeBg = "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
                      badgeLabel = "Valorisation";
                      amountColor = "text-purple-700 dark:text-purple-400";
                      prefix = "≈ ";
                    }

                    return (
                      <div
                        key={op.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 hover:bg-slate-100/70 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${badgeBg}`}>
                            {isReturn && <ArrowDownLeft className="h-4 w-4" />}
                            {isWithdrawal && <Coins className="h-4 w-4" />}
                            {isValuation && <TrendingUp className="h-4 w-4" />}
                            {!isReturn && !isWithdrawal && !isValuation && (
                              <ArrowUpRight className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-sm ${amountColor}`}>
                                {prefix}
                                {formatMoney(op.amount, currency)}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeBg}`}>
                                {badgeLabel}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              <span>
                                {new Date(op.date).toLocaleDateString("fr-FR", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                              {op.notes && (
                                <>
                                  <span>•</span>
                                  <span className="italic text-slate-600 dark:text-slate-300 truncate">
                                    {op.notes}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteOperation(op.id)}
                          className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 h-8 w-8 shrink-0"
                          title="Supprimer cette opération"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Aucune opération correspondant à ce filtre.
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 border-t flex flex-wrap gap-2 justify-between items-center">
              <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>
                Fermer
              </Button>
              {selectedInv && (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    onClick={() => {
                      setIsHistoryOpen(false);
                      handleOpenOpModal(selectedInv, "capital_outflow");
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs h-8"
                  >
                    <Plus className="h-3.5 w-3.5" /> Apport
                  </Button>
                  <Button
                    onClick={() => {
                      setIsHistoryOpen(false);
                      handleOpenOpModal(selectedInv, "return_inflow");
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs h-8"
                  >
                    <Plus className="h-3.5 w-3.5" /> Gain
                  </Button>
                  <Button
                    onClick={() => {
                      setIsHistoryOpen(false);
                      handleOpenOpModal(selectedInv, "capital_withdrawal");
                    }}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-1 text-xs h-8"
                  >
                    <Coins className="h-3.5 w-3.5" /> Retrait
                  </Button>
                </div>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* =========================================================================
            EN-TÊTE DE LA PAGE & ACTIONS PRINCIPALES
        ========================================================================== */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 mb-1 border border-indigo-100 dark:border-indigo-800/50">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Gestion de Patrimoine & Actifs Productifs</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Portefeuille d&apos;Investissements
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">
              Pilotez vos actifs, valorisations, apports et dividendes avec une concordance 100 % automatique sur votre budget.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={handleExportPortfolio}
              className="gap-1.5 h-10 text-xs sm:text-sm font-semibold border-slate-200 dark:border-slate-700"
              title="Exporter l'ensemble du portefeuille au format CSV"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
            <Button
              onClick={handleOpenCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5 flex-1 sm:flex-initial h-10 text-xs sm:text-sm font-bold"
            >
              <Plus className="h-4 w-4" />
              <span>Nouvel investissement</span>
            </Button>
          </div>
        </div>

        {/* =========================================================================
            TABLEAU DE BORD : 5 CARTES KPI PATRIMONIALES
        ========================================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4">
          {/* 1. Capital Investi Total */}
          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Capital Total Injecté
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-indigo-100 dark:bg-indigo-950/60 rounded-lg shrink-0">
                <Briefcase className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div
                suppressHydrationWarning
                className="text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100 truncate"
              >
                {formatMoney(totalInvested, currency)}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                Net : {formatMoney(totalNetInvested, currency)}
              </p>
            </CardContent>
          </Card>

          {/* 2. Valeur Actuelle du Portefeuille */}
          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Valeur Actuelle (Actifs)
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-sky-100 dark:bg-sky-950/60 rounded-lg shrink-0">
                <Scale className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 dark:text-sky-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div
                suppressHydrationWarning
                className="text-lg sm:text-2xl font-extrabold text-sky-700 dark:text-sky-300 truncate"
              >
                {formatMoney(totalCurrentValuation, currency)}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                Plus-value latente :{" "}
                <span
                  className={
                    totalUnrealizedGains >= 0
                      ? "text-emerald-600 font-semibold"
                      : "text-red-500 font-semibold"
                  }
                >
                  {totalUnrealizedGains >= 0 ? "+" : ""}
                  {formatMoney(totalUnrealizedGains, currency)}
                </span>
              </p>
            </CardContent>
          </Card>

          {/* 3. Gains Réalisés (Cash perçu) */}
          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Gains Reçus (Cash)
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg shrink-0">
                <Coins className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div
                suppressHydrationWarning
                className="text-lg sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 truncate"
              >
                +{formatMoney(totalReturns, currency)}
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                Retraits capital : +{formatMoney(totalWithdrawals, currency)}
              </p>
            </CardContent>
          </Card>

          {/* 4. Rentabilité (ROI Global Net) */}
          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Rendement Global (ROI)
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-950/60 rounded-lg shrink-0">
                <Percent className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div
                suppressHydrationWarning
                className={`text-lg sm:text-2xl font-extrabold ${
                  portfolioGlobalRoi >= 0
                    ? "text-purple-700 dark:text-purple-300"
                    : "text-red-600"
                }`}
              >
                {portfolioGlobalRoi >= 0 ? "+" : ""}
                {portfolioGlobalRoi}%
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                Rdt cash pur : +{portfolioCashRoi}%
              </p>
            </CardContent>
          </Card>

          {/* 5. Flux du Mois */}
          <Card className="col-span-2 lg:col-span-1 min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Mouvements du Mois
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-amber-100 dark:bg-amber-950/60 rounded-lg shrink-0">
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600 dark:text-amber-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div
                suppressHydrationWarning
                className="text-sm sm:text-base font-extrabold text-indigo-700 dark:text-indigo-300 truncate"
              >
                Placé : {formatMoney(monthlyInvested, currency)}
              </div>
              <p className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                Gains ce mois : +{formatMoney(monthlyReturns, currency)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* =========================================================================
            GRAPHIQUE RECHARTS : ALLOCATION SECTORIELLE DU PATRIMOINE
        ========================================================================== */}
        {allocationData.length > 0 && (
          <Card className="border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    Répartition Sectorielle du Portefeuille
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Allocation des actifs par catégorie en fonction de leur valeur marchande actuelle
                  </CardDescription>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-xs font-semibold text-slate-400">Total valorisé</span>
                  <p className="text-sm font-extrabold text-slate-800 dark:text-white">
                    {formatMoney(totalCurrentValuation, currency)}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5 pt-2">
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* Donut Chart */}
                <div className="h-[180px] w-[180px] sm:h-[200px] sm:w-[200px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={allocationData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: unknown) => [
                          formatMoney(Number(val) || 0, currency),
                          "Valeur",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Légende interactive enrichie */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full">
                  {allocationData.map((item) => (
                    <div
                      key={item.name}
                      onClick={() =>
                        setCategoryFilter(categoryFilter === item.name ? "all" : item.name)
                      }
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        categoryFilter === item.name
                          ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-400 shadow-xs"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium">
                            {formatMoney(item.value, currency)}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-2">
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* =========================================================================
            BANDEAU CONCORDANCE BUDGET, REVENUS & TRANSACTIONS
        ========================================================================== */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border border-indigo-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-700 dark:text-slate-200 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Wallet className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400 shrink-0" />
              <span>Solde disponible :</span>
              <strong
                className={availableBalance < 0 ? "text-red-600" : "text-emerald-700 dark:text-emerald-400"}
              >
                {formatMoney(availableBalance, currency)}
              </strong>
            </div>
            <span className="hidden sm:inline text-slate-300">|</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <Briefcase className="h-4 w-4 text-indigo-600 shrink-0" />
              <span>Investi ce mois :</span>
              <strong className="text-indigo-700 dark:text-indigo-300">
                {formatMoney(monthlyInvested, currency)}
              </strong>
              {investmentEnvelope && (
                <span className="text-slate-500 text-xs">
                  (Enveloppe : {formatMoney(investmentEnvelope.amount, currency)})
                </span>
              )}
            </div>
            <span className="hidden sm:inline text-slate-300">|</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Gains ajoutés au Revenu :</span>
              <strong className="text-emerald-700 dark:text-emerald-400">
                +{formatMoney(monthlyReturns, currency)}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/budget"
              className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Layers className="h-3.5 w-3.5" />
              Mon Budget
            </Link>
            <Link
              href="/transactions"
              className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              Transactions
            </Link>
          </div>
        </div>

        {/* =========================================================================
            BARRE D'OUTILS : RECHERCHE, FILTRES PAR STATUT / CATÉGORIE & TRI
        ========================================================================== */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Recherche textuelle */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Rechercher par projet, notes ou secteur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 text-xs sm:text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtres par statut (Tous, Actifs, Pause, Clôturés) */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs overflow-x-auto shrink-0">
            {[
              { id: "all", label: `Tous (${investments.length})` },
              { id: "active", label: `Actifs (${activeCount})` },
              {
                id: "paused",
                label: `En pause (${investments.filter((i) => i.status === "paused").length})`,
              },
              { id: "completed", label: `Clôturés (${completedCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`py-1.5 px-2.5 rounded-lg font-semibold transition shrink-0 ${
                  statusFilter === tab.id
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sélecteur de Tri */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 font-semibold hidden lg:inline">Trier par :</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "recent" | "capital_desc" | "roi_desc" | "target_progress")
              }
              className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="recent">Plus récents d&apos;abord</option>
              <option value="capital_desc">Capital le plus élevé</option>
              <option value="roi_desc">Meilleur ROI Net</option>
              <option value="target_progress">Avancement du capital cible</option>
            </select>
          </div>
        </div>

        {/* Pilules de filtres par catégorie si plusieurs catégories existent */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1 rounded-full font-medium transition shrink-0 ${
              categoryFilter === "all"
                ? "bg-indigo-600 text-white font-semibold"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
            }`}
          >
            Toutes les catégories
          </button>
          {INVESTMENT_CATEGORIES.map((cat) => {
            const count = investments.filter((i) => i.category === cat).length;
            if (count === 0 && categoryFilter !== cat) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)}
                className={`px-3 py-1 rounded-full font-medium transition shrink-0 flex items-center gap-1 ${
                  categoryFilter === cat
                    ? "bg-indigo-600 text-white font-semibold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                }`}
              >
                <span>{cat}</span>
                <span className="text-[10px] opacity-75">({count})</span>
              </button>
            );
          })}
        </div>

        {/* =========================================================================
            LISTE DES PROJETS D'INVESTISSEMENT (CARTES ENRICHIES)
        ========================================================================== */}
        {investments.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
            <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="p-4 rounded-2xl bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-4">
                <Briefcase className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Aucun projet d&apos;investissement enregistré
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
                Lancez votre premier actif productif (commerce, agriculture, terrain, moto-taxi, actions BRVM...) pour suivre votre capital et rentabiliser vos revenus.
              </p>
              <Button
                onClick={handleOpenCreateModal}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-semibold"
              >
                <Plus className="h-4 w-4" />
                Créer mon premier investissement
              </Button>
            </CardContent>
          </Card>
        ) : filteredInvestments.length === 0 ? (
          <div className="text-center py-12 px-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aucun investissement ne correspond à vos critères de recherche ou de filtre.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("all");
                setStatusFilter("all");
              }}
              className="mt-3 text-xs"
            >
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredInvestments.map((inv) => {
              const progressPercent =
                inv.targetAmount > 0
                  ? Math.min(100, Math.round((inv.investedAmount / inv.targetAmount) * 100))
                  : 100;
              const globalRoi = getInvestmentGlobalROI(inv);
              const cashRoi = getInvestmentROI(inv);
              const netInvested = getNetInvestedCapital(inv);
              const curVal = getInvestmentCurrentValue(inv);
              const unrealizedGain = getInvestmentUnrealizedGain(inv);
              const paybackPct = getInvestmentPaybackPercent(inv);
              const isPaused = inv.status === "paused";
              const isCompleted = inv.status === "completed";

              return (
                <Card
                  key={inv.id}
                  className={`overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition bg-white dark:bg-slate-900 ${
                    isPaused ? "opacity-75" : isCompleted ? "border-emerald-200 dark:border-emerald-800/60" : ""
                  }`}
                >
                  <div className={`h-2 w-full ${inv.color || "bg-indigo-600"}`} />
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {inv.category}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              globalRoi >= 0
                                ? "bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200/60"
                                : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            ROI Net : {globalRoi >= 0 ? "+" : ""}
                            {globalRoi}%
                            {inv.expectedReturnPercent > 0
                              ? ` (visé ${inv.expectedReturnPercent}%)`
                              : ""}
                          </span>
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> Clôturé
                            </span>
                          ) : isPaused ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <Pause className="h-3 w-3" /> En pause
                            </span>
                          ) : null}
                        </div>

                        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white truncate pt-1">
                          {inv.name}
                        </CardTitle>
                        {inv.notes && (
                          <CardDescription className="text-xs text-slate-500 line-clamp-1">
                            {inv.notes}
                          </CardDescription>
                        )}
                      </div>

                      {/* Menu d'actions rapides du projet */}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditModal(inv)}
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                          title="Modifier les paramètres"
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            updateInvestmentStatus(
                              inv.id,
                              isPaused ? "active" : "paused"
                            )
                          }
                          className="h-8 w-8 text-slate-400 hover:text-slate-700"
                          title={isPaused ? "Reprendre le projet" : "Mettre en pause"}
                        >
                          {isPaused ? (
                            <Play className="h-4 w-4 text-emerald-600" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenHistoryModal(inv)}
                          className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                          title="Journal des opérations"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={async () => {
                            if (
                              confirm(
                                `Voulez-vous vraiment supprimer le projet « ${inv.name} » ? Ses opérations liées seront également retirées.`
                              )
                            ) {
                              await removeInvestment(inv.id);
                              toast.success(`Investissement « ${inv.name} » supprimé.`);
                            }
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                          title="Supprimer ce projet"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-2 space-y-4">
                    {/* Grille 4 Chiffres Clés du Projet */}
                    <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-slate-400">
                          Capital Net Engagé
                        </p>
                        <p className="text-base font-extrabold text-slate-900 dark:text-white">
                          {formatMoney(netInvested, currency)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Total injecté : {formatMoney(inv.investedAmount, currency)}
                        </p>
                      </div>

                      <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
                        <p className="text-[10px] uppercase font-semibold text-slate-400">
                          Valeur Actuelle (Actif)
                        </p>
                        <p className="text-base font-extrabold text-indigo-700 dark:text-indigo-300">
                          {formatMoney(curVal, currency)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Plus-value :{" "}
                          <span
                            className={
                              unrealizedGain >= 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"
                            }
                          >
                            {unrealizedGain >= 0 ? "+" : ""}
                            {formatMoney(unrealizedGain, currency)}
                          </span>
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] uppercase font-semibold text-slate-400">
                          Gains Encaissés (Cash)
                        </p>
                        <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                          +{formatMoney(inv.totalReturns, currency)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Rdt cash : +{cashRoi}%
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700 border-l pl-3">
                        <p className="text-[10px] uppercase font-semibold text-slate-400">
                          Amortissement (Payback)
                        </p>
                        <p className="text-base font-extrabold text-slate-800 dark:text-slate-100">
                          {paybackPct}%
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Retraits : {formatMoney(inv.totalWithdrawals || 0, currency)}
                        </p>
                      </div>
                    </div>

                    {/* Barre de progression du capital cible */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1">
                          <Target className="h-3 w-3 text-slate-400" />
                          Constitution capital : {formatMoney(inv.investedAmount, currency)} / {formatMoney(inv.targetAmount, currency)} ({progressPercent}%)
                        </span>
                        {inv.startDate && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Depuis {new Date(inv.startDate).toLocaleDateString("fr-FR")}
                          </span>
                        )}
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            inv.color || "bg-indigo-600"
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* 4 Boutons d'Action Rapide par Projet */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                      <Button
                        type="button"
                        onClick={() => handleOpenOpModal(inv, "capital_outflow")}
                        disabled={isPaused}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-8.5 px-2 gap-1"
                        title="Injecter du capital supplémentaire"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">+ Apport</span>
                      </Button>

                      <Button
                        type="button"
                        onClick={() => handleOpenOpModal(inv, "return_inflow")}
                        disabled={isPaused}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-8.5 px-2 gap-1"
                        title="Encaisser un dividende ou bénéfice"
                      >
                        <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">+ Gain</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenOpModal(inv, "capital_withdrawal")}
                        disabled={isPaused}
                        className="text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-bold h-8.5 px-2 gap-1"
                        title="Retirer du capital investi vers le budget"
                      >
                        <Coins className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">- Retrait</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleOpenOpModal(inv, "valuation_update")}
                        disabled={isPaused}
                        className="text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs font-bold h-8.5 px-2 gap-1"
                        title="Actualiser la valeur marchande du bien"
                      >
                        <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Valoriser</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </PlanGate>
  );
}

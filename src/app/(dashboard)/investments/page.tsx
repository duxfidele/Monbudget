"use client";

import { useState } from "react";
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
} from "lucide-react";
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

export default function InvestmentsPage() {
  const {
    investments,
    addInvestment,
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
  const [isOpModalOpen, setIsOpModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedInvId, setSelectedInvId] = useState<string | null>(null);
  const [opType, setOpType] = useState<"capital_outflow" | "return_inflow">("capital_outflow");

  // New Investment form
  const [invName, setInvName] = useState("");
  const [invCategory, setInvCategory] = useState<string>(INVESTMENT_CATEGORIES[0]);
  const [invTargetStr, setInvTargetStr] = useState("");
  const [invExpectedRoiStr, setInvExpectedRoiStr] = useState("20");
  const [invStartDate, setInvStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [invColor, setInvColor] = useState(INVESTMENT_COLORS[0].class);
  const [invNotes, setInvNotes] = useState("");

  // Operation form (Invest capital or Record return)
  const [opAmountStr, setOpAmountStr] = useState("");
  const [opDate, setOpDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [opNotes, setOpNotes] = useState("");

  const selectedInv: InvestmentItem | null = selectedInvId
    ? investments.find((i) => i.id === selectedInvId) || null
    : null;

  // Global Portfolio KPIs
  const totalInvested = getTotalInvestedCapital(investments);
  const totalReturns = getTotalInvestmentReturns(investments);
  const portfolioRoi = getPortfolioROI(investments);
  const activeCount = investments.filter((i) => i.status === "active").length;

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

  const handleOpenOpModal = (
    inv: InvestmentItem,
    defaultType: "capital_outflow" | "return_inflow"
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
      toast.success(`Capital de ${formatMoney(amount, currency)} investi !`, {
        description: `Ajouté à « ${selectedInv.name} » et déduit automatiquement de votre Solde disponible (enveloppe Investissement synchronisée dans Mon Budget).`,
      });
    } else {
      toast.success(`Gain / Rendement de +${formatMoney(amount, currency)} encaissé !`, {
        description: `Ajouté aux rendements de « ${selectedInv.name} » et crédité automatiquement dans votre Revenu Réel du mois.`,
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
      featureTitle="Portefeuille d'Investissements & Suivi ROI"
      featureDescription="Pilotez vos projets d'investissement (Commerce, Agriculture, Immobilier, Transport, BRVM...), suivez vos placements de capital et encaissez vos rendements avec une concordance 100 % automatique sur votre budget, vos revenus et vos rapports."
    >
      <div className="flex flex-col gap-6 pb-12">
        {/* 1. Modale Création d'un Projet d'Investissement */}
        <Dialog open={isNewInvOpen} onOpenChange={setIsNewInvOpen}>
          <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Briefcase className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Nouveau Projet d&apos;Investissement
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Créez un actif productif pour faire fructifier votre capital et suivre vos gains.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Modèles rapides adaptés au contexte africain */}
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
                    Date de lancement
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
                    Rendement espéré (ROI %)
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
                  placeholder="Ex: Revente prévue dans 6 mois, dividende mensuel..."
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

        {/* 2. Modale d'Opération (Placer du capital OU Encaisser un gain) */}
        <Dialog open={isOpModalOpen} onOpenChange={setIsOpModalOpen}>
          <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                {opType === "capital_outflow" ? (
                  <>
                    <ArrowUpRight className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    Investir du capital : {selectedInv?.name}
                  </>
                ) : (
                  <>
                    <ArrowDownLeft className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Encaisser un gain : {selectedInv?.name}
                  </>
                )}
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                {opType === "capital_outflow"
                  ? "Ce placement sera déduit de votre Solde disponible et synchronisé avec l'enveloppe « Investissement » dans Mon Budget."
                  : "Ce rendement sera ajouté automatiquement à votre Revenu Réel du mois et augmentera votre Solde disponible."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Sélecteur de type d'opération */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setOpType("capital_outflow")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    opType === "capital_outflow"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Investir du capital
                </button>
                <button
                  type="button"
                  onClick={() => setOpType("return_inflow")}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    opType === "return_inflow"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  <ArrowDownLeft className="h-3.5 w-3.5" />
                  Encaisser un gain
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Montant ({currency})
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
                      ? "Ex: Achat premier stock, avance terrain, matériel..."
                      : "Ex: Bénéfice ventes du mois, dividende, recette moto..."
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
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-semibold"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-semibold"
                }
              >
                {opType === "capital_outflow"
                  ? "Confirmer le placement"
                  : "Encaisser ce rendement"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 3. Modale Historique des Opérations d'un Investissement */}
        <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                <History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Journal de l&apos;investissement : {selectedInv?.name}
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400">
                Capital placé :{" "}
                <strong>
                  {selectedInv ? formatMoney(selectedInv.investedAmount, currency) : 0}
                </strong>{" "}
                • Gains encaissés :{" "}
                <strong className="text-emerald-600">
                  +{selectedInv ? formatMoney(selectedInv.totalReturns, currency) : 0}
                </strong>{" "}
                (ROI : {selectedInv ? getInvestmentROI(selectedInv) : 0}%)
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
              {selectedInv && selectedInv.operations && selectedInv.operations.length > 0 ? (
                selectedInv.operations.map((op) => {
                  const isReturn = op.type === "return_inflow";
                  return (
                    <div
                      key={op.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100/60 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            isReturn
                              ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                              : "bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300"
                          }`}
                        >
                          {isReturn ? (
                            <ArrowDownLeft className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-bold text-sm ${
                                isReturn
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-indigo-700 dark:text-indigo-300"
                              }`}
                            >
                              {isReturn ? "+" : "-"}
                              {formatMoney(op.amount, currency)}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                isReturn
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-indigo-100 text-indigo-800"
                              }`}
                            >
                              {isReturn ? "Gain encaissé" : "Capital investi"}
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
                        className="text-slate-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 shrink-0"
                        title="Supprimer cette opération (met à jour le budget automatiquement)"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm">
                  Aucune opération enregistrée sur cet investissement pour le moment.
                </div>
              )}
            </div>

            <DialogFooter className="pt-2 border-t flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>
                Fermer
              </Button>
              {selectedInv && (
                <>
                  <Button
                    onClick={() => {
                      setIsHistoryOpen(false);
                      handleOpenOpModal(selectedInv, "capital_outflow");
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Investir du capital
                  </Button>
                  <Button
                    onClick={() => {
                      setIsHistoryOpen(false);
                      handleOpenOpModal(selectedInv, "return_inflow");
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Encaisser un gain
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* En-tête de la page */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-800 mb-1 border border-indigo-100">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              <span>Actifs Productifs & Revenus Passifs</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Portefeuille d&apos;Investissements
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm md:text-base">
              Placez votre capital, encaissez vos rendements et gardez 100 % de concordance avec votre budget.
            </p>
          </div>

          <Button
            onClick={handleOpenCreateModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-1.5 w-full sm:w-auto h-10 text-xs sm:text-sm font-bold"
          >
            <Plus className="h-4 w-4" />
            <span>Nouvel investissement</span>
          </Button>
        </div>

        {/* 4 Cartes KPI Globales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Capital Total Investi
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
                Sur {investments.length} projet(s) ({activeCount} actif(s))
              </p>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Gains / Rendements Reçus
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
                Synchronisés avec vos revenus
              </p>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-5 pb-1 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 truncate">
                Rentabilité (ROI Global)
              </CardTitle>
              <div className="p-1.5 sm:p-2 bg-purple-100 dark:bg-purple-950/60 rounded-lg shrink-0">
                <Percent className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-5 pt-0 sm:pt-0">
              <div
                suppressHydrationWarning
                className="text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-slate-100"
              >
                +{portfolioRoi}%
              </div>
              <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 sm:mt-1 truncate">
                Ratio Gains / Capital placé
              </p>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-none shadow-sm bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
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

        {/* Bandeau de Concordance 100 % avec Mon Budget, Revenus & Transactions */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border border-indigo-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-700 dark:text-slate-200 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Wallet className="h-4 w-4 text-[#1E3A5F] dark:text-sky-400 shrink-0" />
              <span>Solde disponible (Mon Budget) :</span>
              <strong className={availableBalance < 0 ? "text-red-600" : "text-emerald-700 dark:text-emerald-400"}>
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
              <span>Rendements ajoutés au Revenu :</span>
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

        {/* Liste des Projets d'Investissement */}
        {investments.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
            <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="p-4 rounded-2xl bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-4">
                <Briefcase className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Aucun projet d&apos;investissement actif
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-1 mb-6">
                Lancez votre premier investissement (commerce, agriculture, terrain, moto-taxi, BRVM...) pour suivre le capital engagé et encaisser vos rendements directement dans votre budget.
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {investments.map((inv) => {
              const progressPercent =
                inv.targetAmount > 0
                  ? Math.min(100, Math.round((inv.investedAmount / inv.targetAmount) * 100))
                  : 100;
              const roi = getInvestmentROI(inv);
              const isPaused = inv.status === "paused";
              const isCompleted =
                inv.status === "completed" ||
                (inv.targetAmount > 0 && inv.investedAmount >= inv.targetAmount);

              return (
                <Card
                  key={inv.id}
                  className={`overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-xs hover:shadow-md transition bg-white dark:bg-slate-900 ${
                    isPaused ? "opacity-75" : ""
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
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60">
                            ROI réel : +{roi}%
                            {inv.expectedReturnPercent > 0
                              ? ` (cible ${inv.expectedReturnPercent}%)`
                              : ""}
                          </span>
                          {isCompleted && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                              <CheckCircle2 className="h-3 w-3" /> Capital complet
                            </span>
                          )}
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

                      <div className="flex items-center gap-1 shrink-0">
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
                            await removeInvestment(inv.id);
                            toast.success(`Investissement « ${inv.name} » supprimé.`);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Supprimer ce projet"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-5 pt-2 space-y-4">
                    {/* Chiffres clés du projet : Capital investi vs Gains encaissés */}
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Capital placé
                        </p>
                        <p className="text-base font-extrabold text-slate-900 dark:text-white">
                          {formatMoney(inv.investedAmount, currency)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Cible : {formatMoney(inv.targetAmount, currency)}
                        </p>
                      </div>
                      <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Gains encaissés
                        </p>
                        <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                          +{formatMoney(inv.totalReturns, currency)}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {(inv.operations || []).filter((o) => o.type === "return_inflow").length}{" "}
                          encaissement(s)
                        </p>
                      </div>
                    </div>

                    {/* Barre de progression du capital cible */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-600 dark:text-slate-400">
                          Constitution du capital ({progressPercent}%)
                        </span>
                        {inv.startDate && (
                          <span className="text-slate-400 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Depuis le {new Date(inv.startDate).toLocaleDateString("fr-FR")}
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

                    {/* Boutons d'action directe : Placer du capital OU Encaisser un gain */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <Button
                        type="button"
                        onClick={() => handleOpenOpModal(inv, "capital_outflow")}
                        disabled={isPaused}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold h-9 gap-1.5"
                      >
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">+ Investir capital</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={() => handleOpenOpModal(inv, "return_inflow")}
                        disabled={isPaused}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 gap-1.5"
                      >
                        <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">+ Encaisser gain</span>
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

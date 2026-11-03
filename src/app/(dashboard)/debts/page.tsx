"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HandCoins,
  Plus,
  Trash2,
  History,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Phone,
  ArrowUpRight,
  ArrowDownLeft,
  BellRing,
  PlusCircle,
  Scale,
  User,
  Wallet,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useUIStore } from "@/lib/store/ui-store";
import {
  formatMoney,
  formatThousands,
  parseThousands,
  getTotalPayableDebts,
  getTotalReceivableDebts,
  getDebtAlerts,
  getTotalExpenses,
  getRemainingToLive,
  getMonthlySavingsContributions,
  getSpentByCategory,
  DebtItem,
} from "@/lib/utils/budget-calc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function DebtsPage() {
  const {
    debts,
    addDebt,
    removeDebt,
    addDebtPayment,
    removeDebtPayment,
    currency,
    income,
    transactions,
    categories,
    savingsGoals,
    activeMonth,
  } = useUIStore();

  const [activeTab, setActiveTab] = useState<"payable" | "receivable">("payable");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtItem | null>(null);

  // New Debt Form
  const [debtType, setDebtType] = useState<"payable" | "receivable">("payable");
  const [personName, setPersonName] = useState("");
  const [phone, setPhone] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Payment Form
  const [paymentAmountStr, setPaymentAmountStr] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentNotes, setPaymentNotes] = useState("");

  // KPIs
  const totalPayable = getTotalPayableDebts(debts);
  const totalReceivable = getTotalReceivableDebts(debts);
  const netDebtPosition = totalReceivable - totalPayable;
  const alerts = getDebtAlerts(debts, new Date(), 7, currency);

  // Liaison directe avec Mon Budget
  const totalExpenses = getTotalExpenses(transactions);
  const monthlySavings = getMonthlySavingsContributions(savingsGoals, activeMonth.year, activeMonth.month);
  const availableBalance = getRemainingToLive(income, totalExpenses, monthlySavings);
  const debtEnvelope = categories.find(
    (c) => c.name.trim().toLowerCase() === "remboursement de dette"
  );
  const repaidThisMonth = getSpentByCategory(transactions, "Remboursement de dette");

  const filteredDebts = debts.filter((d) => d.type === activeTab);

  // Sync selectedDebt with live store updates
  const currentSelectedDebt = selectedDebt ? debts.find((d) => d.id === selectedDebt.id) || selectedDebt : null;

  const handleOpenAddModal = (defaultType?: "payable" | "receivable") => {
    setDebtType(defaultType || activeTab);
    setPersonName("");
    setPhone("");
    setAmountStr("");
    setDueDate("");
    setNotes("");
    setIsAddOpen(true);
  };

  const handleCreateDebt = async () => {
    const cleanName = personName.trim();
    const totalAmount = parseThousands(amountStr);

    if (!cleanName) {
      toast.error("Veuillez indiquer le nom de la personne ou de l'organisme.");
      return;
    }
    if (totalAmount <= 0) {
      toast.error("Veuillez saisir un montant valide supérieur à 0.");
      return;
    }

    await addDebt({
      type: debtType,
      personName: cleanName,
      phone: phone.trim() || undefined,
      totalAmount,
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined,
    });

    setActiveTab(debtType);
    setIsAddOpen(false);
    toast.success(
      debtType === "payable"
        ? `Dette envers ${cleanName} (${formatMoney(totalAmount, currency)}) enregistrée.`
        : `Créance sur ${cleanName} (${formatMoney(totalAmount, currency)}) enregistrée.`
    );
  };

  const handleOpenPaymentModal = (debt: DebtItem) => {
    setSelectedDebt(debt);
    setPaymentAmountStr(formatThousands(debt.remainingAmount));
    setPaymentDate(new Date().toISOString().split("T")[0]);
    setPaymentNotes("");
    setIsPaymentOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!currentSelectedDebt) return;
    const amount = parseThousands(paymentAmountStr);
    if (amount <= 0) {
      toast.error("Veuillez saisir un montant de remboursement valide.");
      return;
    }

    await addDebtPayment(
      currentSelectedDebt.id,
      amount,
      paymentNotes.trim() || undefined,
      paymentDate
    );

    toast.success(`Remboursement de ${formatMoney(amount, currency)} enregistré !`, {
      description:
        currentSelectedDebt.type === "payable"
          ? `Versé à ${currentSelectedDebt.personName} — déduit automatiquement de votre Solde disponible et ajouté aux Transactions.`
          : `Reçu de ${currentSelectedDebt.personName} — ajouté automatiquement à vos Entrées et à votre Solde disponible.`,
    });
    setIsPaymentOpen(false);
  };

  const handleOpenHistoryModal = (debt: DebtItem) => {
    setSelectedDebt(debt);
    setIsHistoryOpen(true);
  };

  const getDueBadge = (debt: DebtItem) => {
    if (debt.status === "paid" || debt.remainingAmount <= 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
          <CheckCircle2 className="h-3 w-3" /> Soldé à 100%
        </span>
      );
    }
    if (!debt.dueDate) return null;
    const todayMidnight = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    ).getTime();
    const parts = debt.dueDate.split("-");
    const dueMidnight = new Date(
      parseInt(parts[0], 10),
      parseInt(parts[1], 10) - 1,
      parseInt(parts[2], 10)
    ).getTime();
    const diffDays = Math.round((dueMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="h-3 w-3" /> En retard ({Math.abs(diffDays)} j)
        </span>
      );
    }
    if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
          <BellRing className="h-3 w-3" /> Échéance aujourd&apos;hui
        </span>
      );
    }
    if (diffDays <= 7) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <Calendar className="h-3 w-3" /> Échéance J-{diffDays}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
        <Calendar className="h-3 w-3" /> Échéance : {new Date(debt.dueDate).toLocaleDateString("fr-FR")}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* 1. Modale Création Dette / Créance */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <HandCoins className="h-5 w-5 text-[#1E3A5F]" />
              Enregistrer une Dette ou Créance
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Suivez précisément ce que vous devez rembourser et ce que l&apos;on vous doit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Sélecteur Type */}
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setDebtType("payable")}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  debtType === "payable"
                    ? "bg-white shadow-xs text-rose-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                Je dois (À rembourser)
              </button>
              <button
                type="button"
                onClick={() => setDebtType("receivable")}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition flex items-center justify-center gap-1.5 ${
                  debtType === "receivable"
                    ? "bg-white shadow-xs text-emerald-600"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <ArrowDownLeft className="h-4 w-4" />
                On me doit (À récupérer)
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                {debtType === "payable"
                  ? "Personne ou institution à qui je dois"
                  : "Personne qui me doit de l'argent"}
              </label>
              <Input
                placeholder="Ex: Oncle Koffi, Tontine Quartier, Ami Marc..."
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Montant ({currency})
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 50 000"
                  value={amountStr}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, "");
                    setAmountStr(digits ? formatThousands(digits) : "");
                  }}
                  className="font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Date d&apos;échéance
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Téléphone / Contact (optionnel)
              </label>
              <Input
                placeholder="Ex: +229 01 97 00 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Motif ou note (optionnel)
              </label>
              <Input
                placeholder="Ex: Prêt urgence santé, Avance marchandise..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateDebt}
              className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Modale d'enregistrement d'un remboursement */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <PlusCircle className="h-5 w-5 text-emerald-600" />
              Enregistrer un remboursement
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              {currentSelectedDebt?.type === "payable"
                ? `Remboursement versé à ${currentSelectedDebt?.personName}`
                : `Remboursement reçu de ${currentSelectedDebt?.personName}`}
              {" — "}Reste actuel :{" "}
              <strong>
                {formatMoney(currentSelectedDebt?.remainingAmount || 0, currency)}
              </strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Montant remboursé ({currency})
              </label>
              <Input
                type="text"
                inputMode="numeric"
                value={paymentAmountStr}
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  setPaymentAmountStr(digits ? formatThousands(digits) : "");
                }}
                className="font-bold text-lg"
                autoFocus
              />
              {currentSelectedDebt && currentSelectedDebt.remainingAmount > 0 && (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentAmountStr(
                        formatThousands(Math.round(currentSelectedDebt.remainingAmount / 2))
                      )
                    }
                    className="text-xs px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                  >
                    50% ({formatMoney(Math.round(currentSelectedDebt.remainingAmount / 2), currency)})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentAmountStr(formatThousands(currentSelectedDebt.remainingAmount))
                    }
                    className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold"
                  >
                    Solder tout ({formatMoney(currentSelectedDebt.remainingAmount, currency)})
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Date du remboursement
              </label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Note (Mobile Money, Espèces, Virement...)
              </label>
              <Input
                placeholder="Ex: Envoyé par Wave / MTN MoMo / Espèces..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsPaymentOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmitPayment}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Valider le remboursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Modale Historique des remboursements */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <History className="h-5 w-5 text-[#1E3A5F]" />
              Historique : {currentSelectedDebt?.personName}
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Montant initial :{" "}
              <strong>{formatMoney(currentSelectedDebt?.totalAmount || 0, currency)}</strong> | Reste
              :{" "}
              <strong>{formatMoney(currentSelectedDebt?.remainingAmount || 0, currency)}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-2.5 py-3 pr-1">
            {currentSelectedDebt &&
            currentSelectedDebt.payments &&
            currentSelectedDebt.payments.length > 0 ? (
              currentSelectedDebt.payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50"
                >
                  <div>
                    <p className="font-bold text-sm text-slate-800">
                      {formatMoney(p.amount, currency)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span>{new Date(p.date).toLocaleDateString("fr-FR")}</span>
                      {p.notes && (
                        <>
                          <span>•</span>
                          <span className="italic text-slate-600">{p.notes}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      removeDebtPayment(p.id, currentSelectedDebt.id);
                      toast.info("Remboursement annulé.");
                    }}
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Supprimer ce remboursement"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                Aucun remboursement enregistré pour ce dossier.
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" onClick={() => setIsHistoryOpen(false)}>
              Fermer
            </Button>
            {currentSelectedDebt && currentSelectedDebt.remainingAmount > 0 && (
              <Button
                onClick={() => {
                  setIsHistoryOpen(false);
                  handleOpenPaymentModal(currentSelectedDebt);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                <Plus className="h-4 w-4" /> Nouveau remboursement
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 mb-1 border border-amber-200">
            <HandCoins className="h-3.5 w-3.5 text-amber-600" />
            <span>Engagements & Recouvrements</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Gestion des Dettes & Créances
          </h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">
            Suivez les personnes à qui vous devez de l&apos;argent, celles qui vous doivent, les échéances et les remboursements.
          </p>
        </div>

        <Button
          onClick={() => handleOpenAddModal()}
          className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white shadow-xs gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>Nouveau dossier</span>
        </Button>
      </div>

      {/* Alertes de rappel d'échéance */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.debt.id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border ${
                alert.urgency === "overdue"
                  ? "bg-red-50 border-red-200 text-red-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <div className="flex items-center gap-3">
                <BellRing
                  className={`h-5 w-5 shrink-0 ${
                    alert.urgency === "overdue" ? "text-red-600" : "text-amber-600"
                  }`}
                />
                <div className="text-xs md:text-sm font-medium">{alert.message}</div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOpenPaymentModal(alert.debt)}
                className="bg-white text-xs h-8 shrink-0 self-end sm:self-center"
              >
                Enregistrer un règlement
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Cartes KPI */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dettes à Rembourser (Je dois)
            </CardTitle>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600">
              {formatMoney(totalPayable, currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {debts.filter((d) => d.type === "payable" && d.remainingAmount > 0).length} créancier(s)
              actif(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Dettes à Récupérer (On me doit)
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {formatMoney(totalReceivable, currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {debts.filter((d) => d.type === "receivable" && d.remainingAmount > 0).length}{" "}
              débiteur(s) actif(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Position Nette (Créances - Dettes)
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-50 text-[#1E3A5F]">
              <Scale className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                netDebtPosition >= 0 ? "text-slate-900" : "text-rose-600"
              }`}
            >
              {netDebtPosition > 0 ? "+" : ""}
              {formatMoney(netDebtPosition, currency)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {alerts.length > 0
                ? `${alerts.length} échéance(s) proche(s) ou en retard`
                : "Aucune échéance en retard"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bandeau de liaison directe avec Mon Budget */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-[#1E3A5F]/5 via-blue-50/70 to-emerald-50/60 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-[#1E3A5F]" />
            <span>Solde disponible (Mon Budget) :</span>
            <strong className={availableBalance < 0 ? "text-red-600" : "text-emerald-700"}>
              {formatMoney(availableBalance, currency)}
            </strong>
          </div>
          <span className="hidden sm:inline text-slate-300">|</span>
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-rose-600" />
            <span>Remboursé ce mois-ci :</span>
            <strong className="text-rose-700">{formatMoney(repaidThisMonth, currency)}</strong>
            {debtEnvelope && (
              <span className="text-xs text-slate-500">
                (sur {formatMoney(debtEnvelope.amount, currency)} budgétisés)
              </span>
            )}
          </div>
        </div>
        <Link href="/budget">
          <Button
            variant="outline"
            size="sm"
            className="border-blue-200 bg-white hover:bg-blue-50 text-[#1E3A5F] text-xs h-8 gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Voir dans Mon Budget</span>
          </Button>
        </Link>
      </div>

      {/* Onglets de bascule : Dettes à rembourser vs Dettes à récupérer */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        <Button
          variant={activeTab === "payable" ? "default" : "outline"}
          onClick={() => setActiveTab("payable")}
          className={
            activeTab === "payable"
              ? "bg-rose-600 hover:bg-rose-700 text-white gap-2"
              : "text-slate-700 border-slate-200 gap-2"
          }
        >
          <ArrowUpRight className="h-4 w-4" />
          <span>Personnes auxquelles je dois ({debts.filter((d) => d.type === "payable").length})</span>
        </Button>

        <Button
          variant={activeTab === "receivable" ? "default" : "outline"}
          onClick={() => setActiveTab("receivable")}
          className={
            activeTab === "receivable"
              ? "bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              : "text-slate-700 border-slate-200 gap-2"
          }
        >
          <ArrowDownLeft className="h-4 w-4" />
          <span>Personnes qui me doivent ({debts.filter((d) => d.type === "receivable").length})</span>
        </Button>
      </div>

      {/* Liste des dossiers */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {filteredDebts.map((debt) => {
          const paidAmount = Math.max(0, debt.totalAmount - debt.remainingAmount);
          const progressPercent =
            debt.totalAmount > 0 ? Math.min(100, Math.round((paidAmount / debt.totalAmount) * 100)) : 0;
          const isPaid = debt.remainingAmount <= 0;

          return (
            <Card
              key={debt.id}
              className="border-none shadow-sm bg-white flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2.5 rounded-xl ${
                        debt.type === "payable"
                          ? "bg-rose-50 text-rose-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      <User className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-slate-900">
                        {debt.personName}
                      </CardTitle>
                      {debt.phone && (
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3" /> {debt.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      removeDebt(debt.id);
                      toast.info("Dossier supprimé.");
                    }}
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {getDueBadge(debt)}
                  {debt.notes && (
                    <span className="text-xs text-slate-500 truncate max-w-[200px]">
                      • {debt.notes}
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <div>
                      <span className="text-xs text-slate-500 block">
                        {debt.type === "payable" ? "Reste à payer" : "Reste à récupérer"}
                      </span>
                      <span
                        className={`text-xl font-extrabold ${
                          isPaid
                            ? "text-emerald-600"
                            : debt.type === "payable"
                            ? "text-rose-600"
                            : "text-slate-900"
                        }`}
                      >
                        {formatMoney(debt.remainingAmount, currency)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Montant initial</span>
                      <span className="text-sm font-semibold text-slate-700">
                        {formatMoney(debt.totalAmount, currency)}
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isPaid
                          ? "bg-emerald-500"
                          : debt.type === "payable"
                          ? "bg-rose-500"
                          : "bg-emerald-600"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                    <span>Remboursé : {formatMoney(paidAmount, currency)}</span>
                    <span className="font-semibold">{progressPercent}%</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  <Button
                    disabled={isPaid}
                    onClick={() => handleOpenPaymentModal(debt)}
                    className={`h-9 text-xs font-semibold text-white gap-1.5 ${
                      debt.type === "payable"
                        ? "bg-rose-600 hover:bg-rose-700"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>{debt.type === "payable" ? "Rembourser" : "Encaisser"}</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => handleOpenHistoryModal(debt)}
                    className="h-9 text-xs border-slate-200 text-slate-700 gap-1.5"
                  >
                    <History className="h-3.5 w-3.5 text-slate-500" />
                    <span>Historique ({debt.payments?.length || 0})</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filteredDebts.length === 0 && (
          <div className="col-span-full p-10 bg-white rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full mb-3">
              <HandCoins className="h-7 w-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              {activeTab === "payable"
                ? "Aucune dette à rembourser enregistrée"
                : "Aucune créance à récupérer enregistrée"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mb-5">
              {activeTab === "payable"
                ? "Notez ici les montants empruntés avec leur date d'échéance pour recevoir des rappels et suivre vos remboursements."
                : "Notez ici les sommes prêtées à vos proches ou clients afin de suivre chaque remboursement reçu."}
            </p>
            <Button
              onClick={() => handleOpenAddModal(activeTab)}
              className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90 text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>
                {activeTab === "payable"
                  ? "Ajouter une dette à rembourser"
                  : "Ajouter une créance à récupérer"}
              </span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}


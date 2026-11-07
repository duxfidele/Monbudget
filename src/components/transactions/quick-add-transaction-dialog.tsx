"use client";

import { useState } from "react";
import { Plus, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ReceiptUpload, ReceiptData } from "@/components/transactions/receipt-upload";
import { useUIStore } from "@/lib/store/ui-store";
import { formatMoney } from "@/lib/utils/budget-calc";
import { toast } from "sonner";

interface QuickAddTransactionDialogProps {
  customTrigger?: React.ReactElement;
}

export function QuickAddTransactionDialog({ customTrigger }: QuickAddTransactionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amountStr, setAmountStr] = useState("");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const { categories, currency, addTransaction } = useUIStore();

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Pré-remplir la catégorie par défaut
      if (categories.length > 0 && !category) {
        setCategory(categories[0].name);
      } else if (!category) {
        setCategory("Autre (Hors Budget)");
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(amountStr);

    if (!amount || isNaN(amount) || amount <= 0) {
      toast.error("Veuillez saisir un montant valide supérieur à 0.");
      return;
    }

    if (!label.trim()) {
      toast.error("Veuillez indiquer un libellé ou une description.");
      return;
    }

    try {
      addTransaction({
        id: crypto.randomUUID(),
        label: label.trim(),
        amount,
        category: type === "expense" ? category || "Autre (Hors Budget)" : "Revenu",
        date,
        type,
        receiptUrl: receipt?.url,
        receiptName: receipt?.name,
      });

      toast.success(
        type === "income"
          ? `Revenu de +${formatMoney(amount, currency)} enregistré !`
          : `Dépense de -${formatMoney(amount, currency)} déduite avec succès !`
      );

      // Reset
      setAmountStr("");
      setLabel("");
      setReceipt(null);
      setDate(new Date().toISOString().split("T")[0]);
      setIsOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'enregistrement.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          customTrigger || (
            <button
              type="button"
              className="flex flex-col items-center justify-center -mt-6 cursor-pointer focus:outline-hidden"
              aria-label="Ajouter une transaction"
            >
              <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-[#1E3A5F] via-sky-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-sky-900/40 border-4 border-white dark:border-slate-900 transition-transform active:scale-95 hover:scale-105">
                <Plus className="w-6 h-6 stroke-[2.5]" />
              </div>
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                Ajouter
              </span>
            </button>
          )
        }
      />

      <DialogContent className="sm:max-w-md p-5">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span>Nouvelle opération financière</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Sélecteur Segmenté Mobile : Dépense / Revenu */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setType("expense")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                type === "expense"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <ArrowDownRight className="w-4 h-4" />
              <span>Dépense</span>
            </button>

            <button
              type="button"
              onClick={() => setType("income")}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                type === "income"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Revenu supplémentaire</span>
            </button>
          </div>

          {/* 2. Champ Montant Grand Format (Pavé numérique optimisé) */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-amount" className="text-xs text-slate-500 font-medium">
              Montant ({currency})
            </Label>
            <div className="relative">
              <Input
                id="quick-amount"
                type="number"
                step="any"
                inputMode="decimal"
                placeholder="0"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                autoFocus
                required
                className="text-2xl sm:text-3xl font-extrabold h-14 pl-3 pr-16 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 uppercase">
                {currency}
              </span>
            </div>
          </div>

          {/* 3. Libellé de la dépense / rentrée */}
          <div className="space-y-1.5">
            <Label htmlFor="quick-label" className="text-xs text-slate-500 font-medium">
              Description / Libellé
            </Label>
            <Input
              id="quick-label"
              placeholder={type === "expense" ? "Ex: Courses, Carburant, Loyer" : "Ex: Prime, Vente, Remboursement reçu"}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              required
              className="text-base h-11 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl"
            />
          </div>

          {/* 4. Catégorie & Date en grille responsive */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {type === "expense" && (
              <div className="space-y-1.5">
                <Label htmlFor="quick-category" className="text-xs text-slate-500 font-medium">
                  Enveloppe / Catégorie
                </Label>
                <select
                  id="quick-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-11 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-sky-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  <option value="Autre (Hors Budget)">Autre (Hors Budget)</option>
                </select>
              </div>
            )}

            <div className={`space-y-1.5 ${type === "income" ? "sm:col-span-2" : ""}`}>
              <Label htmlFor="quick-date" className="text-xs text-slate-500 font-medium">
                Date de l&apos;opération
              </Label>
              <Input
                id="quick-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 text-sm bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 rounded-xl"
              />
            </div>
          </div>

          {/* 5. Justificatif / Reçu (Photo ou fichier) */}
          {type === "expense" && (
            <div className="pt-1">
              <Label className="text-xs text-slate-500 font-medium block mb-1.5">
                Justificatif ou Reçu (Optionnel)
              </Label>
              <ReceiptUpload receipt={receipt} onChange={setReceipt} />
            </div>
          )}

          {/* 6. Bouton de validation tactile pleine largeur */}
          <Button
            type="submit"
            className={`w-full h-12 text-base font-bold rounded-xl text-white shadow-md cursor-pointer transition-all active:scale-[0.98] ${
              type === "expense"
                ? "bg-rose-600 hover:bg-rose-700 shadow-rose-900/20"
                : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
            }`}
          >
            {type === "expense" ? "Enregistrer la dépense" : "Ajouter le revenu"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

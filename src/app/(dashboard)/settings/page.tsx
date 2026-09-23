"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Save, User, Bell, Shield, LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/lib/store/ui-store";
import { useEffect } from "react";

export default function SettingsPage() {
  const [name, setName] = useState("Fr Fidèle");
  const [email, setEmail] = useState("fidele@example.com");
  const [currency, setCurrency] = useState("FCFA");
  const { alertThreshold, updateAlertThreshold } = useUIStore();
  const [localAlert, setLocalAlert] = useState(80);
  useEffect(() => { if (alertThreshold) setLocalAlert(alertThreshold); }, [alertThreshold]);
  
  const supabase = createClient();
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const handleSave = async () => {
    await updateAlertThreshold(localAlert);
    toast.success("Paramètres mis à jour avec succès !");
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Paramètres</h2>
        <p className="text-slate-500 mt-2">
          Gérez votre profil, vos préférences et la sécurité de votre compte.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {/* Navigation des paramètres (Sidebar interne) */}
        <div className="md:col-span-1 space-y-1">
          <Button variant="secondary" className="w-full justify-start font-medium bg-slate-100 text-slate-900">
            <User className="mr-2 h-4 w-4" />
            Mon Profil
          </Button>
          <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-slate-900">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </Button>
          <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-slate-900">
            <Shield className="mr-2 h-4 w-4" />
            Sécurité
          </Button>
          <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 mt-4">
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>

        {/* Contenu principal */}
        <div className="md:col-span-3 space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Informations Personnelles</CardTitle>
              <CardDescription>Mettez à jour votre nom et votre adresse e-mail.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Nom complet</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Adresse e-mail</label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Préférences de l'application</CardTitle>
              <CardDescription>Personnalisez votre expérience sur MonBudget.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-2">
                <label className="text-sm font-medium text-slate-700">Devise par défaut</label>
                <select 
                  value={currency} 
                  onChange={(e) => setCurrency(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                >
                  <option value="FCFA">FCFA (Franc CFA)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium text-slate-900">Alertes de dépassement</label>
                  <p className="text-sm text-slate-500">Seuil d'alerte pour vos budgets.</p>
                </div>
                <select 
                  value={localAlert} 
                  onChange={(e) => setLocalAlert(Number(e.target.value))}
                  className="flex h-10 w-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value={50}>50 %</option>
                  <option value={80}>80 %</option>
                  <option value={90}>90 %</option>
                  <option value={100}>100 %</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} className="bg-[#1E3A5F] hover:bg-[#1E3A5F]/90">
              <Save className="mr-2 h-4 w-4" />
              Sauvegarder les modifications
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

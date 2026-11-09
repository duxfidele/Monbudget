"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 8) {
      toast.error("Le mot de passe doit comporter au moins 8 caractères.");
      return;
    }
    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success("Mot de passe mis à jour avec succès !");
      router.push("/login");
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
        <CardTitle className="text-2xl font-bold text-center">Nouveau mot de passe</CardTitle>
        <CardDescription className="text-center">
          Veuillez entrer votre nouveau mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input 
              id="password" 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

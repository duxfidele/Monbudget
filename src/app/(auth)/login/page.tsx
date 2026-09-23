"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else {
      toast.success("Connexion réussie !");
      router.push("/");
      router.refresh();
    }
  };

  return (
    <Card className="w-full max-w-md border-none shadow-xl">
      <CardHeader className="space-y-3 items-center">
        <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg">
          <Wallet className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold text-center">Bon retour !</CardTitle>
        <CardDescription className="text-center">
          Connectez-vous pour accéder à votre budget.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              placeholder="vous@exemple.com" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Mot de passe</Label>
              <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">Mot de passe oublié ?</Link>
            </div>
            <Input 
              id="password" 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
            {loading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="justify-center border-t p-4">
        <p className="text-sm text-slate-600">
          Pas encore de compte ?{" "}
          <Link href="/register" className="text-blue-600 font-semibold hover:underline">
            S'inscrire
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

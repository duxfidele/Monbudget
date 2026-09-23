"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Si cet email existe, un lien de réinitialisation vous a été envoyé.");
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <Card className="w-full max-w-md border-none shadow-xl">
      <CardHeader className="space-y-3 items-center">
        <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg">
          <Wallet className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl font-bold text-center">Mot de passe oublié</CardTitle>
        <CardDescription className="text-center">
          Entrez votre email pour réinitialiser votre mot de passe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-green-600 font-medium">Lien envoyé !</p>
            <p className="text-sm text-slate-600">
              Veuillez vérifier votre boîte de réception et vos spams.
            </p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
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
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={loading}>
              {loading ? "Envoi en cours..." : "Envoyer le lien"}
            </Button>
          </form>
        )}
      </CardContent>
      <CardFooter className="justify-center border-t p-4">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="text-blue-600 font-semibold hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

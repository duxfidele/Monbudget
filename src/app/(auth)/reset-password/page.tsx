"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet } from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
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
        <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg">
          <Wallet className="h-6 w-6" />
        </div>
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
              minLength={6}
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

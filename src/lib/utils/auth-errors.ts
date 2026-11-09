export function translateAuthError(rawError: string | null | undefined): string | null {
  if (!rawError) return null;
  const msg = rawError.trim();
  const lower = msg.toLowerCase();

  if (lower.includes("database error saving new user")) {
    return "Impossible de finaliser l'enregistrement du nouveau compte en base de données. Veuillez réessayer dans un instant ou contacter le support.";
  }
  if (lower.includes("invalid login credentials")) {
    return "Email ou mot de passe incorrect. Si vous n'avez pas encore de compte, cliquez sur « S'inscrire » ci-dessous.";
  }
  if (lower.includes("email not confirmed")) {
    return "Votre adresse email n'a pas encore été confirmée. Veuillez vérifier votre boîte de réception ou dossier spam.";
  }
  if (lower.includes("user already registered") || lower.includes("already exists")) {
    return "Cette adresse email est déjà enregistrée. Veuillez vous connecter.";
  }
  if (lower.includes("password should be at least")) {
    const match = msg.match(/at least (\d+)/i);
    const minChars = match?.[1] || "8";
    return `Le mot de passe doit comporter au moins ${minChars} caractères.`;
  }
  if (lower.includes("access_denied") || lower.includes("access denied")) {
    return "Connexion Google annulée ou accès refusé. Veuillez réessayer avec un compte autorisé.";
  }
  if (lower.includes("rate limit")) {
    return "Trop de tentatives effectuées. Veuillez patienter quelques minutes avant de réessayer.";
  }
  return msg;
}


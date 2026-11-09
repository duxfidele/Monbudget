"use client";

interface HoneypotFieldProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

/**
 * Champ piège (Honeypot) invisible aux utilisateurs humains et lecteurs d'écran.
 * Les robots automatisés qui remplissent tous les champs du DOM déclenchent ce piège.
 */
export function HoneypotField({ value, onChange, id = "mb_website_hp" }: HoneypotFieldProps) {
  return (
    <div
      aria-hidden="true"
      style={{ clipPath: "inset(50%)" }}
      className="absolute left-0 top-0 w-px h-px overflow-hidden opacity-0 pointer-events-none select-none"
    >
      <label htmlFor={id}>Site web (laisser ce champ vide)</label>
      <input
        id={id}
        name="website_url"
        type="text"
        tabIndex={-1}
        autoComplete="nope"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

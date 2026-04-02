import { Lightbulb } from "lucide-react";

const ROUTE_HINTS: Record<string, string> = {
  "/leave-request": "Pot să vă ajut cu cererea de concediu — întrebați-mă orice!",
  "/leave-calendar": "Întrebați-mă cine este în concediu sau despre soldul dumneavoastră.",
  "/hr-management": "Pot verifica documente expirate sau cereri în așteptare.",
  "/admin": "Pot verifica starea sistemului sau activitatea recentă.",
  "/my-profile": "Întrebați-mă despre soldul de concediu sau datele din profil.",
  "/medicina-muncii": "Pot explica procesul de medicina muncii.",
  "/formulare": "Vă pot ghida prin formulare și șabloane disponibile.",
  "/inventory": "Întrebați-mă despre echipamente sau procedura de inventar.",
};

interface IrisContextHintsProps {
  currentRoute: string;
}

export default function IrisContextHints({ currentRoute }: IrisContextHintsProps) {
  const hint = Object.entries(ROUTE_HINTS).find(([route]) =>
    currentRoute.startsWith(route)
  );

  if (!hint) return null;

  return (
    <div className="mx-4 mt-2 mb-1 px-3 py-2 rounded-lg bg-accent/50 border border-accent text-xs text-accent-foreground flex items-start gap-2">
      <Lightbulb className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
      <span>{hint[1]}</span>
    </div>
  );
}

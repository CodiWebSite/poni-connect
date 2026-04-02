import { MessageSquare } from "lucide-react";

interface IrisQuickActionsProps {
  onSelect: (text: string) => void;
  userRole?: string;
}

const BASE_SUGGESTIONS = [
  "Câte zile de concediu mai am?",
  "Ce documente îmi expiră?",
  "Cum depun o cerere de concediu?",
  "Ce e nou în platformă?",
];

const HR_SUGGESTIONS = [
  "Câte cereri sunt în așteptare?",
  "Rezumat activitate săptămânală",
];

const ADMIN_SUGGESTIONS = [
  "Care este starea sistemului?",
  "Cine s-a logat recent?",
];

export default function IrisQuickActions({ onSelect, userRole }: IrisQuickActionsProps) {
  const suggestions = [...BASE_SUGGESTIONS];
  if (["hr", "sef_srus", "super_admin"].includes(userRole || "")) {
    suggestions.push(...HR_SUGGESTIONS);
  }
  if (userRole === "super_admin") {
    suggestions.push(...ADMIN_SUGGESTIONS);
  }

  return (
    <div className="px-4 py-3">
      <p className="text-xs text-muted-foreground mb-2.5 flex items-center gap-1.5">
        <MessageSquare className="w-3 h-3" />
        Sugestii rapide
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

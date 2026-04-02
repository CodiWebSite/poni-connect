import { MessageSquare, Zap } from "lucide-react";

interface IrisQuickActionsProps {
  onSelect: (text: string) => void;
  userRole?: string;
}

const BASE_SUGGESTIONS = [
  "Câte zile de concediu mai am?",
  "Depune o cerere de concediu",
  "Raportează o problemă",
];

const APPROVER_SUGGESTIONS = [
  "Aprobări în așteptare",
];

const HR_SUGGESTIONS = [
  "Documente ce expiră curând",
];

const ADMIN_SUGGESTIONS = [
  "Rezumat operațional",
];

export default function IrisQuickActions({ onSelect, userRole }: IrisQuickActionsProps) {
  const suggestions = [...BASE_SUGGESTIONS];
  const approverRoles = ["sef", "director_institut", "director_adjunct", "secretar_stiintific"];
  
  if (approverRoles.includes(userRole || "")) {
    suggestions.push(...APPROVER_SUGGESTIONS);
  }
  if (["hr", "sef_srus", "super_admin"].includes(userRole || "")) {
    suggestions.push(...HR_SUGGESTIONS, ...APPROVER_SUGGESTIONS);
  }
  if (userRole === "super_admin") {
    suggestions.push(...ADMIN_SUGGESTIONS);
  }

  return (
    <div className="px-4 py-3">
      <p className="text-xs text-muted-foreground mb-2.5 flex items-center gap-1.5">
        <Zap className="w-3 h-3" />
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

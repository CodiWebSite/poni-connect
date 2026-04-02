import { CheckCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";

interface ActionData {
  type: string;
  data: Record<string, any>;
  label: string;
}

interface IrisConfirmationCardProps {
  action: ActionData;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  create_leave: "Cerere concediu de odihnă",
  create_helpdesk_ticket: "Tichet HelpDesk",
  create_correction_request: "Cerere corecție date",
  create_hr_request: "Cerere HR",
};

export default function IrisConfirmationCard({
  action,
  onConfirm,
  onCancel,
  isExecuting,
}: IrisConfirmationCardProps) {
  const title = ACTION_LABELS[action.type] || action.label || "Acțiune";
  const data = action.data || {};

  return (
    <div className="my-2 rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 border-b border-border">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 font-medium">
          v2 — Action Mode
        </span>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-1.5 text-xs">
        {action.type === "create_leave" && (
          <>
            <Detail label="Perioadă" value={`${data.startDate} → ${data.endDate}`} />
            <Detail label="Zile lucrătoare" value={`${data.workingDays}`} />
            <Detail label="Înlocuitor" value={data.replacementName || "—"} />
            <Detail label="Aprobator" value={data.approverName || "Nedesemnat"} />
            <Detail label="Sold actual" value={`${data.currentBalance} zile`} />
            <Detail label="Sold după" value={`${data.balanceAfter} zile`} />
          </>
        )}
        {action.type === "create_helpdesk_ticket" && (
          <>
            <Detail label="Subiect" value={data.subject} />
            <Detail label="Mesaj" value={data.message} />
          </>
        )}
        {action.type === "create_correction_request" && (
          <>
            <Detail label="Câmp" value={data.fieldName} />
            <Detail label="Valoare curentă" value={data.currentValue || "—"} />
            <Detail label="Valoare dorită" value={data.requestedValue} />
            <Detail label="Motiv" value={data.reason || "—"} />
          </>
        )}
        {action.type === "create_hr_request" && (
          <>
            <Detail label="Tip cerere" value={data.requestType} />
            {data.details && <Detail label="Detalii" value={data.details} />}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 px-4 py-2.5 border-t border-border bg-muted/30">
        <button
          onClick={onConfirm}
          disabled={isExecuting}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Se execută...
            </>
          ) : (
            <>
              <CheckCircle className="w-3.5 h-3.5" />
              Confirmă
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={isExecuting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          Anulează
        </button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground min-w-[100px]">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

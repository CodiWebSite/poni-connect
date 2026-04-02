import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import irisLogo from "@/assets/iris-logo.png";

interface IrisActionPreviewProps {
  success: boolean;
  message: string;
  details?: Record<string, string>;
  link?: { label: string; href: string };
}

export default function IrisActionPreview({ success, message, details, link }: IrisActionPreviewProps) {
  return (
    <div className={`my-2 rounded-xl border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300 ${
      success ? "border-emerald-200 dark:border-emerald-800" : "border-destructive/30"
    }`}>
      <div className={`flex items-center gap-2 px-4 py-2.5 ${
        success
          ? "bg-emerald-50 dark:bg-emerald-950/30"
          : "bg-destructive/5"
      }`}>
        {success ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="w-4 h-4 text-destructive" />
        )}
        <span className="text-xs font-medium text-foreground">{message}</span>
      </div>

      {details && Object.keys(details).length > 0 && (
        <div className="px-4 py-2.5 space-y-1 text-xs border-t border-border">
          {Object.entries(details).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-muted-foreground min-w-[100px]">{key}:</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          Acțiune executată prin IRIS
        </span>
        {link && (
          <a
            href={link.href}
            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
          >
            {link.label}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
}

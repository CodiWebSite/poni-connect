import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";
import IrisChatPanel from "./IrisChatPanel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const HIDDEN_ROUTES = ["/kiosk", "/auth", "/profil/", "/echipament/"];

export default function IrisButton() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(() => localStorage.getItem("iris-opened") === "1");
  const { user } = useAuth();
  const location = useLocation();

  const isHidden = HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r)) || !user;

  useEffect(() => {
    if (open && !hasOpened) {
      setHasOpened(true);
      localStorage.setItem("iris-opened", "1");
    }
  }, [open, hasOpened]);

  if (isHidden) return null;

  return (
    <>
      <IrisChatPanel open={open} onClose={() => setOpen(false)} />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setOpen((v) => !v)}
            className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
            aria-label="IRIS — Asistent AI"
          >
            <Sparkles className="w-5 h-5 group-hover:animate-pulse" />
            {!hasOpened && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 border-2 border-background animate-pulse" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>IRIS — Asistent AI</p>
        </TooltipContent>
      </Tooltip>
    </>
  );
}

import { useState, useEffect } from "react";
import irisLogo from "@/assets/iris-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";
import IrisChatPanel from "./IrisChatPanel";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";

const HIDDEN_ROUTES = ["/kiosk", "/auth", "/profil/", "/echipament/", "/maintenance"];

export default function IrisButton() {
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(() => localStorage.getItem("iris-opened") === "1");
  const [aalReady, setAalReady] = useState(false);
  const { user } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      setAalReady(false);
      return;
    }
    let cancelled = false;
    const check = () => {
      supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
        if (cancelled) return;
        // Hide IRIS if MFA challenge is pending (user has factor but session is AAL1)
        if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
          setAalReady(false);
        } else {
          setAalReady(true);
        }
      });
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [user]);

  const isHidden = HIDDEN_ROUTES.some((r) => location.pathname.startsWith(r)) || !user || !aalReady;

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
            className="fixed bottom-5 right-5 z-40 w-16 h-16 rounded-full shadow-[0_4px_24px_rgba(99,102,241,0.45)] hover:shadow-[0_6px_32px_rgba(99,102,241,0.6)] hover:scale-110 transition-all flex items-center justify-center group overflow-hidden ring-2 ring-violet-400/50 ring-offset-2 ring-offset-background"
            aria-label="IRIS — Asistent AI"
          >
            <img src={irisLogo} alt="IRIS" className="w-16 h-16 object-contain group-hover:scale-110 transition-transform" />
            {!hasOpened && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 border-2 border-background animate-pulse" />
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

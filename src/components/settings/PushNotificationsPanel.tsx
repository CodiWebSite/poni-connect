import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, Smartphone, AlertCircle, Loader2, CheckCircle2 } from "lucide-react";
import {
  isPushSupported,
  isSubscribedToPush,
  subscribeToPush,
  unsubscribeFromPush,
  getNotificationPermission,
} from "@/utils/pushNotifications";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const PushNotificationsPanel = () => {
  const { user } = useAuth();
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);

  const refresh = async () => {
    setLoading(true);
    const sup = isPushSupported();
    setSupported(sup);
    setPermission(getNotificationPermission());
    if (sup) {
      const isSub = await isSubscribedToPush();
      setSubscribed(isSub);
    }
    if (user) {
      const { count } = await supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setDeviceCount(count || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleToggle = async (next: boolean) => {
    setBusy(true);
    if (next) {
      const res = await subscribeToPush();
      if (res.ok) {
        toast.success("Notificările push au fost activate pe acest dispozitiv");
      } else {
        toast.error(res.error || "Nu am putut activa notificările");
      }
    } else {
      const res = await unsubscribeFromPush();
      if (res.ok) {
        toast.success("Notificările push au fost dezactivate pe acest dispozitiv");
      } else {
        toast.error(res.error || "Nu am putut dezactiva notificările");
      }
    }
    await refresh();
    setBusy(false);
  };

  const handleTest = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("notifications").insert({
      user_id: user.id,
      title: "🔔 Test notificare push",
      message: "Notificările push funcționează corect pe acest dispozitiv!",
      type: "info",
    });
    if (error) {
      toast.error("Test eșuat: " + error.message);
    } else {
      toast.success("Notificare test trimisă");
    }
    setBusy(false);
  };

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS
      window.navigator.standalone === true);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notificări push (PWA)
        </CardTitle>
        <CardDescription>
          Primește notificări native pe telefon sau desktop chiar și când aplicația este închisă —
          pentru aprobări concedii, mesaje noi, anunțuri și alte evenimente importante.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!supported && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
            <div>
              Browserul tău nu suportă notificări push. Pe iPhone, este nevoie să instalezi aplicația
              pe ecranul de start (Adaugă pe ecranul principal) și să o deschizi de acolo.
            </div>
          </div>
        )}

        {supported && permission === "denied" && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
            <div>
              Permisiunea pentru notificări a fost refuzată. Activează-o din setările browserului
              pentru această pagină, apoi reîncarcă.
            </div>
          </div>
        )}

        {supported && !isStandalone && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            💡 <span className="text-foreground font-medium">Sugestie:</span> instalează aplicația
            ICMPP Intranet pe telefon/desktop pentru cea mai bună experiență cu notificări.
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              {subscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              Notificări push pe acest dispozitiv
            </Label>
            <p className="text-xs text-muted-foreground">
              {subscribed
                ? "Active — vei primi notificări pe acest dispozitiv"
                : "Dezactivate pe acest dispozitiv"}
            </p>
          </div>
          <Switch
            checked={subscribed}
            onCheckedChange={handleToggle}
            disabled={!supported || loading || busy || permission === "denied"}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5" />
            Dispozitive active: <Badge variant="secondary">{deviceCount}</Badge>
          </span>
          {subscribed && (
            <Button size="sm" variant="outline" onClick={handleTest} disabled={busy}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
              Trimite test
            </Button>
          )}
        </div>

        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p className="font-medium text-foreground">Ce evenimente declanșează notificări:</p>
          <ul className="list-disc ml-4 space-y-0.5">
            <li>Aprobare/respingere cereri de concediu</li>
            <li>Cereri noi de aprobat (pentru manageri)</li>
            <li>Mesaje noi în chat</li>
            <li>Anunțuri și notificări HR importante</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default PushNotificationsPanel;

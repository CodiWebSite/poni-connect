import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollText, Inbox, ShieldAlert, Settings2, Send, FileText, EyeOff, Beaker } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import SubmitRequestDialog from "@/components/registry/SubmitRequestDialog";
import MyRequestsList from "@/components/registry/MyRequestsList";
import SecretariatQueue from "@/components/registry/SecretariatQueue";
import SecretariatRestrictedQueue from "@/components/registry/SecretariatRestrictedQueue";
import EntriesRegister from "@/components/registry/EntriesRegister";
import RegistryAdminPanel from "@/components/registry/RegistryAdminPanel";

export default function Registratura() {
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [isDemo, setIsDemo] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [myDeptKey, setMyDeptKey] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const isSecretariat = role === "secretariat" || isSuperAdmin;
  const isManagement = role === "director_institut" || role === "director_adjunct" || isSuperAdmin;

  const loadMyDept = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("get_user_registry_dept_key", { _user_id: user.id });
    setMyDeptKey((data as string | null) ?? null);
  }, [user]);

  useEffect(() => { loadMyDept(); }, [loadMyDept]);

  if (authLoading || roleLoading) {
    return <MainLayout><div className="p-8 text-muted-foreground">Se încarcă…</div></MainLayout>;
  }

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ScrollText className="w-7 h-7 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Registratură Digitală</h1>
              <Badge variant="outline" className="ml-2">BETA</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Trimitere, aprobare și evidență a corespondenței oficiale ICMPP.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {(isSecretariat || isSuperAdmin) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20">
                <Beaker className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                <Label htmlFor="demo-switch" className="text-xs cursor-pointer">Mod demo</Label>
                <Switch id="demo-switch" checked={isDemo} onCheckedChange={setIsDemo} />
              </div>
            )}
            {myDeptKey && (
              <Button onClick={() => setSubmitOpen(true)} className="gap-2">
                <Send className="w-4 h-4" /> Înregistrare nouă
              </Button>
            )}
          </div>
        </header>

        <Alert>
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Modul în BETA</AlertTitle>
          <AlertDescription>
            Numerele alocate în acest modul sunt oficiale și imutabile. Pentru anulare, contactați Secretariatul. Atașamentele sunt stocate într-un bucket privat, accesibil doar prin URL-uri semnate temporar.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue={isSecretariat ? "queue" : "mine"} className="w-full">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            {myDeptKey && (
              <TabsTrigger value="mine" className="gap-2"><FileText className="w-4 h-4" /> Cererile mele</TabsTrigger>
            )}
            {isSecretariat && (
              <>
                <TabsTrigger value="queue" className="gap-2"><Inbox className="w-4 h-4" /> Cereri în așteptare</TabsTrigger>
                <TabsTrigger value="restricted" className="gap-2"><EyeOff className="w-4 h-4" /> Conducere (minimal)</TabsTrigger>
              </>
            )}
            <TabsTrigger value="register" className="gap-2"><ScrollText className="w-4 h-4" /> Registru</TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="admin" className="gap-2"><Settings2 className="w-4 h-4" /> Administrare</TabsTrigger>
            )}
          </TabsList>

          {myDeptKey && (
            <TabsContent value="mine" className="mt-4">
              <MyRequestsList key={`mine-${refreshKey}`} departmentKey={myDeptKey} />
            </TabsContent>
          )}

          {isSecretariat && (
            <TabsContent value="queue" className="mt-4">
              <SecretariatQueue key={`q-${refreshKey}`} onChange={refresh} />
            </TabsContent>
          )}

          {isSecretariat && (
            <TabsContent value="restricted" className="mt-4">
              <SecretariatRestrictedQueue key={`r-${refreshKey}`} onChange={refresh} canViewFull={isManagement} />
            </TabsContent>
          )}

          <TabsContent value="register" className="mt-4">
            <EntriesRegister key={`reg-${refreshKey}`} />
          </TabsContent>

          {isSuperAdmin && (
            <TabsContent value="admin" className="mt-4">
              <RegistryAdminPanel onChange={refresh} />
            </TabsContent>
          )}
        </Tabs>

        {myDeptKey && (
          <SubmitRequestDialog
            open={submitOpen}
            onOpenChange={setSubmitOpen}
            departmentKey={myDeptKey}
            isDemo={isDemo}
            onSubmitted={refresh}
          />
        )}
      </div>
    </MainLayout>
  );
}

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, KeyRound, Loader2, Sparkles, AlertTriangle, RotateCw } from "lucide-react";
import ReauthDialog from "@/components/shared/ReauthDialog";

interface Dept {
  id: string;
  department_key: string;
  department_label: string;
  profile_department_value: string;
  draft_prefix: string;
  is_active: boolean;
  pin_hash: string | null;
  pin_rotated_at: string | null;
  pin_max_attempts: number;
  pin_lockout_minutes: number;
}
interface Operator { id: string; department_key: string; user_id: string; is_active: boolean; }

export default function RegistryAdminPanel({ onChange }: { onChange: () => void }) {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [profiles, setProfiles] = useState<Array<{ user_id: string; full_name: string | null; department: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [newDept, setNewDept] = useState({ department_key: "", department_label: "", profile_department_value: "", draft_prefix: "" });
  const [reauthOpen, setReauthOpen] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ deptKey: string; newPin: string } | null>(null);
  const [pinDialogDept, setPinDialogDept] = useState<Dept | null>(null);
  const [newPinValue, setNewPinValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [newOp, setNewOp] = useState({ department_key: "", user_id: "" });
  const [integrity, setIntegrity] = useState<{ series: string; year: number; missing: number[] } | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [d, o, p] = await Promise.all([
      supabase.from("registry_department_settings").select("*").order("department_label"),
      supabase.from("registry_department_operators").select("*"),
      supabase.from("profiles").select("user_id, full_name, department").order("full_name").limit(2000),
    ]);
    setDepts((d.data as Dept[]) ?? []);
    setOperators((o.data as Operator[]) ?? []);
    setProfiles((p.data as Array<{ user_id: string; full_name: string | null; department: string | null }>) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const distinctDepartments = Array.from(
    new Set(profiles.map((p) => (p.department ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "ro"));

  const addDept = async () => {
    if (!newDept.department_key || !newDept.department_label || !newDept.profile_department_value || !newDept.draft_prefix) {
      toast.error("Completează toate câmpurile.");
      return;
    }
    const { error } = await supabase.from("registry_department_settings").insert(newDept);
    if (error) { toast.error(error.message); return; }
    toast.success("Departament adăugat.");
    setNewDept({ department_key: "", department_label: "", profile_department_value: "", draft_prefix: "" });
    load(); onChange();
  };

  const updateProfileValue = async (d: Dept, value: string) => {
    const { error } = await supabase.from("registry_department_settings").update({ profile_department_value: value }).eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Mapare actualizată.");
    load(); onChange();
  };

  const removeDept = async (d: Dept) => {
    if (!confirm(`Ștergi maparea „${d.department_label}"? Aceasta NU afectează intrările deja înregistrate.`)) return;
    const { error } = await supabase.from("registry_department_settings").delete().eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Departament șters."); load(); onChange();
  };

  const toggleDept = async (d: Dept) => {
    const { error } = await supabase.from("registry_department_settings").update({ is_active: !d.is_active }).eq("id", d.id);
    if (error) toast.error(error.message); else { toast.success(`Departament ${!d.is_active ? "activ" : "dezactivat"}.`); load(); }
  };

  const requestRotatePin = (d: Dept) => {
    setPinDialogDept(d);
    setNewPinValue("");
  };

  const confirmPinRotation = () => {
    if (!pinDialogDept) return;
    if (newPinValue.length < 6) { toast.error("PIN minim 6 caractere."); return; }
    setPendingPin({ deptKey: pinDialogDept.department_key, newPin: newPinValue });
    setPinDialogDept(null);
    setReauthOpen(true);
  };

  const performPinRotation = async () => {
    if (!pendingPin) return;
    setBusy(true);
    const { error } = await supabase.rpc("rotate_department_pin", { _department_key: pendingPin.deptKey, _new_pin: pendingPin.newPin });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("PIN rotit cu succes.");
    setPendingPin(null);
    load();
  };

  const addOperator = async () => {
    if (!newOp.department_key || !newOp.user_id) { toast.error("Selectează departament și utilizator."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("registry_department_operators").insert({ ...newOp, assigned_by: user?.id });
    if (error) { toast.error(error.message); return; }
    toast.success("Operator adăugat."); setNewOp({ department_key: "", user_id: "" }); load();
  };

  const toggleOperator = async (op: Operator) => {
    const { error } = await supabase.from("registry_department_operators").update({ is_active: !op.is_active }).eq("id", op.id);
    if (error) toast.error(error.message); else load();
  };

  const removeOperator = async (op: Operator) => {
    const { error } = await supabase.from("registry_department_operators").delete().eq("id", op.id);
    if (error) toast.error(error.message); else { toast.success("Operator șters."); load(); }
  };

  const checkIntegrity = async (series: string, year: number) => {
    const { data, error } = await supabase.rpc("verify_counter_integrity", { _series_key: series, _year: year });
    if (error) { toast.error(error.message); return; }
    const missing = (data as Array<{ missing_number: number }>).map((r) => r.missing_number);
    setIntegrity({ series, year, missing });
  };

  const runCleanup = async () => {
    setCleanupBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setCleanupBusy(false); return; }
    const res = await fetch(
      `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/registry-cleanup-storage`,
      { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }
    );
    const d = await res.json();
    setCleanupBusy(false);
    if (!res.ok) { toast.error(d?.error ?? "Eroare cleanup"); return; }
    toast.success(`Cleanup: șterse ${d.deleted}, orfane ${d.orphans}, scanate ${d.scanned}.`);
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Se încarcă…</div>;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="depts">
        <TabsList>
          <TabsTrigger value="depts">Departamente</TabsTrigger>
          <TabsTrigger value="operators">Operatori</TabsTrigger>
          <TabsTrigger value="integrity">Integritate</TabsTrigger>
          <TabsTrigger value="storage">Storage / Cleanup</TabsTrigger>
        </TabsList>

        <TabsContent value="depts" className="space-y-3 mt-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Adaugă departament</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Input placeholder="Cheie (ex: srus)" value={newDept.department_key} onChange={(e) => setNewDept({ ...newDept, department_key: e.target.value.toLowerCase() })} />
              <Input placeholder="Etichetă afișată" value={newDept.department_label} onChange={(e) => setNewDept({ ...newDept, department_label: e.target.value })} />
              <select
                className="border rounded px-2 py-1 text-sm bg-background"
                value={newDept.profile_department_value}
                onChange={(e) => setNewDept({ ...newDept, profile_department_value: e.target.value })}
              >
                <option value="">— Departament din profiluri —</option>
                {distinctDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="flex gap-2">
                <Input placeholder="Prefix draft (ex: SRUS)" value={newDept.draft_prefix} onChange={(e) => setNewDept({ ...newDept, draft_prefix: e.target.value.toUpperCase() })} />
                <Button onClick={addDept}><Plus className="w-4 h-4" /></Button>
              </div>
            </CardContent>
          </Card>

          {depts.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[260px] space-y-1">
                  <div className="font-semibold">{d.department_label} <span className="text-xs text-muted-foreground font-mono">[{d.department_key}]</span></div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    Prefix: <code>{d.draft_prefix}</code>
                    {d.pin_hash ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">PIN setat</Badge> : <Badge variant="destructive">FĂRĂ PIN</Badge>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Label className="text-[11px] text-muted-foreground">Mapare profil:</Label>
                    <select
                      className="border rounded px-2 py-1 text-xs bg-background max-w-[420px]"
                      value={d.profile_department_value}
                      onChange={(e) => updateProfileValue(d, e.target.value)}
                    >
                      {!distinctDepartments.some((x) => x.toLowerCase() === (d.profile_department_value ?? "").toLowerCase()) && (
                        <option value={d.profile_department_value}>„{d.profile_department_value}" (nepotrivit)</option>
                      )}
                      {distinctDepartments.map((dep) => <option key={dep} value={dep}>{dep}</option>)}
                    </select>
                  </div>
                  {d.pin_rotated_at && <div className="text-[10px] text-muted-foreground">Rotit: {new Date(d.pin_rotated_at).toLocaleString("ro-RO")}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={d.is_active} onCheckedChange={() => toggleDept(d)} />
                  <Button size="sm" variant="outline" onClick={() => requestRotatePin(d)}><KeyRound className="w-4 h-4 mr-1" />PIN</Button>
                  <Button size="sm" variant="ghost" onClick={() => removeDept(d)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="operators" className="space-y-3 mt-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Atribuie operator</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-2">
              <select className="border rounded px-2 py-1 text-sm" value={newOp.department_key} onChange={(e) => setNewOp({ ...newOp, department_key: e.target.value })}>
                <option value="">— Departament —</option>
                {depts.map((d) => <option key={d.id} value={d.department_key}>{d.department_label}</option>)}
              </select>
              <select className="border rounded px-2 py-1 text-sm" value={newOp.user_id} onChange={(e) => setNewOp({ ...newOp, user_id: e.target.value })}>
                <option value="">— Utilizator —</option>
                {profiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name ?? p.user_id.slice(0, 8)} {p.department ? `(${p.department})` : ""}</option>)}
              </select>
              <Button onClick={addOperator}><Plus className="w-4 h-4 mr-1" />Adaugă</Button>
            </CardContent>
          </Card>
          {operators.map((op) => {
            const profile = profiles.find((p) => p.user_id === op.user_id);
            return (
              <Card key={op.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{profile?.full_name ?? op.user_id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">Departament: {op.department_key}</div>
                  </div>
                  <Switch checked={op.is_active} onCheckedChange={() => toggleOperator(op)} />
                  <Button size="sm" variant="ghost" onClick={() => removeOperator(op)}><Trash2 className="w-4 h-4" /></Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="integrity" className="space-y-3 mt-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Verifică goluri de numerotare</CardTitle></CardHeader>
            <CardContent className="flex gap-2 flex-wrap">
              {["ICMPP-REG", "DEMO-REG"].map((s) =>
                [0, 1].map((d) => {
                  const y = new Date().getFullYear() - d;
                  return (
                    <Button key={`${s}-${y}`} variant="outline" size="sm" onClick={() => checkIntegrity(s, y)}>
                      <Sparkles className="w-4 h-4 mr-1" />{s} / {y}
                    </Button>
                  );
                })
              )}
            </CardContent>
          </Card>
          {integrity && (
            <Alert variant={integrity.missing.length ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {integrity.series} / {integrity.year}: {integrity.missing.length === 0
                  ? "✓ Nicio anomalie. Toate numerele alocate sunt prezente (anulate sau active)."
                  : `⚠️ ${integrity.missing.length} numere lipsesc (NU trebuie să existe goluri reale): ${integrity.missing.slice(0, 50).join(", ")}${integrity.missing.length > 50 ? "…" : ""}`}
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="storage" className="space-y-3 mt-3">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Cleanup șterge atașamentele DEMO și ciornele abandonate (&gt; 7 zile). Necesită AAL2 (MFA activă).
            </AlertDescription>
          </Alert>
          <Button onClick={runCleanup} disabled={cleanupBusy}>
            {cleanupBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCw className="w-4 h-4 mr-2" />}Rulează cleanup
          </Button>
        </TabsContent>
      </Tabs>

      {/* PIN dialog */}
      <Dialog open={!!pinDialogDept} onOpenChange={(o) => !o && setPinDialogDept(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Setează PIN pentru {pinDialogDept?.department_label}</DialogTitle>
            <DialogDescription>PIN minim 6 caractere. Vei fi rugat să confirmi cu parola.</DialogDescription>
          </DialogHeader>
          <Input type="password" value={newPinValue} onChange={(e) => setNewPinValue(e.target.value)} placeholder="PIN nou" autoFocus />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogDept(null)}>Anulează</Button>
            <Button onClick={confirmPinRotation}>Continuă</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReauthDialog
        open={reauthOpen}
        onOpenChange={(o) => { setReauthOpen(o); if (!o) setPendingPin(null); }}
        onSuccess={() => { setReauthOpen(false); performPinRotation(); }}
        title="Confirmă rotația PIN"
        description="Această acțiune este sensibilă și va fi auditată."
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Check, X, Loader2, Paperclip, Download } from "lucide-react";

interface Req {
  id: string;
  temp_code: string;
  entry_type: string;
  confidentiality: string;
  source_department_key: string;
  sender: string | null;
  recipient: string | null;
  subject: string | null;
  content: string | null;
  is_late: boolean;
  late_reason: string | null;
  is_demo: boolean;
  attachments_count: number;
  document_date: string | null;
  declared_registration_date: string;
  created_at: string;
  submitted_by: string | null;
}

export default function SecretariatQueue({ onChange }: { onChange: () => void }) {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Req | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; file_name: string }>>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("registry_requests")
      .select("*")
      .eq("status", "submitted")
      .neq("confidentiality", "restricted_management")
      .order("created_at", { ascending: true })
      .limit(100);
    setItems((data as Req[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAction = async (req: Req, act: "approve" | "reject") => {
    setSelected(req);
    setAction(act);
    setOverrideDate("");
    setOverrideReason("");
    setRejectReason("");
    if (act === "approve") {
      const { data } = await supabase
        .from("registry_attachments")
        .select("id, file_name")
        .eq("request_id", req.id);
      setAttachments(data ?? []);
    }
  };

  const downloadAttachment = async (attachmentId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(
      `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/registry-signed-url`,
      { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ attachment_id: attachmentId }) }
    );
    const d = await res.json();
    if (d.url) window.open(d.url, "_blank");
    else toast.error("Nu s-a putut genera URL-ul.");
  };

  const performApprove = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("approve_registry_request", {
      _request_id: selected.id,
      _override_date: overrideDate || null,
      _override_reason: overrideReason || null,
    });
    setSubmitting(false);
    if (error) { toast.error(`Aprobare eșuată: ${error.message}`); return; }
    toast.success(`Număr alocat. Entry: ${data}`);
    setSelected(null); setAction(null);
    load(); onChange();
  };

  const performReject = async () => {
    if (!selected || !rejectReason.trim()) { toast.error("Motivul este obligatoriu."); return; }
    setSubmitting(true);
    const { error } = await supabase.rpc("reject_registry_request", { _request_id: selected.id, _reason: rejectReason });
    setSubmitting(false);
    if (error) { toast.error(`Respingere eșuată: ${error.message}`); return; }
    toast.success("Cerere respinsă.");
    setSelected(null); setAction(null);
    load(); onChange();
  };

  if (loading) return <div className="text-sm text-muted-foreground p-4">Se încarcă…</div>;
  if (!items.length) return <Card><CardContent className="p-6 text-center text-muted-foreground">Nicio cerere în așteptare.</CardContent></Card>;

  return (
    <div className="space-y-2">
      {items.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{r.temp_code}</span>
                  <Badge variant="outline">{r.entry_type}</Badge>
                  <Badge variant="outline">{r.source_department_key}</Badge>
                  {r.is_demo && <Badge variant="outline" className="text-amber-700 border-amber-300">DEMO</Badge>}
                  {r.is_late && <Badge variant="outline" className="text-orange-700 border-orange-300">Retroactiv</Badge>}
                  {r.attachments_count > 0 && <Badge variant="secondary"><Paperclip className="w-3 h-3 mr-1" />{r.attachments_count}</Badge>}
                </div>
                <div className="text-sm font-medium">{r.subject || <em className="text-muted-foreground">fără subiect</em>}</div>
                <div className="text-xs text-muted-foreground mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
                  {r.sender && <span><b>De la:</b> {r.sender}</span>}
                  {r.recipient && <span><b>Către:</b> {r.recipient}</span>}
                  <span><b>Data declarată:</b> {format(new Date(r.declared_registration_date), "dd MMM yyyy", { locale: ro })}</span>
                  <span><b>Trimisă:</b> {format(new Date(r.created_at), "dd MMM yyyy HH:mm", { locale: ro })}</span>
                </div>
                {r.is_late && r.late_reason && (
                  <div className="mt-2 text-xs p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
                    <b>Motiv retroactiv:</b> {r.late_reason}
                  </div>
                )}
                {r.content && <div className="mt-2 text-xs text-muted-foreground line-clamp-2">{r.content}</div>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openAction(r, "reject")}><X className="w-4 h-4 mr-1" />Respinge</Button>
                <Button size="sm" onClick={() => openAction(r, "approve")}><Check className="w-4 h-4 mr-1" />Aprobă</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!selected && action === "approve"} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aprobă și alocă număr</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Numărul oficial va fi alocat atomic din contorul {selected?.is_demo ? "DEMO-REG" : "ICMPP-REG"} pentru anul {selected ? new Date(overrideDate || selected.declared_registration_date).getFullYear() : ""}.</p>
            <div>
              <Label>Suprascriere dată (opțional)</Label>
              <Input type="date" value={overrideDate} onChange={(e) => setOverrideDate(e.target.value)} />
            </div>
            {overrideDate && (
              <div>
                <Label>Motiv suprascriere *</Label>
                <Textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
              </div>
            )}
            {attachments.length > 0 && (
              <div>
                <Label>Atașamente</Label>
                <ul className="space-y-1 mt-1">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex justify-between items-center text-xs border rounded p-2">
                      <span>{a.file_name}</span>
                      <Button size="sm" variant="ghost" onClick={() => downloadAttachment(a.id)}><Download className="w-3 h-3" /></Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Anulează</Button>
            <Button onClick={performApprove} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}Aprobă și alocă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected && action === "reject"} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Respinge cererea</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Motiv respingere *</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Renunță</Button>
            <Button variant="destructive" onClick={performReject} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}Respinge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

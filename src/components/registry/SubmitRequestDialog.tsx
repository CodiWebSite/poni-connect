import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload, X, Beaker, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentKey: string;
  isDemo: boolean;
  onSubmitted: () => void;
}

const ENTRY_TYPES = [
  { value: "intrare", label: "Intrare" },
  { value: "iesire", label: "Ieșire" },
  { value: "intern", label: "Document intern" },
];

const CONFIDENTIALITY = [
  { value: "internal_normal", label: "Intern normal" },
  { value: "internal_sensitive", label: "Intern sensibil" },
  { value: "confidential_dept", label: "Confidențial — departament" },
  { value: "confidential_hr", label: "Confidențial — HR" },
  { value: "confidential_legal", label: "Confidențial — juridic" },
  { value: "confidential_finance", label: "Confidențial — financiar" },
  { value: "restricted_management", label: "Strict — conducere", management: true },
];

export default function SubmitRequestDialog({ open, onOpenChange, departmentKey, isDemo, onSubmitted }: Props) {
  const [step, setStep] = useState<"form" | "pin">("form");
  const [submitting, setSubmitting] = useState(false);
  const [pin, setPin] = useState("");
  const [form, setForm] = useState({
    entry_type: "intrare" as string,
    confidentiality: "internal_normal" as string,
    document_date: "",
    declared_registration_date: format(new Date(), "yyyy-MM-dd"),
    late_reason: "",
    sender: "",
    recipient: "",
    subject: "",
    content: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [createdRequestId, setCreatedRequestId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep("form");
      setPin("");
      setFiles([]);
      setCreatedRequestId(null);
      setForm({
        entry_type: "intrare",
        confidentiality: "internal_normal",
        document_date: "",
        declared_registration_date: format(new Date(), "yyyy-MM-dd"),
        late_reason: "",
        sender: "",
        recipient: "",
        subject: "",
        content: "",
      });
    }
  }, [open]);

  const isLate = form.declared_registration_date < format(new Date(), "yyyy-MM-dd");
  const isRestricted = form.confidentiality === "restricted_management";

  const validate = (): string | null => {
    if (!form.subject.trim()) return "Subiectul este obligatoriu.";
    if (!form.declared_registration_date) return "Data declarată este obligatorie.";
    if (isLate && !form.late_reason.trim()) return "Motivul pentru data retroactivă este obligatoriu.";
    return null;
  };

  const handleNext = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setStep("pin");
  };

  const handleSubmit = async () => {
    if (pin.length < 4) { toast.error("Introdu PIN-ul departamentului."); return; }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sesiune expirată."); return; }

      const payload = {
        ...form,
        document_date: form.document_date || null,
        late_reason: isLate ? form.late_reason : null,
        is_demo: isDemo,
        attachments_count: files.length,
      };

      const submitRes = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/registry-submit-request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ department_key: departmentKey, pin, payload }),
        }
      );
      const submitData = await submitRes.json();
      if (!submitRes.ok) {
        const reason = submitData?.details?.reason ?? submitData?.error ?? "Eroare necunoscută";
        const lockedUntil = submitData?.details?.locked_until;
        if (reason === "locked" && lockedUntil) {
          toast.error(`PIN blocat până la ${new Date(lockedUntil).toLocaleString("ro-RO")}.`);
        } else if (reason === "pin_invalid") {
          toast.error("PIN incorect. Verifică PIN-ul departamentului.");
        } else if (reason === "late_reason_required") {
          toast.error("Motivul retroactiv este obligatoriu.");
        } else if (reason === "not_department_operator") {
          toast.error("Nu ești operator înregistrat pentru acest departament.");
        } else {
          toast.error(`Trimitere eșuată: ${reason}`);
        }
        return;
      }

      const requestId = submitData.request_id as string;
      setCreatedRequestId(requestId);

      // Upload attachments
      if (files.length > 0) {
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("request_id", requestId);
          fd.append("is_demo", String(isDemo));
          const upRes = await fetch(
            `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/registry-upload-attachment`,
            { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: fd }
          );
          if (!upRes.ok) {
            const e = await upRes.json().catch(() => ({}));
            toast.warning(`Atașament „${file.name}" eșuat: ${e.error ?? upRes.statusText}`);
          }
        }
      }

      toast.success(`Cerere trimisă către Secretariat${isDemo ? " (DEMO)" : ""}.`);
      onSubmitted();
      onOpenChange(false);
    } catch (e) {
      toast.error("Eroare de rețea.");
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Înregistrare nouă în registratură
            {isDemo && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 flex items-center gap-1"><Beaker className="w-3 h-3" />DEMO</span>}
          </DialogTitle>
          <DialogDescription>
            {step === "form"
              ? "Completează datele și atașează documentele. Numărul oficial va fi alocat de Secretariat la aprobare."
              : "Confirmă cu PIN-ul departamentului pentru a trimite cererea."}
          </DialogDescription>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tip document *</Label>
                <Select value={form.entry_type} onValueChange={(v) => setForm({ ...form, entry_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Confidențialitate *</Label>
                <Select value={form.confidentiality} onValueChange={(v) => setForm({ ...form, confidentiality: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CONFIDENTIALITY.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isRestricted && (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Conținutul nu va fi vizibil Secretariatului. Doar conducerea poate vedea detaliile. Secretariatul va aproba doar metadatele minime.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data documentului</Label>
                <Input type="date" value={form.document_date} onChange={(e) => setForm({ ...form, document_date: e.target.value })} />
              </div>
              <div>
                <Label>Data declarată înregistrare *</Label>
                <Input type="date" value={form.declared_registration_date} onChange={(e) => setForm({ ...form, declared_registration_date: e.target.value })} />
              </div>
            </div>

            {isLate && (
              <div>
                <Label>Motiv pentru data retroactivă *</Label>
                <Textarea value={form.late_reason} onChange={(e) => setForm({ ...form, late_reason: e.target.value })} placeholder="Explicați de ce înregistrarea se face cu data anterioară zilei de azi." />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expeditor / sursă</Label>
                <Input value={form.sender} onChange={(e) => setForm({ ...form, sender: e.target.value })} />
              </div>
              <div>
                <Label>Destinatar</Label>
                <Input value={form.recipient} onChange={(e) => setForm({ ...form, recipient: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Subiect *</Label>
              <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>

            <div>
              <Label>Conținut / observații</Label>
              <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} />
            </div>

            <div>
              <Label>Atașamente ({files.length})</Label>
              <div className="border border-dashed rounded-lg p-3 mt-1">
                <input
                  type="file" multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  className="text-sm"
                />
                {files.length > 0 && (
                  <ul className="mt-2 text-xs space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex justify-between items-center">
                        <span className="truncate">{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                        <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground mt-2">Max 20MB/fișier. PDF, DOCX, XLSX, imagini.</p>
              </div>
            </div>
          </div>
        )}

        {step === "pin" && (
          <div className="space-y-4">
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Introdu PIN-ul departamentului pentru a confirma trimiterea. PIN-ul este al departamentului, nu personal.
              </AlertDescription>
            </Alert>
            <div>
              <Label>PIN departament</Label>
              <Input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={20} autoFocus />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "form" ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Anulează</Button>
              <Button onClick={handleNext}>Continuă</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("form")} disabled={submitting}>Înapoi</Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Se trimite…</> : <><Upload className="w-4 h-4 mr-2" /> Trimite</>}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

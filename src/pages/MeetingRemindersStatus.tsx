import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Send,
  Search,
  Mail,
  MailX,
  Bell,
  BellOff,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";

type Meeting = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  status: "scheduled" | "cancelled" | "completed";
  reminder_enabled: boolean;
  reminder_emails: string[];
  reminder_offset_minutes: number;
  reminder_sent_at: string | null;
};

type ReminderLog = {
  id: string;
  meeting_id: string;
  attempted_at: string;
  success: boolean;
  recipients_total: number;
  recipients_sent: number;
  status_code: number | null;
  error_message: string | null;
  details: any;
};

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ro-RO", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type ReminderStatus =
  | "disabled"
  | "sent"
  | "scheduled_pending"
  | "scheduled_due"
  | "past_not_sent"
  | "not_eligible";

function deriveReminderStatus(m: Meeting): {
  key: ReminderStatus;
  label: string;
  className: string;
  icon: any;
} {
  if (!m.reminder_enabled || (m.reminder_emails || []).length === 0) {
    return {
      key: "disabled",
      label: "Dezactivat",
      className: "bg-muted text-muted-foreground border-border",
      icon: BellOff,
    };
  }
  if (m.status !== "scheduled") {
    return {
      key: "not_eligible",
      label: "Neeligibil (status)",
      className: "bg-muted text-muted-foreground border-border",
      icon: BellOff,
    };
  }
  if (m.reminder_sent_at) {
    return {
      key: "sent",
      label: "Trimis",
      className: "bg-success/15 text-success border-success/30",
      icon: CheckCircle2,
    };
  }
  const now = Date.now();
  const start = new Date(m.start_at).getTime();
  if (start < now) {
    return {
      key: "past_not_sent",
      label: "Trecut & netrimis",
      className: "bg-destructive/15 text-destructive border-destructive/30",
      icon: AlertCircle,
    };
  }
  const dueAt = start - (m.reminder_offset_minutes || 0) * 60 * 1000;
  if (now >= dueAt) {
    return {
      key: "scheduled_due",
      label: "În așteptare (scadent)",
      className: "bg-warning/15 text-warning border-warning/30",
      icon: Clock,
    };
  }
  return {
    key: "scheduled_pending",
    label: "Programat",
    className: "bg-primary/15 text-primary border-primary/30",
    icon: Bell,
  };
}

export default function MeetingRemindersStatus() {
  const navigate = useNavigate();
  const { role, allRoles, loading: roleLoading, isSuperAdmin } = useUserRole();

  const isAuthorized =
    isSuperAdmin ||
    ["director_institut", "director_adjunct", "secretariat"].some(
      (r) => role === r || allRoles.includes(r as any)
    );

  useEffect(() => {
    if (!roleLoading && !isAuthorized) {
      toast.error("Nu ai acces la această pagină.");
      navigate("/", { replace: true });
    }
  }, [roleLoading, isAuthorized, navigate]);

  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [logsByMeeting, setLogsByMeeting] = useState<Record<string, ReminderLog[]>>({});
  const [latestLogByMeeting, setLatestLogByMeeting] = useState<Record<string, ReminderLog>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [resending, setResending] = useState<string | null>(null);
  const [logDialog, setLogDialog] = useState<{ meeting: Meeting; logs: ReminderLog[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: mData, error: mErr } = await (supabase as any)
      .from("meetings")
      .select(
        "id,title,start_at,end_at,status,reminder_enabled,reminder_emails,reminder_offset_minutes,reminder_sent_at"
      )
      .order("start_at", { ascending: false })
      .limit(300);

    if (mErr) {
      toast.error("Eroare la încărcarea întâlnirilor");
      setLoading(false);
      return;
    }

    const list = (mData || []) as Meeting[];
    setMeetings(list);

    const ids = list.map((m) => m.id);
    if (ids.length > 0) {
      const { data: lData } = await (supabase as any)
        .from("meeting_reminder_logs")
        .select("*")
        .in("meeting_id", ids)
        .order("attempted_at", { ascending: false });

      const byMeeting: Record<string, ReminderLog[]> = {};
      const latest: Record<string, ReminderLog> = {};
      ((lData || []) as ReminderLog[]).forEach((l) => {
        (byMeeting[l.meeting_id] ||= []).push(l);
        if (!latest[l.meeting_id]) latest[l.meeting_id] = l;
      });
      setLogsByMeeting(byMeeting);
      setLatestLogByMeeting(latest);
    } else {
      setLogsByMeeting({});
      setLatestLogByMeeting({});
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthorized) load();
  }, [isAuthorized, load]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return meetings.filter((m) => {
      if (s && !m.title.toLowerCase().includes(s)) return false;
      if (statusFilter === "all") return true;
      const st = deriveReminderStatus(m).key;
      if (statusFilter === "failed") {
        const latest = latestLogByMeeting[m.id];
        return (latest && !latest.success) || st === "past_not_sent";
      }
      return st === statusFilter;
    });
  }, [meetings, search, statusFilter, latestLogByMeeting]);

  const counts = useMemo(() => {
    let sent = 0;
    let pending = 0;
    let failed = 0;
    let disabled = 0;
    meetings.forEach((m) => {
      const k = deriveReminderStatus(m).key;
      const latest = latestLogByMeeting[m.id];
      if (latest && !latest.success) failed++;
      else if (k === "past_not_sent") failed++;
      else if (k === "sent") sent++;
      else if (k === "scheduled_pending" || k === "scheduled_due") pending++;
      else disabled++;
    });
    return { sent, pending, failed, disabled };
  }, [meetings, latestLogByMeeting]);

  const resend = async (m: Meeting) => {
    setResending(m.id);
    const { data, error } = await supabase.functions.invoke("send-meeting-reminder", {
      body: { meeting_id: m.id },
    });
    setResending(null);
    if (error) {
      toast.error(`Eroare: ${error.message}`);
    } else if ((data as any)?.success) {
      toast.success(`Reminder trimis (${(data as any)?.sent ?? 0} destinatari)`);
    } else {
      toast.warning(
        `Trimitere eșuată: ${(data as any)?.error_message || "vezi log-urile pentru detalii"}`
      );
    }
    load();
  };

  if (roleLoading || !isAuthorized) {
    return (
      <MainLayout title="Status reminder-e întâlniri">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Status reminder-e întâlniri"
      description="Confirmare rapidă a funcționării reminder-elor automate"
    >
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success/15 text-success flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{counts.sent}</div>
            <div className="text-xs text-muted-foreground">Trimise</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{counts.pending}</div>
            <div className="text-xs text-muted-foreground">Programate</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{counts.failed}</div>
            <div className="text-xs text-muted-foreground">Eșuate / netrimise</div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
            <MailX className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-bold">{counts.disabled}</div>
            <div className="text-xs text-muted-foreground">Dezactivate</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Caută după titlu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="md:w-64">
            <SelectValue placeholder="Filtru status reminder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate</SelectItem>
            <SelectItem value="scheduled_pending">Programate</SelectItem>
            <SelectItem value="scheduled_due">În așteptare (scadent)</SelectItem>
            <SelectItem value="sent">Trimise</SelectItem>
            <SelectItem value="failed">Eșuate</SelectItem>
            <SelectItem value="disabled">Dezactivate</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Reîncarcă
        </Button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Întâlnire</TableHead>
                <TableHead>Început</TableHead>
                <TableHead>Reminder</TableHead>
                <TableHead>Trimis la</TableHead>
                <TableHead>Ultima încercare</TableHead>
                <TableHead className="text-right">Acțiuni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const st = deriveReminderStatus(m);
                const Icon = st.icon;
                const latest = latestLogByMeeting[m.id];
                const logs = logsByMeeting[m.id] || [];
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium max-w-[260px]">
                      <div className="truncate">{m.title}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {(m.reminder_emails || []).length} destinatari · {m.reminder_offset_minutes}m înainte
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{fmt(m.start_at)}</TableCell>
                    <TableCell>
                      <Badge className={st.className} variant="outline">
                        <Icon className="w-3 h-3 mr-1" />
                        {st.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {m.reminder_sent_at ? fmt(m.reminder_sent_at) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[280px]">
                      {latest ? (
                        <div className="text-xs">
                          <div className="flex items-center gap-1">
                            {latest.success ? (
                              <CheckCircle2 className="w-3 h-3 text-success" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-destructive" />
                            )}
                            <span className="font-medium">
                              {latest.recipients_sent}/{latest.recipients_total}
                            </span>
                            <span className="text-muted-foreground">
                              · {fmt(latest.attempted_at)}
                            </span>
                            {latest.status_code != null && (
                              <Badge variant="outline" className="ml-1 py-0 text-[10px]">
                                {latest.status_code}
                              </Badge>
                            )}
                          </div>
                          {latest.error_message && (
                            <div className="text-destructive truncate" title={latest.error_message}>
                              {latest.error_message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {logs.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogDialog({ meeting: m, logs })}
                        >
                          Istoric ({logs.length})
                        </Button>
                      )}
                      {m.reminder_enabled && (m.reminder_emails || []).length > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resend(m)}
                          disabled={resending === m.id}
                          className="ml-1"
                        >
                          <Send className="w-3 h-3 mr-1" />
                          {resending === m.id ? "..." : "Retrimite"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8 text-sm">
                    Nicio întâlnire găsită
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Log history dialog */}
      <Dialog open={!!logDialog} onOpenChange={(o) => !o && setLogDialog(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Istoric trimiteri — {logDialog?.meeting.title}</DialogTitle>
            <DialogDescription>
              Începe: {logDialog ? fmt(logDialog.meeting.start_at) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {logDialog?.logs.map((l) => (
              <div
                key={l.id}
                className={`border rounded-lg p-3 ${
                  l.success
                    ? "border-success/30 bg-success/5"
                    : "border-destructive/30 bg-destructive/5"
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    {l.success ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                    {fmt(l.attempted_at)}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">Status {l.status_code ?? "—"}</Badge>
                    <Badge variant="outline">
                      {l.recipients_sent}/{l.recipients_total} trimise
                    </Badge>
                  </div>
                </div>
                {l.error_message && (
                  <div className="mt-2 text-xs text-destructive whitespace-pre-wrap break-words">
                    {l.error_message}
                  </div>
                )}
                {Array.isArray(l.details?.per_recipient_errors) &&
                  l.details.per_recipient_errors.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-muted-foreground">
                        Detalii pe destinatar ({l.details.per_recipient_errors.length})
                      </summary>
                      <ul className="mt-1 text-xs space-y-1">
                        {l.details.per_recipient_errors.map((e: any, i: number) => (
                          <li key={i} className="font-mono break-all">
                            <span className="text-destructive">✖</span> {e.to} — {e.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
              </div>
            ))}
            {logDialog && logDialog.logs.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                Nicio încercare înregistrată încă.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

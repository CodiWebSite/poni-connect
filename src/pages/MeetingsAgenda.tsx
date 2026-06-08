import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar as BigCalendar, dateFnsLocalizer, View, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ro } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Calendar as CalendarIcon, Search, X, Send, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const locales = { ro };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (d: Date) => startOfWeek(d, { locale: ro }),
  getDay,
  locales,
});

const MESSAGES = {
  allDay: "Toată ziua",
  previous: "‹",
  next: "›",
  today: "Astăzi",
  month: "Lună",
  week: "Săptămână",
  day: "Zi",
  agenda: "Agendă",
  date: "Dată",
  time: "Oră",
  event: "Întâlnire",
  noEventsInRange: "Nicio întâlnire în acest interval.",
  showMore: (n: number) => `+${n} altele`,
};

type Meeting = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  location: string | null;
  participants: string | null;
  notes: string | null;
  status: "scheduled" | "cancelled" | "completed";
  created_by: string | null;
  reminder_enabled: boolean;
  reminder_emails: string[];
  reminder_offset_minutes: number;
  reminder_sent_at: string | null;
};

const OFFSETS = [
  { value: 10, label: "10 minute înainte" },
  { value: 30, label: "30 minute înainte" },
  { value: 60, label: "1 oră înainte" },
  { value: 1440, label: "1 zi înainte" },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string): string {
  return new Date(s).toISOString();
}

const emptyForm = (start?: Date, end?: Date) => ({
  title: "",
  start_at: toLocalInput((start || new Date()).toISOString()),
  end_at: toLocalInput((end || new Date(Date.now() + 60 * 60 * 1000)).toISOString()),
  location: "",
  participants: "",
  notes: "",
  status: "scheduled" as Meeting["status"],
  reminder_enabled: false,
  reminder_emails: [] as string[],
  reminder_offset_minutes: 30,
});

const statusBadgeClass = (s: Meeting["status"]) =>
  s === "scheduled"
    ? "bg-primary/15 text-primary border-primary/30"
    : s === "completed"
    ? "bg-success/15 text-success border-success/30"
    : "bg-destructive/15 text-destructive border-destructive/30";

const statusLabel = (s: Meeting["status"]) =>
  s === "scheduled" ? "Programată" : s === "completed" ? "Finalizată" : "Anulată";

export default function MeetingsAgenda() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role, loading: roleLoading, isSuperAdmin } = useUserRole();

  const isAuthorized =
    isSuperAdmin ||
    role === "director_institut" ||
    role === "director_adjunct" ||
    role === "secretariat";

  useEffect(() => {
    if (!roleLoading && !isAuthorized) {
      toast.error("Nu ai acces la Agenda întâlniri.");
      navigate("/", { replace: true });
    }
  }, [roleLoading, isAuthorized, navigate]);

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Dialog
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Meeting | null>(null);

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("meetings")
      .select("*")
      .order("start_at", { ascending: true });
    if (error) {
      toast.error("Eroare la încărcarea întâlnirilor");
    } else {
      setMeetings((data || []) as Meeting[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthorized) loadMeetings();
  }, [isAuthorized, loadMeetings]);

  // Realtime
  useEffect(() => {
    if (!isAuthorized) return;
    const ch = supabase
      .channel("meetings-realtime")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "meetings" },
        () => loadMeetings()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [isAuthorized, loadMeetings]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return meetings.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      const start = new Date(m.start_at).getTime();
      if (from && start < from) return false;
      if (to && start > to) return false;
      if (s) {
        const hay = `${m.title} ${m.location || ""} ${m.participants || ""} ${m.notes || ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [meetings, statusFilter, search, dateFrom, dateTo]);

  const events = useMemo(
    () =>
      filtered.map((m) => ({
        id: m.id,
        title: m.title,
        start: new Date(m.start_at),
        end: new Date(m.end_at),
        resource: m,
      })),
    [filtered]
  );

  const openNew = (start?: Date, end?: Date) => {
    setEditing(null);
    setForm(emptyForm(start, end));
    setEmailInput("");
    setDialogOpen(true);
  };

  const openEdit = (m: Meeting) => {
    setEditing(m);
    setForm({
      title: m.title,
      start_at: toLocalInput(m.start_at),
      end_at: toLocalInput(m.end_at),
      location: m.location || "",
      participants: m.participants || "",
      notes: m.notes || "",
      status: m.status,
      reminder_enabled: m.reminder_enabled,
      reminder_emails: m.reminder_emails || [],
      reminder_offset_minutes: m.reminder_offset_minutes || 30,
    });
    setEmailInput("");
    setDialogOpen(true);
  };

  const addEmail = (raw: string) => {
    const v = raw.trim().toLowerCase();
    if (!v || !v.includes("@")) return;
    if (form.reminder_emails.includes(v)) return;
    setForm((f) => ({ ...f, reminder_emails: [...f.reminder_emails, v] }));
  };

  const removeEmail = (e: string) => {
    setForm((f) => ({ ...f, reminder_emails: f.reminder_emails.filter((x) => x !== e) }));
  };

  const addDefaultRecipients = async () => {
    const { data, error } = await (supabase as any).rpc("get_meeting_default_recipients");
    if (error) {
      toast.error("Nu am putut prelua emailurile implicite");
      return;
    }
    const emails: string[] = (data || []) as string[];
    setForm((f) => {
      const set = new Set(f.reminder_emails);
      emails.forEach((e) => e && set.add(e.toLowerCase()));
      return { ...f, reminder_emails: Array.from(set) };
    });
    toast.success(`${emails.length} emailuri adăugate`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!form.title.trim()) {
      toast.error("Titlul este obligatoriu");
      return;
    }
    const startISO = fromLocalInput(form.start_at);
    const endISO = fromLocalInput(form.end_at);
    if (new Date(endISO) <= new Date(startISO)) {
      toast.error("Ora de final trebuie să fie după ora de început");
      return;
    }
    if (form.reminder_enabled && form.reminder_emails.length === 0) {
      toast.error("Adaugă cel puțin un email pentru reminder");
      return;
    }

    setSaving(true);
    const payload: any = {
      title: form.title.trim(),
      start_at: startISO,
      end_at: endISO,
      location: form.location.trim() || null,
      participants: form.participants.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
      reminder_enabled: form.reminder_enabled,
      reminder_emails: form.reminder_emails,
      reminder_offset_minutes: form.reminder_offset_minutes,
    };

    let err;
    if (editing) {
      // Reset reminder_sent_at if user changes time or re-enables reminder
      if (editing.start_at !== startISO || editing.reminder_enabled !== form.reminder_enabled) {
        payload.reminder_sent_at = null;
      }
      ({ error: err } = await (supabase as any).from("meetings").update(payload).eq("id", editing.id));
    } else {
      payload.created_by = user.id;
      ({ error: err } = await (supabase as any).from("meetings").insert(payload));
    }
    setSaving(false);
    if (err) {
      toast.error(`Eroare: ${err.message}`);
      return;
    }
    toast.success(editing ? "Întâlnire actualizată" : "Întâlnire creată");
    setDialogOpen(false);
    loadMeetings();
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { error } = await (supabase as any).from("meetings").delete().eq("id", deleteConfirm.id);
    if (error) {
      toast.error(`Eroare: ${error.message}`);
      return;
    }
    toast.success("Întâlnire ștearsă");
    setDeleteConfirm(null);
    setDialogOpen(false);
    loadMeetings();
  };

  const sendReminderNow = async () => {
    if (!editing) return;
    if (!editing.reminder_enabled || editing.reminder_emails.length === 0) {
      toast.error("Activează reminder și adaugă emailuri înainte de trimitere");
      return;
    }
    const { data, error } = await supabase.functions.invoke("send-meeting-reminder", {
      body: { meeting_id: editing.id },
    });
    if (error) {
      toast.error(`Eroare trimitere: ${error.message}`);
      return;
    }
    toast.success(`Reminder trimis (${(data as any)?.sent ?? 0} destinatari)`);
    loadMeetings();
  };

  const eventStyleGetter = (event: any) => {
    const status = event.resource?.status as Meeting["status"];
    const colors: Record<string, string> = {
      scheduled: "hsl(var(--primary))",
      completed: "hsl(var(--success))",
      cancelled: "hsl(var(--destructive))",
    };
    return {
      style: {
        backgroundColor: colors[status] || colors.scheduled,
        borderRadius: "6px",
        border: "none",
        color: "#fff",
        opacity: status === "cancelled" ? 0.65 : 1,
        textDecoration: status === "cancelled" ? "line-through" : "none",
      },
    };
  };

  if (roleLoading || !isAuthorized) {
    return (
      <MainLayout title="Agenda întâlniri">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Agenda întâlniri" description="Calendar întâlniri pentru director și secretariat">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row gap-3 mb-4">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Caută titlu, locație, participanți..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <Filter className="w-4 h-4 mr-1" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate statusurile</SelectItem>
              <SelectItem value="scheduled">Programate</SelectItem>
              <SelectItem value="completed">Finalizate</SelectItem>
              <SelectItem value="cancelled">Anulate</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="De la"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Până la"
          />
        </div>
        <Button onClick={() => openNew()} className="shrink-0">
          <Plus className="w-4 h-4 mr-2" />
          Întâlnire nouă
        </Button>
      </div>

      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl p-3 md:p-4">
        <div style={{ height: "70vh" }}>
          <BigCalendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={(v) => setView(v)}
            date={currentDate}
            onNavigate={(d) => setCurrentDate(d)}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            messages={MESSAGES}
            culture="ro"
            selectable
            popup
            onSelectSlot={(slot) => openNew(slot.start as Date, slot.end as Date)}
            onSelectEvent={(ev: any) => openEdit(ev.resource as Meeting)}
            eventPropGetter={eventStyleGetter}
            style={{ height: "100%" }}
          />
        </div>
      </div>

      {/* Compact list (mobile + overflow) */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">
          {filtered.length} întâlniri (după filtre)
        </h3>
        <div className="grid gap-2">
          {filtered.slice(0, 20).map((m) => (
            <button
              key={m.id}
              onClick={() => openEdit(m)}
              className="text-left p-3 rounded-lg border border-border bg-card hover:bg-secondary/40 transition flex items-center gap-3"
            >
              <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {new Intl.DateTimeFormat("ro-RO", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(m.start_at))}
                  {m.location ? ` • ${m.location}` : ""}
                </div>
              </div>
              <Badge className={statusBadgeClass(m.status)} variant="outline">
                {statusLabel(m.status)}
              </Badge>
            </button>
          ))}
          {filtered.length === 0 && !loading && (
            <div className="text-center text-muted-foreground py-8 text-sm">
              Nicio întâlnire găsită
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editare întâlnire" : "Întâlnire nouă"}</DialogTitle>
            <DialogDescription>
              {editing ? "Modifică detaliile și salvează." : "Completează detaliile întâlnirii."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titlu *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="start">Început *</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">Sfârșit *</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="location">Locație</Label>
                <Input
                  id="location"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as Meeting["status"] })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Programată</SelectItem>
                    <SelectItem value="completed">Finalizată</SelectItem>
                    <SelectItem value="cancelled">Anulată</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="participants">Participanți</Label>
              <Textarea
                id="participants"
                rows={2}
                value={form.participants}
                onChange={(e) => setForm({ ...form, participants: e.target.value })}
                placeholder="Ex: Director, Secretar științific, ..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observații / detalii</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {/* Reminder block */}
            <div className="rounded-lg border border-border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-semibold">Reminder pe email</Label>
                  <p className="text-xs text-muted-foreground">
                    Trimite automat un email înainte de întâlnire
                  </p>
                </div>
                <Switch
                  checked={form.reminder_enabled}
                  onCheckedChange={(v) => setForm({ ...form, reminder_enabled: v })}
                />
              </div>

              {form.reminder_enabled && (
                <>
                  <div className="space-y-2">
                    <Label>Moment trimitere</Label>
                    <Select
                      value={String(form.reminder_offset_minutes)}
                      onValueChange={(v) =>
                        setForm({ ...form, reminder_offset_minutes: parseInt(v) })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OFFSETS.map((o) => (
                          <SelectItem key={o.value} value={String(o.value)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Destinatari</Label>
                    <div className="flex gap-2">
                      <Input
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addEmail(emailInput);
                            setEmailInput("");
                          }
                        }}
                        placeholder="email@icmpp.ro"
                        type="email"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          addEmail(emailInput);
                          setEmailInput("");
                        }}
                      >
                        Adaugă
                      </Button>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={addDefaultRecipients}
                    >
                      + Adaugă director și secretariat
                    </Button>
                    <div className="flex flex-wrap gap-2">
                      {form.reminder_emails.map((e) => (
                        <Badge key={e} variant="secondary" className="gap-1">
                          {e}
                          <button
                            type="button"
                            onClick={() => removeEmail(e)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    {editing?.reminder_sent_at && (
                      <p className="text-xs text-muted-foreground">
                        Ultimul reminder trimis:{" "}
                        {new Intl.DateTimeFormat("ro-RO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(editing.reminder_sent_at))}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              {editing && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={sendReminderNow}
                    disabled={!form.reminder_enabled}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Trimite reminder acum
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteConfirm(editing)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Șterge
                  </Button>
                </>
              )}
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Anulează
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Se salvează..." : editing ? "Salvează" : "Creează"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi întâlnirea?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune nu poate fi anulată.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Șterge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

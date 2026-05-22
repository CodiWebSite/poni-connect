import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ro } from "date-fns/locale";
import { Paperclip } from "lucide-react";

interface Req {
  id: string;
  temp_code: string;
  entry_type: string;
  confidentiality: string;
  subject: string | null;
  status: string;
  is_late: boolean;
  is_demo: boolean;
  attachments_count: number;
  declared_registration_date: string;
  created_at: string;
  rejection_reason: string | null;
  approved_entry_id: string | null;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Ciornă", cls: "bg-muted text-muted-foreground" },
  submitted: { label: "Trimis", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200" },
  approved: { label: "Aprobat", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  rejected: { label: "Respins", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200" },
  cancelled: { label: "Anulat", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200" },
};

export default function MyRequestsList({ departmentKey }: { departmentKey: string }) {
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [officialMap, setOfficialMap] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("registry_requests")
        .select("id, temp_code, entry_type, confidentiality, subject, status, is_late, is_demo, attachments_count, declared_registration_date, created_at, rejection_reason, approved_entry_id")
        .eq("source_department_key", departmentKey)
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error && data) {
        setItems(data as Req[]);
        const approvedIds = data.filter((d) => d.approved_entry_id).map((d) => d.approved_entry_id!);
        if (approvedIds.length) {
          const { data: entries } = await supabase
            .from("registry_entries")
            .select("id, series_key, year, official_number")
            .in("id", approvedIds);
          const map: Record<string, string> = {};
          (entries ?? []).forEach((e) => { map[e.id] = `${e.series_key}/${e.year}/${e.official_number}`; });
          setOfficialMap(map);
        }
      }
      setLoading(false);
    })();
  }, [departmentKey]);

  if (loading) return <div className="text-sm text-muted-foreground p-4">Se încarcă…</div>;
  if (!items.length) return <Card><CardContent className="p-6 text-center text-muted-foreground">Nicio cerere depusă încă.</CardContent></Card>;

  return (
    <div className="space-y-2">
      {items.map((r) => {
        const st = STATUS_LABELS[r.status] ?? { label: r.status, cls: "bg-muted" };
        return (
          <Card key={r.id}>
            <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">{r.temp_code}</span>
                  <Badge className={st.cls}>{st.label}</Badge>
                  {r.is_demo && <Badge variant="outline" className="text-amber-700 border-amber-300">DEMO</Badge>}
                  {r.is_late && <Badge variant="outline" className="text-orange-700 border-orange-300">Retroactiv</Badge>}
                  {r.confidentiality === "restricted_management" && <Badge variant="outline">Strict conducere</Badge>}
                  {r.approved_entry_id && officialMap[r.approved_entry_id] && (
                    <Badge className="bg-emerald-600 text-white">Nr. {officialMap[r.approved_entry_id]}</Badge>
                  )}
                </div>
                <div className="mt-1 text-sm font-medium truncate">{r.subject || <em className="text-muted-foreground">fără subiect</em>}</div>
                <div className="mt-1 text-xs text-muted-foreground flex gap-3 flex-wrap">
                  <span>Tip: {r.entry_type}</span>
                  <span>Declarată: {format(new Date(r.declared_registration_date), "dd MMM yyyy", { locale: ro })}</span>
                  <span>Trimisă: {format(new Date(r.created_at), "dd MMM yyyy HH:mm", { locale: ro })}</span>
                  {r.attachments_count > 0 && <span className="flex items-center gap-1"><Paperclip className="w-3 h-3" />{r.attachments_count}</span>}
                </div>
                {r.status === "rejected" && r.rejection_reason && (
                  <div className="mt-2 text-xs text-red-700 dark:text-red-300">Motiv respingere: {r.rejection_reason}</div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

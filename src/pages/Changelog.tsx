import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, ArrowRight, Search, Filter, Loader2, Newspaper, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Link, Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';

interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  description: string;
  target_roles: string[];
  impact_level: string;
  module: string | null;
  action_url: string | null;
  action_label: string | null;
  created_at: string;
}

const impactConfig: Record<string, { label: string; className: string }> = {
  major: { label: 'Major', className: 'bg-primary/10 text-primary border-primary/30' },
  minor: { label: 'Minor', className: 'bg-muted text-muted-foreground border-muted' },
  fix: { label: 'Fix / Cleanup', className: 'bg-green-500/10 text-green-700 border-green-500/30' },
};

const Changelog = () => {
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('all');
  const [filterImpact, setFilterImpact] = useState('all');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const { data } = await supabase
      .from('changelog_entries')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setEntries(data as ChangelogEntry[]);
    setLoading(false);
  };

  if (roleLoading) return null;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const modules = [...new Set(entries.map(e => e.module).filter(Boolean))] as string[];

  const filtered = entries.filter(e => {
    if (filterModule !== 'all' && e.module !== filterModule) return false;
    if (filterImpact !== 'all' && e.impact_level !== filterImpact) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.version.includes(q) ||
        (e.module || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group by version major (e.g. "1.x", "2.x")
  const grouped = filtered.reduce<Record<string, ChangelogEntry[]>>((acc, e) => {
    const major = e.version.split('.')[0] + '.x';
    if (!acc[major]) acc[major] = [];
    acc[major].push(e);
    return acc;
  }, {});

  const sortedGroups = Object.keys(grouped).sort((a, b) => {
    return parseFloat(b) - parseFloat(a);
  });

  const stats = {
    total: entries.length,
    major: entries.filter(e => e.impact_level === 'major').length,
    minor: entries.filter(e => e.impact_level === 'minor').length,
    fix: entries.filter(e => e.impact_level === 'fix').length,
  };

  const exportXlsx = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Changelog');

    ws.columns = [
      { header: 'Versiune', key: 'version', width: 10 },
      { header: 'Tip', key: 'impact', width: 12 },
      { header: 'Modul', key: 'module', width: 16 },
      { header: 'Titlu', key: 'title', width: 40 },
      { header: 'Descriere', key: 'description', width: 80 },
      { header: 'Data', key: 'date', width: 14 },
    ];

    // Header style
    ws.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      cell.alignment = { horizontal: 'center' };
    });

    const impactLabels: Record<string, string> = { major: 'Major', minor: 'Minor', fix: 'Fix/Cleanup' };

    filtered.forEach(e => {
      ws.addRow({
        version: 'v' + e.version,
        impact: impactLabels[e.impact_level] || e.impact_level,
        module: e.module || '',
        title: e.title,
        description: e.description,
        date: format(new Date(e.created_at), 'dd.MM.yyyy'),
      });
    });

    // Color-code impact column
    ws.eachRow((row, idx) => {
      if (idx === 1) return;
      row.alignment = { wrapText: true, vertical: 'top' };
      const impactCell = row.getCell(2);
      const val = impactCell.value as string;
      if (val === 'Major') impactCell.font = { bold: true, color: { argb: 'FF4F46E5' } };
      else if (val === 'Fix/Cleanup') impactCell.font = { color: { argb: 'FF16A34A' } };
    });

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `changelog_icmpp_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <MainLayout title="Changelog Complet" description="Istoricul complet al tuturor schimbărilor implementate pe platformă">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">Total intrări</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{stats.major}</p>
            <p className="text-xs text-muted-foreground">Funcționalități majore</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-muted-foreground">{stats.minor}</p>
            <p className="text-xs text-muted-foreground">Îmbunătățiri minore</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.fix}</p>
            <p className="text-xs text-muted-foreground">Fix-uri & Cleanup</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Caută în changelog..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterModule} onValueChange={setFilterModule}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Modul" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate modulele</SelectItem>
            {modules.sort().map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterImpact} onValueChange={setFilterImpact}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Impact" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate tipurile</SelectItem>
            <SelectItem value="major">Major</SelectItem>
            <SelectItem value="minor">Minor</SelectItem>
            <SelectItem value="fix">Fix / Cleanup</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nu s-au găsit rezultate pentru filtrele selectate.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {sortedGroups.map(group => (
            <div key={group}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold text-foreground">Versiunea {group}</h2>
                <Badge variant="outline" className="text-xs">
                  {grouped[group].length} schimbări
                </Badge>
              </div>
              <div className="relative pl-6 border-l-2 border-border space-y-4">
                {grouped[group].map(entry => {
                  const isRecent = Date.now() - new Date(entry.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;
                  const impact = impactConfig[entry.impact_level] || impactConfig.minor;

                  return (
                    <div key={entry.id} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[calc(1.5rem+5px)] w-2.5 h-2.5 rounded-full border-2 border-background ${
                        entry.impact_level === 'major' ? 'bg-primary' : entry.impact_level === 'fix' ? 'bg-green-500' : 'bg-muted-foreground'
                      }`} />

                      <Card className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="outline" className={impact.className}>
                                v{entry.version}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {impact.label}
                              </Badge>
                              {entry.module && (
                                <Badge variant="secondary" className="text-[10px]">
                                  {entry.module}
                                </Badge>
                              )}
                              {isRecent && (
                                <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 h-4 gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5" /> NOU
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(entry.created_at), 'd MMMM yyyy', { locale: ro })}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-foreground mb-1">{entry.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{entry.description}</p>
                          {entry.action_url && entry.action_label && (
                            <Link to={entry.action_url}>
                              <Button variant="link" size="sm" className="h-auto p-0 mt-2 text-xs">
                                {entry.action_label} <ArrowRight className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </MainLayout>
  );
};

export default Changelog;

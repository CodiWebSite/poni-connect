import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Cloud, RefreshCw, Loader2, AlertTriangle, FileJson, History, Download, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { RequireReasonDialog } from '@/components/shared/RequireReasonDialog';

interface DriveFile {
  id: string;
  name: string;
  size?: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
}

const DriveBackupRestorePanel = () => {
  const { toast } = useToast();
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<DriveFile | null>(null);
  const [preview, setPreview] = useState<{ counts: Record<string, number>; metadata: any } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [restoring, setRestoring] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [report, setReport] = useState<any[] | null>(null);
  const [reasonOpen, setReasonOpen] = useState(false);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('restore-from-drive', {
        method: 'GET',
      });
      if (error) throw error;
      setFiles(data?.files || []);
    } catch (e: any) {
      toast({ title: 'Eroare listare', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFiles(); }, []);

  const openRestore = async (file: DriveFile) => {
    setSelectedFile(file);
    setPreview(null);
    setReport(null);
    setConfirmText('');
    setRestoreMode('merge');
    try {
      const { data, error } = await supabase.functions.invoke('restore-from-drive?action=preview', {
        body: { fileId: file.id },
      });
      if (error) throw error;
      setPreview(data);
    } catch (e: any) {
      toast({ title: 'Eroare preview', description: e.message, variant: 'destructive' });
    }
  };

  const runRestore = async () => {
    if (!selectedFile || confirmText !== 'RESTAUREAZĂ') return;
    setRestoring(true);
    try {
      const { data, error } = await supabase.functions.invoke('restore-from-drive?action=restore', {
        body: { fileId: selectedFile.id, mode: restoreMode, confirm: true },
      });
      if (error) throw error;
      setReport(data?.report || []);
      const errs = (data?.report || []).filter((r: any) => r.status === 'error').length;
      toast({
        title: errs > 0 ? '⚠️ Restaurare parțială' : '✅ Restaurare reușită',
        description: `${data?.report?.length || 0} tabele procesate${errs ? `, ${errs} cu erori` : ''}`,
      });
    } catch (e: any) {
      toast({ title: 'Eroare restaurare', description: e.message, variant: 'destructive' });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Cloud className="w-4 h-4 text-primary" />
              Backup-uri Google Drive
            </CardTitle>
            <CardDescription className="text-xs">
              Istoric versiuni · folder „ICMPP Backups" · ultimele 12 backup-uri păstrate
            </CardDescription>
          </div>
          <Button onClick={loadFiles} disabled={loading} size="sm" variant="outline">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Reîncarcă
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {files.length === 0 && !loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <FileJson className="w-10 h-10 mx-auto mb-2 opacity-50" />
            Niciun backup în Google Drive. Rulează un backup pentru a începe.
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((f) => (
              <div key={f.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                <FileJson className={`w-5 h-5 ${f.name === 'latest.json' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{f.name}</p>
                    {f.name === 'latest.json' && <Badge variant="secondary" className="text-[10px]">Curent</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(f.createdTime), "d MMM yyyy 'la' HH:mm", { locale: ro })}
                    {f.size && ` · ${(parseInt(f.size) / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                </div>
                {f.webViewLink && (
                  <Button asChild size="sm" variant="ghost">
                    <a href={f.webViewLink} target="_blank" rel="noreferrer"><Download className="w-4 h-4" /></a>
                  </Button>
                )}
                <Button onClick={() => openRestore(f)} size="sm" variant="default">
                  <RotateCcw className="w-4 h-4 mr-1.5" />Restaurează
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!selectedFile} onOpenChange={(o) => !o && setSelectedFile(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="w-5 h-5" />Restaurare backup</DialogTitle>
            <DialogDescription>
              {selectedFile?.name} — {selectedFile && format(new Date(selectedFile.createdTime), "d MMMM yyyy HH:mm", { locale: ro })}
            </DialogDescription>
          </DialogHeader>

          {!preview ? (
            <div className="py-6 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : !report ? (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription className="text-xs">
                  Operațiune ireversibilă. Doar date operaționale sunt restaurate (cereri concediu, anunțuri, evenimente, setări, bibliotecă etc.). 
                  <strong> Conturile, parolele, fișierele storage și log-urile NU sunt afectate.</strong>
                </AlertDescription>
              </Alert>

              <div>
                <p className="text-sm font-medium mb-2">Conținut backup:</p>
                <div className="grid grid-cols-2 gap-1 text-xs max-h-48 overflow-y-auto bg-muted/30 p-2 rounded">
                  {Object.entries(preview.counts).filter(([, c]) => c > 0).map(([t, c]) => (
                    <div key={t} className="flex justify-between"><span className="truncate">{t}</span><span className="text-muted-foreground">{c}</span></div>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium">Mod restaurare:</Label>
                <RadioGroup value={restoreMode} onValueChange={(v: any) => setRestoreMode(v)} className="mt-2">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="merge" id="merge" className="mt-0.5" />
                    <Label htmlFor="merge" className="font-normal cursor-pointer">
                      <span className="font-medium">Merge (recomandat)</span> — actualizează rândurile existente, le păstrează pe cele noi.
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="replace" id="replace" className="mt-0.5" />
                    <Label htmlFor="replace" className="font-normal cursor-pointer">
                      <span className="font-medium text-destructive">Replace</span> — șterge complet și înlocuiește fiecare tabelă cu conținutul backup-ului.
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label className="text-sm">Pentru confirmare, scrie <strong>RESTAUREAZĂ</strong>:</Label>
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded text-sm bg-background"
                  placeholder="RESTAUREAZĂ"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <p className="text-sm font-medium">Raport restaurare:</p>
              {report.map((r, i) => (
                <div key={i} className={`flex items-center justify-between p-2 rounded text-xs border ${r.status === 'ok' ? 'border-emerald-500/30 bg-emerald-500/5' : r.status === 'error' ? 'border-destructive/30 bg-destructive/5' : 'border-muted bg-muted/20'}`}>
                  <span className="font-mono">{r.table}</span>
                  <span>{r.status === 'ok' ? `✅ ${r.restored}` : r.status === 'skipped' ? '— gol' : `❌ ${r.error}`}</span>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            {!report ? (
              <>
                <Button variant="outline" onClick={() => setSelectedFile(null)}>Anulează</Button>
                <Button onClick={() => setReasonOpen(true)} disabled={restoring || confirmText !== 'RESTAUREAZĂ' || !preview} variant="destructive">
                  {restoring ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RotateCcw className="w-4 h-4 mr-2" />}
                  Restaurează acum
                </Button>
              </>
            ) : (
              <Button onClick={() => setSelectedFile(null)}>Închide</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RequireReasonDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title="Confirmare restaurare backup"
        description="Această operațiune va modifica date operaționale. Confirmă parola și descrie motivul."
        action="backup_restore"
        entityType="drive_backup"
        entityId={selectedFile?.id ?? null}
        extraDetails={{ file: selectedFile?.name, mode: restoreMode }}
        onConfirm={runRestore}
      />
    </Card>
  );
};

export default DriveBackupRestorePanel;

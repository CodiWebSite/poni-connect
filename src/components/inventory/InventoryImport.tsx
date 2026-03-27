import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { parseInventoryXls, mapStatus, mapCategory, type InventoryParseResult } from '@/utils/parseInventoryXls';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InventoryImportProps {
  onComplete: () => void;
}

const InventoryImport = ({ onComplete }: InventoryImportProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<InventoryParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; softwareLinked: number } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const data = parseInventoryXls(buf);
    setParsed(data);
    setResult(null);
  };

  const handleImport = async () => {
    if (!parsed || !user) return;
    setImporting(true);
    let inserted = 0;
    let softwareLinked = 0;

    try {
      // Import equipment
      for (const eq of parsed.equipment) {
        const { data: existing } = await supabase
          .from('equipment_items')
          .select('id')
          .eq('inventory_number', eq.inventory_number)
          .maybeSingle();

        if (existing) continue; // skip duplicates

        const { data: newItem, error } = await supabase.from('equipment_items').insert({
          name: eq.brand_model || eq.equipment_type || 'Echipament',
          category: mapCategory(eq.equipment_type),
          serial_number: eq.serial_number || null,
          description: eq.notes || null,
          status: mapStatus(eq.status),
          building: eq.building || null,
          floor: eq.floor,
          room: eq.room || null,
          brand_model: eq.brand_model || null,
          inventory_number: eq.inventory_number,
          created_by: user.id,
        } as any).select('id').maybeSingle();

        if (!error && newItem) {
          inserted++;
          // Log creation
          await supabase.from('equipment_history').insert({
            equipment_id: newItem.id,
            action: 'created',
            performed_by: user.id,
            notes: 'Import XLS',
          });
        }
      }

      // Link software to equipment by inventory_number
      for (const sw of parsed.software) {
        const { data: eqItem } = await supabase
          .from('equipment_items')
          .select('id')
          .eq('inventory_number', sw.inventory_number)
          .maybeSingle();

        if (!eqItem) continue;

        const { error } = await supabase.from('equipment_software').insert({
          equipment_id: eqItem.id,
          activity_type: sw.activity_type || null,
          pc_name: sw.pc_name || null,
          os: sw.os || null,
          license_year: sw.license_year,
          license_type: sw.license_type || null,
          antivirus: sw.antivirus || null,
          antivirus_year: sw.antivirus_year,
          installed_apps: sw.installed_apps || null,
          licensed_count: sw.licensed_count || null,
          notes: sw.notes || null,
        });
        if (!error) softwareLinked++;
      }

      setResult({ inserted, softwareLinked });
      toast({ title: 'Import finalizat', description: `${inserted} echipamente importate, ${softwareLinked} înregistrări software asociate.` });
      onComplete();
    } catch (err: any) {
      toast({ title: 'Eroare', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-primary" />
          Import Inventar IT din Excel
        </CardTitle>
        <CardDescription>Încarcă fișierul Excel cu cele 2 sheet-uri (inventar_echipamente + Software_calculatoare)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-2" />
            Selectează fișier Excel
          </Button>
        </div>

        {parsed && (
          <>
            <div className="flex gap-4">
              <Badge variant="secondary" className="text-sm">
                {parsed.equipment.length} echipamente detectate
              </Badge>
              <Badge variant="secondary" className="text-sm">
                {parsed.software.length} înregistrări software detectate
              </Badge>
            </div>

            {parsed.errors.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-200 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> Atenționări ({parsed.errors.length})
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-300 mt-1 space-y-0.5">
                  {parsed.errors.slice(0, 10).map((e, i) => <li key={i}>• {e}</li>)}
                  {parsed.errors.length > 10 && <li>...și alte {parsed.errors.length - 10}</li>}
                </ul>
              </div>
            )}

            {/* Preview table */}
            <ScrollArea className="h-64 rounded border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Clădire</TableHead>
                    <TableHead>Etaj</TableHead>
                    <TableHead>Cameră</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Brand/Model</TableHead>
                    <TableHead>Nr. Inventar</TableHead>
                    <TableHead>Serie</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.equipment.slice(0, 50).map((eq, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-xs">{eq.building}</TableCell>
                      <TableCell className="text-xs">{eq.floor ?? '—'}</TableCell>
                      <TableCell className="text-xs">{eq.room}</TableCell>
                      <TableCell className="text-xs">{eq.equipment_type}</TableCell>
                      <TableCell className="text-xs">{eq.brand_model}</TableCell>
                      <TableCell className="text-xs font-mono">{eq.inventory_number}</TableCell>
                      <TableCell className="text-xs font-mono">{eq.serial_number || '—'}</TableCell>
                      <TableCell className="text-xs">{eq.status || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {result ? (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">Import finalizat</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {result.inserted} echipamente noi · {result.softwareLinked} software asociat
                  </p>
                </div>
              </div>
            ) : (
              <Button onClick={handleImport} disabled={importing || parsed.equipment.length === 0}>
                {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                {importing ? 'Se importă...' : `Importă ${parsed.equipment.length} echipamente`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryImport;

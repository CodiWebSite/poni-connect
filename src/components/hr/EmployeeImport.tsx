import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileSpreadsheet, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ImportResult {
  success: boolean;
  imported?: number;
  skipped?: number;
  total?: number;
  message?: string;
  errors?: string[];
  error?: string;
}

export const EmployeeImport = () => {
  const { toast } = useToast();
  const [csvContent, setCsvContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvContent(content);
      setResult(null);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvContent.trim()) {
      toast({
        title: 'Eroare',
        description: 'Selectați sau introduceți un fișier CSV.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('import-employees', {
        body: { csvContent },
      });

      if (error) throw error;

      setResult(data);

      if (data.success) {
        toast({
          title: 'Import reușit',
          description: data.message || `Importați ${data.imported} angajați.`,
        });
      } else {
        toast({
          title: 'Eroare la import',
          description: data.error || 'A apărut o eroare.',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      console.error('Import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută';
      setResult({ success: false, error: errorMessage });
      toast({
        title: 'Eroare la import',
        description: errorMessage,
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const sampleFormat = `id;user_id;email;first_name;last_name;cnp;ci_series;ci_number;ci_issued_by;ci_issued_date;address_street;address_number;address_block;address_floor;address_apartment;address_city;address_county;employment_date;created_at;updated_at`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Import Angajați din CSV
        </CardTitle>
        <CardDescription>
          Importați datele angajaților din fișierul exportat din sistemul HR
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label
            htmlFor="csv-upload"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold">Click pentru a încărca</span> sau trageți fișierul aici
              </p>
              <p className="text-xs text-muted-foreground">Fișier CSV (separator: ;)</p>
            </div>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {csvContent && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Conținut CSV încărcat:</p>
            <Textarea
              value={csvContent}
              onChange={(e) => setCsvContent(e.target.value)}
              rows={8}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              {csvContent.split('\n').length - 1} rânduri de date detectate
            </p>
          </div>
        )}

        {!csvContent && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs font-medium mb-1">Format așteptat (separator: ;):</p>
            <code className="text-xs text-muted-foreground break-all">{sampleFormat}</code>
          </div>
        )}

        {result && (
          <Alert variant={result.success ? 'default' : 'destructive'}>
            {result.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertTitle>{result.success ? 'Import finalizat' : 'Eroare'}</AlertTitle>
            <AlertDescription>
              {result.success ? (
                <div>
                  <p>Importați: {result.imported} din {result.total}</p>
                  {result.skipped && result.skipped > 0 && (
                    <p>Omise: {result.skipped}</p>
                  )}
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">Erori:</p>
                      <ul className="list-disc list-inside text-xs">
                        {result.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p>{result.error}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleImport}
          disabled={loading || !csvContent.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Se importă...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Importă Angajați
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

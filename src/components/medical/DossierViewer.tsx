import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Edit2, CheckCircle, XCircle } from 'lucide-react';
import { generateDosarMedical, type DosarMedicalParams } from '@/utils/generateDosarMedical';
import type { MedicalCabinetConfig } from '@/utils/generateFisaAptitudine';
import { toast } from 'sonner';

interface WorkHistoryRow {
  post: string;
  period: string;
  occupation: string;
  noxe: string;
}

interface DossierData {
  professional_training: string | null;
  professional_route: string | null;
  work_history: WorkHistoryRow[];
  current_activities: string | null;
  professional_diseases: boolean | null;
  professional_diseases_details: string | null;
  work_accidents: boolean | null;
  work_accidents_details: string | null;
  family_doctor: string | null;
  heredo_collateral: string | null;
  personal_physiological: string | null;
  personal_pathological: string | null;
  smoking: string | null;
  alcohol: string | null;
}

interface EmployeeInfo {
  id: string;
  first_name: string;
  last_name: string;
  cnp: string;
  department: string | null;
  position: string | null;
  address_street: string | null;
  address_number: string | null;
  address_city: string | null;
  address_county: string | null;
  employment_date: string;
}

interface DossierViewerProps {
  employee: EmployeeInfo;
  config: MedicalCabinetConfig;
  onEditClick: () => void;
}

function parseCNP(cnp: string) {
  if (!cnp || cnp.length < 7) return { sex: '', birthDate: '', age: '' };
  const s = cnp[0];
  const sex = ['1', '3', '5', '7'].includes(s) ? 'Masculin' : (['2', '4', '6', '8'].includes(s) ? 'Feminin' : '');
  let century = '19';
  if (['5', '6'].includes(s)) century = '20';
  if (['3', '4'].includes(s)) century = '18';
  const yy = cnp.substring(1, 3);
  const mm = cnp.substring(3, 5);
  const dd = cnp.substring(5, 7);
  const birthYear = parseInt(century + yy);
  const birthDate = `${dd}.${mm}.${century}${yy}`;
  const now = new Date();
  let age = now.getFullYear() - birthYear;
  if (now.getMonth() + 1 < parseInt(mm) || (now.getMonth() + 1 === parseInt(mm) && now.getDate() < parseInt(dd))) age--;
  return { sex, birthDate, age: `${age} ani` };
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline gap-2 py-1">
      <span className="text-xs text-muted-foreground min-w-[140px] shrink-0">{label}:</span>
      <span className="text-sm font-medium text-foreground">{value || '—'}</span>
    </div>
  );
}

function BoolField({ label, value, details }: { label: string; value: boolean | null | undefined; details?: string | null }) {
  return (
    <div className="py-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground min-w-[140px] shrink-0">{label}:</span>
        {value === true ? (
          <Badge variant="destructive" className="text-xs"><CheckCircle className="w-3 h-3 mr-1" />DA</Badge>
        ) : value === false ? (
          <Badge variant="secondary" className="text-xs"><XCircle className="w-3 h-3 mr-1" />NU</Badge>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </div>
      {value === true && details && (
        <p className="text-sm text-foreground ml-[148px] mt-1">{details}</p>
      )}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mt-4 mb-2">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">{title}</h3>
      <Separator className="mt-1" />
    </div>
  );
}

export default function DossierViewer({ employee, config, onEditClick }: DossierViewerProps) {
  const [data, setData] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const { sex, birthDate, age } = parseCNP(employee.cnp);
  const address = [
    employee.address_street,
    employee.address_number ? `nr. ${employee.address_number}` : '',
    employee.address_city,
    employee.address_county ? `jud. ${employee.address_county}` : '',
  ].filter(Boolean).join(', ');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: d } = await supabase
        .from('medical_dossier_data' as any)
        .select('*')
        .eq('epd_id', employee.id)
        .maybeSingle();
      if (d) {
        const r = d as any;
        setData({
          professional_training: r.professional_training,
          professional_route: r.professional_route,
          work_history: Array.isArray(r.work_history) ? r.work_history : [],
          current_activities: r.current_activities,
          professional_diseases: r.professional_diseases,
          professional_diseases_details: r.professional_diseases_details,
          work_accidents: r.work_accidents,
          work_accidents_details: r.work_accidents_details,
          family_doctor: r.family_doctor,
          heredo_collateral: r.heredo_collateral,
          personal_physiological: r.personal_physiological,
          personal_pathological: r.personal_pathological,
          smoking: r.smoking,
          alcohol: r.alcohol,
        });
      } else {
        setData(null);
      }
      setLoading(false);
    };
    load();
  }, [employee.id]);

  const handleDownloadPdf = async () => {
    setGenerating(true);
    try {
      await generateDosarMedical({
        lastName: employee.last_name,
        firstName: employee.first_name,
        cnp: employee.cnp,
        position: employee.position || '',
        department: employee.department || '',
        address,
        employmentDate: employee.employment_date || '',
        config,
        professionalTraining: data?.professional_training || undefined,
        professionalRoute: data?.professional_route || undefined,
        workHistory: data?.work_history || undefined,
        currentActivities: data?.current_activities || undefined,
        professionalDiseases: data?.professional_diseases ?? undefined,
        professionalDiseasesDetails: data?.professional_diseases_details || undefined,
        workAccidents: data?.work_accidents ?? undefined,
        workAccidentsDetails: data?.work_accidents_details || undefined,
        familyDoctor: data?.family_doctor || undefined,
        heredoCollateral: data?.heredo_collateral || undefined,
        personalPhysiological: data?.personal_physiological || undefined,
        personalPathological: data?.personal_pathological || undefined,
        smoking: data?.smoking || undefined,
        alcohol: data?.alcohol || undefined,
      });
      toast.success('Dosarul medical a fost descărcat');
    } catch {
      toast.error('Eroare la generarea PDF-ului');
    }
    setGenerating(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Dosar Medical — {employee.last_name} {employee.first_name}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEditClick}>
              <Edit2 className="w-4 h-4 mr-1" /> Editează
            </Button>
            <Button size="sm" onClick={handleDownloadPdf} disabled={generating}>
              <Download className="w-4 h-4 mr-1" />
              {generating ? 'Se generează...' : 'Descarcă PDF'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-0">
        {/* Personal Data */}
        <SectionHeader title="Date personale" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <FieldRow label="Numele" value={employee.last_name.toUpperCase()} />
          <FieldRow label="Prenumele" value={employee.first_name.toUpperCase()} />
          <FieldRow label="Sex" value={sex} />
          <FieldRow label="Data nașterii" value={birthDate} />
          <FieldRow label="Vârsta" value={age} />
          <FieldRow label="CNP" value={employee.cnp} />
          <FieldRow label="Domiciliul" value={address} />
          <FieldRow label="Ocupația / Funcția" value={employee.position} />
          <FieldRow label="Locul de muncă" value={employee.department} />
        </div>

        {/* Professional */}
        <SectionHeader title="Formare și traseu profesional" />
        <FieldRow label="Formarea profesională" value={data?.professional_training} />
        <FieldRow label="Ruta profesională" value={data?.professional_route} />

        {/* Work history */}
        <SectionHeader title="Locuri de muncă anterioare" />
        {data?.work_history && data.work_history.length > 0 ? (
          <div className="overflow-auto">
            <table className="w-full text-sm border border-border rounded-md">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground border-b">Nr.</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground border-b">Post / Loc de muncă</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground border-b">Perioada</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground border-b">Ocupația</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground border-b">Noxe profesionale</th>
                </tr>
              </thead>
              <tbody>
                {data.work_history.map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{i + 1}</td>
                    <td className="px-3 py-1.5">{row.post || '—'}</td>
                    <td className="px-3 py-1.5">{row.period || '—'}</td>
                    <td className="px-3 py-1.5">{row.occupation || '—'}</td>
                    <td className="px-3 py-1.5">{row.noxe || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic py-2">Niciun loc de muncă anterior înregistrat</p>
        )}

        {/* Current activities */}
        <SectionHeader title="Activitate curentă și noxe" />
        <FieldRow label="Activități / Noxe" value={data?.current_activities} />
        <BoolField label="Boli profesionale" value={data?.professional_diseases} details={data?.professional_diseases_details} />
        <BoolField label="Accidente de muncă" value={data?.work_accidents} details={data?.work_accidents_details} />

        {/* Family doctor */}
        <SectionHeader title="Medic de familie și antecedente" />
        <FieldRow label="Medic de familie" value={data?.family_doctor} />
        <FieldRow label="Ant. heredocolaterale" value={data?.heredo_collateral} />
        <FieldRow label="Ant. pers. fiziologice" value={data?.personal_physiological} />
        <FieldRow label="Ant. pers. patologice" value={data?.personal_pathological} />

        {/* Habits */}
        <SectionHeader title="Obiceiuri" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          <FieldRow label="Fumat" value={data?.smoking} />
          <FieldRow label="Consum alcool" value={data?.alcohol} />
        </div>

        {!data && (
          <div className="text-center py-6 text-muted-foreground">
            <p className="mb-2">Nu există date suplimentare pentru dosarul medical.</p>
            <Button variant="outline" size="sm" onClick={onEditClick}>
              <Edit2 className="w-4 h-4 mr-1" /> Completează datele
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, FileSpreadsheet, File } from 'lucide-react';

interface Template {
  name: string;
  filename: string;
  category: string;
}

const templates: Template[] = [
  { name: 'Model cerere de concediu', filename: 'Model_cerere_concediu.doc', category: 'Resurse Umane' },
  { name: 'Declarația persoanelor întreținute', filename: 'Declaratia_pers_intretinere.doc', category: 'Resurse Umane' },
  { name: 'Declarația contribuabilului', filename: 'Declaratia_contribuabilului.doc', category: 'Declarații' },
  { name: 'Declarație de avere', filename: 'Declaratie_Avere.doc', category: 'Declarații' },
  { name: 'Declarație de interese', filename: 'Declaratie_Interese.doc', category: 'Declarații' },
  { name: 'Documente deplasări interne', filename: 'Deplasari_interne.docx', category: 'Deplasări' },
  { name: 'Documente deplasări externe', filename: 'Deplasari_externe.docx', category: 'Deplasări' },
  { name: 'Decont cheltuieli deplasări externe', filename: 'Decont_cheltuieli_deplasari_externe.xlsx', category: 'Deplasări' },
  { name: 'Fișă solicitare analize (Digestor)', filename: 'Fisa_solicitare_analize.pdf', category: 'Laborator' },
  { name: 'Fișă solicitare analize DSC', filename: 'Fisa_solicitare_analize_DSC.pdf', category: 'Laborator' },
  { name: 'Fișă solicitare analize AAS', filename: 'Fisa_solicitare_analize_AAS.pdf', category: 'Laborator' },
  { name: 'Fișă solicitare analize TOC (carbon-azot)', filename: 'Fisa_solicitare_analize_TOC_carbon_azot.pdf', category: 'Laborator' },
  { name: 'Fișă solicitare analize – Sistem echipamente', filename: 'Fisa_solicitare_analize_sistem_echipamente.doc', category: 'Laborator' },
  { name: 'Fișe SPM', filename: 'Fise_SPM.doc', category: 'Laborator' },
  { name: 'Fișe WAXD', filename: 'Fise_WAXD.doc', category: 'Laborator' },
  { name: 'Fișe Zeta Master / SurPASS', filename: 'Fise_Zeta_Master_SurPASS.doc', category: 'Laborator' },
  { name: 'Curs de RMN', filename: 'Curs_de_RMN.pdf', category: 'Laborator' },
  { name: 'Info și reguli analize RMN', filename: 'Info_reguli_analize_RMN.doc', category: 'Laborator' },
  { name: 'Model referat produse', filename: 'Model_referat_produse.docx', category: 'Achiziții' },
];

const getIcon = (filename: string) => {
  if (filename.endsWith('.xlsx')) return FileSpreadsheet;
  if (filename.endsWith('.pdf')) return File;
  return FileText;
};

const categories = [...new Set(templates.map(t => t.category))];

export default function FormTemplates() {
  return (
    <MainLayout title="Formulare și Modele" description="Descărcați modelele de formulare necesare activității instituționale.">
      <div className="space-y-6">

        {categories.map(category => (
          <Card key={category}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {templates.filter(t => t.category === category).map(template => {
                const Icon = getIcon(template.filename);
                return (
                  <a
                    key={template.filename}
                    href={`/templates/${template.filename}`}
                    download
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="font-medium text-sm">{template.name}</span>
                    </div>
                    <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </MainLayout>
  );
}

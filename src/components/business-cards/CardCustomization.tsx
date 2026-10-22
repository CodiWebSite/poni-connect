import { useRef, useState } from 'react';
import { Pencil, Upload, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { CardLang } from '@/utils/businessCards';

export interface CardCustomizationData {
  titlePrefix: string;
  positionEn: string;
  departmentEn: string;
  qrImage: string;
}
export const EMPTY_CUSTOMIZATION: CardCustomizationData = {
  titlePrefix: '', positionEn: '', departmentEn: '', qrImage: '',
};

interface EditableFieldsProps {
  displayName: string; setDisplayName: (value: string) => void;
  position: string; setPosition: (value: string) => void;
  department: string; setDepartment: (value: string) => void;
  phone: string; setPhone: (value: string) => void;
  qrUrl: string; setQrUrl: (value: string) => void;
  originalName: string; originalPosition: string; originalDepartment: string; originalQrUrl: string;
  lang: CardLang;
  customization: CardCustomizationData;
  setCustomization: React.Dispatch<React.SetStateAction<CardCustomizationData>>;
}

export function EditableFields(props: EditableFieldsProps) {
  const { displayName, setDisplayName, position, setPosition, department, setDepartment,
    phone, setPhone, qrUrl, setQrUrl, originalName, originalPosition, originalDepartment,
    originalQrUrl, lang, customization, setCustomization } = props;
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadVersion = useRef(0);
  const [uploading, setUploading] = useState(false);
  const update = (field: keyof CardCustomizationData, value: string) => {
    setCustomization(current => ({ ...current, [field]: value }));
  };

  const loadQR = async (file?: File) => {
    if (!file) return;
    const version = ++uploadVersion.current;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast({ title: 'Imagine neacceptată', description: 'Alegeți o imagine PNG, JPG sau WEBP de maximum 5 MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Fișier invalid'));
        reader.readAsDataURL(file);
      });
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => image.naturalWidth && image.naturalHeight ? resolve() : reject(new Error('Imagine invalidă'));
        image.onerror = reject;
        image.src = source;
      });
      if (version === uploadVersion.current) update('qrImage', source);
    } catch {
      toast({ title: 'Imagine invalidă', description: 'Fișierul nu a putut fi deschis. Alegeți o altă imagine.', variant: 'destructive' });
    } finally {
      if (version === uploadVersion.current) setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Pencil className="w-4 h-4" />Personalizare text</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="card-title" className="text-xs">Titulatură înaintea numelui (opțional)</Label>
          <Input id="card-title" value={customization.titlePrefix} onChange={event => update('titlePrefix', event.target.value)} placeholder="Dr., Acad., Prof. dr. ..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="card-name" className="text-xs">Nume afișat</Label>
          <Input id="card-name" value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder={originalName} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="card-position" className="text-xs">Funcție{lang === 'ro-en' ? ' — română' : ''}</Label>
            <Input id="card-position" value={position} onChange={event => setPosition(event.target.value)} placeholder={originalPosition || 'Funcție'} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-dept" className="text-xs">Departament{lang === 'ro-en' ? ' — română' : ''} (opțional)</Label>
            <Input id="card-dept" value={department} onChange={event => setDepartment(event.target.value)} placeholder={originalDepartment || 'Departament'} />
          </div>
        </div>
        {lang !== 'ro' && <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="card-position-en" className="text-xs">Funcție — engleză (opțional)</Label>
            <Input id="card-position-en" value={customization.positionEn} onChange={event => update('positionEn', event.target.value)} placeholder="Researcher ..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-dept-en" className="text-xs">Departament — engleză (opțional)</Label>
            <Input id="card-dept-en" value={customization.departmentEn} onChange={event => update('departmentEn', event.target.value)} placeholder="Laboratory ..." disabled={!department.trim()} />
          </div>
        </div>}
        <div className="space-y-1.5">
          <Label htmlFor="card-phone" className="text-xs">Telefon (opțional)</Label>
          <Input id="card-phone" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+40 xxx xxx xxx" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="card-qr" className="text-xs">Link cod QR (verso) — opțional</Label>
          <Input id="card-qr" value={qrUrl} onChange={event => setQrUrl(event.target.value)} placeholder={originalQrUrl} type="url" />
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label htmlFor="card-qr-image" className="text-xs">Imagine cod QR (verso) — opțional</Label>
          <Input ref={fileRef} id="card-qr-image" type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={event => { void loadQR(event.target.files?.[0]); event.target.value = ''; }} />
          <div className="flex items-center gap-3 flex-wrap">
            {customization.qrImage && <img src={customization.qrImage} alt="Imagine QR încărcată" className="w-16 h-16 object-contain border rounded-md bg-card" />}
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload className="w-4 h-4 mr-2" />{uploading ? 'Se încarcă...' : customization.qrImage ? 'Schimbă imaginea QR' : 'Încarcă imagine QR'}
            </Button>
            {customization.qrImage && <Button type="button" variant="ghost" size="icon" aria-label="Elimină imaginea QR" title="Elimină imaginea QR"
              onClick={() => { uploadVersion.current += 1; setUploading(false); update('qrImage', ''); }}><X className="w-4 h-4" /></Button>}
          </div>
          <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP · maximum 5 MB</p>
        </div>
      </CardContent>
    </Card>
  );
}
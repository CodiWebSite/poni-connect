import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'sonner';
import { 
  Globe, BookOpen, GraduationCap, Phone, Save, Loader2, Eye, 
  QrCode, ExternalLink 
} from 'lucide-react';

interface PublicProfileEditorProps {
  epdId: string;
  employeeName: string;
}

interface ProfileSettings {
  bio: string;
  tagline: string;
  phone: string;
  researchgate_url: string;
  google_scholar_url: string;
  orcid_url: string;
  website_url: string;
  show_phone: boolean;
  show_email: boolean;
  show_department: boolean;
  show_position: boolean;
}

const defaultSettings: ProfileSettings = {
  bio: '',
  tagline: '',
  phone: '',
  researchgate_url: '',
  google_scholar_url: '',
  orcid_url: '',
  website_url: '',
  show_phone: true,
  show_email: true,
  show_department: true,
  show_position: true,
};

export function PublicProfileEditor({ epdId, employeeName }: PublicProfileEditorProps) {
  const [settings, setSettings] = useState<ProfileSettings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasRecord, setHasRecord] = useState(false);

  const profileUrl = `${window.location.origin}/profil/${epdId}`;

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('public_profile_settings')
        .select('*')
        .eq('epd_id', epdId)
        .maybeSingle();

      if (data) {
        setHasRecord(true);
        setSettings({
          bio: data.bio || '',
          tagline: data.tagline || '',
          phone: data.phone || '',
          researchgate_url: data.researchgate_url || '',
          google_scholar_url: data.google_scholar_url || '',
          orcid_url: data.orcid_url || '',
          website_url: data.website_url || '',
          show_phone: data.show_phone,
          show_email: data.show_email,
          show_department: data.show_department,
          show_position: data.show_position,
        });
      }
      setLoading(false);
    };
    fetch();
  }, [epdId]);

  const handleSave = async () => {
    setSaving(true);

    const payload = {
      epd_id: epdId,
      bio: settings.bio || null,
      tagline: settings.tagline || null,
      phone: settings.phone || null,
      researchgate_url: settings.researchgate_url || null,
      google_scholar_url: settings.google_scholar_url || null,
      orcid_url: settings.orcid_url || null,
      website_url: settings.website_url || null,
      show_phone: settings.show_phone,
      show_email: settings.show_email,
      show_department: settings.show_department,
      show_position: settings.show_position,
      updated_at: new Date().toISOString(),
    };

    let error;

    if (hasRecord) {
      const res = await supabase
        .from('public_profile_settings')
        .update(payload)
        .eq('epd_id', epdId);
      error = res.error;
    } else {
      const res = await supabase
        .from('public_profile_settings')
        .insert(payload);
      error = res.error;
      if (!error) setHasRecord(true);
    }

    if (error) {
      toast.error('Eroare la salvarea setărilor');
      console.error(error);
    } else {
      toast.success('Profil public actualizat!');
    }
    setSaving(false);
  };

  const update = (key: keyof ProfileSettings, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          Profil Public & Cod QR
        </CardTitle>
        <CardDescription>
          Personalizează informațiile afișate pe profilul tău public (accesibil prin codul QR de pe cartea de vizită)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Preview */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-muted/50">
          <div className="flex-shrink-0 p-3 bg-white rounded-lg shadow-sm">
            <QRCodeCanvas value={profileUrl} size={96} level="M" />
          </div>
          <div className="text-center sm:text-left space-y-1 min-w-0">
            <p className="text-sm font-medium">Codul QR al profilului tău</p>
            <p className="text-xs text-muted-foreground break-all">{profileUrl}</p>
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              <Eye className="w-3 h-3" />
              Previzualizează profilul public
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Bio & Tagline */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pp-tagline">Titlu profesional / Tagline</Label>
            <Input
              id="pp-tagline"
              placeholder="ex: Cercetător Științific, Chimie Macromoleculară"
              value={settings.tagline}
              onChange={e => update('tagline', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-bio">Despre mine (bio)</Label>
            <Textarea
              id="pp-bio"
              placeholder="Scrie o scurtă descriere profesională..."
              className="min-h-[80px]"
              value={settings.bio}
              onChange={e => update('bio', e.target.value)}
            />
          </div>
        </div>

        {/* Contact for public profile */}
        <div className="space-y-2">
          <Label htmlFor="pp-phone">Telefon public</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="pp-phone"
              className="pl-10"
              placeholder="+40 XXX XXX XXX"
              value={settings.phone}
              onChange={e => update('phone', e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">Separat de telefonul din profilul intern</p>
        </div>

        {/* Academic Links */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Link-uri academice</Label>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pp-rg" className="text-xs text-muted-foreground">ResearchGate</Label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="pp-rg"
                  className="pl-10"
                  placeholder="https://researchgate.net/profile/..."
                  value={settings.researchgate_url}
                  onChange={e => update('researchgate_url', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-gs" className="text-xs text-muted-foreground">Google Scholar</Label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="pp-gs"
                  className="pl-10"
                  placeholder="https://scholar.google.com/..."
                  value={settings.google_scholar_url}
                  onChange={e => update('google_scholar_url', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-orcid" className="text-xs text-muted-foreground">ORCID</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="pp-orcid"
                  className="pl-10"
                  placeholder="https://orcid.org/0000-..."
                  value={settings.orcid_url}
                  onChange={e => update('orcid_url', e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-web" className="text-xs text-muted-foreground">Website personal</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="pp-web"
                  className="pl-10"
                  placeholder="https://..."
                  value={settings.website_url}
                  onChange={e => update('website_url', e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Visibility Toggles */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Vizibilitate pe profilul public</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: 'show_email' as const, label: 'Afișează email-ul' },
              { key: 'show_phone' as const, label: 'Afișează telefonul' },
              { key: 'show_department' as const, label: 'Afișează departamentul' },
              { key: 'show_position' as const, label: 'Afișează funcția' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                <span className="text-sm">{item.label}</span>
                <Switch
                  checked={settings[item.key] as boolean}
                  onCheckedChange={v => update(item.key, v)}
                />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} variant="hero">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {saving ? 'Se salvează...' : 'Salvează profilul public'}
        </Button>
      </CardContent>
    </Card>
  );
}

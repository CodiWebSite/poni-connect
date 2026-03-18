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
  QrCode, ExternalLink, Instagram, Facebook, Linkedin, Twitter
} from 'lucide-react';

interface PublicProfileEditorProps {
  epdId: string;
  employeeName: string;
}

interface ProfileSettings {
  bio: string;
  bio_en: string;
  tagline: string;
  tagline_en: string;
  position_en: string;
  department_en: string;
  phone: string;
  researchgate_url: string;
  google_scholar_url: string;
  orcid_url: string;
  website_url: string;
  instagram_url: string;
  facebook_url: string;
  linkedin_url: string;
  x_url: string;
  show_phone: boolean;
  show_email: boolean;
  show_department: boolean;
  show_position: boolean;
}

const defaultSettings: ProfileSettings = {
  bio: '',
  bio_en: '',
  tagline: '',
  tagline_en: '',
  position_en: '',
  department_en: '',
  phone: '',
  researchgate_url: '',
  google_scholar_url: '',
  orcid_url: '',
  website_url: '',
  instagram_url: '',
  facebook_url: '',
  linkedin_url: '',
  x_url: '',
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
          bio_en: (data as any).bio_en || '',
          tagline: data.tagline || '',
          tagline_en: (data as any).tagline_en || '',
          position_en: (data as any).position_en || '',
          department_en: (data as any).department_en || '',
          phone: data.phone || '',
          researchgate_url: data.researchgate_url || '',
          google_scholar_url: data.google_scholar_url || '',
          orcid_url: data.orcid_url || '',
          website_url: data.website_url || '',
          instagram_url: (data as any).instagram_url || '',
          facebook_url: (data as any).facebook_url || '',
          linkedin_url: (data as any).linkedin_url || '',
          x_url: (data as any).x_url || '',
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
      bio_en: settings.bio_en || null,
      tagline: settings.tagline || null,
      tagline_en: settings.tagline_en || null,
      position_en: settings.position_en || null,
      department_en: settings.department_en || null,
      phone: settings.phone || null,
      researchgate_url: settings.researchgate_url || null,
      google_scholar_url: settings.google_scholar_url || null,
      orcid_url: settings.orcid_url || null,
      website_url: settings.website_url || null,
      instagram_url: settings.instagram_url || null,
      facebook_url: settings.facebook_url || null,
      linkedin_url: settings.linkedin_url || null,
      x_url: settings.x_url || null,
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

        {/* Bio & Tagline — Română */}
        <div className="space-y-4">
          <p className="text-sm font-semibold flex items-center gap-2">🇷🇴 Versiunea în Română</p>
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

        {/* Bio & Tagline — English */}
        <div className="space-y-4">
          <p className="text-sm font-semibold flex items-center gap-2">🇬🇧 English Version</p>
          <div className="space-y-2">
            <Label htmlFor="pp-tagline-en">Professional Title / Tagline</Label>
            <Input
              id="pp-tagline-en"
              placeholder="e.g. Research Scientist, Macromolecular Chemistry"
              value={settings.tagline_en}
              onChange={e => update('tagline_en', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pp-bio-en">About me (bio)</Label>
            <Textarea
              id="pp-bio-en"
              placeholder="Write a short professional description..."
              className="min-h-[80px]"
              value={settings.bio_en}
              onChange={e => update('bio_en', e.target.value)}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pp-position-en">Position (English)</Label>
              <Input
                id="pp-position-en"
                placeholder="e.g. Senior Researcher"
                value={settings.position_en}
                onChange={e => update('position_en', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pp-dept-en">Department (English)</Label>
              <Input
                id="pp-dept-en"
                placeholder="e.g. Polymer Physics"
                value={settings.department_en}
                onChange={e => update('department_en', e.target.value)}
              />
            </div>
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
                <Input id="pp-rg" className="pl-10" placeholder="https://researchgate.net/profile/..." value={settings.researchgate_url} onChange={e => update('researchgate_url', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-gs" className="text-xs text-muted-foreground">Google Scholar</Label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="pp-gs" className="pl-10" placeholder="https://scholar.google.com/..." value={settings.google_scholar_url} onChange={e => update('google_scholar_url', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-orcid" className="text-xs text-muted-foreground">ORCID</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="pp-orcid" className="pl-10" placeholder="https://orcid.org/0000-..." value={settings.orcid_url} onChange={e => update('orcid_url', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-web" className="text-xs text-muted-foreground">Website personal</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="pp-web" className="pl-10" placeholder="https://..." value={settings.website_url} onChange={e => update('website_url', e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold">Rețele sociale</Label>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="pp-linkedin" className="text-xs text-muted-foreground">LinkedIn</Label>
              <div className="relative">
                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="pp-linkedin" className="pl-10" placeholder="https://linkedin.com/in/..." value={settings.linkedin_url} onChange={e => update('linkedin_url', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-facebook" className="text-xs text-muted-foreground">Facebook</Label>
              <div className="relative">
                <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="pp-facebook" className="pl-10" placeholder="https://facebook.com/..." value={settings.facebook_url} onChange={e => update('facebook_url', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-instagram" className="text-xs text-muted-foreground">Instagram</Label>
              <div className="relative">
                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="pp-instagram" className="pl-10" placeholder="https://instagram.com/..." value={settings.instagram_url} onChange={e => update('instagram_url', e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pp-x" className="text-xs text-muted-foreground">X (Twitter)</Label>
              <div className="relative">
                <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="pp-x" className="pl-10" placeholder="https://x.com/..." value={settings.x_url} onChange={e => update('x_url', e.target.value)} />
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

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { Mail, Phone, MapPin, Globe, BookOpen, GraduationCap, ExternalLink, Instagram, Facebook, Linkedin, Twitter } from 'lucide-react';

interface ProfileData {
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  email: string;
  avatar_url: string | null;
  settings: {
    phone: string | null;
    bio: string | null;
    tagline: string | null;
    researchgate_url: string | null;
    google_scholar_url: string | null;
    orcid_url: string | null;
    website_url: string | null;
    instagram_url: string | null;
    facebook_url: string | null;
    linkedin_url: string | null;
    x_url: string | null;
    show_phone: boolean;
    show_email: boolean;
    show_department: boolean;
    show_position: boolean;
  } | null;
}

const PublicProfile = () => {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) { setError(true); setLoading(false); return; }

      // Fetch employee data from the public view
      const { data: empData, error: empError } = await supabase
        .from('employee_directory_full')
        .select('first_name, last_name, department, position, email, avatar_url')
        .eq('id', id)
        .maybeSingle();

      if (empError || !empData) {
        setError(true);
        setLoading(false);
        return;
      }

      // Fetch public profile settings
      const { data: settingsData } = await supabase
        .from('public_profile_settings')
        .select('*')
        .eq('epd_id', id)
        .maybeSingle();

      setProfile({
        ...empData,
        settings: settingsData ? {
          phone: settingsData.phone,
          bio: settingsData.bio,
          tagline: settingsData.tagline,
          researchgate_url: settingsData.researchgate_url,
          google_scholar_url: settingsData.google_scholar_url,
          orcid_url: settingsData.orcid_url,
          website_url: settingsData.website_url,
          instagram_url: (settingsData as any).instagram_url,
          facebook_url: (settingsData as any).facebook_url,
          linkedin_url: (settingsData as any).linkedin_url,
          x_url: (settingsData as any).x_url,
          show_phone: settingsData.show_phone,
          show_email: settingsData.show_email,
          show_department: settingsData.show_department,
          show_position: settingsData.show_position,
        } : null,
      });
      setLoading(false);
    };

    fetchProfile();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#003366] to-[#001a33] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#003366] to-[#001a33] flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">🔍</span>
          </div>
          <h1 className="text-2xl font-bold">Profil negăsit</h1>
          <p className="text-white/60">Acest profil nu există sau a fost dezactivat.</p>
        </div>
      </div>
    );
  }

  const s = profile.settings;
  const showEmail = s ? s.show_email : true;
  const showPhone = s ? s.show_phone : true;
  const showDept = s ? s.show_department : true;
  const showPos = s ? s.show_position : true;
  const fullName = `${profile.last_name} ${profile.first_name}`.toUpperCase();
  const currentUrl = window.location.href;

  const academicLinks = [
    { url: s?.researchgate_url, label: 'ResearchGate', icon: BookOpen },
    { url: s?.google_scholar_url, label: 'Google Scholar', icon: GraduationCap },
    { url: s?.orcid_url, label: 'ORCID', icon: ExternalLink },
    { url: s?.website_url, label: 'Website', icon: Globe },
  ].filter(l => l.url);

  const socialLinks = [
    { url: s?.linkedin_url, label: 'LinkedIn', icon: Linkedin },
    { url: s?.facebook_url, label: 'Facebook', icon: Facebook },
    { url: s?.instagram_url, label: 'Instagram', icon: Instagram },
    { url: s?.x_url, label: 'X (Twitter)', icon: Twitter },
  ].filter(l => l.url);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003366] via-[#002244] to-[#001a33]">
      {/* Header bar */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/logo-icmpp.png" alt="ICMPP" className="h-10 w-auto brightness-0 invert opacity-90" />
          <div>
            <p className="text-white/90 text-sm font-semibold leading-tight">Institutul de Chimie Macromoleculară</p>
            <p className="text-white/50 text-xs">"Petru Poni" Iași</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
        {/* Avatar + Name */}
        <div className="text-center space-y-4">
          <div className="relative inline-block">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={fullName}
                className="w-28 h-28 rounded-full object-cover border-4 border-white/20 shadow-2xl"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-white/10 border-4 border-white/20 flex items-center justify-center shadow-2xl">
                <span className="text-4xl text-white/60 font-bold">
                  {profile.last_name[0]}{profile.first_name[0]}
                </span>
              </div>
            )}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide">{fullName}</h1>
            {showPos && profile.position && (
              <p className="text-blue-200/80 text-sm mt-1 italic">{profile.position}</p>
            )}
            {showDept && profile.department && (
              <p className="text-white/50 text-sm">{profile.department}</p>
            )}
            {s?.tagline && (
              <p className="text-white/40 text-xs mt-2">{s.tagline}</p>
            )}
          </div>
        </div>

        {/* Bio */}
        {s?.bio && (
          <div className="bg-white/5 rounded-2xl p-5 border border-white/10">
            <p className="text-white/70 text-sm leading-relaxed">{s.bio}</p>
          </div>
        )}

        {/* Contact Info */}
        <div className="space-y-3">
          {showEmail && (
            <a href={`mailto:${profile.email}`} 
               className="flex items-center gap-4 bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 transition-colors group">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-blue-300" />
              </div>
              <div className="min-w-0">
                <p className="text-white/40 text-xs">Email</p>
                <p className="text-white text-sm truncate group-hover:text-blue-200 transition-colors">{profile.email}</p>
              </div>
            </a>
          )}

          {showPhone && s?.phone && (
            <a href={`tel:${s.phone}`}
               className="flex items-center gap-4 bg-white/5 hover:bg-white/10 rounded-xl p-4 border border-white/10 transition-colors group">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5 text-green-300" />
              </div>
              <div>
                <p className="text-white/40 text-xs">Telefon</p>
                <p className="text-white text-sm group-hover:text-green-200 transition-colors">{s.phone}</p>
              </div>
            </a>
          )}

          <div className="flex items-center gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-orange-300" />
            </div>
            <div>
              <p className="text-white/40 text-xs">Locație</p>
              <p className="text-white text-sm">ICMPP — Iași, România</p>
            </div>
          </div>
        </div>

        {/* Academic Links */}
        {academicLinks.length > 0 && (
          <div className="space-y-3">
            <p className="text-white/30 text-xs uppercase tracking-widest font-medium">Prezență Academică</p>
            <div className="grid grid-cols-2 gap-3">
              {academicLinks.map((link) => (
                <a key={link.label} href={link.url!} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl p-3 border border-white/10 transition-colors">
                  <link.icon className="w-4 h-4 text-white/50" />
                  <span className="text-white/80 text-sm">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Social Media Links */}
        {socialLinks.length > 0 && (
          <div className="space-y-3">
            <p className="text-white/30 text-xs uppercase tracking-widest font-medium">Rețele Sociale</p>
            <div className="grid grid-cols-2 gap-3">
              {socialLinks.map((link) => (
                <a key={link.label} href={link.url!} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-2 bg-white/5 hover:bg-white/10 rounded-xl p-3 border border-white/10 transition-colors">
                  <link.icon className="w-4 h-4 text-white/50" />
                  <span className="text-white/80 text-sm">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* QR Code — share this profile */}
        <div className="flex justify-center pt-4">
          <div className="bg-white rounded-2xl p-4 shadow-2xl">
            <QRCodeSVG value={currentUrl} size={120} level="M" />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <p className="text-white/20 text-xs">icmpp.ro • Profil profesional</p>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;

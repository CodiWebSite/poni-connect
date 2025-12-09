import { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Mail, Phone, Building2, Users } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  avatar_url: string | null;
  user_id: string;
}

const Employees = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (data) {
      setProfiles(data);
    }
    setIsLoading(false);
  };

  const filteredProfiles = profiles.filter((profile) =>
    profile.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    profile.position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <MainLayout title="Director Angajați" description="Echipa ICMPP">
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Caută după nume, departament..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-5 border border-border animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-muted" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="bg-card rounded-xl p-12 border border-border text-center">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nu s-au găsit angajați</h3>
          <p className="text-muted-foreground">
            {searchQuery ? 'Încercați o altă căutare' : 'Angajații vor apărea aici după înregistrare'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProfiles.map((profile) => (
            <div
              key={profile.id}
              className="bg-card rounded-xl p-5 border border-border hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <Avatar className="w-14 h-14 border-2 border-primary/20">
                  <AvatarImage src={profile.avatar_url || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{profile.full_name}</h3>
                  {profile.position && (
                    <p className="text-sm text-muted-foreground truncate">{profile.position}</p>
                  )}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-border space-y-2">
                {profile.department && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building2 className="w-4 h-4" />
                    <span className="truncate">{profile.department}</span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="w-4 h-4" />
                    <span>{profile.phone}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </MainLayout>
  );
};

export default Employees;

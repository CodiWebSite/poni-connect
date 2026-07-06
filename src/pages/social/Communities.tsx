import { useEffect, useState, useCallback } from 'react';
import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Globe, Lock, Trash2, Archive } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import CreateCommunityDialog from '@/components/social/CreateCommunityDialog';

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: 'public' | 'private';
  is_archived: boolean;
  created_by: string | null;
  member_count: number;
  is_member: boolean;
  avatar_url: string | null;
}

const Communities = () => {
  const { canManageHR, isSuperAdmin } = useUserRole();
  const canCreate = canManageHR || isSuperAdmin;
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;
    setCurrentUserId(uid);

    const [communitiesRes, membershipsRes, countsRes] = await Promise.all([
      supabase
        .from('communities')
        .select('id, name, slug, description, visibility, is_archived, created_by, avatar_url')
        .order('created_at', { ascending: false }),
      uid
        ? supabase.from('community_members').select('community_id').eq('user_id', uid)
        : Promise.resolve({ data: [] as { community_id: string }[] } as any),
      supabase.from('community_members').select('community_id'),
    ]);

    const communities = communitiesRes.data;
    const memberships = (membershipsRes as any).data ?? [];
    const counts = countsRes.data ?? [];

    const memberSet = new Set((memberships as any[]).map((m) => m.community_id));
    const countMap = new Map<string, number>();
    (counts ?? []).forEach((r: any) => {
      countMap.set(r.community_id, (countMap.get(r.community_id) ?? 0) + 1);
    });

    // Sign avatar URLs in bulk
    const paths = (communities ?? [])
      .map((c: any) => c.avatar_url)
      .filter((p: string | null): p is string => !!p);
    const signedMap = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from('community-avatars')
        .createSignedUrls(paths, 60 * 60 * 24);
      (signed ?? []).forEach((r: any) => r.signedUrl && signedMap.set(r.path, r.signedUrl));
    }

    setItems(
      (communities ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        visibility: c.visibility,
        is_archived: c.is_archived,
        created_by: c.created_by,
        member_count: countMap.get(c.id) ?? 0,
        is_member: memberSet.has(c.id),
        avatar_url: c.avatar_url ? signedMap.get(c.avatar_url) ?? null : null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const q = search.trim().toLowerCase();
  const matches = (c: Community) =>
    !q || c.name.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);

  const active = items.filter((c) => !c.is_archived && matches(c));
  const archived = items.filter((c) => c.is_archived && matches(c));
  const mine = active.filter((c) => c.is_member);
  const others = active.filter((c) => !c.is_member);

  const handleDelete = async (id: string) => {
    if (!confirm('Sigur ștergi această comunitate?')) return;
    const { error } = await supabase.from('communities').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Comunitate ștearsă');
      load();
    }
  };

  const handleArchive = async (id: string, archive: boolean) => {
    const { error } = await supabase
      .from('communities')
      .update({ is_archived: archive })
      .eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(archive ? 'Comunitate arhivată' : 'Comunitate restaurată');
      load();
    }
  };

  return (
    <SocialLayout title="Comunități" description="Spații tematice de colaborare">
      <Tabs defaultValue="active" className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 gap-6">
            <TabsTrigger
              value="active"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 pb-2"
            >
              Comunități active
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-primary border-b-2 border-transparent rounded-none px-0 pb-2"
            >
              Comunități arhivate
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Caută"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64 rounded-xl"
              />
            </div>
            <Button
              className="rounded-xl"
              disabled={!canCreate}
              onClick={() => setDialogOpen(true)}
              title={canCreate ? '' : 'Doar admin / HR pot crea comunități'}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Creează comunitate
            </Button>
          </div>
        </div>

        <TabsContent value="active" className="space-y-8 mt-0">
          {loading ? (
            <p className="text-sm text-muted-foreground">Se încarcă…</p>
          ) : (
            <>
              <section>
                <h2 className="font-display font-bold text-xl mb-4">
                  Comunitățile tale ({mine.length})
                </h2>
                {mine.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nu faci parte din nicio comunitate încă.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mine.map((c) => (
                      <CommunityCard
                        key={c.id}
                        c={c}
                        canManage={canCreate || c.created_by === currentUserId}
                        onDelete={() => handleDelete(c.id)}
                        onArchive={() => handleArchive(c.id, true)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section>
                <h2 className="font-display font-bold text-xl mb-4">
                  Alte comunități ({others.length})
                </h2>
                {others.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nu există alte comunități disponibile.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {others.map((c) => (
                      <CommunityCard
                        key={c.id}
                        c={c}
                        canManage={canCreate || c.created_by === currentUserId}
                        onDelete={() => handleDelete(c.id)}
                        onArchive={() => handleArchive(c.id, true)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-0">
          {archived.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nicio comunitate arhivată.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {archived.map((c) => (
                <CommunityCard
                  key={c.id}
                  c={c}
                  canManage={canCreate || c.created_by === currentUserId}
                  onDelete={() => handleDelete(c.id)}
                  onArchive={() => handleArchive(c.id, false)}
                  archivedView
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <CreateCommunityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={load}
      />
    </SocialLayout>
  );
};

interface CardProps {
  c: Community;
  canManage: boolean;
  onDelete: () => void;
  onArchive: () => void;
  archivedView?: boolean;
}

const CommunityCard = ({ c, canManage, onDelete, onArchive, archivedView }: CardProps) => {
  const initials = c.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Card className="p-5 rounded-2xl border-border hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between mb-3 gap-2">
        <h3 className="font-bold text-lg leading-tight">{c.name}</h3>
        <Badge variant="secondary" className="rounded-full font-normal shrink-0">
          {c.visibility === 'public' ? (
            <>
              <Globe className="w-3 h-3 mr-1" /> Public
            </>
          ) : (
            <>
              <Lock className="w-3 h-3 mr-1" /> Privat
            </>
          )}
        </Badge>
      </div>
      {c.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{c.description}</p>
      )}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
          {initials || 'C'}
        </div>
        <span className="text-xs text-muted-foreground">
          {c.member_count} {c.member_count === 1 ? 'membru' : 'membri'}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link to={`/social/comunitati/${c.slug}`} className="flex-1">
          <Button className="w-full rounded-xl" size="sm">
            Vezi comunitatea
          </Button>
        </Link>
        {canManage && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground rounded-xl"
              onClick={onArchive}
              title={archivedView ? 'Restaurează' : 'Arhivează'}
            >
              <Archive className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive rounded-xl"
              onClick={onDelete}
              title="Șterge"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
};

export default Communities;

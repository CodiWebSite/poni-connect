import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ArrowLeft,
  Globe,
  Lock,
  UserPlus,
  Search,
  LogOut,
  X,
  Camera,
  Pencil,
  Check,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  UserMinus,
  Clock,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import PostFeed from '@/components/social/PostFeed';

interface Community {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  visibility: 'public' | 'private';
  created_by: string | null;
  avatar_url: string | null;
}

interface JoinRequest {
  id: string;
  user_id: string;
  message: string | null;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface Member {
  user_id: string;
  role: 'admin' | 'member' | 'moderator';
  full_name: string | null;
  avatar_url: string | null;
}

interface DirectoryUser {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const BUCKET = 'community-avatars';

const CommunityDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const { canManageHR, isSuperAdmin } = useUserRole();

  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [myJoinRequestId, setMyJoinRequestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [allProfiles, setAllProfiles] = useState<DirectoryUser[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    const { data: c } = await supabase
      .from('communities')
      .select('id, name, slug, description, visibility, created_by, avatar_url')
      .eq('slug', slug)
      .maybeSingle();
    if (!c) {
      setLoading(false);
      return;
    }
    let avatarDisplay: string | null = null;
    if ((c as any).avatar_url) {
      const path = (c as any).avatar_url as string;
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24);
      avatarDisplay = signed?.signedUrl ?? null;
    }
    setCommunity({ ...(c as any), avatar_url: avatarDisplay } as Community);

    const { data: mems } = await supabase
      .from('community_members')
      .select('user_id, role')
      .eq('community_id', c.id);
    const ids = (mems ?? []).map((m: any) => m.user_id);
    let profs: any[] = [];
    if (ids.length) {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', ids);
      profs = data ?? [];
    }
    const profMap = new Map(profs.map((p) => [p.user_id, p]));
    setMembers(
      (mems ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: profMap.get(m.user_id)?.full_name ?? null,
        avatar_url: profMap.get(m.user_id)?.avatar_url ?? null,
      })),
    );
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .order('full_name');
      setAllProfiles((data ?? []) as DirectoryUser[]);
    })();
  }, []);

  useEffect(() => {
    const q = pickerQuery.trim().toLowerCase();
    const memberIds = new Set(members.map((m) => m.user_id));
    const filtered = allProfiles
      .filter((p) => !memberIds.has(p.user_id))
      .filter((p) => !q || (p.full_name || '').toLowerCase().includes(q))
      .slice(0, 30);
    setDirectory(filtered);
  }, [pickerQuery, allProfiles, members]);

  if (!loading && !community) {
    return (
      <SocialLayout title="Comunitate" description="Negăsită">
        <p className="text-sm text-muted-foreground">
          Comunitatea nu există sau nu ai acces.
        </p>
      </SocialLayout>
    );
  }
  if (!community) {
    return (
      <SocialLayout title="Comunitate" description="">
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      </SocialLayout>
    );
  }

  const myMembership = members.find((m) => m.user_id === user?.id);
  const isMember = !!myMembership;
  const isAdmin =
    myMembership?.role === 'admin' ||
    community.created_by === user?.id ||
    canManageHR ||
    isSuperAdmin;
  const canPost = isMember || canManageHR || isSuperAdmin;

  const addMember = async (uid: string) => {
    const { error } = await supabase
      .from('community_members')
      .insert({ community_id: community.id, user_id: uid, role: 'member' });
    if (error) return toast.error(error.message);
    toast.success('Membru adăugat');
    setPickerOpen(false);
    setPickerQuery('');
    load();
  };

  const removeMember = async (uid: string) => {
    if (!confirm('Elimini membrul?')) return;
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', community.id)
      .eq('user_id', uid);
    if (error) return toast.error(error.message);
    toast.success('Membru eliminat');
    load();
  };

  const changeRole = async (uid: string, role: 'admin' | 'member') => {
    const { error } = await supabase
      .from('community_members')
      .update({ role })
      .eq('community_id', community.id)
      .eq('user_id', uid);
    if (error) return toast.error(error.message);
    toast.success(role === 'admin' ? 'Promovat la admin' : 'Retras rolul de admin');
    load();
  };

  const joinCommunity = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('community_members')
      .insert({ community_id: community.id, user_id: user.id, role: 'member' });
    if (error) return toast.error(error.message);
    toast.success('Te-ai alăturat comunității');
    load();
  };

  const leaveCommunity = async () => {
    if (!user) return;
    if (!confirm('Părăsești comunitatea?')) return;
    const { error } = await supabase
      .from('community_members')
      .delete()
      .eq('community_id', community.id)
      .eq('user_id', user.id);
    if (error) return toast.error(error.message);
    toast.success('Ai părăsit comunitatea');
    load();
  };

  const saveName = async () => {
    const name = nameDraft.trim();
    if (!name) return;
    const { error } = await supabase
      .from('communities')
      .update({ name })
      .eq('id', community.id);
    if (error) return toast.error(error.message);
    toast.success('Nume actualizat');
    setEditingName(false);
    load();
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Maxim 5MB');
    setUploadingAvatar(true);
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${community.id}/avatar-${Date.now()}.${ext}`;
    const up = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (up.error) {
      setUploadingAvatar(false);
      return toast.error(up.error.message);
    }
    const { error } = await supabase
      .from('communities')
      .update({ avatar_url: path })
      .eq('id', community.id);
    setUploadingAvatar(false);
    if (error) return toast.error(error.message);
    toast.success('Poză actualizată');
    load();
  };

  const removeAvatar = async () => {
    const { error } = await supabase
      .from('communities')
      .update({ avatar_url: null })
      .eq('id', community.id);
    if (error) return toast.error(error.message);
    toast.success('Poză eliminată');
    load();
  };

  const filteredMembers = members.filter((m) =>
    !memberSearch.trim()
      ? true
      : (m.full_name || '').toLowerCase().includes(memberSearch.toLowerCase()),
  );

  const initials = community.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <SocialLayout title={community.name} description="Comunitate">
      <Link
        to="/social/comunitati"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Înapoi la comunități
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative group">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {community.avatar_url ? (
                    <img src={community.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg font-bold text-primary">{initials}</span>
                  )}
                </div>
                {isAdmin && (
                  <>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        if (f) uploadAvatar(f);
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingAvatar}
                      onClick={() => avatarInputRef.current?.click()}
                      title="Schimbă poza"
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow hover:opacity-90"
                    >
                      <Camera className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
              {editingName && isAdmin ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    className="h-9 rounded-xl"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveName();
                      if (e.key === 'Escape') setEditingName(false);
                    }}
                  />
                  <Button size="icon" className="h-9 w-9 rounded-xl" onClick={saveName}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-xl"
                    onClick={() => setEditingName(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className="font-display font-bold text-2xl truncate">{community.name}</h1>
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => {
                        setNameDraft(community.name);
                        setEditingName(true);
                      }}
                      title="Editează numele"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {isAdmin && community.avatar_url && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={removeAvatar}
                      title="Elimină poza"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!isMember && community.visibility === 'public' && (
                <Button onClick={joinCommunity} className="rounded-xl" size="sm">
                  <UserPlus className="w-4 h-4 mr-1.5" />
                  Alătură-te
                </Button>
              )}
              {isMember && !isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={leaveCommunity}
                  className="rounded-xl text-muted-foreground"
                >
                  <LogOut className="w-4 h-4 mr-1.5" />
                  Părăsește
                </Button>
              )}
            </div>
          </div>

          <PostFeed
            communityId={community.id}
            canPost={canPost}
            emptyHint={
              canPost
                ? 'Nicio postare încă. Începe conversația!'
                : community.visibility === 'private'
                  ? 'Doar membrii pot vedea postările din această comunitate.'
                  : 'Nicio postare încă.'
            }
          />
        </div>

        <div className="space-y-4">
          <Card className="p-5 rounded-2xl border-border">
            <h3 className="font-bold text-lg mb-3">Despre</h3>
            <div className="flex items-center gap-2 mb-3">
              <Badge variant="secondary" className="rounded-full font-normal">
                {community.visibility === 'public' ? (
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
            {community.description && (
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                {community.description}
              </p>
            )}

            <div className="flex items-center justify-between mb-3 mt-4">
              <p className="font-semibold text-sm">Membri ({members.length})</p>
              {isAdmin && (
                <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-7 px-2 rounded-lg">
                      <UserPlus className="w-3.5 h-3.5 mr-1" />
                      Adaugă
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-72 p-2">
                    <div className="relative mb-2">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={pickerQuery}
                        onChange={(e) => setPickerQuery(e.target.value)}
                        placeholder="Caută coleg"
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                    <div className="max-h-72 overflow-y-auto space-y-0.5">
                      {directory.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">
                          Niciun rezultat
                        </p>
                      ) : (
                        directory.map((d) => (
                          <button
                            key={d.user_id}
                            onClick={() => addMember(d.user_id)}
                            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted text-left"
                          >
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                              {d.avatar_url ? (
                                <img
                                  src={d.avatar_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[10px] font-semibold text-primary">
                                  {(d.full_name || '?').substring(0, 2).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <span className="text-xs truncate">{d.full_name || 'Coleg'}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            <div className="relative mb-3">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Caută membru"
                className="pl-9 rounded-xl"
              />
            </div>

            <div className="space-y-1 max-h-96 overflow-y-auto">
              {filteredMembers.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {m.avatar_url ? (
                      <img
                        src={m.avatar_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-primary">
                        {(m.full_name || '?').substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">
                        {m.full_name || 'Coleg'}
                      </p>
                      {m.role === 'admin' && (
                        <Badge className="text-[9px] px-1.5 py-0 h-4 rounded-full">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </div>
                  {isAdmin && m.user_id !== user?.id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {m.role === 'member' ? (
                          <DropdownMenuItem onClick={() => changeRole(m.user_id, 'admin')}>
                            <ShieldCheck className="w-3.5 h-3.5 mr-2" />
                            Promovează la admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => changeRole(m.user_id, 'member')}>
                            <ShieldOff className="w-3.5 h-3.5 mr-2" />
                            Retrage admin
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => removeMember(m.user_id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <UserMinus className="w-3.5 h-3.5 mr-2" />
                          Elimină din comunitate
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </SocialLayout>
  );
};

export default CommunityDetail;

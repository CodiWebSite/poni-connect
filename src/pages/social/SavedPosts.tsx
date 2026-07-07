import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SocialLayout from '@/components/layout/SocialLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bookmark, Info, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { RichText } from '@/components/social/RichText';

interface Row {
  post_id: string;
  content: string;
  created_at: string;
  author_id: string;
  community_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  community_slug: string | null;
  community_name: string | null;
}

const SavedPosts = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data: bms } = await supabase
      .from('social_post_bookmarks')
      .select('post_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    const ids = (bms ?? []).map((r: any) => r.post_id);
    if (!ids.length) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data: posts } = await supabase
      .from('social_posts')
      .select('id, author_id, community_id, content, created_at')
      .in('id', ids);
    const authorIds = Array.from(new Set((posts ?? []).map((p: any) => p.author_id)));
    const commIds = Array.from(
      new Set((posts ?? []).map((p: any) => p.community_id).filter(Boolean)),
    );
    const [profRes, commRes] = await Promise.all([
      authorIds.length
        ? supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', authorIds)
        : Promise.resolve({ data: [] as any[] }),
      commIds.length
        ? supabase.from('communities').select('id, slug, name').in('id', commIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const pmap = new Map<string, any>();
    (profRes.data ?? []).forEach((p: any) => pmap.set(p.user_id, p));
    const cmap = new Map<string, any>();
    (commRes.data ?? []).forEach((c: any) => cmap.set(c.id, c));
    const postMap = new Map<string, any>();
    (posts ?? []).forEach((p: any) => postMap.set(p.id, p));

    const combined: Row[] = ids
      .map((id) => {
        const p = postMap.get(id);
        if (!p) return null;
        const author = pmap.get(p.author_id);
        const comm = p.community_id ? cmap.get(p.community_id) : null;
        return {
          post_id: p.id,
          content: p.content,
          created_at: p.created_at,
          author_id: p.author_id,
          community_id: p.community_id,
          author_name: author?.full_name ?? null,
          author_avatar: author?.avatar_url ?? null,
          community_slug: comm?.slug ?? null,
          community_name: comm?.name ?? null,
        } as Row;
      })
      .filter(Boolean) as Row[];
    setRows(combined);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (postId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('social_post_bookmarks')
      .delete()
      .eq('user_id', user.id)
      .eq('post_id', postId);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.post_id !== postId));
  };

  return (
    <SocialLayout title="Salvate" description="Postările tale salvate">
      {loading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col items-center justify-center text-center border border-border bg-card rounded-2xl py-16 px-8">
          <div className="w-10 h-10 rounded-full border-2 border-primary/40 flex items-center justify-center mb-3">
            <Bookmark className="w-5 h-5 text-primary/60" />
          </div>
          <p className="text-sm text-muted-foreground">
            Nu ai postări salvate. Apasă pe pictograma <Bookmark className="w-3 h-3 inline" /> de sub o postare pentru a o salva.
          </p>
        </Card>
      ) : (
        <div className="space-y-3 max-w-3xl">
          {rows.map((r) => (
            <Card key={r.post_id} className="p-5 rounded-2xl border-border">
              <div className="flex items-start gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {r.author_avatar ? (
                    <img src={r.author_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-primary">
                      {(r.author_name || '?').substring(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{r.author_name || 'Coleg'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: ro })}
                    {r.community_slug && (
                      <>
                        {' · '}
                        <Link
                          to={`/social/comunitati/${r.community_slug}`}
                          className="text-primary hover:underline"
                        >
                          {r.community_name}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(r.post_id)}
                  title="Elimină din salvate"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {r.content && r.content !== '📎' && (
                <RichText content={r.content} className="text-sm leading-relaxed" />
              )}
            </Card>
          ))}
        </div>
      )}
    </SocialLayout>
  );
};

export default SavedPosts;

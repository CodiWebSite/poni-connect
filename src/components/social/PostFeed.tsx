import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Heart, MessageCircle, Send, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PostRow {
  id: string;
  author_id: string;
  community_id: string | null;
  content: string;
  like_count: number;
  comment_count: number;
  created_at: string;
}

interface ProfileMini {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface CommentRow {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

interface Props {
  communityId?: string | null;
  canPost?: boolean;
  emptyHint?: string;
}

const PostFeed = ({ communityId = null, canPost = true, emptyHint }: Props) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('social_posts')
      .select('id, author_id, community_id, content, like_count, comment_count, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (communityId === null) {
      query = query.is('community_id', null);
    } else {
      query = query.eq('community_id', communityId);
    }
    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as PostRow[];
    setPosts(rows);

    const authorIds = Array.from(new Set(rows.map((p) => p.author_id)));
    if (authorIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', authorIds);
      const map: Record<string, ProfileMini> = {};
      (profs ?? []).forEach((p: any) => (map[p.user_id] = p));
      setProfiles(map);
    }

    if (user && rows.length) {
      const { data: likes } = await supabase
        .from('social_post_likes')
        .select('post_id')
        .eq('user_id', user.id)
        .in('post_id', rows.map((p) => p.id));
      setLikedSet(new Set((likes ?? []).map((l: any) => l.post_id)));
    }
    setLoading(false);
  }, [communityId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const submitPost = async () => {
    if (!user || !draft.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from('social_posts').insert({
      author_id: user.id,
      community_id: communityId,
      content: draft.trim(),
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft('');
    toast.success('Postare publicată');
    load();
  };

  const toggleLike = async (post: PostRow) => {
    if (!user) return;
    const isLiked = likedSet.has(post.id);
    // optimistic
    setLikedSet((s) => {
      const n = new Set(s);
      isLiked ? n.delete(post.id) : n.add(post.id);
      return n;
    });
    setPosts((ps) =>
      ps.map((p) =>
        p.id === post.id ? { ...p, like_count: p.like_count + (isLiked ? -1 : 1) } : p,
      ),
    );
    if (isLiked) {
      await supabase
        .from('social_post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('social_post_likes')
        .insert({ post_id: post.id, user_id: user.id });
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Ștergi postarea?')) return;
    const { error } = await supabase.from('social_posts').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Postare ștearsă');
    load();
  };

  return (
    <div className="space-y-4">
      {canPost && user && (
        <Card className="p-4 rounded-2xl border-border">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ce vrei să împărtășești?"
            className="min-h-[80px] resize-none border-0 focus-visible:ring-0 px-0"
            maxLength={4000}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground">{draft.length}/4000</span>
            <Button
              size="sm"
              className="rounded-xl"
              disabled={!draft.trim() || submitting}
              onClick={submitPost}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Publică
            </Button>
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Se încarcă…</p>
      ) : posts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center text-center border border-border bg-card rounded-2xl py-16 px-8">
          <div className="w-10 h-10 rounded-full border-2 border-primary/40 flex items-center justify-center mb-3">
            <Info className="w-5 h-5 text-primary/60" />
          </div>
          <p className="text-sm text-muted-foreground">{emptyHint || 'Nicio postare încă.'}</p>
        </Card>
      ) : (
        posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            author={profiles[p.author_id]}
            liked={likedSet.has(p.id)}
            currentUserId={user?.id ?? null}
            onLike={() => toggleLike(p)}
            onDelete={() => deletePost(p.id)}
          />
        ))
      )}
    </div>
  );
};

interface CardProps {
  post: PostRow;
  author?: ProfileMini;
  liked: boolean;
  currentUserId: string | null;
  onLike: () => void;
  onDelete: () => void;
}

const PostCard = ({ post, author, liked, currentUserId, onLike, onDelete }: CardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentProfiles, setCommentProfiles] = useState<Record<string, ProfileMini>>({});
  const [draft, setDraft] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const name = author?.full_name || 'Coleg';
  const initials = name.substring(0, 2).toUpperCase();
  const canDelete = currentUserId === post.author_id;

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    const { data } = await supabase
      .from('social_post_comments')
      .select('id, post_id, author_id, content, created_at')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    const rows = (data ?? []) as CommentRow[];
    setComments(rows);
    const ids = Array.from(new Set(rows.map((c) => c.author_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .in('user_id', ids);
      const map: Record<string, ProfileMini> = {};
      (profs ?? []).forEach((p: any) => (map[p.user_id] = p));
      setCommentProfiles(map);
    }
    setLoadingComments(false);
  }, [post.id]);

  const toggle = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) loadComments();
  };

  const submitComment = async () => {
    if (!currentUserId || !draft.trim()) return;
    const { error } = await supabase.from('social_post_comments').insert({
      post_id: post.id,
      author_id: currentUserId,
      content: draft.trim(),
    });
    if (error) return toast.error(error.message);
    setDraft('');
    loadComments();
  };

  const deleteComment = async (id: string) => {
    const { error } = await supabase.from('social_post_comments').delete().eq('id', id);
    if (error) return toast.error(error.message);
    loadComments();
  };

  return (
    <Card className="p-5 rounded-2xl border-border">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
          {author?.avatar_url ? (
            <img src={author.avatar_url} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-semibold text-primary">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{name}</p>
          <p className="text-[11px] text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ro })}
          </p>
        </div>
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed mb-3">{post.content}</p>
      <div className="flex items-center gap-1 pt-2 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onLike}
          className={cn('rounded-xl gap-1.5', liked && 'text-rose-500')}
        >
          <Heart className={cn('w-4 h-4', liked && 'fill-current')} />
          {post.like_count > 0 && <span>{post.like_count}</span>}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggle} className="rounded-xl gap-1.5">
          <MessageCircle className="w-4 h-4" />
          {post.comment_count > 0 && <span>{post.comment_count}</span>}
        </Button>
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {loadingComments ? (
            <p className="text-xs text-muted-foreground">Se încarcă…</p>
          ) : (
            comments.map((c) => {
              const a = commentProfiles[c.author_id];
              const nm = a?.full_name || 'Coleg';
              const ini = nm.substring(0, 2).toUpperCase();
              return (
                <div key={c.id} className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {a?.avatar_url ? (
                      <img src={a.avatar_url} alt={nm} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[10px] font-semibold text-primary">{ini}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 bg-muted/50 rounded-xl px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">{nm}</p>
                      {c.author_id === currentUserId && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          Șterge
                        </button>
                      )}
                    </div>
                    <p className="text-xs whitespace-pre-wrap leading-relaxed">{c.content}</p>
                  </div>
                </div>
              );
            })
          )}
          {currentUserId && (
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Scrie un comentariu…"
                className="min-h-[40px] resize-none text-sm rounded-xl"
                maxLength={2000}
              />
              <Button
                size="sm"
                className="rounded-xl shrink-0"
                disabled={!draft.trim()}
                onClick={submitComment}
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default PostFeed;

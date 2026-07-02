import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  MessageCircle,
  Send,
  Trash2,
  Info,
  ImagePlus,
  Paperclip,
  X,
  FileText,
  Download,
  ThumbsUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ReactionType = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';

const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: 'like', emoji: '👍', label: 'Îmi place', color: 'text-blue-500' },
  { type: 'love', emoji: '❤️', label: 'Iubesc', color: 'text-rose-500' },
  { type: 'haha', emoji: '😂', label: 'Haha', color: 'text-amber-500' },
  { type: 'wow', emoji: '😮', label: 'Wow', color: 'text-amber-500' },
  { type: 'sad', emoji: '😢', label: 'Trist', color: 'text-amber-500' },
  { type: 'angry', emoji: '😡', label: 'Supărat', color: 'text-orange-600' },
];

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

interface Attachment {
  id: string;
  post_id: string;
  storage_path: string;
  url: string; // signed url (populated after fetch)
  mime_type: string;
  file_name: string;
  file_size: number;
  kind: 'image' | 'gif' | 'document';
}

interface DraftFile {
  file: File;
  preview?: string;
  kind: 'image' | 'gif' | 'document';
}

interface Props {
  communityId?: string | null;
  canPost?: boolean;
  emptyHint?: string;
}

const BUCKET = 'social-media';
const MAX_FILE_MB = 15;

async function signAttachments(atts: Omit<Attachment, 'url'>[]): Promise<Attachment[]> {
  if (!atts.length) return [];
  const paths = atts.map((a) => a.storage_path);
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 60 * 60 * 24);
  const map = new Map<string, string>();
  (data ?? []).forEach((r: any) => r.signedUrl && map.set(r.path, r.signedUrl));
  return atts.map((a) => ({ ...a, url: map.get(a.storage_path) || '' }));
}

const PostFeed = ({ communityId = null, canPost = true, emptyHint }: Props) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileMini>>({});
  const [myReactions, setMyReactions] = useState<Record<string, ReactionType>>({});
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [drafts, setDrafts] = useState<DraftFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('social_posts')
      .select('id, author_id, community_id, content, like_count, comment_count, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (communityId === null) query = query.is('community_id', null);
    else query = query.eq('community_id', communityId);

    const { data, error } = await query;
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as PostRow[];
    setPosts(rows);

    const postIds = rows.map((p) => p.id);
    const authorIds = Array.from(new Set(rows.map((p) => p.author_id)));

    const [profRes, reactRes, attRes] = await Promise.all([
      authorIds.length
        ? supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', authorIds)
        : Promise.resolve({ data: [] as any[] }),
      user && postIds.length
        ? supabase
            .from('social_post_likes')
            .select('post_id, reaction')
            .eq('user_id', user.id)
            .in('post_id', postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length
        ? supabase
            .from('social_post_attachments')
            .select('id, post_id, storage_path, mime_type, file_name, file_size, kind')
            .in('post_id', postIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const pmap: Record<string, ProfileMini> = {};
    (profRes.data ?? []).forEach((p: any) => (pmap[p.user_id] = p));
    setProfiles(pmap);

    const rmap: Record<string, ReactionType> = {};
    (reactRes.data ?? []).forEach((r: any) => (rmap[r.post_id] = r.reaction as ReactionType));
    setMyReactions(rmap);

    const signed = await signAttachments((attRes.data ?? []) as any[]);
    const amap: Record<string, Attachment[]> = {};
    signed.forEach((a) => {
      (amap[a.post_id] ||= []).push(a);
    });
    setAttachments(amap);

    setLoading(false);
  }, [communityId, user]);

  useEffect(() => {
    load();
  }, [load]);

  const addFiles = (files: FileList | null, docs = false) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 6);
    const newDrafts: DraftFile[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name}: peste ${MAX_FILE_MB}MB`);
        continue;
      }
      const isGif = f.type === 'image/gif';
      const isImage = f.type.startsWith('image/');
      newDrafts.push({
        file: f,
        preview: isImage ? URL.createObjectURL(f) : undefined,
        kind: isGif ? 'gif' : isImage ? 'image' : 'document',
      });
      if (docs && isImage) continue;
    }
    setDrafts((d) => [...d, ...newDrafts].slice(0, 6));
  };

  const removeDraft = (idx: number) => {
    setDrafts((d) => d.filter((_, i) => i !== idx));
  };

  const submitPost = async () => {
    if (!user || (!draft.trim() && drafts.length === 0)) return;
    setSubmitting(true);
    const { data: postRow, error } = await supabase
      .from('social_posts')
      .insert({
        author_id: user.id,
        community_id: communityId,
        content: draft.trim() || '📎',
      })
      .select('id')
      .single();

    if (error || !postRow) {
      setSubmitting(false);
      toast.error(error?.message ?? 'Eroare la publicare');
      return;
    }

    // Upload files
    for (const d of drafts) {
      const ext = d.file.name.split('.').pop() || 'bin';
      const path = `${user.id}/${postRow.id}/${crypto.randomUUID()}.${ext}`;
      const up = await supabase.storage.from(BUCKET).upload(path, d.file, {
        contentType: d.file.type || 'application/octet-stream',
      });
      if (up.error) {
        toast.error(`Upload eșuat: ${d.file.name}`);
        continue;
      }
      await supabase.from('social_post_attachments').insert({
        post_id: postRow.id,
        uploader_id: user.id,
        storage_path: path,
        url: '',
        mime_type: d.file.type || 'application/octet-stream',
        file_name: d.file.name,
        file_size: d.file.size,
        kind: d.kind,
      });
    }

    setDraft('');
    setDrafts([]);
    setSubmitting(false);
    toast.success('Postare publicată');
    load();
  };

  const setReaction = async (post: PostRow, reaction: ReactionType | null) => {
    if (!user) return;
    const current = myReactions[post.id];
    // optimistic
    setMyReactions((m) => {
      const n = { ...m };
      if (reaction) n[post.id] = reaction;
      else delete n[post.id];
      return n;
    });
    setPosts((ps) =>
      ps.map((p) =>
        p.id === post.id
          ? {
              ...p,
              like_count:
                p.like_count + (reaction && !current ? 1 : !reaction && current ? -1 : 0),
            }
          : p,
      ),
    );

    if (reaction === null) {
      await supabase.from('social_post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else if (current) {
      await supabase
        .from('social_post_likes')
        .update({ reaction })
        .eq('post_id', post.id)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('social_post_likes')
        .insert({ post_id: post.id, user_id: user.id, reaction });
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
          {drafts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {drafts.map((d, i) => (
                <div key={i} className="relative group">
                  {d.preview ? (
                    <img
                      src={d.preview}
                      className="w-20 h-20 object-cover rounded-lg border border-border"
                      alt={d.file.name}
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-lg border border-border bg-muted flex flex-col items-center justify-center p-1">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <span className="text-[9px] text-muted-foreground truncate w-full text-center mt-1">
                        {d.file.name}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => removeDraft(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <input
                ref={docInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files, true);
                  e.target.value = '';
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl gap-1.5 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <ImagePlus className="w-4 h-4" />
                <span className="hidden sm:inline">Foto/GIF</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl gap-1.5 text-muted-foreground"
                onClick={() => docInputRef.current?.click()}
                type="button"
              >
                <Paperclip className="w-4 h-4" />
                <span className="hidden sm:inline">Document</span>
              </Button>
              <span className="text-[11px] text-muted-foreground ml-2">{draft.length}/4000</span>
            </div>
            <Button
              size="sm"
              className="rounded-xl"
              disabled={(!draft.trim() && drafts.length === 0) || submitting}
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
            myReaction={myReactions[p.id] ?? null}
            attachments={attachments[p.id] ?? []}
            currentUserId={user?.id ?? null}
            onReact={(r) => setReaction(p, r)}
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
  myReaction: ReactionType | null;
  attachments: Attachment[];
  currentUserId: string | null;
  onReact: (r: ReactionType | null) => void;
  onDelete: () => void;
}

const PostCard = ({
  post,
  author,
  myReaction,
  attachments,
  currentUserId,
  onReact,
  onDelete,
}: CardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentProfiles, setCommentProfiles] = useState<Record<string, ProfileMini>>({});
  const [draft, setDraft] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const name = author?.full_name || 'Coleg';
  const initials = name.substring(0, 2).toUpperCase();
  const canDelete = currentUserId === post.author_id;
  const activeReaction = myReaction ? REACTIONS.find((r) => r.type === myReaction) : null;

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

  const images = attachments.filter((a) => a.kind === 'image' || a.kind === 'gif');
  const docs = attachments.filter((a) => a.kind === 'document');

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

      {post.content && post.content !== '📎' && (
        <p className="text-sm whitespace-pre-wrap leading-relaxed mb-3">{post.content}</p>
      )}

      {images.length > 0 && (
        <div
          className={cn(
            'grid gap-1.5 mb-3 rounded-xl overflow-hidden',
            images.length === 1 && 'grid-cols-1',
            images.length === 2 && 'grid-cols-2',
            images.length >= 3 && 'grid-cols-2',
          )}
        >
          {images.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-muted"
            >
              <img
                src={a.url}
                alt={a.file_name}
                className="w-full max-h-96 object-cover hover:opacity-90 transition"
                loading="lazy"
              />
            </a>
          ))}
        </div>
      )}

      {docs.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {docs.map((a) => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 border border-border rounded-xl hover:bg-muted/50 transition"
            >
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.file_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(a.file_size / 1024).toFixed(0)} KB
                </p>
              </div>
              <Download className="w-4 h-4 text-muted-foreground" />
            </a>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 pt-2 border-t border-border">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn('rounded-xl gap-1.5', activeReaction?.color)}
              onClick={(e) => {
                if (activeReaction) {
                  e.preventDefault();
                  onReact(null);
                }
              }}
            >
              {activeReaction ? (
                <>
                  <span className="text-base leading-none">{activeReaction.emoji}</span>
                  <span>{activeReaction.label}</span>
                </>
              ) : (
                <>
                  <ThumbsUp className="w-4 h-4" />
                  <span>Reacționează</span>
                </>
              )}
              {post.like_count > 0 && <span className="ml-1">· {post.like_count}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-1 w-auto rounded-full" side="top" align="start">
            <div className="flex items-center gap-0.5">
              {REACTIONS.map((r) => (
                <button
                  key={r.type}
                  onClick={() => onReact(r.type)}
                  title={r.label}
                  className="text-2xl p-1.5 hover:scale-125 transition-transform"
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button variant="ghost" size="sm" onClick={toggle} className="rounded-xl gap-1.5">
          <MessageCircle className="w-4 h-4" />
          Comentează
          {post.comment_count > 0 && <span>· {post.comment_count}</span>}
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    submitComment();
                  }
                }}
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

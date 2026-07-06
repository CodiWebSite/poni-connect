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
  Reply,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import RichTextComposer from './RichTextComposer';
import { RichText } from './RichText';
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
  parent_comment_id: string | null;
  content: string;
  reaction_count: number;
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
          <RichTextComposer
            value={draft}
            onChange={setDraft}
            placeholder="Ce vrei să împărtășești? (Ctrl+Enter pentru publicare)"
            maxLength={10000}
            minRows={4}
            onSubmitKey={submitPost}
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
              <span className="text-[11px] text-muted-foreground ml-2">{draft.length}/10000</span>
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
            onCommentDelta={(delta) =>
              setPosts((ps) =>
                ps.map((post) =>
                  post.id === p.id
                    ? { ...post, comment_count: Math.max(0, post.comment_count + delta) }
                    : post,
                ),
              )
            }
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
  onCommentDelta: (delta: number) => void;
}

const PostCard = ({
  post,
  author,
  myReaction,
  attachments,
  currentUserId,
  onReact,
  onDelete,
  onCommentDelta,
}: CardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentProfiles, setCommentProfiles] = useState<Record<string, ProfileMini>>({});
  const [commentReactions, setCommentReactions] = useState<Record<string, ReactionType>>({});
  const [replyingTo, setReplyingTo] = useState<CommentRow | null>(null);
  const [draft, setDraft] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const name = author?.full_name || 'Coleg';
  const initials = name.substring(0, 2).toUpperCase();
  const canDelete = currentUserId === post.author_id;
  const activeReaction = myReaction ? REACTIONS.find((r) => r.type === myReaction) : null;

  const loadComments = useCallback(async () => {
    setLoadingComments(true);
    const { data, error } = await supabase
      .from('social_post_comments')
      .select('id, post_id, author_id, parent_comment_id, content, reaction_count, created_at')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error(error.message);
      setLoadingComments(false);
      return;
    }
    const rows = (data ?? []) as CommentRow[];
    setComments(rows);
    const ids = Array.from(new Set(rows.map((c) => c.author_id)));
    const commentIds = rows.map((c) => c.id);
    const [profsRes, reactsRes] = await Promise.all([
      ids.length
        ? supabase.from('profiles').select('user_id, full_name, avatar_url').in('user_id', ids)
        : Promise.resolve({ data: [] as any[] }),
      currentUserId && commentIds.length
        ? supabase
            .from('social_comment_reactions')
            .select('comment_id, reaction')
            .eq('user_id', currentUserId)
            .in('comment_id', commentIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    if (ids.length) {
      const map: Record<string, ProfileMini> = {};
      ((profsRes as any).data ?? []).forEach((p: any) => (map[p.user_id] = p));
      setCommentProfiles(map);
    }

    const reactionMap: Record<string, ReactionType> = {};
    ((reactsRes as any).data ?? []).forEach((r: any) => {
      reactionMap[r.comment_id] = r.reaction as ReactionType;
    });
    setCommentReactions(reactionMap);
    setLoadingComments(false);
  }, [currentUserId, post.id]);

  const toggle = () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) loadComments();
  };

  const submitComment = async () => {
    if (!currentUserId || !draft.trim()) return;
    setSubmittingComment(true);
    const parentId = replyingTo?.parent_comment_id ?? replyingTo?.id ?? null;
    const { error } = await supabase.from('social_post_comments').insert({
      post_id: post.id,
      author_id: currentUserId,
      parent_comment_id: parentId,
      content: draft.trim(),
    });
    setSubmittingComment(false);
    if (error) return toast.error(error.message);
    setDraft('');
    setReplyingTo(null);
    onCommentDelta(1);
    loadComments();
  };

  const deleteComment = async (id: string) => {
    const deletedCount = 1 + comments.filter((c) => c.parent_comment_id === id).length;
    const { error } = await supabase.from('social_post_comments').delete().eq('id', id);
    if (error) return toast.error(error.message);
    onCommentDelta(-deletedCount);
    loadComments();
  };

  const setCommentReaction = async (comment: CommentRow, reaction: ReactionType | null) => {
    if (!currentUserId) return;
    const current = commentReactions[comment.id];
    setCommentReactions((m) => {
      const next = { ...m };
      if (reaction) next[comment.id] = reaction;
      else delete next[comment.id];
      return next;
    });
    setComments((cs) =>
      cs.map((c) =>
        c.id === comment.id
          ? {
              ...c,
              reaction_count: Math.max(
                0,
                c.reaction_count + (reaction && !current ? 1 : !reaction && current ? -1 : 0),
              ),
            }
          : c,
      ),
    );

    let error: any = null;
    if (reaction === null) {
      const res = await supabase
        .from('social_comment_reactions')
        .delete()
        .eq('comment_id', comment.id)
        .eq('user_id', currentUserId);
      error = res.error;
    } else if (current) {
      const res = await supabase
        .from('social_comment_reactions')
        .update({ reaction })
        .eq('comment_id', comment.id)
        .eq('user_id', currentUserId);
      error = res.error;
    } else {
      const res = await supabase.from('social_comment_reactions').insert({
        comment_id: comment.id,
        user_id: currentUserId,
        reaction,
      });
      error = res.error;
    }

    if (error) {
      toast.error(error.message);
      loadComments();
    }
  };

  const startReply = (comment: CommentRow) => {
    setReplyingTo(comment);
    setTimeout(() => commentInputRef.current?.focus(), 0);
  };

  const images = attachments.filter((a) => a.kind === 'image' || a.kind === 'gif');
  const docs = attachments.filter((a) => a.kind === 'document');
  const repliesByParent = comments.reduce<Record<string, CommentRow[]>>((acc, comment) => {
    if (comment.parent_comment_id) (acc[comment.parent_comment_id] ||= []).push(comment);
    return acc;
  }, {});
  const topLevelComments = comments.filter((comment) => !comment.parent_comment_id);

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
        <RichText content={post.content} className="text-sm leading-relaxed mb-3 space-y-1" />
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
          ) : topLevelComments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nu există comentarii încă.</p>
          ) : (
            topLevelComments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                profile={commentProfiles[c.author_id]}
                currentUserId={currentUserId}
                activeReaction={commentReactions[c.id] ?? null}
                replies={repliesByParent[c.id] ?? []}
                profiles={commentProfiles}
                reactions={commentReactions}
                onReact={setCommentReaction}
                onReply={startReply}
                onDelete={deleteComment}
              />
            ))
          )}
          {currentUserId && (
            <div className="space-y-2">
              {replyingTo && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    Răspunzi lui {commentProfiles[replyingTo.author_id]?.full_name || 'Coleg'}
                  </span>
                  <button onClick={() => setReplyingTo(null)} className="hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <Textarea
                  ref={commentInputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={replyingTo ? 'Scrie un răspuns…' : 'Scrie un comentariu…'}
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
                  disabled={!draft.trim() || submittingComment}
                  onClick={submitComment}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

interface CommentItemProps {
  comment: CommentRow;
  profile?: ProfileMini;
  currentUserId: string | null;
  activeReaction: ReactionType | null;
  replies: CommentRow[];
  profiles: Record<string, ProfileMini>;
  reactions: Record<string, ReactionType>;
  onReact: (comment: CommentRow, reaction: ReactionType | null) => void;
  onReply: (comment: CommentRow) => void;
  onDelete: (id: string) => void;
}

const CommentItem = ({
  comment,
  profile,
  currentUserId,
  activeReaction,
  replies,
  profiles,
  reactions,
  onReact,
  onReply,
  onDelete,
}: CommentItemProps) => {
  const name = profile?.full_name || 'Coleg';
  const initials = name.substring(0, 2).toUpperCase();
  const reaction = activeReaction ? REACTIONS.find((r) => r.type === activeReaction) : null;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] font-semibold text-primary">{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="bg-muted/50 rounded-xl px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">{name}</p>
              {comment.author_id === currentUserId && (
                <button
                  onClick={() => onDelete(comment.id)}
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                >
                  Șterge
                </button>
              )}
            </div>
            <RichText content={comment.content} className="text-xs leading-relaxed" />
          </div>
          <div className="flex items-center gap-2 px-1 pt-1 text-[11px] text-muted-foreground">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn('font-medium hover:text-foreground inline-flex items-center gap-1', reaction?.color)}
                  onClick={(e) => {
                    if (reaction) {
                      e.preventDefault();
                      onReact(comment, null);
                    }
                  }}
                >
                  {reaction ? <span>{reaction.emoji}</span> : <ThumbsUp className="w-3 h-3" />}
                  <span>{reaction ? reaction.label : 'Reacționează'}</span>
                  {comment.reaction_count > 0 && <span>· {comment.reaction_count}</span>}
                </button>
              </PopoverTrigger>
              <PopoverContent className="p-1 w-auto rounded-full" side="top" align="start">
                <div className="flex items-center gap-0.5">
                  {REACTIONS.map((r) => (
                    <button
                      key={r.type}
                      onClick={() => onReact(comment, r.type)}
                      title={r.label}
                      className="text-xl p-1.5 hover:scale-125 transition-transform"
                    >
                      {r.emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <button
              onClick={() => onReply(comment)}
              className="font-medium hover:text-foreground inline-flex items-center gap-1"
            >
              <Reply className="w-3 h-3" />
              Răspunde
            </button>
            <span>
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ro })}
            </span>
          </div>
        </div>
      </div>

      {replies.length > 0 && (
        <div className="ml-9 space-y-2 border-l border-border pl-3">
          {replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              profile={profiles[reply.author_id]}
              currentUserId={currentUserId}
              activeReaction={reactions[reply.id] ?? null}
              replies={[]}
              profiles={profiles}
              reactions={reactions}
              onReact={onReact}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default PostFeed;

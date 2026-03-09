import { useEffect, useState, useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import AnnouncementCard from '@/components/dashboard/AnnouncementCard';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { Plus, Megaphone, Paperclip, X, Link2, Loader2 } from 'lucide-react';

interface LinkItem {
  label: string;
  url: string;
}

interface AttachmentItem {
  name: string;
  url: string;
  type: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  is_pinned: boolean;
  created_at: string;
  author_id: string | null;
  attachments: AttachmentItem[];
  links: LinkItem[];
}

const Announcements = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { user } = useAuth();
  const { canManageContent, isSuperAdmin } = useUserRole();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isPublisher, setIsPublisher] = useState(false);

  const [formData, setFormData] = useState<{
    title: string;
    content: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    is_pinned: boolean;
    links: LinkItem[];
    attachments: AttachmentItem[];
  }>({
    title: '',
    content: '',
    priority: 'normal',
    is_pinned: false,
    links: [],
    attachments: [],
  });

  const [newLink, setNewLink] = useState({ label: '', url: '' });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('announcements')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setAnnouncements(data.map(a => ({
        ...a,
        priority: a.priority as any || 'normal',
        attachments: (a.attachments as any) || [],
        links: (a.links as any) || [],
      })));
    }
  };

  const resetForm = () => {
    setFormData({ title: '', content: '', priority: 'normal', is_pinned: false, links: [], attachments: [] });
    setNewLink({ label: '', url: '' });
    setEditingId(null);
  };

  const handleFileUpload = async (files: FileList) => {
    if (!files.length) return;
    setUploadingFiles(true);
    const newAttachments: AttachmentItem[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('announcement-attachments').upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from('announcement-attachments').getPublicUrl(path);
        newAttachments.push({ name: file.name, url: urlData.publicUrl, type: file.type });
      }
    }

    setFormData(prev => ({ ...prev, attachments: [...prev.attachments, ...newAttachments] }));
    setUploadingFiles(false);
  };

  const addLink = () => {
    if (!newLink.url) return;
    let url = newLink.url;
    if (!url.startsWith('http')) url = 'https://' + url;
    setFormData(prev => ({
      ...prev,
      links: [...prev.links, { label: newLink.label || url, url }],
    }));
    setNewLink({ label: '', url: '' });
  };

  const removeAttachment = (idx: number) => {
    setFormData(prev => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== idx) }));
  };

  const removeLink = (idx: number) => {
    setFormData(prev => ({ ...prev, links: prev.links.filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);

    const payload = {
      title: formData.title,
      content: formData.content,
      priority: formData.priority,
      is_pinned: formData.is_pinned,
      attachments: formData.attachments as any,
      links: formData.links as any,
    };

    if (editingId) {
      const { error } = await supabase.from('announcements').update(payload).eq('id', editingId);
      if (error) toast.error('Eroare la actualizare');
      else toast.success('Anunț actualizat');
    } else {
      const { error } = await supabase.from('announcements').insert({ ...payload, author_id: user.id });
      if (error) toast.error('Eroare la adăugare');
      else toast.success('Anunț adăugat cu succes');
    }

    setIsOpen(false);
    resetForm();
    fetchAnnouncements();
    setIsLoading(false);
  };

  const handleEdit = (a: Announcement) => {
    setEditingId(a.id);
    setFormData({
      title: a.title,
      content: a.content,
      priority: a.priority,
      is_pinned: a.is_pinned,
      links: a.links || [],
      attachments: a.attachments || [],
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) toast.error('Eroare la ștergere');
    else {
      toast.success('Anunț șters');
      fetchAnnouncements();
    }
  };

  const canEditDelete = (a: Announcement) => {
    return isSuperAdmin || (user && a.author_id === user.id);
  };

  return (
    <MainLayout title="Anunțuri" description="Comunicate și informații importante">
      {canManageContent && (
        <div className="flex justify-end mb-6">
          <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="w-4 h-4 mr-2" />
                Anunț nou
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editează anunț' : 'Adaugă anunț nou'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Titlu</Label>
                  <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="content">Conținut</Label>
                  <Textarea id="content" rows={4} value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Prioritate</Label>
                  <Select value={formData.priority} onValueChange={(v: any) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Scăzut</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Important</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Switch id="pinned" checked={formData.is_pinned} onCheckedChange={(c) => setFormData({ ...formData, is_pinned: c })} />
                  <Label htmlFor="pinned">Fixează anunțul</Label>
                </div>

                {/* Attachments */}
                <div className="space-y-2">
                  <Label>Atașamente</Label>
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files)} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingFiles}>
                    {uploadingFiles ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Paperclip className="w-4 h-4 mr-2" />}
                    {uploadingFiles ? 'Se încarcă...' : 'Adaugă fișiere'}
                  </Button>
                  {formData.attachments.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {formData.attachments.map((att, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                          <Paperclip className="w-3 h-3 text-muted-foreground" />
                          <span className="truncate flex-1">{att.name}</span>
                          <button type="button" onClick={() => removeAttachment(i)} className="text-destructive hover:text-destructive/80">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Links */}
                <div className="space-y-2">
                  <Label>Linkuri</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Etichetă (opțional)" value={newLink.label} onChange={(e) => setNewLink({ ...newLink, label: e.target.value })} className="flex-1" />
                    <Input placeholder="https://..." value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} className="flex-1" />
                    <Button type="button" variant="outline" size="icon" onClick={addLink} disabled={!newLink.url}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {formData.links.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {formData.links.map((link, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded px-2 py-1">
                          <Link2 className="w-3 h-3 text-muted-foreground" />
                          <span className="truncate flex-1">{link.label}</span>
                          <button type="button" onClick={() => removeLink(i)} className="text-destructive hover:text-destructive/80">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Se salvează...' : editingId ? 'Actualizează' : 'Salvează'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {announcements.length === 0 ? (
        <div className="bg-card rounded-xl p-12 border border-border text-center">
          <Megaphone className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nu există anunțuri</h3>
          <p className="text-muted-foreground">Creați primul anunț pentru echipă</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {announcements.map((announcement) => (
            <AnnouncementCard
              key={announcement.id}
              id={announcement.id}
              title={announcement.title}
              content={announcement.content}
              priority={announcement.priority}
              isPinned={announcement.is_pinned}
              createdAt={announcement.created_at}
              attachments={announcement.attachments}
              links={announcement.links}
              canEdit={canEditDelete(announcement)}
              onEdit={() => handleEdit(announcement)}
              onDelete={() => handleDelete(announcement.id)}
            />
          ))}
        </div>
      )}
    </MainLayout>
  );
};

export default Announcements;

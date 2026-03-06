import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Users, Pencil, Check, X, UserPlus, UserMinus, Shield } from 'lucide-react';
import { formatNumePrenume } from '@/utils/formatName';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Member {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
  participant_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  groupName: string;
  adminId: string | null;
  onNameUpdated: (name: string) => void;
}

const GroupInfoPanel = ({ open, onOpenChange, conversationId, groupName, adminId, onNameUpdated }: Props) => {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(groupName);
  const [showAddMember, setShowAddMember] = useState(false);
  const [allUsers, setAllUsers] = useState<{ user_id: string; full_name: string; avatar_url: string | null }[]>([]);
  const [addSearch, setAddSearch] = useState('');
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [removeMemberName, setRemoveMemberName] = useState('');

  const isAdmin = user?.id === adminId;

  const fetchMembers = useCallback(async () => {
    if (!conversationId) return;
    const { data: parts } = await supabase
      .from('chat_participants')
      .select('id, user_id')
      .eq('conversation_id', conversationId);

    if (!parts) return;

    const memberList: Member[] = [];
    for (const p of parts) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, department')
        .eq('user_id', p.user_id)
        .maybeSingle();

      memberList.push({
        user_id: p.user_id,
        full_name: profile ? formatNumePrenume({ fullName: profile.full_name }) : 'Utilizator',
        avatar_url: profile?.avatar_url || null,
        department: profile?.department || null,
        participant_id: p.id,
      });
    }

    // Sort: admin first, then alphabetical
    memberList.sort((a, b) => {
      if (a.user_id === adminId) return -1;
      if (b.user_id === adminId) return 1;
      return a.full_name.localeCompare(b.full_name, 'ro');
    });

    setMembers(memberList);
  }, [conversationId, adminId]);

  useEffect(() => {
    if (open) {
      fetchMembers();
      setEditing(false);
      setEditName(groupName);
      setShowAddMember(false);
    }
  }, [open, fetchMembers, groupName]);

  const handleSaveName = async () => {
    if (!editName.trim() || editName.trim() === groupName) {
      setEditing(false);
      return;
    }
    await supabase
      .from('chat_conversations')
      .update({ name: editName.trim() } as any)
      .eq('id', conversationId);
    onNameUpdated(editName.trim());
    setEditing(false);
    toast({ title: 'Nume actualizat', description: `Grupul se numește acum „${editName.trim()}".` });
  };

  const handleAddMember = async (userId: string) => {
    const { error } = await supabase
      .from('chat_participants')
      .insert({ conversation_id: conversationId, user_id: userId });

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut adăuga membrul.', variant: 'destructive' });
      return;
    }
    toast({ title: 'Membru adăugat' });
    fetchMembers();
    setShowAddMember(false);
    setAddSearch('');
  };

  const handleRemoveMember = async () => {
    if (!removeMemberId) return;
    const member = members.find(m => m.user_id === removeMemberId);
    if (!member) return;

    const { error } = await supabase
      .from('chat_participants')
      .delete()
      .eq('id', member.participant_id);

    if (error) {
      toast({ title: 'Eroare', description: 'Nu s-a putut elimina membrul.', variant: 'destructive' });
    } else {
      toast({ title: 'Membru eliminat', description: `${member.full_name} a fost eliminat din grup.` });
      fetchMembers();
    }
    setRemoveMemberId(null);
  };

  const fetchAllUsers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url')
      .neq('user_id', user.id)
      .order('full_name');

    setAllUsers((data || []).map(u => ({
      ...u,
      full_name: formatNumePrenume({ fullName: u.full_name }),
    })));
  }, [user]);

  useEffect(() => {
    if (showAddMember) fetchAllUsers();
  }, [showAddMember, fetchAllUsers]);

  const memberUserIds = new Set(members.map(m => m.user_id));
  const availableUsers = allUsers
    .filter(u => !memberUserIds.has(u.user_id))
    .filter(u => u.full_name.toLowerCase().includes(addSearch.toLowerCase()));

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[340px] sm:w-[380px] p-0 flex flex-col">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Informații grup
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-3">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="h-9 text-sm"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveName}>
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(false); setEditName(groupName); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground flex-1 truncate">{groupName}</h3>
                {isAdmin && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{members.length} membri</p>
          </div>

          <Separator />

          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Membri</span>
            {isAdmin && (
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowAddMember(true)}>
                <UserPlus className="h-3.5 w-3.5" />
                Adaugă
              </Button>
            )}
          </div>

          {showAddMember && (
            <div className="px-4 pb-2 space-y-2">
              <Input
                placeholder="Caută coleg..."
                value={addSearch}
                onChange={e => setAddSearch(e.target.value)}
                className="h-8 text-sm"
                autoFocus
              />
              <ScrollArea className="max-h-[160px]">
                <div className="space-y-0.5">
                  {availableUsers.map(u => (
                    <button
                      key={u.user_id}
                      onClick={() => handleAddMember(u.user_id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <Avatar className="h-6 w-6">
                        {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                        <AvatarFallback className="text-[9px]">{u.full_name.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs truncate flex-1">{u.full_name}</span>
                      <UserPlus className="h-3.5 w-3.5 text-primary" />
                    </button>
                  ))}
                  {availableUsers.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Niciun coleg disponibil</p>
                  )}
                </div>
              </ScrollArea>
              <Button size="sm" variant="ghost" className="w-full h-7 text-xs" onClick={() => { setShowAddMember(false); setAddSearch(''); }}>
                Închide
              </Button>
            </div>
          )}

          <ScrollArea className="flex-1 px-4">
            <div className="space-y-0.5 pb-4">
              {members.map(m => (
                <div key={m.user_id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Avatar className="h-8 w-8">
                    {m.avatar_url && <AvatarImage src={m.avatar_url} />}
                    <AvatarFallback className="text-xs">{m.full_name.substring(0, 2)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{m.full_name}</span>
                      {m.user_id === adminId && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 gap-0.5 border-primary/30 text-primary">
                          <Shield className="h-2.5 w-2.5" /> Admin
                        </Badge>
                      )}
                      {m.user_id === user?.id && (
                        <span className="text-[10px] text-muted-foreground">(Tu)</span>
                      )}
                    </div>
                    {m.department && (
                      <p className="text-[10px] text-muted-foreground truncate">{m.department}</p>
                    )}
                  </div>
                  {isAdmin && m.user_id !== user?.id && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => { setRemoveMemberId(m.user_id); setRemoveMemberName(m.full_name); }}
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!removeMemberId} onOpenChange={o => !o && setRemoveMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimină membru</AlertDialogTitle>
            <AlertDialogDescription>
              Sigur vrei să-l elimini pe <strong>{removeMemberName}</strong> din acest grup?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimină
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GroupInfoPanel;

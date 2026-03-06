import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Search, Users, X, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { formatNumePrenume } from '@/utils/formatName';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface UserItem {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (conversationId: string) => void;
}

const NewGroupDialog = ({ open, onOpenChange, onCreated }: Props) => {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !user) return;
    setSearch('');
    setGroupName('');
    setSelectedUsers(new Set());

    const fetchUsers = async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url, department')
        .neq('user_id', user.id)
        .order('full_name');

      const mapped = (profiles || []).map(u => ({
        ...u,
        full_name: formatNumePrenume({ fullName: u.full_name }),
      }));
      setUsers(mapped);
      setExpandedDepts(new Set(mapped.map(u => u.department || 'Fără departament')));
    };
    fetchUsers();
  }, [open, user]);

  const filtered = useMemo(() =>
    users.filter(u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (u.department || '').toLowerCase().includes(search.toLowerCase())
    ),
    [users, search]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, UserItem[]>();
    for (const u of filtered) {
      const dept = u.department || 'Fără departament';
      if (!map.has(dept)) map.set(dept, []);
      map.get(dept)!.push(u);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === 'Fără departament') return 1;
      if (b === 'Fără departament') return -1;
      return a.localeCompare(b, 'ro');
    });
  }, [filtered]);

  const toggleDept = (dept: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      if (next.has(dept)) next.delete(dept);
      else next.add(dept);
      return next;
    });
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const selectedUsersList = users.filter(u => selectedUsers.has(u.user_id));

  const handleCreate = async () => {
    if (!user || !groupName.trim() || selectedUsers.size < 1) return;
    setCreating(true);

    try {
      const { data: newConv, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          type: 'group',
          name: groupName.trim(),
          created_by: user.id,
          admin_id: user.id,
        } as any)
        .select('id')
        .single();

      if (convError || !newConv) {
        toast({ title: 'Eroare', description: 'Nu s-a putut crea grupul.', variant: 'destructive' });
        return;
      }

      // Add creator as participant
      await supabase.from('chat_participants').insert({
        conversation_id: newConv.id,
        user_id: user.id,
      });

      // Add selected members
      for (const uid of selectedUsers) {
        await supabase.from('chat_participants').insert({
          conversation_id: newConv.id,
          user_id: uid,
        });
      }

      toast({ title: 'Grup creat', description: `Grupul „${groupName.trim()}" a fost creat cu ${selectedUsers.size + 1} membri.` });
      onCreated(newConv.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Grup nou
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 min-h-0 flex flex-col">
          <div>
            <Label className="text-xs text-muted-foreground">Numele grupului</Label>
            <Input
              placeholder="Ex: Proiect XYZ, Laborator 5..."
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Selected members chips */}
          {selectedUsersList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsersList.map(u => (
                <Badge key={u.user_id} variant="secondary" className="gap-1 pr-1">
                  <span className="text-xs">{u.full_name}</span>
                  <button
                    onClick={() => toggleUser(u.user_id)}
                    className="rounded-full hover:bg-foreground/10 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Caută colegi..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="flex-1 min-h-0 max-h-[50vh]">
            <div className="space-y-0.5">
              {grouped.map(([dept, deptUsers]) => {
                const isExpanded = expandedDepts.has(dept);
                const selectedInDept = deptUsers.filter(u => selectedUsers.has(u.user_id)).length;
                return (
                  <div key={dept}>
                    <button
                      onClick={() => toggleDept(dept)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      <Building2 className="h-3.5 w-3.5 text-primary/70" />
                      <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wide flex-1 text-left truncate">{dept}</span>
                      {selectedInDept > 0 && (
                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-primary text-primary-foreground">
                          {selectedInDept}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{deptUsers.length}</Badge>
                    </button>
                    {isExpanded && (
                      <div className="ml-4 space-y-0.5">
                        {deptUsers.map(u => {
                          const isSelected = selectedUsers.has(u.user_id);
                          return (
                            <button
                              key={u.user_id}
                              onClick={() => toggleUser(u.user_id)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-left",
                                isSelected ? "bg-primary/10 ring-1 ring-primary/30" : "hover:bg-muted"
                              )}
                            >
                              <Avatar className="h-7 w-7">
                                {u.avatar_url && <AvatarImage src={u.avatar_url} />}
                                <AvatarFallback className="text-[10px] bg-secondary text-secondary-foreground">
                                  {u.full_name.substring(0, 2)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm flex-1 truncate">{u.full_name}</span>
                              {isSelected && (
                                <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                  <span className="text-primary-foreground text-xs">✓</span>
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anulează</Button>
          <Button
            onClick={handleCreate}
            disabled={creating || !groupName.trim() || selectedUsers.size < 1}
            className="gap-1.5"
          >
            <Users className="h-4 w-4" />
            Creează grup ({selectedUsers.size + 1} membri)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewGroupDialog;

import { useEffect, useState, useCallback } from 'react';
import SocialLayout from '@/components/layout/SocialLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Minus,
  Plus,
  Maximize2,
  Download,
  Pencil,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

interface OrgNode {
  id: string;
  name: string;
  position: string | null;
  department: string | null;
  parent_id: string | null;
  user_id: string | null;
  avatar_url: string | null;
  order_index: number;
  is_root: boolean;
}

const OrgChart = () => {
  const { user } = useAuth();
  const { canManageHR, isSuperAdmin } = useUserRole();
  const canEdit = canManageHR || isSuperAdmin;
  const [zoom, setZoom] = useState(1);
  const [nodes, setNodes] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<OrgNode | null>(null);
  const [parentFor, setParentFor] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', position: '', department: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase.from('org_nodes' as any) as any)
      .select('*')
      .order('order_index', { ascending: true });
    if (error) toast.error(error.message);
    setNodes(((data as OrgNode[]) || []));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // If empty, seed a root from current user (admin only) so we're not blank
  useEffect(() => {
    if (!loading && nodes.length === 0 && canEdit && user) {
      (async () => {
        await (supabase.from('org_nodes' as any) as any).insert({
          name: 'ICMPP',
          position: 'Organizație',
          is_root: true,
          created_by: user.id,
        });
        load();
      })();
    }
  }, [loading, nodes.length, canEdit, user, load]);

  const openCreate = (parentId: string | null) => {
    setEditing(null);
    setParentFor(parentId);
    setForm({ name: '', position: '', department: '' });
    setDialogOpen(true);
  };

  const openEdit = (node: OrgNode) => {
    setEditing(node);
    setParentFor(node.parent_id);
    setForm({
      name: node.name,
      position: node.position || '',
      department: node.department || '',
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Numele este obligatoriu');
      return;
    }
    if (editing) {
      const { error } = await (supabase.from('org_nodes' as any) as any)
        .update({
          name: form.name.trim(),
          position: form.position.trim() || null,
          department: form.department.trim() || null,
        })
        .eq('id', editing.id);
      if (error) return toast.error(error.message);
      toast.success('Nod actualizat');
    } else {
      const { error } = await (supabase.from('org_nodes' as any) as any).insert({
        name: form.name.trim(),
        position: form.position.trim() || null,
        department: form.department.trim() || null,
        parent_id: parentFor,
        created_by: user?.id,
        order_index: nodes.filter((n) => n.parent_id === parentFor).length,
      });
      if (error) return toast.error(error.message);
      toast.success('Nod adăugat');
    }
    setDialogOpen(false);
    load();
  };

  const remove = async (node: OrgNode) => {
    if (!confirm(`Ștergi „${node.name}"? Subordonații vor rămâne fără părinte.`)) return;
    const { error } = await (supabase.from('org_nodes' as any) as any).delete().eq('id', node.id);
    if (error) return toast.error(error.message);
    toast.success('Nod șters');
    load();
  };

  const roots = nodes.filter((n) => !n.parent_id);
  const childrenOf = (id: string) => nodes.filter((n) => n.parent_id === id);

  return (
    <SocialLayout title="Organigramă" description="Structura organizațională ICMPP">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" className="rounded-xl" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
            <Minus className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="icon" className="rounded-xl" onClick={() => setZoom((z) => Math.min(1.5, z + 0.1))}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="secondary" className="rounded-xl" onClick={() => setZoom(1)}>
            <Maximize2 className="w-4 h-4 mr-2" />
            Zoom fix
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button className="rounded-xl" onClick={() => openCreate(null)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Adaugă nod rădăcină
            </Button>
          )}
          <Button
            variant="secondary"
            className="rounded-xl"
            onClick={() => window.print()}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportă (Print)
          </Button>
        </div>
      </div>

      <div className="flex justify-center py-8 overflow-auto min-h-[400px]">
        {loading ? (
          <p className="text-sm text-muted-foreground">Se încarcă…</p>
        ) : roots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nu există noduri.</p>
        ) : (
          <div
            className="flex gap-16 transition-transform"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          >
            {roots.map((root) => (
              <NodeTree
                key={root.id}
                node={root}
                childrenOf={childrenOf}
                canEdit={canEdit}
                onAddChild={openCreate}
                onEdit={openEdit}
                onDelete={remove}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Editează nod' : parentFor ? 'Adaugă subordonat' : 'Adaugă nod'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nume *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex. Ion Popescu"
              />
            </div>
            <div>
              <Label>Funcție</Label>
              <Input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="Ex. Director"
              />
            </div>
            <div>
              <Label>Departament</Label>
              <Input
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="Ex. IT"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Anulează</Button>
            <Button onClick={save}>Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SocialLayout>
  );
};

interface NodeTreeProps {
  node: OrgNode;
  childrenOf: (id: string) => OrgNode[];
  canEdit: boolean;
  onAddChild: (parentId: string) => void;
  onEdit: (node: OrgNode) => void;
  onDelete: (node: OrgNode) => void;
}

const NodeTree = ({ node, childrenOf, canEdit, onAddChild, onEdit, onDelete }: NodeTreeProps) => {
  const kids = childrenOf(node.id);
  const initials = node.name.split(' ').map((s) => s[0]).join('').substring(0, 2).toUpperCase();
  return (
    <div className="flex flex-col items-center">
      <div className="bg-card border border-border rounded-2xl shadow-sm p-4 w-52 text-center relative group">
        {canEdit && (
          <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(node)}
              className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90"
              title="Editează"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDelete(node)}
              className="w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:opacity-90"
              title="Șterge"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2 text-sm font-semibold text-primary">
          {initials}
        </div>
        <p className="font-bold text-sm leading-tight">{node.name}</p>
        {node.position && <p className="text-xs text-primary mt-1">{node.position}</p>}
        {node.department && <p className="text-[11px] text-muted-foreground mt-1">{node.department}</p>}
      </div>

      {canEdit && (
        <button
          onClick={() => onAddChild(node.id)}
          className="mt-2 w-6 h-6 rounded-full bg-primary/10 hover:bg-primary hover:text-primary-foreground text-primary flex items-center justify-center transition-colors"
          title="Adaugă subordonat"
        >
          <Plus className="w-3 h-3" />
        </button>
      )}

      {kids.length > 0 && (
        <>
          <div className="w-px h-6 bg-primary/40 mt-2" />
          <div className="flex gap-8 pt-2 border-t border-primary/20 px-4">
            {kids.map((k) => (
              <NodeTree
                key={k.id}
                node={k}
                childrenOf={childrenOf}
                canEdit={canEdit}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OrgChart;

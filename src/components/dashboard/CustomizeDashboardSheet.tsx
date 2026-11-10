import { useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GripVertical, RotateCcw } from 'lucide-react';
import { LayoutItem, widgetById } from './dashboardWidgets';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function Row({ item, onToggle }: { item: LayoutItem; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const w = widgetById(item.id);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-3 rounded-xl border bg-card/80 backdrop-blur px-3 py-2.5', isDragging && 'shadow-lg ring-2 ring-primary/30 z-10', !item.visible && 'opacity-60')}
    >
      <button {...attributes} {...listeners} aria-label={`Mută ${w.title}`} className="touch-none cursor-grab text-muted-foreground hover:text-foreground">
        <GripVertical className="w-5 h-5" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{w.title}</div>
        <div className="text-xs text-muted-foreground truncate">{w.description}</div>
      </div>
      <Switch checked={item.visible} onCheckedChange={onToggle} aria-label={`Afișează ${w.title}`} />
    </li>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  layout: LayoutItem[];
  onSave: (l: LayoutItem[]) => void;
  onReset: () => void;
}

export default function CustomizeDashboardSheet({ open, onOpenChange, layout, onSave, onReset }: Props) {
  const [items, setItems] = useState(layout);
  useEffect(() => { if (open) setItems(layout); }, [open, layout]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex(i => i.id === e.active.id);
    const to = items.findIndex(i => i.id === e.over!.id);
    setItems(arrayMove(items, from, to));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Personalizează pagina</SheetTitle>
          <SheetDescription>Trage cardurile ca să schimbi ordinea și alege ce vezi. Se păstrează pe toate dispozitivele.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-2">
                {items.map(it => (
                  <Row key={it.id} item={it} onToggle={() => setItems(items.map(x => x.id === it.id ? { ...x, visible: !x.visible } : x))} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => { onReset(); onOpenChange(false); toast.success('Pagina a revenit la varianta standard'); }}>
            <RotateCcw className="w-4 h-4 mr-2" /> Varianta standard
          </Button>
          <Button className="flex-1" onClick={() => { onSave(items); onOpenChange(false); toast.success('Pagina a fost salvată'); }}>Salvează</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

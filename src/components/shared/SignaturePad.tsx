import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eraser, Check, Save, Trash2, Star, Pencil, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
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

interface SignaturePadProps {
  onSave: (signature: string) => void;
  existingSignature?: string | null;
  disabled?: boolean;
  label?: string;
}

interface SavedSignature {
  id: string;
  label: string;
  signature_data: string;
  is_default: boolean;
}

export function SignaturePad({ onSave, existingSignature, disabled = false, label = 'Semnătură' }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedSignature[]>([]);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const drawDataUrl = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      ctx.drawImage(img, 0, 0, rect.width, rect.height);
      setHasSignature(true);
    };
    img.src = dataUrl;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.strokeStyle = '#1a3ba3';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (existingSignature) {
      drawDataUrl(existingSignature);
    }
  }, [existingSignature, drawDataUrl]);

  const loadSaved = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('user_signatures')
      .select('id, label, signature_data, is_default')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (!error && data) setSaved(data as SavedSignature[]);
  }, [user]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    if ('touches' in e) e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || disabled) return;
    if ('touches' in e) e.preventDefault();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
  };

  const getCurrentDataUrl = () => canvasRef.current?.toDataURL('image/png') || null;

  const applyCurrent = () => {
    const sig = getCurrentDataUrl();
    if (!sig || !hasSignature) return;
    onSave(sig);
  };

  const applySaved = (sig: SavedSignature) => {
    drawDataUrl(sig.signature_data);
    onSave(sig.signature_data);
    toast({ title: 'Semnătură aplicată', description: sig.label });
  };

  const saveCurrentAsNew = async () => {
    if (!user) return;
    const sig = getCurrentDataUrl();
    if (!sig || !hasSignature) return;
    const finalLabel = newLabel.trim() || `Semnătură ${saved.length + 1}`;
    const { error } = await supabase.from('user_signatures').insert({
      user_id: user.id,
      label: finalLabel,
      signature_data: sig,
      is_default: saved.length === 0,
    });
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Semnătură salvată', description: finalLabel });
    setShowSaveInput(false);
    setNewLabel('');
    loadSaved();
  };

  const deleteSaved = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('user_signatures').delete().eq('id', deleteId);
    if (error) {
      toast({ title: 'Eroare', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Semnătură ștearsă' });
      loadSaved();
    }
    setDeleteId(null);
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    await supabase.from('user_signatures').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('user_signatures').update({ is_default: true }).eq('id', id);
    loadSaved();
  };

  const saveLabelEdit = async (id: string) => {
    const v = editLabel.trim();
    if (!v) return;
    await supabase.from('user_signatures').update({ label: v }).eq('id', id);
    setEditingId(null);
    setEditLabel('');
    loadSaved();
  };

  const signed = !!existingSignature;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-foreground">{label}</label>

      {/* Saved signatures gallery */}
      {!disabled && saved.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Semnături salvate — apasă pentru a aplica:</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {saved.map((s) => (
              <div
                key={s.id}
                className={`group relative border-2 rounded-lg overflow-hidden bg-white transition-all hover:border-primary ${
                  s.is_default ? 'border-primary/60' : 'border-border'
                }`}
              >
                <button
                  type="button"
                  onClick={() => applySaved(s)}
                  className="block w-full"
                  title="Aplică semnătura"
                >
                  <img src={s.signature_data} alt={s.label} className="w-full h-16 object-contain p-1" />
                </button>
                <div className="px-2 py-1 border-t bg-muted/40 flex items-center justify-between gap-1">
                  {editingId === s.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="h-6 text-xs"
                        autoFocus
                      />
                      <button type="button" onClick={() => saveLabelEdit(s.id)} className="text-green-600">
                        <Check className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="text-muted-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs truncate flex items-center gap-1">
                        {s.is_default && <Star className="w-3 h-3 fill-yellow-400 text-yellow-500 shrink-0" />}
                        {s.label}
                      </span>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!s.is_default && (
                          <button
                            type="button"
                            onClick={() => setDefault(s.id)}
                            title="Setează ca implicită"
                            className="p-0.5 hover:text-yellow-500"
                          >
                            <Star className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setEditingId(s.id); setEditLabel(s.label); }}
                          title="Editează numele"
                          className="p-0.5 hover:text-primary"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(s.id)}
                          title="Șterge"
                          className="p-0.5 hover:text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canvas */}
      <div className={`border-2 rounded-lg overflow-hidden ${disabled ? 'bg-muted' : 'bg-white'} ${signed ? 'border-green-500' : 'border-border'}`}>
        <canvas
          ref={canvasRef}
          className={`w-full h-32 touch-none ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>

      {!disabled && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={clearCanvas} disabled={!hasSignature}>
              <Eraser className="w-4 h-4 mr-1" /> Șterge
            </Button>
            <Button type="button" size="sm" onClick={applyCurrent} disabled={!hasSignature}>
              <Check className="w-4 h-4 mr-1" /> Aplică
            </Button>
            {user && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowSaveInput((v) => !v)}
                disabled={!hasSignature}
              >
                <Save className="w-4 h-4 mr-1" /> Salvează pentru reutilizare
              </Button>
            )}
          </div>

          {showSaveInput && (
            <div className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
              <Input
                placeholder="Nume (ex: Semnătura oficială)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="h-8 text-sm"
              />
              <Button type="button" size="sm" onClick={saveCurrentAsNew}>
                <Check className="w-4 h-4" />
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => { setShowSaveInput(false); setNewLabel(''); }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {signed && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <Check className="w-3 h-3" /> Semnat
        </p>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi semnătura salvată?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune nu poate fi anulată. Semnătura va fi eliminată din lista ta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSaved} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

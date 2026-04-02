import { useState } from "react";
import { Star, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

interface IrisFeedbackDialogProps {
  open: boolean;
  onClose: () => void;
  conversation: Msg[];
}

export default function IrisFeedbackDialog({ open, onClose, conversation }: IrisFeedbackDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { session } = useAuth();

  if (!open) return null;

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Vă rugăm să selectați un rating.");
      return;
    }
    if (!session?.user?.id) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("iris_feedback" as any).insert({
        user_id: session.user.id,
        rating,
        comment: comment.trim() || null,
        conversation: conversation as any,
      } as any);

      if (error) throw error;
      toast.success("Mulțumim pentru feedback!");
      onClose();
    } catch (e) {
      console.error("Feedback error:", e);
      toast.error("Eroare la trimiterea feedback-ului.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200">
      <div className="w-[380px] max-w-[calc(100vw-2rem)] bg-background border border-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base">Feedback IRIS</h3>
          <button onClick={handleSkip} className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Cum evaluați experiența cu IRIS? Feedback-ul dvs. ne ajută să îmbunătățim asistentul.
        </p>

        {/* Star Rating */}
        <div className="flex justify-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-8 h-8 transition-colors ${
                  star <= (hoveredStar || rating)
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>

        {rating > 0 && (
          <p className="text-center text-xs text-muted-foreground mb-3">
            {rating === 1 && "Foarte slab"}
            {rating === 2 && "Slab"}
            {rating === 3 && "Acceptabil"}
            {rating === 4 && "Bun"}
            {rating === 5 && "Excelent"}
          </p>
        )}

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ce ar trebui îmbunătățit? (opțional)"
          rows={3}
          className="w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary/20 mb-4"
        />

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleSkip}
            className="flex-1 px-4 py-2 text-sm rounded-xl border border-border hover:bg-muted transition-colors"
          >
            Omite
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0 || submitting}
            className="flex-1 px-4 py-2 text-sm rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            {submitting ? "Se trimite..." : "Trimite"}
          </button>
        </div>
      </div>
    </div>
  );
}

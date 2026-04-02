import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Star, MessageSquare, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ro } from "date-fns/locale";

interface FeedbackRow {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  conversation: { role: string; content: string }[];
  created_at: string;
  profile_name?: string;
}

export default function IrisFeedbackPanel() {
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchFeedback();
  }, []);

  const fetchFeedback = async () => {
    const { data, error } = await supabase
      .from("iris_feedback" as any)
      .select("*")
      .order("created_at", { ascending: false }) as any;

    if (error) {
      console.error("Feedback fetch error:", error);
      setLoading(false);
      return;
    }

    // Fetch profile names
    const userIdsSet = new Set<string>();
    (data || []).forEach((f: any) => { if (f.user_id) userIdsSet.add(f.user_id); });
    const userIds = Array.from(userIdsSet);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

    setFeedback(
      (data || []).map((f: any) => ({
        ...f,
        conversation: Array.isArray(f.conversation) ? f.conversation : [],
        profile_name: profileMap.get(f.user_id) || "Necunoscut",
      }))
    );
    setLoading(false);
  };

  const avgRating = feedback.length > 0
    ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
    : "—";

  const ratingDistribution = [5, 4, 3, 2, 1].map((r) => ({
    rating: r,
    count: feedback.filter((f) => f.rating === r).length,
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{avgRating}</div>
            <div className="flex justify-center gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${s <= Math.round(Number(avgRating)) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Rating mediu</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{feedback.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total feedback-uri</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <div className="text-3xl font-bold">{feedback.filter((f) => f.comment).length}</div>
            <p className="text-xs text-muted-foreground mt-1">Cu comentarii</p>
          </CardContent>
        </Card>
      </div>

      {/* Distribution */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Distribuție rating-uri</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {ratingDistribution.map(({ rating, count }) => (
            <div key={rating} className="flex items-center gap-3">
              <span className="text-sm w-8 text-right">{rating} ★</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full transition-all"
                  style={{ width: feedback.length > 0 ? `${(count / feedback.length) * 100}%` : "0%" }}
                />
              </div>
              <span className="text-xs text-muted-foreground w-8">{count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Feedback list */}
      <div className="space-y-3">
        {feedback.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Niciun feedback primit încă.
            </CardContent>
          </Card>
        ) : (
          feedback.map((f) => (
            <Card key={f.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{f.profile_name}</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-3.5 h-3.5 ${s <= f.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(f.created_at), "d MMM yyyy, HH:mm", { locale: ro })}
                      </span>
                    </div>
                    {f.comment && (
                      <p className="text-sm text-muted-foreground mt-1.5">{f.comment}</p>
                    )}
                  </div>

                  {f.conversation.length > 0 && (
                    <button
                      onClick={() => setExpandedId(expandedId === f.id ? null : f.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {f.conversation.length}
                      {expandedId === f.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {/* Expanded conversation */}
                {expandedId === f.id && f.conversation.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border space-y-2 max-h-60 overflow-y-auto">
                    {f.conversation.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                            msg.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          {msg.content.slice(0, 500)}{msg.content.length > 500 ? "..." : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

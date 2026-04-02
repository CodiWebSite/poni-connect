import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2 } from "lucide-react";
import irisLogo from "@/assets/iris-logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useLocation } from "react-router-dom";
import IrisMessageBubble from "./IrisMessageBubble";
import IrisQuickActions from "./IrisQuickActions";
import IrisContextHints from "./IrisContextHints";
import IrisConfirmationCard from "./IrisConfirmationCard";
import IrisActionPreview from "./IrisActionPreview";
import IrisFeedbackDialog from "./IrisFeedbackDialog";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

interface PendingAction {
  type: string;
  data: Record<string, any>;
  label: string;
}

interface ActionResult {
  success: boolean;
  message: string;
  details?: Record<string, string>;
  link?: { label: string; href: string };
}

interface IrisChatPanelProps {
  open: boolean;
  onClose: () => void;
}

function parseActionBlocks(content: string): { text: string; actions: PendingAction[] } {
  const actions: PendingAction[] = [];
  const text = content.replace(/\[IRIS_ACTION:(.*?)\]/gs, (_, json) => {
    try {
      actions.push(JSON.parse(json));
    } catch { /* ignore */ }
    return "";
  });
  return { text: text.trim(), actions };
}

export default function IrisChatPanel({ open, onClose }: IrisChatPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [actionResults, setActionResults] = useState<Map<number, ActionResult>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { session } = useAuth();
  const { role } = useUserRole();
  const location = useLocation();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 200); }, [open]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || !session?.access_token) return;

    const userMsg: Msg = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    setPendingAction(null);

    let assistantSoFar = "";

    try {
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/iris-chat`;
      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          currentRoute: location.pathname,
        }),
      });

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        toast.error(errBody.error || "Eroare la comunicarea cu IRIS");
        setIsLoading(false);
        return;
      }

      if (!resp.body) {
        toast.error("Răspuns gol de la IRIS");
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      const upsertAssistant = (nextChunk: string) => {
        assistantSoFar += nextChunk;
        const content = assistantSoFar;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content } : m));
          }
          return [...prev, { role: "assistant", content }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }

      // Check for action blocks in final content
      const { actions } = parseActionBlocks(assistantSoFar);
      if (actions.length > 0) {
        setPendingAction(actions[0]);
      }
    } catch (e) {
      console.error("IRIS stream error:", e);
      toast.error("Eroare la comunicarea cu IRIS. Încercați din nou.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!pendingAction || !session?.access_token) return;
    setIsExecuting(true);

    try {
      const chatUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/iris-chat`;
      const resp = await fetch(chatUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          executeAction: {
            type: pendingAction.type,
            data: pendingAction.data,
          },
        }),
      });

      const result = await resp.json();
      const msgIndex = messages.length - 1;

      if (result.error) {
        setActionResults(new Map(actionResults.set(msgIndex, {
          success: false,
          message: result.error,
        })));
        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `❌ ${result.error}`,
        }]);
      } else {
        const details: Record<string, string> = {};
        let link: { label: string; href: string } | undefined;

        if (pendingAction.type === "create_leave") {
          details["Nr. cerere"] = result.requestNumber || "N/A";
          details["Zile lucrătoare"] = `${result.workingDays}`;
          details["Status"] = "Trimisă spre aprobare";
          details["Aprobator"] = result.approverName || "Nedesemnat";
          link = { label: "Vezi cererea", href: "/leave-calendar" };
        } else if (pendingAction.type === "create_helpdesk_ticket") {
          details["ID Tichet"] = result.ticketId || "N/A";
          details["Status"] = "Deschis";
        } else if (pendingAction.type === "create_correction_request") {
          details["ID Cerere"] = result.requestId || "N/A";
          details["Status"] = "Trimisă spre HR";
        } else if (pendingAction.type === "create_hr_request") {
          details["ID Cerere"] = result.requestId || "N/A";
          details["Status"] = "Trimisă spre HR";
        }

        setActionResults(new Map(actionResults.set(msgIndex, {
          success: true,
          message: "Acțiune executată cu succes!",
          details,
          link,
        })));

        setMessages((prev) => [...prev, {
          role: "assistant",
          content: `✅ Acțiunea a fost executată cu succes!${result.requestNumber ? ` Nr. cerere: **${result.requestNumber}**` : ""}`,
        }]);
      }
    } catch (e) {
      console.error("Execute action error:", e);
      toast.error("Eroare la executarea acțiunii.");
    } finally {
      setIsExecuting(false);
      setPendingAction(null);
    }
  };

  const handleCancelAction = () => {
    setPendingAction(null);
    setMessages((prev) => [...prev, {
      role: "assistant",
      content: "Acțiunea a fost anulată. Puteți continua cu altceva.",
    }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!open && !showFeedback) return null;

  if (showFeedback) {
    return (
      <IrisFeedbackDialog
        open={showFeedback}
        onClose={() => {
          setShowFeedback(false);
          setMessages([]);
          setActionResults(new Map());
        }}
        conversation={messages}
      />
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 w-[420px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-6rem)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 sm:bottom-20 sm:right-4 max-sm:inset-0 max-sm:bottom-0 max-sm:right-0 max-sm:w-full max-sm:h-full max-sm:max-w-none max-sm:max-h-none max-sm:rounded-none">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-t-2xl max-sm:rounded-none bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20">
          <img src={irisLogo} alt="IRIS" className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">IRIS <span className="text-[10px] opacity-70 font-normal">v2</span></h3>
          <p className="text-[10px] opacity-80 truncate">Copilot operațional ICMPP</p>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Context hint */}
      <IrisContextHints currentRoute={location.pathname} />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full overflow-hidden">
              <img src={irisLogo} alt="IRIS" className="w-full h-full object-cover" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">Bună! Sunt IRIS v2.</p>
            <p className="text-xs text-muted-foreground">
              Vă pot ajuta cu informații, dar și să executez acțiuni — cereri de concediu, tichete, adeverințe și multe altele.
            </p>
          </div>
        )}
        {messages.map((msg, i) => {
          const { text, actions } = msg.role === "assistant" ? parseActionBlocks(msg.content) : { text: msg.content, actions: [] };
          const result = actionResults.get(i);

          return (
            <div key={i}>
              <IrisMessageBubble role={msg.role} content={text || msg.content} />
              {result && (
                <IrisActionPreview {...result} />
              )}
            </div>
          );
        })}

        {/* Pending action confirmation */}
        {pendingAction && (
          <IrisConfirmationCard
            action={pendingAction}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
            isExecuting={isExecuting}
          />
        )}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-2.5">
            <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden">
              <img src={irisLogo} alt="IRIS" className="w-full h-full object-cover" />
            </div>
            <div className="rounded-2xl bg-muted px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">IRIS analizează...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {messages.length === 0 && (
        <IrisQuickActions onSelect={sendMessage} userRole={role || undefined} />
      )}

      {/* Input */}
      <div className="px-3 pb-3 pt-1 border-t border-border">
        <div className="flex items-end gap-2 bg-muted rounded-xl px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Întrebați-mă ceva sau cereți o acțiune..."
            rows={1}
            className="flex-1 bg-transparent text-sm resize-none outline-none max-h-24 min-h-[1.5rem]"
            disabled={isLoading || isExecuting}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading || isExecuting}
            className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

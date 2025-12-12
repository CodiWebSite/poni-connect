import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import MainLayout from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Bot, User, Loader2, Sparkles, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const AIAssistant = () => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: { 
          message: userMessage,
          history: messages.slice(-10) // Send last 10 messages for context
        },
      });

      if (error) throw error;

      setMessages((prev) => [...prev, { role: "assistant", content: data.response }]);
    } catch (error) {
      console.error("Error calling AI assistant:", error);
      toast({
        title: "Eroare",
        description: "Nu s-a putut obține un răspuns de la asistent. Încercați din nou.",
        variant: "destructive",
      });
      // Remove the user message if there was an error
      setMessages((prev) => prev.slice(0, -1));
      setInput(userMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestedQuestions = [
    "Cum pot solicita concediu de odihnă?",
    "Ce documente sunt necesare pentru o delegație?",
    "Cum obțin o adeverință de salariat?",
    "Care sunt pașii pentru o cerere de demisie?",
  ];

  return (
    <MainLayout title="Asistent AI" description="Întrebări despre proceduri HR">
      <div className="h-[calc(100vh-8rem)] flex flex-col">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Asistent AI</h1>
            <p className="text-sm text-muted-foreground">Întreabă despre proceduri HR și politici interne</p>
          </div>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Bun venit la Asistentul AI!</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Sunt aici să te ajut cu întrebări despre proceduri HR, concedii, adeverințe și alte informații din Knowledge Base.
                </p>
                
                <div className="grid gap-2 w-full max-w-md">
                  <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Întrebări sugerate:
                  </p>
                  {suggestedQuestions.map((question) => (
                    <Button
                      key={question}
                      variant="outline"
                      className="justify-start text-left h-auto py-3 px-4"
                      onClick={() => {
                        setInput(question);
                      }}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex gap-3",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "rounded-lg px-4 py-3 max-w-[80%]",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    </div>
                    {message.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="bg-muted rounded-lg px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Scrie întrebarea ta..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button onClick={sendMessage} disabled={!input.trim() || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default AIAssistant;

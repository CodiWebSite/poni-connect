import irisLogo from "@/assets/iris-logo.png";

interface IrisMessageBubbleProps {
  role: "user" | "assistant";
  content: string;
}

function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-muted-foreground/10 px-1 py-0.5 rounded text-xs">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank" rel="noopener">$1</a>')
    .replace(/^[-•]\s+(.+)/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>)/gs, "<ul class='list-disc pl-4 my-1'>$1</ul>")
    .replace(/\n{2,}/g, "</p><p class='my-1'>")
    .replace(/\n/g, "<br/>");
}

export default function IrisMessageBubble({ role, content }: IrisMessageBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-in fade-in slide-in-from-right-2 duration-200">
        <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 animate-in fade-in slide-in-from-left-2 duration-200">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-muted px-4 py-2.5 text-sm">
        <div
          className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:text-primary [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: simpleMarkdown(content) }}
        />
      </div>
    </div>
  );
}

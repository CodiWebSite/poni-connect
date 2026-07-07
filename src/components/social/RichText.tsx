import React from 'react';

/**
 * Very small, safe markdown-ish renderer for social posts/comments.
 * Supports: **bold**, *italic*, __underline__, `code`, [text](url), > quote, • bullets, line breaks.
 * All URLs are validated (http/https/mailto only). No raw HTML is injected.
 */

const inlineTokens: { re: RegExp; render: (m: RegExpMatchArray, key: number) => React.ReactNode }[] = [
  {
    re: /@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/,
    render: (m, k) => (
      <span
        key={k}
        className="text-primary font-medium bg-primary/10 rounded px-1 py-0.5"
        data-user-id={m[2]}
      >
        @{m[1]}
      </span>
    ),
  },
  { re: /\*\*(.+?)\*\*/, render: (m, k) => <strong key={k}>{renderInline(m[1], k * 100)}</strong> },
  { re: /__(.+?)__/, render: (m, k) => <u key={k}>{renderInline(m[1], k * 100)}</u> },
  { re: /\*(.+?)\*/, render: (m, k) => <em key={k}>{renderInline(m[1], k * 100)}</em> },
  { re: /`([^`]+?)`/, render: (m, k) => <code key={k} className="px-1 py-0.5 rounded bg-muted text-[0.9em]">{m[1]}</code> },
  {
    re: /\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/,
    render: (m, k) => (
      <a
        key={k}
        href={m[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80"
      >
        {m[1]}
      </a>
    ),
  },
  {
    re: /(https?:\/\/[^\s]+)/,
    render: (m, k) => (
      <a
        key={k}
        href={m[1]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80"
      >
        {m[1]}
      </a>
    ),
  },
];

function renderInline(text: string, baseKey = 0): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let key = baseKey;
  while (rest.length) {
    let bestIdx = -1;
    let bestMatch: RegExpMatchArray | null = null;
    let bestRender: (typeof inlineTokens)[number]['render'] | null = null;
    for (const t of inlineTokens) {
      const m = rest.match(t.re);
      if (m && m.index !== undefined && (bestIdx === -1 || m.index < bestIdx)) {
        bestIdx = m.index;
        bestMatch = m;
        bestRender = t.render;
      }
    }
    if (!bestMatch || bestIdx === -1 || !bestRender) {
      out.push(rest);
      break;
    }
    if (bestIdx > 0) out.push(rest.slice(0, bestIdx));
    out.push(bestRender(bestMatch, ++key));
    rest = rest.slice(bestIdx + bestMatch[0].length);
  }
  return out;
}

export function RichText({ content, className }: { content: string; className?: string }) {
  const lines = content.split(/\n/);
  return (
    <div className={className}>
      {lines.map((line, i) => {
        if (/^\s*>\s?/.test(line)) {
          return (
            <blockquote key={i} className="border-l-2 border-border pl-3 my-1 text-muted-foreground">
              {renderInline(line.replace(/^\s*>\s?/, ''), i * 1000)}
            </blockquote>
          );
        }
        if (/^\s*(•|-|\*)\s+/.test(line)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span>•</span>
              <span>{renderInline(line.replace(/^\s*(•|-|\*)\s+/, ''), i * 1000)}</span>
            </div>
          );
        }
        if (line.trim() === '') return <br key={i} />;
        return <div key={i}>{renderInline(line, i * 1000)}</div>;
      })}
    </div>
  );
}

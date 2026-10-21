import { useState, type ReactNode } from "react";
import { Check, Copy, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { motion } from "motion/react";
import katex from "katex";
import { springs } from "../../design/motion";
import type { ChatMessage } from "./aiStore";
import { t } from "../../i18n";

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatMessageItem({ message, isStreaming }: ChatMessageItemProps) {
  const [copiedFull, setCopiedFull] = useState(false);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedFull(true);
      window.setTimeout(() => setCopiedFull(false), 1400);
    } catch {
      // Ignore clipboard error
    }
  };

  if (message.role === "user") {
    return (
      <motion.div
        initial={{ opacity: 0, transform: "translateY(6px) scale(0.98)" }}
        animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
        transition={springs.snappy}
        className="flex justify-end pl-8"
      >
        <div
          className="max-w-full rounded-[14px] rounded-br-[4px] px-3 py-2 text-footnote leading-[1.45] text-label break-words whitespace-pre-wrap"
          style={{
            background: "color-mix(in srgb, var(--accent, #4285f4) 24%, rgba(255, 255, 255, 0.07))",
            border: "1px solid color-mix(in srgb, var(--accent, #4285f4) 42%, rgba(255, 255, 255, 0.12))",
          }}
        >
          {message.content}
        </div>
      </motion.div>
    );
  }

  const isEmptyThinking = !message.content && isStreaming;

  return (
    <motion.div
      initial={{ opacity: 0, transform: "translateY(6px) scale(0.98)" }}
      animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
      transition={springs.snappy}
      className="group relative flex justify-start pr-4"
    >
      <div
        className={`relative w-full rounded-[14px] rounded-tl-[4px] border px-3.5 py-2.5 text-footnote leading-[1.5] break-words ${
          message.isError
            ? "border-red/35 bg-red/10 text-red"
            : "border-separator bg-fill-1 text-label"
        }`}
      >
        {isEmptyThinking ? (
          <div className="flex items-center gap-2 py-0.5 text-label-2">
            <motion.span
              animate={{ rotate: [0, 18, -18, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              className="flex text-[var(--accent,#4285f4)]"
            >
              <Sparkle size={14} weight="fill" />
            </motion.span>
            <span className="text-footnote text-label-2">{t("Denkt nach …")}</span>
          </div>
        ) : message.isError ? (
          <div className="flex items-start gap-2">
            <WarningCircle size={15} weight="fill" className="mt-0.5 shrink-0 text-red" />
            <span>{message.content}</span>
          </div>
        ) : (
          <div className="space-y-2">
            <MarkdownContent content={message.content} />
            {isStreaming && (
              <span
                className="ml-1 inline-block h-3 w-1.5 translate-y-0.5 animate-pulse rounded-full"
                style={{ background: "var(--accent, #4285f4)" }}
              />
            )}
          </div>
        )}

        {!isEmptyThinking && message.content && (
          <div className="mt-1.5 flex items-center justify-between border-t border-white/[0.05] pt-1">
            <div className="flex items-center gap-1.5">
              {message.emotionLabel && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    background: "color-mix(in srgb, var(--accent, #4285f4) 16%, rgba(255,255,255,0.04))",
                    color: "color-mix(in srgb, var(--accent, #4285f4) 75%, white)",
                  }}
                >
                  <Sparkle size={9} weight="fill" />
                  {message.emotionLabel}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void copyText(message.content)}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-label-3 opacity-75 transition-all hover:bg-fill-2 hover:text-label group-hover:opacity-100"
              title={t("Kopieren")}
            >
              {copiedFull ? (
                <>
                  <Check size={11} weight="bold" className="text-green" />
                  <span className="text-green">{t("Kopiert")}</span>
                </>
              ) : (
                <>
                  <Copy size={11} weight="bold" />
                  <span>{t("Kopieren")}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="my-1.5 overflow-hidden rounded-[10px] border border-white/[0.08] bg-black/40">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.03] px-2.5 py-1">
        <span className="font-mono text-[10px] tracking-wider text-label-3 uppercase">
          {lang || "code"}
        </span>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-label-2 transition-colors hover:bg-white/10 hover:text-label"
        >
          {copied ? (
            <>
              <Check size={11} weight="bold" className="text-green" />
              <span className="text-green">{t("Kopiert")}</span>
            </>
          ) : (
            <>
              <Copy size={11} weight="bold" />
              <span>{t("Kopieren")}</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-2.5 font-mono text-[11px] leading-[1.45] text-label [scrollbar-width:thin]">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MathBlock({ math }: { math: string }) {
  let html = "";
  try {
    html = katex.renderToString(math.trim(), {
      displayMode: true,
      throwOnError: false,
    });
  } catch {
    return <pre className="my-1.5 p-2 font-mono text-[11px] text-label">{math}</pre>;
  }

  return (
    <div
      className="my-2 overflow-x-auto rounded-[8px] border border-white/[0.06] bg-black/30 py-2 px-3 text-center text-label [scrollbar-width:thin]"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function MarkdownContent({ content }: { content: string }) {
  // Split fenced code blocks and display math blocks first
  const parts = content.split(/(```[\s\S]*?```|\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\])/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          const inner = part.slice(3, -3);
          const firstNewline = inner.indexOf("\n");
          const lang = firstNewline !== -1 ? inner.slice(0, firstNewline).trim() : "";
          const code = firstNewline !== -1 ? inner.slice(firstNewline + 1) : inner;
          return <CodeBlock key={i} lang={lang} code={code} />;
        }
        if (
          (part.startsWith("$$") && part.endsWith("$$") && part.length > 4) ||
          (part.startsWith("\\[") && part.endsWith("\\]") && part.length > 4)
        ) {
          const inner = part.startsWith("$$") ? part.slice(2, -2) : part.slice(2, -2);
          return <MathBlock key={i} math={inner} />;
        }
        return <TextBlock key={i} text={part} />;
      })}
    </>
  );
}

function TextBlock({ text }: { text: string }) {
  const paragraphs = text.trim().split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((para, pIdx) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={pIdx} className="pt-1 text-[13px] font-semibold text-label">
              {renderInline(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={pIdx} className="pt-1 text-[13.5px] font-semibold text-label">
              {renderInline(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={pIdx} className="pt-1 text-[14px] font-bold text-label">
              {renderInline(trimmed.slice(2))}
            </h2>
          );
        }

        const lines = trimmed.split("\n");
        const isBulletList = lines.every((l) => /^(\s*[-*]\s+)/.test(l));
        if (isBulletList) {
          return (
            <ul key={pIdx} className="list-disc space-y-1 pl-4 text-label">
              {lines.map((l, lIdx) => (
                <li key={lIdx}>{renderInline(l.replace(/^\s*[-*]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }

        const isOrderedList = lines.every((l) => /^(\s*\d+\.\s+)/.test(l));
        if (isOrderedList) {
          return (
            <ol key={pIdx} className="list-decimal space-y-1 pl-4 text-label">
              {lines.map((l, lIdx) => (
                <li key={lIdx}>{renderInline(l.replace(/^\s*\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={pIdx} className="whitespace-pre-line text-label">
            {renderInline(trimmed)}
          </p>
        );
      })}
    </>
  );
}

function renderInline(text: string): ReactNode[] {
  // Matches `code`, **bold**, *italic*, $inline math$, or \(inline math\)
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\$(?!\$)[^$\n]+\$|\\\([^\n]+?\\\))/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith("`") && tok.endsWith("`") && tok.length > 2) {
      return (
        <code
          key={i}
          className="rounded bg-white/[0.09] px-1 py-0.5 font-mono text-[11px] text-label"
        >
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith("**") && tok.endsWith("**") && tok.length > 4) {
      return (
        <strong key={i} className="font-semibold text-white">
          {tok.slice(2, -2)}
        </strong>
      );
    }
    if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2) {
      return (
        <em key={i} className="italic text-label-2">
          {tok.slice(1, -1)}
        </em>
      );
    }
    if (
      (tok.startsWith("$") && tok.endsWith("$") && tok.length > 2) ||
      (tok.startsWith("\\(") && tok.endsWith("\\)") && tok.length > 4)
    ) {
      const expr = tok.startsWith("$") ? tok.slice(1, -1) : tok.slice(2, -2);
      try {
        const html = katex.renderToString(expr.trim(), {
          displayMode: false,
          throwOnError: false,
        });
        return (
          <span
            key={i}
            className="inline-math inline-block px-1 align-baseline text-white"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      } catch {
        return <span key={i}>{tok}</span>;
      }
    }
    return tok;
  });
}

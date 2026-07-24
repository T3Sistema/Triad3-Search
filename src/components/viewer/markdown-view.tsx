"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

export function MarkdownView({ content }: { content: string }) {
  if (!content) {
    return <p className="text-sm text-text-secondary">Sem conteúdo Markdown.</p>;
  }
  return (
    <div className="prose-triad3 max-w-none text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

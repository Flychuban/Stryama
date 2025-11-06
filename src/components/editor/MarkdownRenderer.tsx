'use client';

import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from 'lucide-react';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const CodeBlock = ({ inline, className, children }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className ?? '');
  const language = match?.[1];

  // Extract string content from children (react-markdown always passes strings for code)
  const getTextContent = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getTextContent).join('');
    return '';
  };

  const codeString = getTextContent(children).replace(/\n$/, '');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (inline) {
    return (
      <code className="rounded border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 font-mono text-sm text-purple-200">
        {children}
      </code>
    );
  }

  return (
    <div className="group relative my-4 overflow-hidden rounded-lg border border-zinc-800 bg-[#0d1117] shadow-lg">
      {language && (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700"
            aria-label="Copy code"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      )}
      {!language && (
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      )}
      <pre className="overflow-x-auto bg-[#0d1117] p-4 text-sm">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
};

const components: Components = {
  code: CodeBlock as Components['code'],
  // Custom link renderer - open external links in new tab
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 underline underline-offset-2 transition-colors hover:text-blue-300"
    >
      {children}
    </a>
  ),
  // Custom list styling
  ul: ({ children }) => (
    <ul className="my-3 list-inside list-disc space-y-1.5 text-foreground/90">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-inside list-decimal space-y-1.5 text-foreground/90">
      {children}
    </ol>
  ),
  // Custom heading styling
  h1: ({ children }) => (
    <h1 className="mb-4 mt-6 border-b border-zinc-800 pb-2 text-2xl font-bold text-foreground">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-5 border-b border-zinc-800/50 pb-1.5 text-xl font-bold text-foreground">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold text-foreground">
      {children}
    </h3>
  ),
  // Custom blockquote styling
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-r border-l-4 border-zinc-600 bg-zinc-900/30 py-2 pl-4 italic text-foreground/70">
      {children}
    </blockquote>
  ),
  // Custom table styling
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="min-w-full overflow-hidden rounded-lg border border-zinc-800">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="border-b border-zinc-800 bg-zinc-900">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-left text-sm font-semibold text-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-t border-zinc-800/50 px-4 py-2 text-sm text-foreground/90">
      {children}
    </td>
  ),
  // Custom paragraph spacing
  p: ({ children }) => (
    <p className="my-2 leading-relaxed text-foreground/90">{children}</p>
  ),
  // Custom horizontal rule
  hr: () => <hr className="my-6 border-zinc-800" />,
  // Strong/bold text
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  // Emphasis/italic text
  em: ({ children }) => (
    <em className="italic text-foreground/90">{children}</em>
  ),
};

const MarkdownRendererComponent = ({
  content,
  className = '',
}: MarkdownRendererProps) => {
  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders during streaming
export const MarkdownRenderer = memo(MarkdownRendererComponent);

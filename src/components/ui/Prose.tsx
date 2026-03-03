/**
 * Prose — lightweight markdown renderer for AI responses.
 *
 * Handles the patterns Gemini commonly returns:
 *   **bold**, *italic*, `code`, # headers, - bullet lists, numbered lists,
 *   horizontal rules, and blank-line paragraphs.
 *
 * No external dependencies — pure React.
 */

import React from 'react';

interface ProseProps {
  content: string;
  className?: string;
}

/** Split content into logical blocks separated by blank lines. */
function splitBlocks(text: string): string[] {
  return text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
}

/** Inline parser — converts **bold**, *italic*, `code` spans to React nodes. */
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Pattern: **bold**, *italic*, `code`
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index} className="font-semibold text-surface-900">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} className="italic">{match[3]}</em>);
    } else if (match[4]) {
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded bg-surface-100 text-primary-700 font-mono text-[0.82em]">
          {match[4]}
        </code>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts;
}

/** Render a single block of text. */
function renderBlock(block: string, index: number): React.ReactNode {
  const lines = block.split('\n');
  const first = lines[0];

  // Heading
  const headingMatch = first.match(/^(#{1,4})\s+(.+)/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const text = headingMatch[2];
    const cls = [
      level === 1 ? 'text-lg font-bold mt-2' : '',
      level === 2 ? 'text-base font-semibold mt-1.5' : '',
      level === 3 ? 'text-sm font-semibold mt-1' : '',
      level === 4 ? 'text-sm font-medium mt-0.5' : '',
      'text-surface-900',
    ].filter(Boolean).join(' ');
    return <p key={index} className={cls}>{parseInline(text)}</p>;
  }

  // Horizontal rule
  if (/^[-*_]{3,}$/.test(first.trim())) {
    return <hr key={index} className="border-surface-200 my-2" />;
  }

  // Unordered list
  if (lines.every((l) => /^\s*[-*•]\s/.test(l) || l.trim() === '')) {
    const items = lines.filter((l) => /^\s*[-*•]\s/.test(l));
    return (
      <ul key={index} className="space-y-1 pl-4 list-none">
        {items.map((item, i) => {
          const text = item.replace(/^\s*[-*•]\s+/, '');
          return (
            <li key={i} className="flex gap-2 text-sm text-surface-700">
              <span className="text-primary-400 mt-0.5 flex-shrink-0">›</span>
              <span>{parseInline(text)}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  // Ordered list
  if (lines.every((l) => /^\s*\d+[.)]\s/.test(l) || l.trim() === '')) {
    const items = lines.filter((l) => /^\s*\d+[.)]\s/.test(l));
    return (
      <ol key={index} className="space-y-1 pl-4 list-none">
        {items.map((item, i) => {
          const text = item.replace(/^\s*\d+[.)]\s+/, '');
          return (
            <li key={i} className="flex gap-2 text-sm text-surface-700">
              <span className="text-primary-500 font-mono font-semibold flex-shrink-0 tabular-nums w-4 text-right">
                {i + 1}.
              </span>
              <span>{parseInline(text)}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  // Multi-line block — render each line with preserved line breaks
  if (lines.length > 1) {
    return (
      <p key={index} className="text-sm text-surface-700 leading-relaxed">
        {lines.map((line, i) => (
          <React.Fragment key={i}>
            {i > 0 && <br />}
            {parseInline(line)}
          </React.Fragment>
        ))}
      </p>
    );
  }

  // Single paragraph
  return (
    <p key={index} className="text-sm text-surface-700 leading-relaxed">
      {parseInline(first)}
    </p>
  );
}

export default function Prose({ content, className = '' }: ProseProps) {
  const blocks = splitBlocks(content);
  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, i) => renderBlock(block, i))}
    </div>
  );
}

"use client";

import {
  Fragment,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CitationChip } from "./citation-chip";

const CITATION_REGEX = /\[(\d+)\]/g;

function splitTextWithCitations(
  text: string,
  onCite: (id: number) => void,
): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let chipIndex = 0;

  for (const match of text.matchAll(CITATION_REGEX)) {
    const offset = match.index ?? 0;
    if (offset > lastIndex) parts.push(text.slice(lastIndex, offset));
    const n = Number(match[1]);
    parts.push(
      <CitationChip
        key={`cite-${chipIndex++}-${n}-${offset}`}
        n={n}
        onClick={() => onCite(n)}
      />,
    );
    lastIndex = offset + match[0].length;
  }

  if (parts.length === 0) return text;
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

function walkChildren(
  children: ReactNode,
  onCite: (id: number) => void,
): ReactNode {
  if (typeof children === "string") {
    return splitTextWithCitations(children, onCite);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => (
      <Fragment key={i}>{walkChildren(child, onCite)}</Fragment>
    ));
  }
  if (isValidElement(children)) {
    const element = children as ReactElement<{ children?: ReactNode }>;
    return cloneElement(
      element,
      undefined,
      walkChildren(element.props.children, onCite),
    );
  }
  return children;
}

type AnswerProps = {
  text: string;
  onCitationClick: (id: number) => void;
};

export function Answer({ text, onCitationClick }: AnswerProps) {
  const walk = (children: ReactNode) => walkChildren(children, onCitationClick);

  return (
    <div className="text-sm leading-6 text-zinc-900 dark:text-zinc-100">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="my-3 first:mt-0 last:mb-0">{walk(children)}</p>
          ),
          h1: ({ children }) => (
            <h1 className="mt-6 mb-3 text-lg font-semibold first:mt-0">
              {walk(children)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-5 mb-2 text-base font-semibold first:mt-0">
              {walk(children)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 text-sm font-semibold first:mt-0">
              {walk(children)}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="my-3 ml-5 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-5 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li>{walk(children)}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold">{walk(children)}</strong>
          ),
          em: ({ children }) => <em className="italic">{walk(children)}</em>,
          code: ({ children }) => (
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-[12px] dark:bg-zinc-800">
              {children}
            </code>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

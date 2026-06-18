'use client'

import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

const components: Components = {
  h2: ({ children }) => (
    <h3 className="mb-2 mt-5 border-b border-slate-200 pb-1.5 text-sm font-bold uppercase tracking-[0.08em] text-slate-800 first:mt-0">
      {children}
    </h3>
  ),
  h3: ({ children }) => (
    <h4 className="mb-2 mt-4 text-sm font-semibold text-slate-900 first:mt-0">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="mb-3 text-sm leading-relaxed text-slate-800 last:mb-0 sm:text-[15px]">{children}</p>
  ),
  strong: ({ children }) => <strong className="font-semibold text-slate-950">{children}</strong>,
  ul: ({ children }) => (
    <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-800 sm:text-[15px]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-800 sm:text-[15px]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="mb-3 border-l-4 border-sky-300 bg-sky-50/60 px-3 py-2 text-sm italic text-slate-700">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-slate-200" />,
  table: ({ children }) => (
    <div className="jarvis-report-table-wrap mb-4 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-left text-xs sm:text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-50 text-slate-600">{children}</thead>,
  tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
  tr: ({ children }) => <tr className="hover:bg-slate-50/80">{children}</tr>,
  th: ({ children }) => (
    <th className="whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide sm:px-4 sm:text-xs">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2.5 align-top text-slate-800 sm:px-4">{children}</td>
  ),
  code: ({ children }) => (
    <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-slate-800">
      {children}
    </code>
  ),
  img: ({ src, alt }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ''}
      className="my-3 max-h-[min(70vh,42rem)] w-full rounded-lg border border-slate-200 object-contain"
    />
  ),
}

interface JarvisReportMarkdownProps {
  content: string
  className?: string
}

export function JarvisReportMarkdown({ content, className }: JarvisReportMarkdownProps) {
  if (!content.trim()) return null

  return (
    <div
      className={cn(
        'jarvis-report-markdown rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5 sm:py-5',
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

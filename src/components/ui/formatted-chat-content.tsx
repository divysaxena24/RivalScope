"use client";

import React from "react";

interface FormattedChatContentProps {
  content: string;
  isUser: boolean;
}

export function FormattedChatContent({ content, isUser }: FormattedChatContentProps) {
  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  // Parse markdown tables and sections for assistant messages
  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let inTable = false;
  let keyIndex = 0;

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headerRow = tableRows[0];
      const dataRows = tableRows.slice(1);

      renderedElements.push(
        <div key={`table-${keyIndex++}`} className="my-3 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-800 font-semibold">
                {headerRow.map((cell, idx) => (
                  <th key={idx} className="px-3 py-2 border-r border-slate-200 last:border-r-0 whitespace-nowrap">
                    {cell.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50/75 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 border-r border-slate-100 last:border-r-0 text-slate-700">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Markdown table row detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());

      // Check if it's separator line (e.g. |---|:---|)
      const isSeparator = cells.every((c) => /^:?-+:?$/.test(c));
      if (isSeparator) {
        continue;
      }

      inTable = true;
      tableRows.push(cells);
      continue;
    } else {
      if (inTable) {
        flushTable();
      }
    }

    // Markdown Headers
    if (trimmed.startsWith("### ")) {
      renderedElements.push(
        <h4 key={`h3-${keyIndex++}`} className="text-sm font-bold text-slate-900 mt-3 mb-1.5 flex items-center gap-1.5">
          {trimmed.replace("### ", "")}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      renderedElements.push(
        <h3 key={`h2-${keyIndex++}`} className="text-base font-bold text-slate-900 mt-4 mb-2">
          {trimmed.replace("## ", "")}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      renderedElements.push(
        <h2 key={`h1-${keyIndex++}`} className="text-lg font-bold text-slate-900 mt-4 mb-2">
          {trimmed.replace("# ", "")}
        </h2>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      renderedElements.push(
        <li key={`li-${keyIndex++}`} className="text-xs sm:text-sm text-slate-700 ml-4 list-disc leading-relaxed my-0.5">
          {renderFormattedInline(trimmed.slice(2))}
        </li>
      );
    } else if (trimmed === "") {
      renderedElements.push(<div key={`sp-${keyIndex++}`} className="h-1.5" />);
    } else {
      renderedElements.push(
        <p key={`p-${keyIndex++}`} className="text-xs sm:text-sm text-slate-700 leading-relaxed">
          {renderFormattedInline(line)}
        </p>
      );
    }
  }

  if (inTable) {
    flushTable();
  }

  return <div className="space-y-1">{renderedElements}</div>;
}

function renderFormattedInline(text: string): React.ReactNode {
  // Simple bold and code format replacement
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={index} className="px-1 py-0.5 rounded bg-slate-200/70 text-slate-800 text-[11px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

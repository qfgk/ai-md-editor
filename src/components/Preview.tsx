import React, { forwardRef, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";
import { Mermaid } from "@/components/Mermaid";

interface PreviewProps {
  content: string;
}

export const Preview = forwardRef<HTMLDivElement, PreviewProps>(({ content }, ref) => {
  // Sanitize and process HTML content to allow video tags
  const sanitizedContent = useMemo(() => {
    return content.replace(
      /<video([^>]*)>/gi,
      (match, attributes) => {
        // Allow only safe attributes
        const safeAttrs = attributes
          .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
          .replace(/javascript:/gi, '') // Remove javascript: URLs
          .replace(/onerror="[^"]*"/gi, ''); // Remove onerror
        return `<video${safeAttrs}>`;
      }
    );
  }, [content]);

  // Track checkbox states
  const checkboxStates = useMemo(() => {
    const states: Record<string, boolean> = {};
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const match = line.match(/^\s*-\s*\[([ x])\]/);
      if (match) {
        states[`task-${index}`] = match[1] === 'x' || match[1] === 'X';
      }
    });
    return states;
  }, [content]);

  const handleCheckboxChange = (taskId: string, checked: boolean) => {
    // This would need to update the markdown content
    // For now, just update local state
    checkboxStates[taskId] = checked;
  };

  return (
    <div
      ref={ref}
      className="h-full w-full overflow-auto bg-background p-8 transition-colors"
      id="preview-scroller"
    >
      <div className="prose prose-slate dark:prose-invert max-w-none mx-auto pb-20">
        <style>{`
          /* Task list styles */
          .task-list-item {
            list-style-type: none;
            margin-left: -1.5em;
          }
          .task-list-item-checkbox {
            appearance: none;
            -webkit-appearance: none;
            width: 1.2em;
            height: 1.2em;
            border: 2px solid #94a3b8;
            border-radius: 0.25em;
            margin-right: 0.5em;
            cursor: pointer;
            position: relative;
            top: 0.15em;
            transition: all 0.2s;
          }
          .dark .task-list-item-checkbox {
            border-color: #64748b;
          }
          .task-list-item-checkbox:hover {
            border-color: #3b82f6;
          }
          .task-list-item-checkbox:checked {
            background-color: #3b82f6;
            border-color: #3b82f6;
            background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
          }
          .task-list-item-text {
            text-decoration: none;
            transition: text-decoration 0.2s;
          }
          .task-list-item-checkbox:checked + .task-list-item-text {
            text-decoration: line-through;
            color: #94a3b8;
          }
          .dark .task-list-item-checkbox:checked + .task-list-item-text {
            color: #64748b;
          }
        `}</style>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeKatex]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || "");
              const isMermaid = match && match[1] === "mermaid";

              if (!inline && isMermaid) {
                return <Mermaid chart={String(children).replace(/\n$/, "")} />;
              }

              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            // Custom video component for better control
            video({ node, ...props }: any) {
              return (
                <div className="my-6 flex justify-center">
                  <video
                    {...props}
                    className="max-w-full rounded-lg shadow-lg"
                    controls
                  />
                </div>
              );
            },
            // Custom task list item rendering
            li({ node, children, ...props }: any) {
              const isTask = node?.children?.[0]?.type === 'paragraph' &&
                             node?.children?.[0]?.children?.[0]?.type === 'input';
              const isChecked = node?.children?.[0]?.children?.[0]?.properties?.checked;

              if (isTask) {
                return (
                  <li className="task-list-item" {...props}>
                    <input
                      type="checkbox"
                      className="task-list-item-checkbox"
                      checked={isChecked || false}
                      readOnly
                    />
                    <span className="task-list-item-text">
                      {node?.children?.[0]?.children?.slice(1)}
                    </span>
                  </li>
                );
              }

              return <li {...props}>{children}</li>;
            },
          }}
        >
          {sanitizedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
});

Preview.displayName = "Preview";

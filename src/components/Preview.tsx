import React, { forwardRef, useMemo } from "react";
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

  return (
    <div
      ref={ref}
      className="h-full w-full overflow-auto bg-background p-8 transition-colors"
      id="preview-scroller"
    >
      <div className="prose prose-slate dark:prose-invert max-w-none mx-auto pb-20">
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
          }}
        >
          {sanitizedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
});

Preview.displayName = "Preview";

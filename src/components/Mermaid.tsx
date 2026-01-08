import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { nanoid } from "nanoid";
import { useTheme } from "@/contexts/ThemeContext";

// Suppress Mermaid console errors
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Syntax error in text')) {
    return; // Suppress Mermaid syntax errors
  }
  originalError.apply(console, args);
};

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "default",
  logLevel: "error", // Only show errors, suppress info and debug
});

interface MermaidProps {
  chart: string;
}

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const { theme } = useTheme();

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "default",
      logLevel: "error",
    });
  }, [theme]);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current || !chart.trim()) return;

      const id = `mermaid-${nanoid()}`;
      setError("");
      setSvg("");

      try {
        // Validate the chart first
        const isValid = await mermaid.parse(chart);
        if (!isValid) {
          setError("Invalid Mermaid syntax");
          return;
        }

        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
      } catch (err: any) {
        console.error("Mermaid render error:", err);
        const errorMsg = err?.str || err?.message || "Failed to render diagram";
        setError(errorMsg);
      }
    };

    renderChart();
  }, [chart, theme]);

  if (error) {
    return (
      <div className="my-6 p-4 border border-destructive/50 rounded bg-destructive/10">
        <div className="text-destructive text-sm font-medium mb-2">Mermaid Diagram Error</div>
        <div className="text-destructive/70 text-xs">{error}</div>
        <details className="mt-2">
          <summary className="text-destructive/60 text-xs cursor-pointer hover:text-destructive/80">
            View source code
          </summary>
          <pre className="mt-2 p-2 bg-background/50 rounded text-xs overflow-x-auto">
            <code>{chart}</code>
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid my-6 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

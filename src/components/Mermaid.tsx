import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { nanoid } from "nanoid";
import { useTheme } from "@/contexts/ThemeContext";

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "loose",
  theme: "default",
});

interface MermaidProps {
  chart: string;
}

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const { theme } = useTheme();

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "default",
    });
  }, [theme]);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current) return;
      
      const id = `mermaid-${nanoid()}`;
      try {
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
      } catch (error) {
        console.error("Mermaid render error:", error);
        setSvg(`<div class="text-destructive text-sm p-2 border border-destructive/50 rounded bg-destructive/10">Failed to render diagram</div>`);
      }
    };

    renderChart();
  }, [chart, theme]);

  return (
    <div 
      ref={containerRef} 
      className="mermaid my-6 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};

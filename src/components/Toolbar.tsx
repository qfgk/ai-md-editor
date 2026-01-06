import React from "react";
import { EditorView } from "@codemirror/view";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Image as ImageIcon,
  Minus,
  Table,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ToolbarProps {
  editorView: EditorView | null;
}

export const Toolbar: React.FC<ToolbarProps> = ({ editorView }) => {
  if (!editorView) return null;

  const insertText = (
    prefix: string,
    suffix: string = "",
    cursorOffset: number = 0
  ) => {
    const { state, dispatch } = editorView;
    const selection = state.selection.main;
    const selectedText = state.sliceDoc(selection.from, selection.to);

    const textToInsert = prefix + selectedText + suffix;
    
    dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: textToInsert,
      },
      selection: { 
        anchor: selection.from + prefix.length + (selectedText ? selectedText.length : 0) + cursorOffset 
      },
      userEvent: "input.type",
    });
    
    editorView.focus();
  };

  const insertLineStart = (prefix: string) => {
    const { state, dispatch } = editorView;
    const selection = state.selection.main;
    const line = state.doc.lineAt(selection.from);
    
    dispatch({
      changes: {
        from: line.from,
        to: line.from,
        insert: prefix,
      },
      userEvent: "input.type",
    });
    editorView.focus();
  };

  const tools = [
    {
      icon: <Bold size={16} />,
      label: "加粗",
      action: () => insertText("**", "**"),
      shortcut: "Ctrl+B",
    },
    {
      icon: <Italic size={16} />,
      label: "斜体",
      action: () => insertText("*", "*"),
      shortcut: "Ctrl+I",
    },
    { separator: true },
    {
      icon: <Heading1 size={16} />,
      label: "一级标题",
      action: () => insertLineStart("# "),
    },
    {
      icon: <Heading2 size={16} />,
      label: "二级标题",
      action: () => insertLineStart("## "),
    },
    {
      icon: <Heading3 size={16} />,
      label: "三级标题",
      action: () => insertLineStart("### "),
    },
    { separator: true },
    {
      icon: <List size={16} />,
      label: "无序列表",
      action: () => insertLineStart("- "),
    },
    {
      icon: <ListOrdered size={16} />,
      label: "有序列表",
      action: () => insertLineStart("1. "),
    },
    {
      icon: <Quote size={16} />,
      label: "引用",
      action: () => insertLineStart("> "),
    },
    { separator: true },
    {
      icon: <Code size={16} />,
      label: "代码块",
      action: () => insertText("```\n", "\n```", -4), // Cursor inside block
    },
    {
      icon: <LinkIcon size={16} />,
      label: "链接",
      action: () => insertText("[", "](url)"),
    },
    {
      icon: <ImageIcon size={16} />,
      label: "插入图片",
      action: () => insertText("![alt text](", ")"),
    },
    {
      icon: <Table size={16} />,
      label: "表格",
      action: () => insertText(
        "| Header | Header |\n| :--- | :--- |\n| Cell | Cell |\n"
      ),
    },
    { separator: true },
    {
      icon: <Minus size={16} />,
      label: "分割线",
      action: () => insertText("\n---\n"),
    },
  ];

  return (
    <div className="flex items-center gap-1 p-2 border-b border-border bg-sidebar overflow-x-auto shrink-0">
      {tools.map((tool, index) => {
        if (tool.separator) {
          return <div key={index} className="w-px h-6 bg-border mx-1 shrink-0" />;
        }
        return (
          <Tooltip key={tool.label}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={tool.action}
              >
                {tool.icon}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tool.label} {tool.shortcut && <span className="text-xs opacity-50 ml-2">({tool.shortcut})</span>}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
};

import React, { useCallback, useEffect, useRef, useState } from "react";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser as ProseMirrorDOMParser } from "prosemirror-model";
import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { history, undo, redo } from "prosemirror-history";
import { baseKeymap, toggleMark, setBlockType, chainCommands, exitCode, joinUp, joinDown, lift, selectParentNode } from "prosemirror-commands";
import { wrapInList, splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";
import { tableEditing } from "prosemirror-tables";
import { useTheme } from "@/contexts/ThemeContext";
import { useSettings } from "@/contexts/SettingsContext";
import { toast } from "sonner";
import { uploadImage, uploadVideo } from "@/lib/image-upload";
import { htmlToMarkdownAsync, getHTMLFromClipboard, downloadImageAsFile } from "@/lib/html-to-markdown";
import mermaid from "mermaid";

// Initialize Mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

// Enhanced schema with fenced code blocks that support language parameter
const schema = new Schema({
  nodes: {
    doc: {
      content: "block+"
    },
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM() { return ["p", 0]; }
    },
    blockquote: {
      content: "block+",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "blockquote" }],
      toDOM() { return ["blockquote", 0]; }
    },
    horizontal_rule: {
      group: "block",
      parseDOM: [{ tag: "hr" }],
      toDOM() { return ["hr"]; }
    },
    heading: {
      attrs: { level: { default: 1 } },
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [
        { tag: "h1", attrs: { level: 1 } },
        { tag: "h2", attrs: { level: 2 } },
        { tag: "h3", attrs: { level: 3 } },
        { tag: "h4", attrs: { level: 4 } },
        { tag: "h5", attrs: { level: 5 } },
        { tag: "h6", attrs: { level: 6 } },
      ],
      toDOM(node) { return ["h" + node.attrs.level, 0]; }
    },
    code_block: {
      attrs: { language: { default: null } },
      content: "text*",
      marks: "",
      group: "block",
      code: true,
      defining: true,
      parseDOM: [{
        tag: "pre",
        getAttrs(dom) {
          const code = (dom as HTMLElement).querySelector('code');
          if (code) {
            const classList = code.className;
            const langMatch = classList.match(/language-(\w+)/);
            return {
              language: langMatch ? langMatch[1] : null
            };
          }
          return {};
        }
      }],
      toDOM(node) {
        const attrs = node.attrs.language ? { class: `language-${node.attrs.language}`, "data-language": node.attrs.language } : {};
        return ["pre", ["code", attrs, 0]];
      }
    },
    text: {
      group: "inline"
    },
    image: {
      inline: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null }
      },
      group: "inline",
      draggable: true,
      parseDOM: [{
        tag: "img[src]",
        getAttrs(dom) {
          return {
            src: (dom as HTMLElement).getAttribute("src"),
            title: (dom as HTMLElement).getAttribute("title"),
            alt: (dom as HTMLElement).getAttribute("alt")
          };
        }
      }],
      toDOM(node) {
        const { src, alt, title } = node.attrs;
        return ["img", { src, alt, title }];
      }
    },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      parseDOM: [{ tag: "br" }],
      toDOM() { return ["br"]; }
    },
    ordered_list: {
      content: "list_item+",
      group: "block",
      attrs: { order: { default: 1 } },
      parseDOM: [{
        tag: "ol",
        getAttrs(dom) {
          return { order: (dom as HTMLElement).hasAttribute("start") ? +(dom as HTMLElement).getAttribute("start")! : 1 };
        }
      }],
      toDOM(node) {
        return node.attrs.order === 1 ? ["ol", 0] : ["ol", { start: node.attrs.order }, 0];
      }
    },
    bullet_list: {
      content: "list_item+",
      group: "block",
      parseDOM: [{ tag: "ul:not(.task-list)" }],
      toDOM() { return ["ul", 0]; }
    },
    list_item: {
      content: "paragraph block*",
      parseDOM: [{ tag: "li:not(.task-item)" }],
      toDOM() { return ["li", 0]; },
      defining: true
    },
    // Task list support
    task_list: {
      content: "task_item+",
      group: "block",
      parseDOM: [{
        tag: "ul.task-list",
      }],
      toDOM() { return ["ul", { class: "task-list" }, 0]; }
    },
    task_item: {
      content: "paragraph block*",
      attrs: {
        checked: { default: false }
      },
      parseDOM: [{
        tag: "li.task-item",
        getAttrs(dom) {
          const input = (dom as HTMLElement).querySelector('input[type="checkbox"]') as HTMLInputElement;
          return {
            checked: input ? input.checked : false
          };
        }
      }],
      toDOM(node) {
        return ["li", {
          class: "task-item",
          "data-checked": node.attrs.checked
        }, ["input", {
          type: "checkbox",
          checked: node.attrs.checked,
          contentEditable: "false"
        }], 0];
      }
    },
    // Table nodes
    table: {
      content: "table_row+",
      group: "block",
      parseDOM: [{ tag: "table" }],
      toDOM() { return ["table", 0]; }
    },
    table_row: {
      content: "(table_cell | table_header)*",
      parseDOM: [{ tag: "tr" }],
      toDOM() { return ["tr", 0]; }
    },
    table_header: {
      content: "paragraph block*",
      parseDOM: [{ tag: "th" }],
      toDOM() { return ["th", 0]; }
    },
    table_cell: {
      content: "paragraph block*",
      parseDOM: [{ tag: "td" }],
      toDOM() { return ["td", 0]; }
    }
  },
  marks: {
    link: {
      attrs: {
        href: {},
        title: { default: null }
      },
      inclusive: false,
      parseDOM: [{
        tag: "a[href]",
        getAttrs(dom) {
          return {
            href: (dom as HTMLElement).getAttribute("href"),
            title: (dom as HTMLElement).getAttribute("title")
          };
        }
      }],
      toDOM(node) {
        const { href, title } = node.attrs;
        return ["a", { href, title }, 0];
      }
    },
    em: {
      parseDOM: [
        { tag: "i" },
        { tag: "em" },
        { style: "font-style=italic" }
      ],
      toDOM() { return ["em", 0]; }
    },
    strong: {
      parseDOM: [
        { tag: "strong" },
        { tag: "b" },
        { style: "font-weight", getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value as string) && null }
      ],
      toDOM() { return ["strong", 0]; }
    },
    code: {
      parseDOM: [{ tag: "code" }],
      toDOM() { return ["code", 0]; }
    }
  }
});

// Build input rules
function headingRule(level: number): InputRule {
  return textblockTypeInputRule(
    new RegExp("^(#{1," + level + "})\\s$"),
    schema.nodes.heading,
    (match) => ({ level: match[1].length })
  );
}

function blockQuoteRule(): InputRule {
  return wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote);
}

function orderedListRule(): InputRule {
  return wrappingInputRule(
    /^(\d+)\.\s$/,
    schema.nodes.ordered_list,
    (match) => ({ order: +match[1] }),
    (match, node) => node.childCount + node.attrs.order === +match[1]
  );
}

function bulletListRule(): InputRule {
  return wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list);
}

function taskListRule(): InputRule {
  return wrappingInputRule(/^\s*-\s*\[\s*\]\s$/, schema.nodes.task_list);
}

function codeBlockRule(): InputRule {
  return textblockTypeInputRule(/^```$/, schema.nodes.code_block);
}

// Input rule for markdown-style links [text](url)
function linkRule(): InputRule {
  return new InputRule(
    /\[([^\]]+)\]\(([^)]+)\)$/,
    (state, match, start, end) => {
      const { link } = state.schema.marks;
      const text = match[1];
      const url = match[2];

      // Create a transaction that replaces the matched text with a link
      const tr = state.tr;

      // Replace the entire match with the link text
      tr.insertText(text, start, end);

      // Add the link mark to the inserted text
      const linkMark = link.create({ href: url });
      tr.addMark(start, start + text.length, linkMark);

      return tr;
    }
  );
}

// Build input rules array
const inputRulesPlugin = inputRules({
  rules: [
    blockQuoteRule(),
    orderedListRule(),
    bulletListRule(),
    taskListRule(),
    codeBlockRule(),
    headingRule(1),
    headingRule(2),
    headingRule(3),
    headingRule(4),
    headingRule(5),
    headingRule(6),
    linkRule(),
  ]
});

// Build keymap
const mac = typeof navigator !== "undefined" ? /Mac|iP(hone|[oa]d)/.test(navigator.platform) : false;

function buildKeymap() {
  const keys: any = {};

  keys["Mod-z"] = undo;
  keys["Shift-Mod-z"] = redo;
  if (!mac) keys["Mod-y"] = redo;

  keys["Mod-b"] = toggleMark(schema.marks.strong);
  keys["Mod-i"] = toggleMark(schema.marks.em);
  keys["Mod-`"] = toggleMark(schema.marks.code);
  keys["Mod-k"] = chainCommands(
    exitCode,
    (state, dispatch, view) => {
      if (dispatch) {
        const url = prompt("Link URL:");
        if (url) {
          const mark = schema.marks.link.create({ href: url });
          dispatch(state.tr.addMark(state.selection.from, state.selection.to, mark));
        }
      }
      return true;
    }
  );

  keys["Alt-ArrowUp"] = joinUp;
  keys["Alt-ArrowDown"] = joinDown;
  keys["Mod-BracketLeft"] = lift;
  keys["Escape"] = selectParentNode;

  keys["Enter"] = chainCommands(
    splitListItem(schema.nodes.list_item),
    splitListItem(schema.nodes.task_item),
    liftListItem(schema.nodes.list_item),
    liftListItem(schema.nodes.task_item),
    (state, dispatch) => {
      const { $from } = state.selection;
      if ($from.parent.type === schema.nodes.code_block) {
        if (dispatch) {
          dispatch(state.tr.insertText("\n"));
        }
        return true;
      }
      return false;
    }
  );

  keys["Mod-Enter"] = chainCommands(
    exitCode,
    (state, dispatch) => {
      if (dispatch) {
        dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
      }
      return true;
    }
  );

  keys["Shift-Enter"] = chainCommands(
    exitCode,
    (state, dispatch) => {
      if (dispatch) {
        dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
      }
      return true;
    }
  );

  keys["Backspace"] = chainCommands(
    (state, dispatch) => {
      if (!(state.selection instanceof TextSelection)) return false;
      const { $cursor } = state.selection;
      if (!$cursor) return false;

      if ($cursor.parent.type.name === 'paragraph' && $cursor.parentOffset === 0) {
        const nodeBefore = $cursor.nodeBefore;
        if (!nodeBefore) {
          const $pos = state.doc.resolve($cursor.before());
          if ($pos.depth > 0) {
            const parentNode = $pos.node($pos.depth - 1);
            if (parentNode.type.name === 'list_item' || parentNode.type.name === 'task_item') {
              return liftListItem(schema.nodes.list_item)(state, dispatch);
            }
          }
        }
      }
      return false;
    },
    (state, dispatch) => {
      if (!(state.selection instanceof TextSelection)) return false;
      const { $cursor } = state.selection;
      if (!$cursor) return false;

      if ($cursor.parent.type.name === 'paragraph' && $cursor.parentOffset === 0) {
        const nodeBefore = $cursor.nodeBefore;
        if (!nodeBefore && $cursor.parent.childCount === 0) {
          return setBlockType(schema.nodes.paragraph)(state, dispatch);
        }
      }
      return false;
    }
  );

  keys["Mod-Shift-C"] = (state, dispatch) => {
    const { $from } = state.selection;
    const node = $from.parent;

    // Check if we're in a task item
    if (node.type.name === 'task_item') {
      if (dispatch) {
        const newChecked = !node.attrs.checked;
        const pos = $from.before($from.depth);
        dispatch(state.tr.setNodeMarkup(pos, null, { ...node.attrs, checked: newChecked }));
      }
      return true;
    }

    // If not in task list, insert one
    if (dispatch) {
      const taskList = schema.nodes.task_list.create();
      const taskItem = schema.nodes.task_item.createAndFill({ checked: false });
      if (taskItem) {
        const tr = state.tr.replaceSelectionWith(taskList);
        const pos = tr.selection.from - 1;
        dispatch(tr.insert(pos, taskItem));
      }
    }
    return true;
  };

  keys["Delete"] = (state, dispatch) => {
    const { $cursor } = state.selection;
    if (!$cursor || $cursor.parent.type.name !== 'paragraph') return false;

    const nodeAfter = $cursor.nodeAfter;
    if (!nodeAfter) return false;

    return false;
  };

  return keymap(keys);
}

// Create plugins array
const plugins = [
  buildKeymap(),
  keymap(baseKeymap),
  inputRulesPlugin,
  history(),
  tableEditing(),
];

interface WysiwygEditorProps {
  content: string;
  onChange: (content: string) => void;
  onEditorReady?: (view: EditorView) => void;
}

export const WysiwygEditor: React.FC<WysiwygEditorProps> = ({ content, onChange, onEditorReady }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { theme } = useTheme();
  const { fontSize, defaultImageUploadProvider } = useSettings();
  const [isReady, setIsReady] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ pos: number; attrs: { src: string; alt: string | null; title: string | null } } | null>(null);
  const [editingImageMarkdown, setEditingImageMarkdown] = useState("");
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMarkdownRef = useRef<string>(content);
  const isUpdatingRef = useRef(false);
  const isExternalUpdateRef = useRef(false);
  const renderMermaidRef = useRef<(() => Promise<void>) | null>(null);

  // Enhanced Markdown to HTML parser with better support for syntax
  const markdownToHTML = useCallback((markdown: string): string => {
    const lines = markdown.split('\n');
    const result: string[] = [];
    let inCodeBlock = false;
    let codeBlockLang: string | null = null;
    let codeBlockContent: string[] = [];
    let inList = false;
    let inTaskList = false;
    let inTable = false;
    let tableRows: string[] = [];
    let tableHeader: boolean = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle code blocks
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          // Start code block
          const lang = line.trim().substring(3).trim();
          codeBlockLang = lang || null;
          inCodeBlock = true;
          codeBlockContent = [];
        } else {
          // End code block
          const codeClass = codeBlockLang ? ` class="language-${codeBlockLang}"` : '';
          const dataLang = codeBlockLang ? ` data-language="${codeBlockLang}"` : '';
          result.push(`<pre><code${codeClass}${dataLang}>${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`);
          inCodeBlock = false;
          codeBlockLang = null;
          codeBlockContent = [];
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Handle tables
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
          tableHeader = false;
        }

        // Check if it's the separator row
        if (line.match(/^\|[\s\-:]+\|$/)) {
          tableHeader = true;
          continue;
        }

        const cells = line.split('|').filter((_, idx, arr) => idx !== 0 && idx !== arr.length - 1);
        const cellTags = cells.map(cell => `<td>${parseInlineMarkdown(cell.trim())}</td>`).join('');
        tableRows.push(`<tr>${cellTags}</tr>`);
        continue;
      } else if (inTable) {
        // End of table
        if (tableRows.length > 0) {
          result.push('<table>');
          result.push(tableRows.join('\n'));
          result.push('</table>');
        }
        inTable = false;
        tableRows = [];
      }

      // Handle task lists
      const taskMatch = line.match(/^(\s*)-\s*\[([ x])\]\s+(.*)$/);
      if (taskMatch) {
        if (!inTaskList) {
          if (inList) result.push('</ul>');
          result.push('<ul class="task-list">');
          inTaskList = true;
        }
        const checked = taskMatch[2] === 'x' || taskMatch[2] === 'X';
        result.push(`<li class="task-item" data-checked="${checked}"><input type="checkbox" ${checked ? 'checked' : ''} contentEditable="false" />${parseInlineMarkdown(taskMatch[3])}</li>`);
        continue;
      } else if (inTaskList) {
        result.push('</ul>');
        inTaskList = false;
      }

      // Handle regular lists
      const listMatch = line.match(/^(\s*)([-*])\s+(.*)$/);
      if (listMatch) {
        if (!inList) {
          result.push('<ul>');
          inList = true;
        }
        result.push(`<li>${parseInlineMarkdown(listMatch[3])}</li>`);
        continue;
      } else if (inList) {
        result.push('</ul>');
        inList = false;
      }

      // Handle ordered lists
      const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
      if (orderedMatch) {
        if (!inList) {
          result.push('<ol>');
          inList = true;
        }
        result.push(`<li>${parseInlineMarkdown(orderedMatch[2])}</li>`);
        continue;
      }

      // Handle headings
      const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        result.push(`<h${level}>${parseInlineMarkdown(headingMatch[2])}</h${level}>`);
        continue;
      }

      // Handle blockquote
      if (line.trim().startsWith('>')) {
        result.push(`<blockquote>${parseInlineMarkdown(line.trim().substring(1).trim())}</blockquote>`);
        continue;
      }

      // Handle horizontal rule
      if (line.match(/^(-{3,}|_{3,}|\*{3,})$/)) {
        result.push('<hr>');
        continue;
      }

      // Handle empty lines
      if (line.trim() === '') {
        continue;
      }

      // Handle regular paragraphs
      result.push(`<p>${parseInlineMarkdown(line)}</p>`);
    }

    // Close any open tags
    if (inTable && tableRows.length > 0) {
      result.push('<table>');
      result.push(tableRows.join('\n'));
      result.push('</table>');
    }
    if (inTaskList) result.push('</ul>');
    if (inList) {
      result.push(inTaskList ? '</ul>' : '</ul>');
    }

    return result.join('\n');
  }, []);

  // Helper function to parse inline markdown
  function parseInlineMarkdown(text: string): string {
    return text
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  }

  // Helper function to escape HTML
  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Parse image markdown to extract src, alt, and title
  function parseImageMarkdown(markdown: string): { src: string; alt: string; title: string | null } | null {
    const match = markdown.match(/^!\[([^\]]*)\]\(([^)]+)(?:\s+"([^"]+)")?\)$/);
    if (!match) return null;

    return {
      alt: match[1] || '',
      src: match[2],
      title: match[3] || null
    };
  }

  // Handle saving the edited image
  const handleSaveImageEdit = useCallback(() => {
    if (!selectedImage || !viewRef.current) return;

    const parsed = parseImageMarkdown(editingImageMarkdown);
    if (!parsed) {
      toast.error('Invalid image markdown format');
      return;
    }

    const { src, alt, title } = parsed;
    const view = viewRef.current;

    // Create a new image node with updated attributes
    const newImageNode = schema.nodes.image.create({ src, alt, title });

    // Replace the old image with the new one
    const tr = view.state.tr.replaceWith(selectedImage.pos, selectedImage.pos + 1, newImageNode);
    view.dispatch(tr);

    setSelectedImage(null);
    setEditingImageMarkdown('');
  }, [selectedImage, editingImageMarkdown]);

  // Handle canceling the image edit
  const handleCancelImageEdit = useCallback(() => {
    setSelectedImage(null);
    setEditingImageMarkdown('');
  }, []);

  // Handle clicking outside to close the editor
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSaveImageEdit();
    } else if (e.key === 'Escape') {
      handleCancelImageEdit();
    }
  }, [handleSaveImageEdit, handleCancelImageEdit]);

  // Enhanced ProseMirror to Markdown converter (optimized for performance)
  const prosemirrorToMarkdown = useCallback((view: EditorView): string => {
    const blocks: string[] = [];

    view.state.doc.forEach((node, offset) => {
      if (!node.isBlock) return;

      const nodePos = offset + 1; // Adjust for document start

      switch (node.type.name) {
        case "heading": {
          const level = "#".repeat(node.attrs.level);
          const text = getNodeTextContent(node);
          blocks.push(`${level} ${text}\n`);
          break;
        }

        case "paragraph": {
          const text = getNodeTextContent(node);
          if (text.trim()) {
            blocks.push(`${text}\n`);
          }
          break;
        }

        case "blockquote": {
          const text = getNodeTextContent(node);
          blocks.push(`> ${text}\n`);
          break;
        }

        case "code_block": {
          const lang = node.attrs.language || '';
          // For mermaid diagrams, try to get the original code from DOM
          let text = node.textContent;

          // Check if this is a mermaid block and try to get original code
          if (lang === 'mermaid' && text.trim() === '') {
            // Try to get from data attribute
            const dom = view.domAtPos(nodePos);
            const preElement = dom.node?.parentElement;
            if (preElement) {
              const dataCode = preElement.getAttribute('data-original-code');
              if (dataCode) {
                text = dataCode;
              } else {
                // Try to extract from HTML comment
                const html = preElement.innerHTML;
                const commentMatch = html.match(/<!-- MERMAID_ORIGINAL_CODE:([^-]+) -->/);
                if (commentMatch) {
                  text = decodeURIComponent(commentMatch[1]);
                }
              }
            }
          }

          blocks.push(`\`\`\`${lang}\n${text}\n\`\`\`\n`);
          break;
        }

        case "ordered_list":
          node.forEach((li) => {
            const text = getNodeTextContent(li);
            blocks.push(`1. ${text}\n`);
          });
          blocks.push("\n");
          break;

        case "bullet_list":
          node.forEach((li) => {
            const text = getNodeTextContent(li);
            blocks.push(`- ${text}\n`);
          });
          blocks.push("\n");
          break;

        case "task_list":
          node.forEach((taskItem) => {
            const checked = taskItem.attrs.checked ? "[x]" : "[ ]";
            const text = getNodeTextContent(taskItem);
            blocks.push(`- ${checked} ${text}\n`);
          });
          blocks.push("\n");
          break;

        case "horizontal_rule":
          blocks.push(`---\n\n`);
          break;

        case "table": {
          const table: string[][] = [];

          // Extract table rows
          node.forEach((row) => {
            if (row.type.name === 'table_row' || row.type.name === 'table_header') {
              const cells: string[] = [];
              row.forEach((cell) => {
                if (cell.type.name === 'table_cell' || cell.type.name === 'table_header') {
                  cells.push(getNodeTextContent(cell).trim());
                }
              });
              table.push(cells);
            }
          });

          // Convert table to markdown
          if (table.length > 0) {
            const header = table[0];
            const separator = header.map(() => '---').join(' | ');

            blocks.push(`| ${header.join(' | ')} |\n`);
            blocks.push(`| ${separator} |\n`);

            for (let i = 1; i < table.length; i++) {
              blocks.push(`| ${table[i].join(' | ')} |\n`);
            }

            blocks.push('\n');
          }
          break;
        }
      }
    });

    return blocks.join('');
  }, []);

  // Helper function to get node text content with inline formatting
  function getNodeTextContent(node: any): string {
    let text = '';
    node.forEach((child: any) => {
      if (child.isText) {
        let markedText = child.text;
        child.marks?.forEach((mark: any) => {
          switch (mark.type.name) {
            case "strong":
              markedText = `**${markedText}**`;
              break;
            case "em":
              markedText = `*${markedText}*`;
              break;
            case "code":
              markedText = `\`${markedText}\``;
              break;
            case "link":
              markedText = `[${markedText}](${mark.attrs.href})`;
              break;
          }
        });
        text += markedText;
      } else if (child.type.name === "image") {
        const alt = child.attrs.alt || '';
        const src = child.attrs.src;
        text += `![${alt}](${src})`;
      } else if (child.isBlock) {
        // Recursively handle nested blocks
        text += getNodeTextContent(child);
      }
    });
    return text;
  }

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;

    const doc = ProseMirrorDOMParser.fromSchema(schema).parse(
      new DOMParser().parseFromString(markdownToHTML(content), "text/html").body
    );

    const state = EditorState.create({
      doc,
      plugins,
    });

    const view = new EditorView(editorRef.current, {
      state,
      dispatchTransaction(transaction) {
        const newState = view.state.apply(transaction);
        view.updateState(newState);

        if (transaction.docChanged) {
          // Skip onChange if this is an external update
          if (isExternalUpdateRef.current) {
            isExternalUpdateRef.current = false;
          } else {
            // Mark that user is editing
            isUpdatingRef.current = true;

            // Debounce markdown updates to avoid excessive recalculations
            if (updateTimeoutRef.current) {
              clearTimeout(updateTimeoutRef.current);
            }
            updateTimeoutRef.current = setTimeout(() => {
              const markdown = prosemirrorToMarkdown(view);

              // Only call onChange if content actually changed
              if (markdown !== lastMarkdownRef.current) {
                lastMarkdownRef.current = markdown;
                onChange(markdown);
              }

              isUpdatingRef.current = false;
            }, 500); // Increased to 500ms for better performance
          }

          // Render Mermaid diagrams after document changes
          setTimeout(() => {
            renderMermaidRef.current?.();
          }, 100);
        }
      },
      attributes: {
        class: `prosemirror-editor ${theme === "dark" ? "dark" : "light"}`,
      },
      handleClickOn(view, pos, node, nodePos, event, direct) {
        // Handle image clicks
        if (node.type.name === 'image' && direct) {
          event.preventDefault();
          const { src, alt, title } = node.attrs;
          setSelectedImage({ pos: nodePos, attrs: { src, alt, title } });
          // Generate markdown for editing
          const altText = alt || '';
          const titleText = title ? ` "${title}"` : '';
          setEditingImageMarkdown(`![${altText}](${src}${titleText})`);
          return true;
        }
        return false;
      },
      handlePaste(view, event) {
        // First, check for HTML content (rich text from web browsers)
        const htmlData = getHTMLFromClipboard(event);
        if (htmlData) {
          event.preventDefault();

          const { from } = view.state.selection;

          // Insert processing placeholder
          const placeholderNode = schema.nodes.paragraph.create({}, view.state.schema.text('Processing...'));
          const tr = view.state.tr.replaceWith(from, view.state.selection.to, placeholderNode);
          view.dispatch(tr);

          // Process asynchronously
          (async () => {
            try {
              // Convert HTML to Markdown with image upload
              const markdown = await htmlToMarkdownAsync(htmlData, {
                preserveFormatting: true,
                convertLinks: true,
                convertImages: true,
                convertLists: true,
                convertHeadings: true,
                onImageFound: async (imageUrl) => {
                  if (!defaultImageUploadProvider) {
                    toast.info('建议配置云存储以自动上传图片');
                    return imageUrl;
                  }

                  try {
                    toast.loading('正在下载并上传图片...', { id: 'image-upload-wysiwyg' });
                    const file = await downloadImageAsFile(imageUrl);
                    const uploadedUrl = await uploadImage(file, defaultImageUploadProvider);
                    toast.success('图片上传成功', { id: 'image-upload-wysiwyg' });
                    return uploadedUrl;
                  } catch (error) {
                    console.error('Failed to upload image:', error);
                    toast.error('图片上传失败，使用原链接');
                    return imageUrl;
                  }
                },
              });

              // Convert Markdown to ProseMirror document
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = markdownToHTML(markdown);
              const doc = ProseMirrorDOMParser.fromSchema(schema).parse(tempDiv);

              // Replace placeholder with actual content
              const newTr = view.state.tr.replaceWith(from, from + 1, doc.content);
              view.dispatch(newTr);

            } catch (error) {
              console.error('Failed to convert HTML to Markdown:', error);
              // Remove placeholder on error
              const errorTr = view.state.tr.delete(from, from + 1);
              view.dispatch(errorTr);
              toast.error('转换失败，请重试');
            }
          })();

          return true;
        }

        // Then check for images/videos
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of items) {
          const isImage = item.type.startsWith("image/");
          const isVideo = item.type.startsWith("video/");

          if (isImage || isVideo) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) continue;

            (async () => {
              try {
                if (!defaultImageUploadProvider) {
                  toast.error("请先配置图片上传服务");
                  return;
                }

                const loadingId = isImage ? "image-upload" : "video-upload";
                toast.loading(isImage ? "正在上传图片..." : "正在上传视频...", { id: loadingId });

                let mediaUrl: string;
                if (isImage) {
                  mediaUrl = await uploadImage(file, defaultImageUploadProvider);
                } else {
                  mediaUrl = await uploadVideo(file, defaultImageUploadProvider);
                }

                toast.success(isImage ? "图片上传成功" : "视频上传成功", { id: loadingId });

                // Insert at cursor position
                const { from } = view.state.selection;
                const node = isImage
                  ? schema.nodes.image.create({ src: mediaUrl, alt: file.name })
                  : schema.nodes.paragraph.create();

                const tr = view.state.tr.insert(from, node);
                view.dispatch(tr);

              } catch (error) {
                toast.error(error instanceof Error ? error.message : (isImage ? "图片上传失败" : "视频上传失败"));
              }
            })();

            return true;
          }
        }
        return false;
      },
      handleDrop(view, event) {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        const file = files[0];
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");

        if (isImage || isVideo) {
          event.preventDefault();

          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!coords) return false;

          (async () => {
            try {
              if (!defaultImageUploadProvider) {
                toast.error("请先配置图片上传服务");
                return;
              }

              const loadingId = isImage ? "image-upload" : "video-upload";
              toast.loading(isImage ? "正在上传图片..." : "正在上传视频...", { id: loadingId });

              let mediaUrl: string;
              if (isImage) {
                mediaUrl = await uploadImage(file, defaultImageUploadProvider);
              } else {
                mediaUrl = await uploadVideo(file, defaultImageUploadProvider);
              }

              toast.success(isImage ? "图片上传成功" : "视频上传成功", { id: loadingId });

              const node = isImage
                ? schema.nodes.image.create({ src: mediaUrl, alt: file.name })
                : schema.nodes.paragraph.create();

              const tr = view.state.tr.insert(coords.pos, node);
              view.dispatch(tr);

            } catch (error) {
              toast.error(error instanceof Error ? error.message : (isImage ? "图片上传失败" : "视频上传失败"));
            }
          })();

          return true;
        }
        return false;
      },
    });

    viewRef.current = view;

    // Initialize lastMarkdownRef to prevent duplicate updates on initial load
    lastMarkdownRef.current = prosemirrorToMarkdown(view);

    // Render Mermaid diagrams
    const renderMermaidDiagrams = async () => {
      const codeBlocks = editorRef.current?.querySelectorAll('pre code[data-language="mermaid"]');
      if (!codeBlocks || codeBlocks.length === 0) return;

      for (const block of codeBlocks) {
        const pre = block.parentElement;
        if (!pre) continue;

        // Store original code before rendering
        const code = block.textContent || '';
        if (!code) continue;

        // Check if already rendered
        if (pre.classList.contains('mermaid-diagram')) continue;

        // Store original code in data attribute
        pre.setAttribute('data-original-code', code);

        try {
          const id = 'mermaid-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
          const { svg } = await mermaid.render(id, code);

          // Add hidden comment with original code before SVG
          const svgWithCode = `<!-- MERMAID_ORIGINAL_CODE:${encodeURIComponent(code)} -->${svg}`;

          pre.innerHTML = svgWithCode;
          pre.classList.add('mermaid-diagram');
        } catch (error) {
          console.error('Failed to render Mermaid diagram:', error);
          // Remove mermaid-diagram class if rendering failed
          pre.classList.remove('mermaid-diagram');
        }
      }
    };

    // Save render function to ref for use in transaction handler
    renderMermaidRef.current = renderMermaidDiagrams;

    // Initial render
    renderMermaidDiagrams();

    // Observe DOM changes for Mermaid diagrams
    const observer = new MutationObserver(() => {
      renderMermaidDiagrams();
    });

    if (editorRef.current) {
      observer.observe(editorRef.current, {
        childList: true,
        subtree: true,
      });
    }

    setIsReady(true);
    onEditorReady?.(view);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      observer.disconnect();
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update content when it changes externally (optimized to avoid conflicts)
  useEffect(() => {
    if (!isReady || !viewRef.current) return;

    // Don't update if user is actively typing or content is the same
    if (isUpdatingRef.current || updateTimeoutRef.current) return;

    const currentMarkdown = prosemirrorToMarkdown(viewRef.current);
    if (currentMarkdown !== content) {
      // Mark this as an external update to prevent triggering onChange
      isExternalUpdateRef.current = true;

      const doc = ProseMirrorDOMParser.fromSchema(schema).parse(
        new DOMParser().parseFromString(markdownToHTML(content), "text/html").body
      );
      const tr = viewRef.current.state.tr.replaceWith(0, viewRef.current.state.doc.content.size, doc.content);
      viewRef.current.dispatch(tr);

      // Update lastMarkdownRef to match the new content
      lastMarkdownRef.current = content;

      // Render Mermaid diagrams after external content update
      setTimeout(() => {
        renderMermaidRef.current?.();
      }, 100);
    }
  }, [content, isReady, markdownToHTML, prosemirrorToMarkdown]);

  return (
    <div className="h-full w-full bg-editor-bg flex flex-col">
      <style>{`
        .prosemirror-editor {
          outline: none;
          padding: 2rem;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          min-height: 100%;
        }

        .prosemirror-editor.dark {
          background-color: oklch(var(--color-background));
          color: oklch(var(--color-foreground));
        }

        .prosemirror-editor.light {
          background-color: oklch(var(--color-background));
          color: oklch(var(--color-foreground));
        }

        /* Typography - Match Tailwind prose styles */
        .prosemirror-editor > * + * {
          margin-top: 1.5em;
          margin-bottom: 0;
        }

        .prosemirror-editor h1:first-child,
        .prosemirror-editor h2:first-child,
        .prosemirror-editor h3:first-child,
        .prosemirror-editor h4:first-child,
        .prosemirror-editor p:first-child {
          margin-top: 0;
        }

        .prosemirror-editor h1,
        .prosemirror-editor h2,
        .prosemirror-editor h3,
        .prosemirror-editor h4,
        .prosemirror-editor h5,
        .prosemirror-editor h6 {
          font-weight: 600;
          line-height: 1.25;
        }

        .prosemirror-editor h1 { font-size: 2.25em; margin-top: 0; margin-bottom: 0.8888889em; }
        .prosemirror-editor h2 { font-size: 1.5em; margin-top: 2em; margin-bottom: 1em; }
        .prosemirror-editor h3 { font-size: 1.25em; margin-top: 1.6em; margin-bottom: 0.6em; }

        .prosemirror-editor p {
          margin-top: 1.25em;
          margin-bottom: 1.25em;
        }

        .prosemirror-editor blockquote {
          font-weight: 500;
          font-style: italic;
          color: #64748b;
          border-left-width: 0.25rem;
          border-left-color: #e2e8f0;
          quotes: "\\201C""\\201D""\\2018""\\2019";
          margin-top: 1.6em;
          margin-bottom: 1.6em;
          padding-left: 1em;
        }

        .dark .prosemirror-editor blockquote {
          border-left-color: #334155;
          color: #94a3b8;
        }

        .prosemirror-editor code {
          color: #e83e8c;
          font-weight: 600;
          font-size: 0.875em;
          background-color: #f1f5f9;
          padding: 0.2em 0.4em;
          border-radius: 0.25rem;
        }

        .dark .prosemirror-editor code {
          background-color: #1e293b;
          color: #f472b6;
        }

        .prosemirror-editor pre {
          color: #e2e8f0;
          background-color: #1e293b;
          overflow-x: auto;
          font-size: 0.875em;
          line-height: 1.7142857;
          margin-top: 1.7142857em;
          margin-bottom: 1.7142857em;
          border-radius: 0.375rem;
          padding: 0.8571429em 1.1428571em;
        }

        .prosemirror-editor pre code {
          background-color: transparent;
          border-width: 0;
          border-radius: 0;
          padding: 0;
          font-weight: 400;
          color: inherit;
        }

        .prosemirror-editor ul,
        .prosemirror-editor ol {
          list-style: disc outside;
          list-style-type: disc;
          list-style-position: outside;
          padding-left: 1.625em;
          margin-top: 1.25em;
          margin-bottom: 1.25em;
        }

        .prosemirror-editor ol {
          list-style: decimal outside;
          list-style-type: decimal;
          list-style-position: outside;
        }

        /* Nested lists */
        .prosemirror-editor ul ul,
        .prosemirror-editor ol ul,
        .prosemirror-editor ul ol,
        .prosemirror-editor ol ol {
          list-style: inherit;
          list-style-type: inherit;
        }

        .prosemirror-editor li {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        .prosemirror-editor ul > li::marker {
          color: #64748b;
        }

        .dark .prosemirror-editor ul > li::marker {
          color: #94a3b8;
        }

        /* Task lists */
        .prosemirror-editor ul.task-list {
          list-style: none;
          padding-left: 0;
        }

        .prosemirror-editor li.task-item {
          display: flex;
          align-items: flex-start;
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        .prosemirror-editor li.task-item input[type="checkbox"] {
          appearance: none;
          -webkit-appearance: none;
          width: 1.2em;
          height: 1.2em;
          border: 2px solid #94a3b8;
          border-radius: 0.25em;
          margin-right: 0.5em;
          margin-top: 0.15em;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.2s;
          position: relative;
        }

        .dark .prosemirror-editor li.task-item input[type="checkbox"] {
          border-color: #64748b;
        }

        .prosemirror-editor li.task-item input[type="checkbox"]:hover {
          border-color: #3b82f6;
        }

        .prosemirror-editor li.task-item input[type="checkbox"]:checked {
          background-color: #3b82f6;
          border-color: #3b82f6;
          background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e");
        }

        .prosemirror-editor li.task-item[data-checked="true"] {
          text-decoration: line-through;
          opacity: 0.6;
        }

        .prosemirror-editor img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 2em auto;
          border-radius: 0.5rem;
        }

        .prosemirror-editor a {
          color: #2563eb;
          text-decoration: underline;
          font-weight: 500;
        }

        .prosemirror-editor a:hover {
          color: #1d4ed8;
        }

        .prosemirror-editor hr {
          border-style: solid;
          border-color: #e2e8f0;
          border-width: 1px 0 0 0;
          height: 0;
          margin: 3em 0;
        }

        .dark .prosemirror-editor hr {
          border-color: #334155;
        }

        .ProseMirror-focused {
          outline: none;
        }

        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
        }

        .dark .ProseMirror p.is-editor-empty:first-child::before {
          color: #64748b;
        }

        /* Table styles */
        .prosemirror-editor table {
          border-collapse: collapse;
          width: 100%;
          margin: 1.5em 0;
          font-size: 0.875em;
        }

        .prosemirror-editor table td,
        .prosemirror-editor table th {
          border: 1px solid #e2e8f0;
          padding: 0.5em 0.75em;
          text-align: left;
        }

        .dark .prosemirror-editor table td,
        .dark .prosemirror-editor table th {
          border-color: #334155;
        }

        .prosemirror-editor table th {
          font-weight: 600;
          background-color: #f8fafc;
        }

        .dark .prosemirror-editor table th {
          background-color: #1e293b;
        }

        .prosemirror-editor table tr:hover {
          background-color: #f8fafc;
        }

        .dark .prosemirror-editor table tr:hover {
          background-color: #1e293b;
        }

        /* Selected table cells */
        .prosemirror-editor .selectedCell {
          background-color: rgba(59, 130, 246, 0.1);
        }

        .dark .prosemirror-editor .selectedCell {
          background-color: rgba(59, 130, 246, 0.2);
        }

        /* Mermaid diagram styles */
        .prosemirror-editor .mermaid-diagram {
          display: flex;
          justify-content: center;
          align-items: center;
          margin: 1.5em 0;
          background: transparent;
        }

        .prosemirror-editor .mermaid-diagram svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
      {selectedImage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[600px] max-w-[90vw]">
          <div className="bg-background border border-border rounded-lg shadow-lg p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">编辑图片</span>
              <button
                onClick={handleCancelImageEdit}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <input
              type="text"
              value={editingImageMarkdown}
              onChange={(e) => setEditingImageMarkdown(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 bg-editor-bg border border-border rounded-md text-foreground text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="![alt](url)"
              autoFocus
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">
                Ctrl+Enter 保存 · Esc 取消
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelImageEdit}
                  className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSaveImageEdit}
                  className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div
        ref={editorRef}
        className="flex-1 overflow-auto"
        style={{ fontSize: fontSize + 'px' }}
      />
    </div>
  );
};

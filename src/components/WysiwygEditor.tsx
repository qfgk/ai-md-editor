import React, { useCallback, useEffect, useRef, useState } from "react";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Schema, DOMParser as ProseMirrorDOMParser } from "prosemirror-model";
import { schema as basicSchema } from "prosemirror-schema-basic";
import { addListNodes } from "prosemirror-schema-list";
import { inputRules, wrappingInputRule, textblockTypeInputRule, InputRule } from "prosemirror-inputrules";
import { keymap } from "prosemirror-keymap";
import { history, undo, redo } from "prosemirror-history";
import { baseKeymap, toggleMark, setBlockType, chainCommands, exitCode, joinUp, joinDown, lift, selectParentNode } from "prosemirror-commands";
import { wrapInList, splitListItem, liftListItem, sinkListItem } from "prosemirror-schema-list";
import { useTheme } from "@/contexts/ThemeContext";
import { useSettings } from "@/contexts/SettingsContext";
import { toast } from "sonner";
import { uploadImage, uploadVideo, getImageMarkdown, getVideoHTML } from "@/lib/image-upload";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";

// Define schema with support for task lists, images, videos, and code blocks
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
      content: "text*",
      marks: "",
      group: "block",
      code: true,
      defining: true,
      parseDOM: [{
        tag: "pre",
        preserveWhitespace: "full"
      }],
      toDOM() { return ["pre", ["code", 0]]; }
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
      parseDOM: [{ tag: "ul" }],
      toDOM() { return ["ul", 0]; }
    },
    list_item: {
      content: "paragraph block*",
      parseDOM: [{ tag: "li" }],
      toDOM() { return ["li", 0]; },
      defining: true
    },
    // Task list item support
    task_list: {
      content: "task_item+",
      group: "block",
      parseDOM: [{
        tag: "ul.task-list",
        getAttrs(dom) {
          return { class: (dom as HTMLElement).getAttribute("class") || "" };
        }
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
          return {
            checked: (dom as HTMLElement).getAttribute("data-checked") === "true"
          };
        }
      }],
      toDOM(node) {
        return ["li", {
          class: "task-item",
          "data-checked": node.attrs.checked
        }, 0];
      }
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

  // Convert markdown to HTML
  const markdownToHTML = useCallback((markdown: string): string => {
    // Simple markdown to HTML conversion for initial content
    let html = markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*)\*/gim, '<em>$1</em>')
      .replace(/`(.*?)`/gim, '<code>$1</code>')
      .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img src="$2" alt="$1" />')
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2">$1</a>')
      .replace(/^\- \[ \] (.*$)/gim, '<li class="task-item" data-checked="false">$1</li>')
      .replace(/^\- \[x\] (.*$)/gim, '<li class="task-item" data-checked="true">$1</li>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
      .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
      .replace(/\n/gim, '<br>');

    // Wrap lists
    if (html.includes('<li')) {
      html = html.replace(/(<li.*<\/li>)/gim, '<ul>$1</ul>');
    }

    // Wrap paragraphs
    const blocks = html.split('<br>');
    html = blocks.map(block => {
      if (block.trim() && !block.startsWith('<h') && !block.startsWith('<blockquote') &&
          !block.startsWith('<pre') && !block.startsWith('<ul')) {
        return `<p>${block}</p>`;
      }
      return block;
    }).join('\n');

    return html;
  }, []);

  // Convert ProseMirror document to markdown
  const prosemirrorToMarkdown = useCallback((view: EditorView): string => {
    let markdown = "";

    view.state.doc.descendants((node) => {
      if (node.isBlock) {
        const text = node.textContent;

        switch (node.type.name) {
          case "heading":
            const level = "#".repeat(node.attrs.level);
            markdown += `${level} ${text}\n\n`;
            break;
          case "paragraph":
            if (text.trim()) {
              markdown += `${text}\n\n`;
            }
            break;
          case "blockquote":
            markdown += `> ${text}\n\n`;
            break;
          case "code_block":
            markdown += `\`\`\`\n${text}\n\`\`\`\n\n`;
            break;
          case "ordered_list":
            markdown += `1. ${text}\n`;
            break;
          case "bullet_list":
            markdown += `- ${text}\n`;
            break;
          case "task_list":
            node.forEach((taskItem) => {
              const checked = taskItem.attrs.checked ? "[x]" : "[ ]";
              markdown += `- ${checked} ${taskItem.textContent}\n`;
            });
            markdown += "\n";
            break;
          case "horizontal_rule":
            markdown += "---\n\n";
            break;
        }
      } else if (node.isInline) {
        if (node.type.name === "image") {
          markdown += `![${node.attrs.alt || ""}](${node.attrs.src})`;
        } else if (node.marks) {
          let markedText = node.textContent;
          node.marks.forEach((mark) => {
            if (mark.type.name === "strong") {
              markedText = `**${markedText}**`;
            } else if (mark.type.name === "em") {
              markedText = `*${markedText}*`;
            } else if (mark.type.name === "code") {
              markedText = `\`${markedText}\``;
            } else if (mark.type.name === "link") {
              markedText = `[${markedText}](${mark.attrs.href})`;
            }
          });
          markdown += markedText;
        } else {
          markdown += node.textContent;
        }
      }
    });

    return markdown;
  }, []);

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
          const markdown = prosemirrorToMarkdown(view);
          onChange(markdown);
        }
      },
      attributes: {
        class: `prosemirror-editor ${theme === "dark" ? "dark" : "light"}`,
      },
      handlePaste(view, event) {
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
    setIsReady(true);
    onEditorReady?.(view);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // Update content when it changes externally
  useEffect(() => {
    if (!isReady || !viewRef.current) return;

    const currentMarkdown = prosemirrorToMarkdown(viewRef.current);
    if (currentMarkdown !== content) {
      const doc = ProseMirrorDOMParser.fromSchema(schema).parse(
        new DOMParser().parseFromString(markdownToHTML(content), "text/html").body
      );
      const tr = viewRef.current.state.tr.replaceWith(0, viewRef.current.state.doc.content.size, doc.content);
      viewRef.current.dispatch(tr);
    }
  }, [content, isReady, markdownToHTML, prosemirrorToMarkdown]);

  return (
    <div className="h-full w-full bg-editor-bg flex flex-col">
      <style>{`
        .prosemirror-editor {
          outline: none;
          padding: 1rem;
          font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
          line-height: 1.6;
          min-height: 100%;
        }

        .prosemirror-editor.dark {
          background-color: oklch(var(--color-editor-bg));
          color: oklch(var(--color-editor-text));
        }

        .prosemirror-editor.light {
          background-color: oklch(var(--color-editor-bg));
          color: oklch(var(--color-editor-text));
        }

        .prosemirror-editor h1,
        .prosemirror-editor h2,
        .prosemirror-editor h3,
        .prosemirror-editor h4,
        .prosemirror-editor h5,
        .prosemirror-editor h6 {
          font-weight: bold;
          margin-top: 1em;
          margin-bottom: 0.5em;
          line-height: 1.3;
        }

        .prosemirror-editor h1 { font-size: 2em; }
        .prosemirror-editor h2 { font-size: 1.5em; }
        .prosemirror-editor h3 { font-size: 1.25em; }

        .prosemirror-editor p {
          margin: 0.5em 0;
        }

        .prosemirror-editor blockquote {
          border-left: 3px solid #3b82f6;
          padding-left: 1em;
          margin: 1em 0;
          opacity: 0.8;
        }

        .prosemirror-editor code {
          background-color: rgba(128, 128, 128, 0.2);
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
          font-size: 0.9em;
        }

        .prosemirror-editor pre {
          background-color: rgba(128, 128, 128, 0.1);
          border: 1px solid rgba(128, 128, 128, 0.3);
          border-radius: 4px;
          padding: 1em;
          margin: 1em 0;
          overflow-x: auto;
        }

        .prosemirror-editor pre code {
          background-color: transparent;
          padding: 0;
          border-radius: 0;
        }

        .prosemirror-editor ul,
        .prosemirror-editor ol {
          padding-left: 2em;
          margin: 0.5em 0;
        }

        .prosemirror-editor ul.task-list {
          list-style: none;
          padding-left: 0;
        }

        .prosemirror-editor li.task-item {
          display: flex;
          align-items: flex-start;
          margin: 0.25em 0;
        }

        .prosemirror-editor li.task-item::before {
          content: attr(data-checked) === "true" ? "☑" : "☐";
          margin-right: 0.5em;
          cursor: pointer;
          font-size: 1.2em;
        }

        .prosemirror-editor li.task-item[data-checked="true"] {
          text-decoration: line-through;
          opacity: 0.7;
        }

        .prosemirror-editor img {
          max-width: 100%;
          height: auto;
          display: block;
          margin: 1em 0;
          border-radius: 4px;
        }

        .prosemirror-editor a {
          color: #3b82f6;
          text-decoration: underline;
          cursor: pointer;
        }

        .prosemirror-editor a:hover {
          text-decoration: none;
        }

        .prosemirror-editor hr {
          border: none;
          border-top: 1px solid rgba(128, 128, 128, 0.3);
          margin: 2em 0;
        }

        .ProseMirror-focused {
          outline: none;
        }

        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #aaa;
          pointer-events: none;
          height: 0;
        }
      `}</style>
      <div
        ref={editorRef}
        className="flex-1 overflow-auto"
        style={{ fontSize: fontSize + 'px' }}
      />
    </div>
  );
};

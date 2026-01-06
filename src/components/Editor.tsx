import React, { useCallback } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "@/contexts/ThemeContext";
import { useSettings } from "@/contexts/SettingsContext";
import { EditorView, keymap } from "@codemirror/view";
import { toast } from "sonner";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onEditorCreate?: (view: EditorView) => void;
}

export const Editor: React.FC<EditorProps> = ({ value, onChange, onEditorCreate }) => {
  const { theme } = useTheme();
  const { fontSize, lineNumbers, wordWrap } = useSettings();

  const handleCreateEditor = useCallback((view: EditorView) => {
    onEditorCreate?.(view);
  }, [onEditorCreate]);

  return (
    <div className="h-full w-full bg-editor-bg flex flex-col">
      <CodeMirror
        value={value}
        height="100%"
        className="h-full font-mono"
        style={{ fontSize: fontSize + 'px' }}
        theme={theme === "dark" ? oneDark : "light"}
        extensions={[
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          wordWrap ? EditorView.lineWrapping : [],
          keymap.of([
            { key: "Mod-b", run: (view) => {
              const { state, dispatch } = view;
              const { from, to } = state.selection.main;
              const text = state.sliceDoc(from, to);
              dispatch({ changes: { from, to, insert: `**${text}**` }, selection: { anchor: from + 2 + text.length } });
              return true;
            }},
            { key: "Mod-i", run: (view) => {
              const { state, dispatch } = view;
              const { from, to } = state.selection.main;
              const text = state.sliceDoc(from, to);
              dispatch({ changes: { from, to, insert: `*${text}*` }, selection: { anchor: from + 1 + text.length } });
              return true;
            }},
          ]),
          EditorView.domEventHandlers({
            paste: (event, view) => {
              const items = event.clipboardData?.items;
              if (!items) return;

              for (const item of items) {
                if (item.type.startsWith("image/")) {
                  event.preventDefault();
                  const file = item.getAsFile();
                  if (!file) continue;

                  const reader = new FileReader();
                  reader.onload = (e) => {
                    const result = e.target?.result as string;
                    const { state, dispatch } = view;
                    const selection = state.selection.main;
                    
                    dispatch({
                      changes: {
                        from: selection.from,
                        to: selection.to,
                        insert: `![Image](${result})`,
                      },
                      selection: { anchor: selection.from + 2 }, // Move cursor inside alt text
                      userEvent: "input.paste",
                    });
                    toast.success("Image pasted successfully");
                  };
                  reader.readAsDataURL(file);
                  return true;
                }
              }
            },
            drop: (event, view) => {
              const files = event.dataTransfer?.files;
              if (!files || files.length === 0) return;

              const file = files[0];
              if (file.type.startsWith("image/")) {
                event.preventDefault();
                const reader = new FileReader();
                reader.onload = (e) => {
                  const result = e.target?.result as string;
                  const { state, dispatch } = view;
                  // Get drop position
                  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                  if (pos === null) return;

                  dispatch({
                    changes: {
                      from: pos,
                      to: pos,
                      insert: `![Image](${result})`,
                    },
                    selection: { anchor: pos + 2 },
                    userEvent: "input.drop",
                  });
                  toast.success("Image dropped successfully");
                };
                reader.readAsDataURL(file);
                return true;
              }
            },
          }),
        ]}
        onChange={onChange}
        onCreateEditor={handleCreateEditor}
        basicSetup={{
          lineNumbers: lineNumbers,
          foldGutter: true,
          highlightActiveLine: true,
          autocompletion: true,
          bracketMatching: true,
          closeBrackets: true,
          history: true,
        }}
      />
    </div>
  );
};

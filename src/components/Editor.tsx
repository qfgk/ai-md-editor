import React, { useCallback } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "@/contexts/ThemeContext";
import { useSettings } from "@/contexts/SettingsContext";
import { EditorView, keymap } from "@codemirror/view";
import { toast } from "sonner";
import { uploadImage, getImageMarkdown } from "@/lib/image-upload";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onEditorCreate?: (view: EditorView) => void;
}

export const Editor: React.FC<EditorProps> = ({ value, onChange, onEditorCreate }) => {
  const { theme } = useTheme();
  const { fontSize, lineNumbers, wordWrap, defaultImageUploadProvider } = useSettings();

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
            paste: async (event, view) => {
              const items = event.clipboardData?.items;
              if (!items) return;

              for (const item of items) {
                if (item.type.startsWith("image/")) {
                  event.preventDefault();
                  const file = item.getAsFile();
                  if (!file) continue;

                  const { state, dispatch } = view;
                  const selection = state.selection.main;

                  // Show uploading indicator
                  const placeholder = `![Uploading...]()`;
                  dispatch({
                    changes: {
                      from: selection.from,
                      to: selection.to,
                      insert: placeholder,
                    },
                    userEvent: "input.paste",
                  });

                  try {
                    let imageUrl: string;

                    if (defaultImageUploadProvider) {
                      // Upload to cloud storage
                      toast.loading("正在上传图片...", { id: "image-upload" });
                      imageUrl = await uploadImage(file, defaultImageUploadProvider);
                      toast.success("图片上传成功", { id: "image-upload" });
                    } else {
                      // Fallback to base64
                      const reader = new FileReader();
                      imageUrl = await new Promise<string>((resolve, reject) => {
                        reader.onload = (e) => resolve(e.target?.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                      });
                      toast.success("图片已嵌入（建议配置云存储）");
                    }

                    // Replace placeholder with actual image
                    const currentText = state.sliceDoc(0, state.doc.length);
                    const placeholderIndex = currentText.indexOf(placeholder);
                    if (placeholderIndex !== -1) {
                      dispatch({
                        changes: {
                          from: placeholderIndex,
                          to: placeholderIndex + placeholder.length,
                          insert: getImageMarkdown(imageUrl, file.name),
                        },
                        selection: { anchor: placeholderIndex + 2 },
                        userEvent: "input.paste",
                      });
                    }
                  } catch (error) {
                    // Remove placeholder on error
                    const currentText = state.sliceDoc(0, state.doc.length);
                    const placeholderIndex = currentText.indexOf(placeholder);
                    if (placeholderIndex !== -1) {
                      dispatch({
                        changes: {
                          from: placeholderIndex,
                          to: placeholderIndex + placeholder.length,
                          insert: "",
                        },
                      });
                    }
                    toast.error(error instanceof Error ? error.message : "图片上传失败");
                  }

                  return true;
                }
              }
            },
            drop: async (event, view) => {
              const files = event.dataTransfer?.files;
              if (!files || files.length === 0) return;

              const file = files[0];
              if (file.type.startsWith("image/")) {
                event.preventDefault();

                // Get drop position
                const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                if (pos === null) return;

                const { state, dispatch } = view;

                // Show uploading indicator
                const placeholder = `![Uploading...]()`;
                dispatch({
                  changes: {
                    from: pos,
                    to: pos,
                    insert: placeholder,
                  },
                  userEvent: "input.drop",
                });

                try {
                  let imageUrl: string;

                  if (defaultImageUploadProvider) {
                    // Upload to cloud storage
                    toast.loading("正在上传图片...", { id: "image-upload" });
                    imageUrl = await uploadImage(file, defaultImageUploadProvider);
                    toast.success("图片上传成功", { id: "image-upload" });
                  } else {
                    // Fallback to base64
                    const reader = new FileReader();
                    imageUrl = await new Promise<string>((resolve, reject) => {
                      reader.onload = (e) => resolve(e.target?.result as string);
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });
                    toast.success("图片已嵌入（建议配置云存储）");
                  }

                  // Replace placeholder with actual image
                  const currentText = state.sliceDoc(0, state.doc.length);
                  const placeholderIndex = currentText.indexOf(placeholder);
                  if (placeholderIndex !== -1) {
                    dispatch({
                      changes: {
                        from: placeholderIndex,
                        to: placeholderIndex + placeholder.length,
                        insert: getImageMarkdown(imageUrl, file.name),
                      },
                      selection: { anchor: placeholderIndex + 2 },
                      userEvent: "input.drop",
                    });
                  }
                } catch (error) {
                  // Remove placeholder on error
                  const currentText = state.sliceDoc(0, state.doc.length);
                  const placeholderIndex = currentText.indexOf(placeholder);
                  if (placeholderIndex !== -1) {
                    dispatch({
                      changes: {
                        from: placeholderIndex,
                        to: placeholderIndex + placeholder.length,
                        insert: "",
                      },
                    });
                  }
                  toast.error(error instanceof Error ? error.message : "图片上传失败");
                }

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

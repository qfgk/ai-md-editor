import React, { useCallback } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "@/contexts/ThemeContext";
import { useSettings } from "@/contexts/SettingsContext";
import { EditorView, keymap } from "@codemirror/view";
import { toast } from "sonner";
import { uploadImage, uploadVideo, getImageMarkdown, getVideoHTML } from "@/lib/image-upload";

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
            paste: (event, view) => {
              const items = event.clipboardData?.items;
              if (!items) return;

              for (const item of items) {
                const isImage = item.type.startsWith("image/");
                const isVideo = item.type.startsWith("video/");

                if (isImage || isVideo) {
                  event.preventDefault();
                  const file = item.getAsFile();
                  if (!file) continue;

                  const { state, dispatch } = view;
                  const selection = state.selection.main;

                  // Show uploading indicator
                  const placeholder = isImage
                    ? `![Uploading...]()`
                    : `<p>Uploading video...</p>`;
                  const placeholderStart = selection.from;

                  dispatch({
                    changes: {
                      from: selection.from,
                      to: selection.to,
                      insert: placeholder,
                    },
                    userEvent: "input.paste",
                  });

                  (async () => {
                    try {
                      let mediaUrl: string;

                      if (defaultImageUploadProvider) {
                        // Upload to cloud storage
                        const loadingId = isImage ? "image-upload" : "video-upload";
                        toast.loading(isImage ? "正在上传图片..." : "正在上传视频...", { id: loadingId });

                        if (isImage) {
                          mediaUrl = await uploadImage(file, defaultImageUploadProvider);
                        } else {
                          mediaUrl = await uploadVideo(file, defaultImageUploadProvider);
                        }

                        toast.success(isImage ? "图片上传成功" : "视频上传成功", { id: loadingId });
                      } else {
                        // Fallback to base64
                        const reader = new FileReader();
                        mediaUrl = await new Promise<string>((resolve, reject) => {
                          reader.onload = (e) => resolve(e.target?.result as string);
                          reader.onerror = reject;
                          reader.readAsDataURL(file);
                        });
                        toast.success(isImage ? "图片已嵌入（建议配置云存储）" : "视频已嵌入（建议配置云存储）");
                      }

                      // Replace placeholder with actual media
                      view.dispatch({
                        changes: {
                          from: placeholderStart,
                          to: placeholderStart + placeholder.length,
                          insert: isImage
                            ? getImageMarkdown(mediaUrl, file.name)
                            : getVideoHTML(mediaUrl, file.name),
                        },
                        selection: { anchor: placeholderStart + 2 },
                        userEvent: "input.paste",
                      });
                    } catch (error) {
                      // Remove placeholder on error
                      view.dispatch({
                        changes: {
                          from: placeholderStart,
                          to: placeholderStart + placeholder.length,
                          insert: "",
                        },
                      });
                      toast.error(error instanceof Error ? error.message : (isImage ? "图片上传失败" : "视频上传失败"));
                    }
                  })();

                  return;
                }
              }
            },
            drop: (event, view) => {
              const files = event.dataTransfer?.files;
              if (!files || files.length === 0) return;

              const file = files[0];
              const isImage = file.type.startsWith("image/");
              const isVideo = file.type.startsWith("video/");

              if (isImage || isVideo) {
                event.preventDefault();

                // Get drop position
                const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
                if (pos === null) return;

                // Show uploading indicator
                const placeholder = isImage
                  ? `![Uploading...]()`
                  : `<p>Uploading video...</p>`;
                const placeholderStart = pos;

                view.dispatch({
                  changes: {
                    from: pos,
                    to: pos,
                    insert: placeholder,
                  },
                  userEvent: "input.drop",
                });

                (async () => {
                  try {
                    let mediaUrl: string;

                    if (defaultImageUploadProvider) {
                      // Upload to cloud storage
                      const loadingId = isImage ? "image-upload" : "video-upload";
                      toast.loading(isImage ? "正在上传图片..." : "正在上传视频...", { id: loadingId });

                      if (isImage) {
                        mediaUrl = await uploadImage(file, defaultImageUploadProvider);
                      } else {
                        mediaUrl = await uploadVideo(file, defaultImageUploadProvider);
                      }

                      toast.success(isImage ? "图片上传成功" : "视频上传成功", { id: loadingId });
                    } else {
                      // Fallback to base64
                      const reader = new FileReader();
                      mediaUrl = await new Promise<string>((resolve, reject) => {
                        reader.onload = (e) => resolve(e.target?.result as string);
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                      });
                      toast.success(isImage ? "图片已嵌入（建议配置云存储）" : "视频已嵌入（建议配置云存储）");
                    }

                    // Replace placeholder with actual media
                    view.dispatch({
                      changes: {
                        from: placeholderStart,
                        to: placeholderStart + placeholder.length,
                        insert: isImage
                          ? getImageMarkdown(mediaUrl, file.name)
                          : getVideoHTML(mediaUrl, file.name),
                      },
                      selection: { anchor: placeholderStart + 2 },
                      userEvent: "input.drop",
                    });
                  } catch (error) {
                    // Remove placeholder on error
                    view.dispatch({
                      changes: {
                        from: placeholderStart,
                        to: placeholderStart + placeholder.length,
                        insert: "",
                      },
                    });
                    toast.error(error instanceof Error ? error.message : (isImage ? "图片上传失败" : "视频上传失败"));
                  }
                })();

                return;
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

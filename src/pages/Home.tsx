import { useState, useCallback, useRef, useEffect } from "react";
import { useAutoSave } from "@/hooks/use-auto-save";
import { toast } from "sonner";
import { type FileNode, openDirectory, openFile, readFileContent, saveFileContent, saveAsFile, processLegacyFileList, createFileNodeFromFile } from "@/lib/file-system";
import { FileTree } from "@/components/FileTree";
import { FolderOpen, Save } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Editor } from "@/components/Editor";
import { WysiwygEditor } from "@/components/WysiwygEditor";
import { Toolbar } from "@/components/Toolbar";
import { EditorView } from "@codemirror/view";
import { Preview } from "@/components/Preview";
import { EditorView as ProseMirrorEditorView } from "prosemirror-view";
import { SettingsDialog } from "@/components/SettingsDialog";
import { MultiCloudStorageDialog } from "@/components/MultiCloudStorageDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Moon,
  Sun,
  PanelLeft,
  FileText,
  Settings,
  Github,
  Download,
  Upload,
  Play,
  FileDown,
  Image as ImageIcon,
  File,
  ChevronDown,
  Code,
  Eye,
} from "lucide-react";
import { exportToPDFWithPrint, exportToPNG, exportToDOCX } from "@/lib/export";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import emptyStateIcon from "@/assets/empty-state.png";

const STORAGE_KEY = "md-editor-content";
const DEFAULT_MARKDOWN = `# 欢迎使用 AI Markdown 编辑器

在左侧输入 Markdown 内容，右侧将实时显示预览效果。

## 核心功能
- **实时预览**：所见即所得，支持同步滚动
- **语法高亮**：支持多种编程语言代码块
- **深色模式**：点击右上角图标一键切换
- **文件管理**：支持打开本地文件夹、导入导出
- **多格式导出**：PDF、PNG、DOCX
- **云存储同步**：支持 5 种云存储方式

\`\`\`javascript
// 代码高亮示例
console.log("Hello, World!");
const sum = (a, b) => a + b;
\`\`\`

> "Simplicity is the ultimate sophistication." - Leonardo da Vinci

| 功能 | 状态 |
| :--- | :--- |
| Markdown | ✅ |
| Mermaid 图表 | ✅ |
| LaTeX 公式 | ✅ |

## Mermaid 流程图示例

\`\`\`mermaid
graph TD
    A[开始] --> B{是否工作?}
    B -- 是 --> C[太棒了!]
    B -- 否 --> D[调试]
    D --> B
\`\`\`

## 数学公式示例

行内公式：$E = mc^2$

块级公式：
$$
\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}
$$
`;

export default function Home() {
  const { value: markdown, setValue: setMarkdown, lastSaved } = useAutoSave(STORAGE_KEY, DEFAULT_MARKDOWN);
  const { theme, toggleTheme } = useTheme();
  const [showSidebar, setShowSidebar] = useState(window.innerWidth >= 768);
  const [editorMode, setEditorMode] = useState<'source' | 'wysiwyg'>('source');
  const [rootNode, setRootNode] = useState<FileNode | null>(null);
  const [activeFileNode, setActiveFileNode] = useState<FileNode | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setShowSidebar(false);
      } else {
        setShowSidebar(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [editorView, setEditorView] = useState<EditorView | ProseMirrorEditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false); // Flag to prevent scroll loop

  const handleEditorChange = useCallback((value: string) => {
    setMarkdown(value);
  }, [setMarkdown]);

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document-" + new Date().toISOString().slice(0, 10) + ".md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("文档已下载");
  };

  const handleSaveAs = async () => {
    try {
      const newNode = await saveAsFile(markdown);
      if (newNode) {
        setActiveFileNode(newNode);
        toast.success(`已另存为: ${newNode.name}`);
      }
    } catch (error: any) {
      // If native save as fails (e.g. not supported or security error in iframe), fallback to download
      if (error.message === "NOT_SUPPORTED" || error.name === "SecurityError" || error.name === "TypeError") {
        handleDownload();
      } else if (error.name !== "AbortError") {
        console.error(error);
        toast.error("另存为失败");
      }
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };



  const handleNew = () => {
    if (confirm("确定要清空当前文档吗？未保存的更改可能会丢失。")) {
      setMarkdown("");
      setActiveFileNode(null); // Clear active file context
      toast.success("已创建新文档");
    }
  };

  const handleOpenFolder = async () => {
    try {
      const root = await openDirectory();
      if (root) {
        setRootNode(root);
        setShowSidebar(true);
        toast.success(`已打开文件夹: ${root.name}`);
      }
    } catch (error: any) {
      console.error(error);
      if (error.message === "NOT_SUPPORTED" || error.name === "SecurityError" || error.name === "TypeError") {
        toast.info("切换至兼容模式...");
        folderInputRef.current?.click();
      } else if (error.name !== "AbortError") {
        toast.error(`打开文件夹失败: ${error.message}`);
      }
    }
  };

  const handleFileFallbackInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const node = createFileNodeFromFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setMarkdown(content);
      setActiveFileNode(node);
      setRootNode(null);
      toast.success(`已打开文件 (兼容模式): ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleOpenFile = async () => {
    try {
      const node = await openFile();
      if (node) {
        // For single file open, we don't necessarily need a tree root, or we treat it as root.
        // Let's set it as root for the tree view to keep consistency, or just load it directly.
        // Loading directly is better for "Open File" UX.
        const content = await readFileContent(node);
        setMarkdown(content);
        setActiveFileNode(node);
        // Clear tree view if we open a single file? Or keep previous context?
        // Let's clear tree to avoid confusion if the file isn't in the tree.
        setRootNode(null); 
        toast.success(`已打开文件: ${node.name}`);
      }
    } catch (error: any) {
      console.error(error);
      if (error.message === "NOT_SUPPORTED" || error.name === "SecurityError" || error.name === "TypeError") {
        toast.warning("在此环境中无法使用原生文件编辑。请点击右上角分享图标，在新标签页中打开网站以解除限制。", {
          duration: 5000,
          action: {
            label: "了解",
            onClick: () => {}
          }
        });
      } else if (error.name !== "AbortError") {
        toast.error(`打开文件失败: ${error.message}`);
      }
    }
  };

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        const root = processLegacyFileList(files);
        setRootNode(root);
        setShowSidebar(true);
        toast.success(`Opened folder: ${root.name}`);
      } catch (err) {
        console.error(err);
        toast.error("处理文件夹失败");
      }
    }
    e.target.value = ""; // Reset
  };

  const handleSelectFile = async (node: FileNode) => {
    try {
      // Check if we have unsaved changes? (Skip for MVP, or assume auto-save handles it)
      const content = await readFileContent(node);
      setMarkdown(content);
      setActiveFileNode(node);
      toast.success(`已打开 ${node.name}`);
    } catch (error) {
      console.error(error);
      toast.error(`读取文件失败: ${node.name}`);
    }
  };

  const handleSave = async () => {
    if (!activeFileNode) {
      // If no file is open, maybe trigger export? Or just save to local storage (which is auto).
      // Let's prompt to export if it's a new file.
      handleDownload();
      return;
    }

    setIsSaving(true);
    try {
      await saveFileContent(activeFileNode, markdown);
      toast.success("文件保存成功");
    } catch (error: any) {
      if (error.message === "LEGACY_MODE") {
        handleDownload();
        toast.warning("浏览器限制：无法直接覆盖本地文件。已自动改为下载副本。", { duration: 4000 });
      } else if (error.message === "PERMISSION_DENIED") {
        toast.error("保存失败：权限被拒绝。请在提示时允许写入权限。");
      } else {
        console.error(error);
        toast.error("保存文件失败");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      // Use actual filename or extract from markdown title
      const documentFilename = activeFileNode?.name || undefined;
      exportToPDFWithPrint(markdown, documentFilename);
      toast.info("正在打开打印对话框，请选择 \"另存为 PDF\"");
    } catch (error: any) {
      toast.error(error.message || "PDF 导出失败");
    }
  };

  // Helper function to generate export filename
  const getExportFilename = (extension: string): string => {
    // Try to get filename from active file
    if (activeFileNode?.name) {
      return activeFileNode.name.replace(/\.md$/i, '') + extension;
    }

    // Otherwise extract title from markdown
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      let title = titleMatch[1].trim();
      // Remove invalid filename characters
      title = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
      return title + extension;
    }

    // Fallback to default
    return 'document' + extension;
  };

  const handleExportPNG = async () => {
    if (!previewRef.current) return;
    try {
      const filename = getExportFilename('.png');
      await exportToPNG(previewRef.current, filename);
      toast.success("PNG 导出成功");
    } catch (error: any) {
      toast.error(error.message || "PNG 导出失败");
    }
  };

  const handleExportDOCX = async () => {
    try {
      const filename = getExportFilename('.docx');
      await exportToDOCX(markdown, filename);
      toast.success("DOCX 导出成功");
    } catch (error: any) {
      toast.error(error.message || "DOCX 导出失败");
    }
  };

  // Keyboard shortcut for Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [markdown, activeFileNode]);

  // Synchronized Scrolling
  useEffect(() => {
    if (!editorView || !previewRef.current || editorMode === 'wysiwyg') return;

    // Check if it's a CodeMirror editor
    if ('dom' in editorView) {
      const editorScroller = (editorView as EditorView).scrollDOM;
      const previewScroller = previewRef.current;

      const handleEditorScroll = () => {
        if (isScrollingRef.current) return;
        isScrollingRef.current = true;

        const ratio = editorScroller.scrollTop / (editorScroller.scrollHeight - editorScroller.clientHeight);
        const previewScrollTop = ratio * (previewScroller.scrollHeight - previewScroller.clientHeight);

        previewScroller.scrollTop = previewScrollTop;

        // Reset flag after a short delay
        setTimeout(() => { isScrollingRef.current = false; }, 50);
      };

      const handlePreviewScroll = () => {
        if (isScrollingRef.current) return;
        isScrollingRef.current = true;

        const ratio = previewScroller.scrollTop / (previewScroller.scrollHeight - previewScroller.clientHeight);
        const editorScrollTop = ratio * (editorScroller.scrollHeight - editorScroller.clientHeight);

        editorScroller.scrollTop = editorScrollTop;

        setTimeout(() => { isScrollingRef.current = false; }, 50);
      };

      editorScroller.addEventListener('scroll', handleEditorScroll);
      previewScroller.addEventListener('scroll', handlePreviewScroll);

      return () => {
        editorScroller.removeEventListener('scroll', handleEditorScroll);
        previewScroller.removeEventListener('scroll', handlePreviewScroll);
      };
    }

    return () => {};
  }, [editorView, editorMode]);

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-border bg-sidebar flex items-center justify-between px-4 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-bold text-lg text-primary">
            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary">
              <FileText size={20} />
            </div>
            MD 编辑器
          </div>
          <div className="h-6 w-px bg-border mx-2" />
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setShowSidebar(!showSidebar)}
            className={cn("text-muted-foreground", !showSidebar && "text-foreground")}
          >
            <PanelLeft size={18} />
          </Button>
          
          {/* File Operations Toolbar */}
          <div className="flex items-center gap-1 ml-2">
            <Button variant="ghost" size="sm" onClick={handleSave} className="gap-2 text-muted-foreground hover:text-foreground" title="保存更改 (Ctrl+S)">
              <Save size={16} /> 保存
            </Button>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".md,.markdown,.txt" 
              onChange={handleFileFallbackInput} 
            />
            <input
              type="file"
              ref={folderInputRef}
              className="hidden"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              onChange={handleFolderInput}
            />
            <Button variant="ghost" size="sm" onClick={handleImportClick} className="gap-2 text-muted-foreground hover:text-foreground" title="导入本地 .md 文件">
              <Upload size={16} /> 导入
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSaveAs} className="gap-2 text-muted-foreground hover:text-foreground" title="另存为新文件">
              <Download size={16} /> 另存为
            </Button>
            <Button variant="ghost" size="sm" onClick={handleNew} className="gap-2 text-muted-foreground hover:text-foreground">
              <FileText size={16} /> 新建
            </Button>
            <span className="text-xs text-muted-foreground ml-2 hidden md:flex items-center gap-2">
              {activeFileNode ? (
                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded flex items-center gap-1">
                  <FileText size={10} /> {activeFileNode.name}
                </span>
              ) : (
                <span className="opacity-50">未保存文件</span>
              )}
              {lastSaved && <span>(自动保存 {lastSaved.toLocaleTimeString()})</span>}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Dropdown */}
          <div className="hidden md:flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-foreground"
                  title="导出文档"
                >
                  <Download size={16} /> 导出 <ChevronDown size={12} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleExportPDF}>
                  <FileDown size={16} className="mr-2 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">导出为 PDF</div>
                    <div className="text-xs text-muted-foreground">高质量（智能分页）</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPNG}>
                  <ImageIcon size={16} className="mr-2 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">导出为 PNG</div>
                    <div className="text-xs text-muted-foreground">图片格式</div>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportDOCX}>
                  <File size={16} className="mr-2 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="font-medium">导出为 DOCX</div>
                    <div className="text-xs text-muted-foreground">Word 文档</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="h-6 w-px bg-border mx-1 hidden md:block" />

          <MultiCloudStorageDialog
            markdown={markdown}
            onLoadContent={setMarkdown}
            filename={activeFileNode?.name || 'document.md'}
          />

          <Button variant="ghost" size="icon" onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </Button>
          <Button variant="ghost" size="icon">
            <Github size={18} />
          </Button>
          <Button variant="default" size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Play size={16} fill="currentColor" /> 运行
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (File Explorer) */}
        {showSidebar && (
          <aside className="w-64 border-r border-border bg-sidebar flex flex-col shrink-0 transition-all duration-300">
            <div className="p-4 font-medium text-sm text-muted-foreground uppercase tracking-wider">
              资源管理器
            </div>
            <div className="flex-1 flex flex-col overflow-hidden">
              {rootNode ? (
                <div className="flex-1 overflow-y-auto">
                  <FileTree 
                    root={rootNode} 
                    onSelectFile={handleSelectFile} 
                    selectedFileId={activeFileNode?.id} 
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                  <img src={emptyStateIcon} alt="Empty" className="w-24 h-24 mb-4 opacity-50 grayscale" />
                  <p className="text-sm">未打开文件夹</p>
                  <div className="flex flex-col gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={handleOpenFolder}>
                      <FolderOpen size={16} className="mr-2" /> 打开文件夹
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleOpenFile}>
                      <FileText size={16} className="mr-2" /> 打开文件
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="p-2 border-t border-border">
              <SettingsDialog />
            </div>
          </aside>
        )}

        {/* Editor & Preview Split View */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            <ResizablePanel defaultSize={50} minSize={20} className="bg-editor-bg flex flex-col">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-sidebar shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">编辑器</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditorMode(editorMode === 'source' ? 'wysiwyg' : 'source')}
                    className="gap-2 h-7 px-2 text-xs"
                    title={editorMode === 'source' ? '切换到所见即所得编辑' : '切换到源代码编辑'}
                  >
                    {editorMode === 'source' ? <Eye size={14} /> : <Code size={14} />}
                    {editorMode === 'source' ? '可视化编辑' : '源代码'}
                  </Button>
                </div>
                {editorMode === 'source' && <Toolbar editorView={editorView as EditorView} />}
              </div>
              <div className="flex-1 overflow-hidden">
                {editorMode === 'source' ? (
                  <Editor
                    value={markdown}
                    onChange={handleEditorChange}
                    onEditorCreate={setEditorView}
                  />
                ) : (
                  <WysiwygEditor
                    content={markdown}
                    onChange={handleEditorChange}
                    onEditorReady={setEditorView}
                  />
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle className="bg-border hover:bg-primary/50 transition-colors w-1" />

            <ResizablePanel defaultSize={50} minSize={20} className="bg-background">
              <Preview content={markdown} ref={previewRef} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </main>
      </div>
    </div>
  );
}

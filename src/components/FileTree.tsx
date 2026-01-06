import React, { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Loader2 } from "lucide-react";
import { type FileNode, readDirectoryEntries } from "@/lib/file-system";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  root: FileNode;
  onSelectFile: (node: FileNode) => void;
  selectedFileId?: string;
}

export const FileTree: React.FC<FileTreeProps> = ({ root, onSelectFile, selectedFileId }) => {
  // We don't render the root folder itself as a collapsible item usually in VS Code style, 
  // but for simplicity let's render the children of root directly at top level if possible, 
  // or just render root. Let's render root as the "Project" header or just start expanding it.
  // Actually, usually you see the project name at top.
  
  return (
    <div className="w-full select-none">
      <FileTreeNode 
        node={root} 
        onSelectFile={onSelectFile} 
        selectedFileId={selectedFileId} 
        isRoot={true}
      />
    </div>
  );
};

interface FileTreeNodeProps {
  node: FileNode;
  onSelectFile: (node: FileNode) => void;
  selectedFileId?: string;
  isRoot?: boolean;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, onSelectFile, selectedFileId, isRoot }) => {
  const [isOpen, setIsOpen] = useState(isRoot); // Root always open initially
  const [children, setChildren] = useState<FileNode[] | undefined>(node.children);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (node.kind === 'file') {
      onSelectFile(node);
      return;
    }

    // Toggle directory
    if (!isOpen) {
      // Opening
      // If node.children is already populated (legacy mode or previously loaded), use it
      if (node.children && node.children.length > 0) {
         setChildren(node.children);
         setIsOpen(true);
         return;
      }

      // Lazy load if handle exists
      if (node.handle) {
        setIsLoading(true);
        try {
          const entries = await readDirectoryEntries(node);
          setChildren(entries);
          node.children = entries; 
        } catch (error) {
          console.error("Failed to read directory", error);
        } finally {
          setIsLoading(false);
        }
      }
      setIsOpen(true);
    } else {
      // Closing
      setIsOpen(false);
    }
  };

  const isSelected = selectedFileId === node.id;
  
  // Indentation based on level. Root (level 0) has 0 padding if we hide it, 
  // but if we show it, it has standard padding.
  // Let's hide root visually if it's the container, or show it as top level item.
  // VS Code shows project name as a section header.
  // Let's render root as a simple item for now.
  
  const Icon = node.kind === 'file' 
    ? File 
    : (isOpen ? FolderOpen : Folder);

  return (
    <div>
      <div 
        className={cn(
          "flex items-center gap-1 py-1 px-2 cursor-pointer text-sm hover:bg-accent/50 transition-colors whitespace-nowrap overflow-hidden text-ellipsis",
          isSelected && "bg-accent text-accent-foreground",
          isRoot && "font-bold text-foreground py-2 border-b border-border mb-1"
        )}
        style={{ paddingLeft: isRoot ? '0.5rem' : `${node.level * 0.75 + 0.5}rem` }}
        onClick={handleToggle}
      >
        <span className="shrink-0 text-muted-foreground">
          {node.kind === 'directory' && !isRoot && (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          )}
          {node.kind === 'directory' && isRoot && (
             <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">项目</span>
          )}
          {node.kind === 'file' && <span className="w-3.5 inline-block" />} {/* Spacer for alignment */}
        </span>
        
        {!isRoot && (
          <Icon size={14} className={cn("shrink-0", node.kind === 'directory' ? "text-primary" : "text-muted-foreground")} />
        )}
        
        <span className="truncate">{node.name}</span>
        
        {isLoading && <Loader2 size={12} className="animate-spin ml-auto shrink-0" />}
      </div>

      {isOpen && node.kind === 'directory' && (
        <div>
          {children && children.map(child => (
            <FileTreeNode 
              key={child.id} 
              node={child} 
              onSelectFile={onSelectFile} 
              selectedFileId={selectedFileId}
            />
          ))}
          {children && children.length === 0 && !isLoading && !isRoot && (
            <div 
              className="text-xs text-muted-foreground py-1 italic"
              style={{ paddingLeft: `${(node.level + 1) * 0.75 + 1.5}rem` }}
            >
              空文件夹
            </div>
          )}
        </div>
      )}
    </div>
  );
};

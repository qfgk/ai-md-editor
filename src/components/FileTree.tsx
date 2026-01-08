import React, { useState, useMemo } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen, Loader2, Search, X } from "lucide-react";
import { type FileNode, readDirectoryEntries } from "@/lib/file-system";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  root: FileNode;
  onSelectFile: (node: FileNode) => void;
  selectedFileId?: string;
}

export const FileTree: React.FC<FileTreeProps> = ({ root, onSelectFile, selectedFileId }) => {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter nodes based on search query
  const filteredRoot = useMemo(() => {
    if (!searchQuery.trim()) {
      return root;
    }

    const query = searchQuery.toLowerCase();

    // Recursive function to filter tree nodes
    const filterNode = (node: FileNode): FileNode | null => {
      const matchesSearch = node.name.toLowerCase().includes(query);

      if (node.kind === 'file') {
        return matchesSearch ? node : null;
      }

      // For directories, filter children
      if (node.kind === 'directory') {
        const filteredChildren = node.children
          ?.map(child => filterNode(child))
          .filter((child): child is FileNode => child !== null);

        if (filteredChildren && filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }

        // Include directory if it matches search
        return matchesSearch ? node : null;
      }

      return null;
    };

    const filtered = filterNode(root);
    return filtered || root;
  }, [root, searchQuery]);

  return (
    <div className="w-full select-none">
      {/* Search Input */}
      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            type="text"
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 search-focus transition-all duration-200"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <FileTreeNode
        node={filteredRoot}
        onSelectFile={onSelectFile}
        selectedFileId={selectedFileId}
        isRoot={true}
        searchQuery={searchQuery}
      />
    </div>
  );
};

interface FileTreeNodeProps {
  node: FileNode;
  onSelectFile: (node: FileNode) => void;
  selectedFileId?: string;
  isRoot?: boolean;
  searchQuery?: string;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ node, onSelectFile, selectedFileId, isRoot, searchQuery = "" }) => {
  // Auto-expand if there's a search query
  const [isOpen, setIsOpen] = useState(isRoot || !!searchQuery);
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

  // Highlight matching text
  const highlightMatch = (text: string) => {
    if (!searchQuery.trim()) {
      return text;
    }

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-primary/20 text-foreground font-semibold">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-2 cursor-pointer text-sm hover:bg-accent/50 transition-all duration-150 whitespace-nowrap overflow-hidden text-ellipsis file-item-hover",
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

        <span className="truncate">{highlightMatch(node.name)}</span>

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
              searchQuery={searchQuery}
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

import { nanoid } from "nanoid";

// Define File System Access API types manually
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry: (other: FileSystemHandle) => Promise<boolean>;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile: () => Promise<File>;
  createWritable: () => Promise<FileSystemWritableFileStream>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write: (data: string | BufferSource | Blob) => Promise<void>;
  close: () => Promise<void>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  resolve: (possibleDescendant: FileSystemHandle) => Promise<string[] | null>;
  entries: () => AsyncIterableIterator<[string, FileSystemHandle]>;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemDirectoryHandle>;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle>;
}

export interface FileNode {
  id: string;
  name: string;
  kind: 'file' | 'directory';
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
  file?: File; // For legacy mode
  children?: FileNode[];
  level: number;
  path?: string; // For legacy mode reconstruction
}

declare global {
  interface Window {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?: (options?: any) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (options?: any) => Promise<FileSystemFileHandle>;
  }
}

export async function openDirectory(): Promise<FileNode | null> {
  if (!window.showDirectoryPicker) {
    throw new Error("NOT_SUPPORTED");
  }

  try {
    const handle = await window.showDirectoryPicker();
    const root: FileNode = {
      id: nanoid(),
      name: handle.name,
      kind: 'directory',
      handle: handle,
      children: [],
      level: 0
    };
    return root;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return null; // User cancelled
    }
    throw err;
  }
}

export async function openFile(): Promise<FileNode | null> {
  if (!window.showOpenFilePicker) {
    throw new Error("NOT_SUPPORTED");
  }

  try {
    const handles = await window.showOpenFilePicker({
      types: [
        {
          description: 'Markdown Files',
          accept: {
            'text/markdown': ['.md', '.markdown'],
            'text/plain': ['.txt'],
          },
        },
      ],
      multiple: false,
    });

    if (!handles || handles.length === 0) return null;

    const handle = handles[0];
    const root: FileNode = {
      id: nanoid(),
      name: handle.name,
      kind: 'file',
      handle: handle,
      level: 0
    };
    return root;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return null;
    }
    throw err;
  }
}

// Native "Save As"
export async function saveAsFile(content: string): Promise<FileNode | null> {
  if (!window.showSaveFilePicker) {
    throw new Error("NOT_SUPPORTED");
  }

  try {
    const handle = await window.showSaveFilePicker({
      types: [
        {
          description: 'Markdown File',
          accept: { 'text/markdown': ['.md'] },
        },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();

    return {
      id: nanoid(),
      name: handle.name,
      kind: 'file',
      handle: handle,
      level: 0
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return null;
    }
    throw err;
  }
}

export async function readDirectoryEntries(directoryNode: FileNode): Promise<FileNode[]> {
  if (!directoryNode.handle) {
    return directoryNode.children || [];
  }

  const dirHandle = directoryNode.handle as FileSystemDirectoryHandle;
  const entries: FileNode[] = [];
  
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith('.')) continue; // Skip hidden
    
    entries.push({
      id: nanoid(),
      name: name,
      kind: handle.kind,
      handle: handle as FileSystemFileHandle | FileSystemDirectoryHandle,
      level: directoryNode.level + 1,
      children: handle.kind === 'directory' ? [] : undefined
    });
  }

  sortFileNodes(entries);
  return entries;
}

export function sortFileNodes(nodes: FileNode[]) {
  nodes.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name);
    return a.kind === 'directory' ? -1 : 1;
  });
}

export async function readFileContent(fileNode: FileNode): Promise<string> {
  if (fileNode.kind !== 'file') throw new Error("Not a file");
  
  let file: File;
  if (fileNode.handle) {
    const handle = fileNode.handle as FileSystemFileHandle;
    file = await handle.getFile();
  } else if (fileNode.file) {
    file = fileNode.file;
  } else {
    throw new Error("No file source found");
  }
  
  return await file.text();
}

async function verifyPermission(fileHandle: FileSystemFileHandle | FileSystemDirectoryHandle, withWrite: boolean) {
  const opts = { mode: withWrite ? 'readwrite' : 'read' };
  
  // @ts-ignore
  if ((await fileHandle.queryPermission(opts)) === 'granted') {
    return true;
  }
  
  // @ts-ignore
  if ((await fileHandle.requestPermission(opts)) === 'granted') {
    return true;
  }
  
  return false;
}

export async function saveFileContent(fileNode: FileNode, content: string): Promise<void> {
  if (fileNode.kind !== 'file') throw new Error("Not a file");
  
  if (fileNode.handle) {
    const handle = fileNode.handle as FileSystemFileHandle;
    
    const hasPermission = await verifyPermission(handle, true);
    if (!hasPermission) {
      throw new Error("PERMISSION_DENIED");
    }

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  } else {
    throw new Error("LEGACY_MODE");
  }
}

export function processLegacyFileList(files: FileList): FileNode {
  if (files.length === 0) throw new Error("No files selected");

  const firstPath = files[0].webkitRelativePath;
  const rootName = firstPath.split('/')[0] || "Project";
  
  const root: FileNode = {
    id: nanoid(),
    name: rootName,
    kind: 'directory',
    level: 0,
    children: []
  };

  const map = new Map<string, FileNode>();
  map.set(rootName, root);

  Array.from(files).forEach(file => {
    const pathParts = file.webkitRelativePath.split('/');
    
    let currentPath = pathParts[0];
    let parentNode = root;

    for (let i = 1; i < pathParts.length; i++) {
      const partName = pathParts[i];
      const isFile = i === pathParts.length - 1;
      currentPath = currentPath + "/" + partName;

      if (isFile) {
        if (partName.startsWith('.')) continue;
        
        const fileNode: FileNode = {
          id: nanoid(),
          name: partName,
          kind: 'file',
          file: file,
          level: parentNode.level + 1,
          path: currentPath
        };
        parentNode.children = parentNode.children || [];
        parentNode.children.push(fileNode);
      } else {
        if (!map.has(currentPath)) {
          const dirNode: FileNode = {
            id: nanoid(),
            name: partName,
            kind: 'directory',
            level: parentNode.level + 1,
            children: [],
            path: currentPath
          };
          map.set(currentPath, dirNode);
          parentNode.children = parentNode.children || [];
          parentNode.children.push(dirNode);
        }
        parentNode = map.get(currentPath)!;
      }
    }
  });

  const sortRecursive = (node: FileNode) => {
    if (node.children) {
      sortFileNodes(node.children);
      node.children.forEach(sortRecursive);
    }
  };
  sortRecursive(root);

  return root;
}

// Create a FileNode from a single File object (Legacy Fallback)
export function createFileNodeFromFile(file: File): FileNode {
  return {
    id: nanoid(),
    name: file.name,
    kind: 'file',
    file: file,
    level: 0,
    path: file.name
  };
}

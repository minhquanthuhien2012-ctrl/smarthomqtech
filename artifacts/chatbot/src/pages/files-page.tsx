import { useState, useEffect, useCallback } from "react";
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, RefreshCw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiBase } from "@/lib/api";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
  size?: number;
}

function FileTree({ nodes, onSelect, selectedPath }: {
  nodes: FileNode[];
  onSelect: (node: FileNode) => void;
  selectedPath: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["artifacts", "lib"]));

  const toggle = (path: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  function Node({ node, depth }: { node: FileNode; depth: number }) {
    const isExpanded = expanded.has(node.path);
    const isSelected = selectedPath === node.path;
    const indent = depth * 12;

    if (node.type === "dir") {
      return (
        <div>
          <button
            onClick={() => toggle(node.path)}
            className="w-full flex items-center gap-1.5 py-1 px-2 hover:bg-muted rounded text-sm text-left"
            style={{ paddingLeft: `${8 + indent}px` }}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            {isExpanded ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-yellow-400" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-yellow-400" />}
            <span className="truncate font-medium">{node.name}</span>
          </button>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => <Node key={child.path} node={child} depth={depth + 1} />)}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        onClick={() => onSelect(node)}
        className={`w-full flex items-center gap-1.5 py-1 px-2 rounded text-sm text-left transition-colors ${
          isSelected ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
        }`}
        style={{ paddingLeft: `${8 + indent}px` }}
      >
        <span className="w-3.5 shrink-0" />
        <FileText className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{node.name}</span>
        {node.size !== undefined && (
          <span className="ml-auto text-xs opacity-50">{node.size > 1024 ? `${Math.round(node.size / 1024)}k` : `${node.size}b`}</span>
        )}
      </button>
    );
  }

  return (
    <div className="space-y-0.5">
      {nodes.map(n => <Node key={n.path} node={n} depth={0} />)}
    </div>
  );
}

function getLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    json: "json", md: "markdown", css: "css", html: "html", sql: "sql",
    yaml: "yaml", yml: "yaml", sh: "shell", toml: "toml",
  };
  return map[ext] ?? "plaintext";
}

export default function FilesPage() {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadTree = useCallback(async () => {
    setLoadingTree(true);
    try {
      const r = await fetch(`${apiBase()}/admin/files/tree`);
      setTree(await r.json() as FileNode[]);
    } finally { setLoadingTree(false); }
  }, []);

  useEffect(() => { void loadTree(); }, [loadTree]);

  const selectFile = async (node: FileNode) => {
    setSelectedFile(node);
    setLoadingFile(true);
    try {
      const r = await fetch(`${apiBase()}/admin/files/read?path=${encodeURIComponent(node.path)}`);
      const data = await r.json() as { content: string };
      setContent(data.content);
      setOriginalContent(data.content);
    } catch {
      toast({ title: "Không thể đọc file", variant: "destructive" });
    } finally { setLoadingFile(false); }
  };

  const saveFile = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      const r = await fetch(`${apiBase()}/admin/files/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedFile.path, content }),
      });
      if (!r.ok) throw new Error("Lỗi lưu");
      setOriginalContent(content);
      toast({ title: `Đã lưu: ${selectedFile.name}` });
    } catch { toast({ title: "Lỗi lưu file", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const isDirty = content !== originalContent;
  const lang = selectedFile ? getLanguage(selectedFile.name) : "";

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-64 shrink-0 border-r flex flex-col">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <span className="text-sm font-semibold">Cây thư mục</span>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => void loadTree()}>
            <RefreshCw className={`h-3.5 w-3.5 ${loadingTree ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            {loadingTree ? (
              <div className="text-center py-8 text-xs text-muted-foreground">Đang tải...</div>
            ) : (
              <FileTree nodes={tree} onSelect={node => void selectFile(node)} selectedPath={selectedFile?.path ?? ""} />
            )}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {selectedFile ? (
          <>
            <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/30 shrink-0">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono truncate flex-1">{selectedFile.path}</span>
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">{lang}</span>
              {isDirty && <span className="text-xs text-yellow-500 font-medium">• Chưa lưu</span>}
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setContent(originalContent); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" onClick={() => void saveFile()} disabled={!isDirty || saving} className="h-7 px-3">
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saving ? "Đang lưu..." : "Lưu"}
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {loadingFile ? (
                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Đang tải...</div>
              ) : (
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  className="w-full h-full resize-none bg-background text-sm font-mono p-4 focus:outline-none leading-relaxed"
                  spellCheck={false}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <FileText className="h-12 w-12 mx-auto opacity-20" />
              <p className="text-sm">Chọn file từ cây thư mục bên trái để xem và chỉnh sửa</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

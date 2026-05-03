import { Router } from "express";
import fs from "fs/promises";
import path from "path";

const router = Router();
const ROOT = path.resolve(".");

function safePath(rel: string): string {
  const abs = path.resolve(ROOT, rel.replace(/^\/+/, ""));
  if (!abs.startsWith(ROOT)) throw new Error("Path traversal blocked");
  return abs;
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
  size?: number;
}

const IGNORE = new Set(["node_modules", ".git", "dist", ".cache", "coverage", ".next", ".turbo"]);

async function buildTree(abs: string, rel: string, depth = 0): Promise<FileNode[]> {
  if (depth > 4) return [];
  const entries = await fs.readdir(abs, { withFileTypes: true });
  const nodes: FileNode[] = [];
  for (const e of entries) {
    if (IGNORE.has(e.name) || e.name.startsWith(".")) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    const childAbs = path.join(abs, e.name);
    if (e.isDirectory()) {
      const children = await buildTree(childAbs, childRel, depth + 1);
      nodes.push({ name: e.name, path: childRel, type: "dir", children });
    } else {
      const stat = await fs.stat(childAbs);
      nodes.push({ name: e.name, path: childRel, type: "file", size: stat.size });
    }
  }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

router.get("/tree", async (_req, res) => {
  try {
    const tree = await buildTree(ROOT, "");
    res.json(tree);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.get("/read", async (req, res) => {
  try {
    const rel = String(req.query.path ?? "");
    if (!rel) { res.status(400).json({ error: "path required" }); return; }
    const abs = safePath(rel);
    const content = await fs.readFile(abs, "utf-8");
    res.json({ path: rel, content });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

router.post("/write", async (req, res) => {
  try {
    const { path: rel, content } = req.body as { path: string; content: string };
    if (!rel) { res.status(400).json({ error: "path required" }); return; }
    const abs = safePath(rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf-8");
    res.json({ ok: true, path: rel });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;

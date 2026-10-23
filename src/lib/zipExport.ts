import JSZip from "jszip";
import type { VaultFolder, VaultItem } from "@/lib/db";

export function sanitizeFileName(name: string): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  return clean.slice(0, 80) || "untitled";
}

function getCodeExtension(language?: string): string {
  const map: Record<string, string> = {
    javascript: "js",
    js: "js",
    jsx: "jsx",
    typescript: "ts",
    ts: "ts",
    tsx: "tsx",
    python: "py",
    py: "py",
    html: "html",
    css: "css",
    markdown: "md",
    md: "md",
    sql: "sql",
    shell: "sh",
    bash: "sh",
    sh: "sh",
    rust: "rs",
    rs: "rs",
    go: "go",
    c: "c",
    cpp: "cpp",
    java: "java",
    php: "php",
    ruby: "rb",
    swift: "swift",
    kotlin: "kt",
    // Strictly avoid .json extension per user request "no json"
    json: "txt"
  };
  return (language && map[language.toLowerCase()]) || "txt";
}

function getMimeExtension(mimeType?: string, kind?: string): string {
  if (kind === "photo") {
    if (mimeType?.includes("png")) return "png";
    if (mimeType?.includes("webp")) return "webp";
    if (mimeType?.includes("gif")) return "gif";
    if (mimeType?.includes("svg")) return "svg";
    return "jpg";
  }
  if (kind === "video") {
    if (mimeType?.includes("webm")) return "webm";
    if (mimeType?.includes("quicktime")) return "mov";
    if (mimeType?.includes("ogg")) return "ogv";
    return "mp4";
  }
  if (kind === "document") {
    if (mimeType?.includes("pdf")) return "pdf";
    if (mimeType?.includes("word") || mimeType?.includes("docx")) return "docx";
    if (mimeType?.includes("sheet") || mimeType?.includes("excel") || mimeType?.includes("xlsx")) return "xlsx";
    if (mimeType?.includes("zip")) return "zip";
    if (mimeType?.includes("text")) return "txt";
    return "pdf";
  }
  return "bin";
}

function getUniqueZipPath(usedPaths: Set<string>, folderPath: string, fileName: string): string {
  let name = fileName;
  let counter = 1;
  const dotIndex = fileName.lastIndexOf(".");
  const base = dotIndex !== -1 ? fileName.slice(0, dotIndex) : fileName;
  const ext = dotIndex !== -1 ? fileName.slice(dotIndex) : "";

  let fullPath = folderPath ? `${folderPath}/${name}` : name;
  while (usedPaths.has(fullPath.toLowerCase())) {
    name = `${base} (${counter})${ext}`;
    fullPath = folderPath ? `${folderPath}/${name}` : name;
    counter++;
  }
  usedPaths.add(fullPath.toLowerCase());
  return fullPath;
}

function triggerZipDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Add a VaultItem to a JSZip instance as a real file (No JSON).
 */
function addItemToZip(
  zip: JSZip,
  item: VaultItem,
  folderPath: string,
  usedPaths: Set<string>
): boolean {
  const baseName = sanitizeFileName(item.title);

  // 1. Photo, Video, Document (Real binary file)
  if (item.blob) {
    let fileName = item.fileName ? sanitizeFileName(item.fileName) : "";
    if (!fileName || !fileName.includes(".")) {
      const ext = getMimeExtension(item.mimeType || item.blob.type, item.kind);
      fileName = `${baseName}.${ext}`;
    }
    const path = getUniqueZipPath(usedPaths, folderPath, fileName);
    zip.file(path, item.blob);
    return true;
  }

  // 2. Code Snippet (Real runnable code file)
  if (item.kind === "code") {
    const ext = getCodeExtension(item.language);
    const fileName = `${baseName}.${ext}`;
    const path = getUniqueZipPath(usedPaths, folderPath, fileName);
    const codeContent = item.body || "";
    zip.file(path, codeContent);
    return true;
  }

  // 3. Note (Real text file)
  if (item.kind === "note") {
    const fileName = `${baseName}.txt`;
    const path = getUniqueZipPath(usedPaths, folderPath, fileName);

    let content = "";
    if (item.body) {
      if (item.description && !item.body.includes(item.description)) {
        content = `${item.title}\n${"-".repeat(item.title.length)}\n${item.description}\n\n${item.body}`;
      } else {
        content = item.body;
      }
    } else {
      content = item.description || item.title;
    }

    if (item.location) {
      content = `[Location: ${item.location}]\n\n${content}`;
    }

    zip.file(path, content);
    return true;
  }

  // 4. Link (Real Windows Internet Shortcut file)
  if (item.kind === "link") {
    const fileName = `${baseName}.url`;
    const path = getUniqueZipPath(usedPaths, folderPath, fileName);
    const urlShortcutContent = `[InternetShortcut]\r\nURL=${item.url || ""}\r\n`;
    zip.file(path, urlShortcutContent);
    return true;
  }

  // Fallback: note/text file
  const fallbackFileName = `${baseName}.txt`;
  const fallbackPath = getUniqueZipPath(usedPaths, folderPath, fallbackFileName);
  zip.file(fallbackPath, item.body || item.description || item.title);
  return true;
}

/**
 * Export all vault items to a ZIP file organized by folder.
 * NO JSON files are included. Only real photos, videos, notes, code, etc.
 */
export async function exportVaultToZip(
  items: VaultItem[],
  folders: VaultFolder[]
): Promise<{ count: number; zipName: string }> {
  if (items.length === 0) {
    throw new Error("Vault is empty. Add some items before exporting.");
  }

  const zip = new JSZip();
  const usedPaths = new Set<string>();
  const folderMap = new Map<number, string>();

  for (const f of folders) {
    if (f.id) {
      folderMap.set(f.id, sanitizeFileName(f.name));
    }
  }

  let count = 0;
  for (const item of items) {
    let folderPath = "";
    if (item.folderId && folderMap.has(item.folderId)) {
      folderPath = folderMap.get(item.folderId)!;
    } else {
      // Unorganized items placed in a clean "Unorganized" folder if folders exist, or root
      folderPath = folders.length > 0 ? "Unorganized" : "";
    }

    if (addItemToZip(zip, item, folderPath, usedPaths)) {
      count++;
    }
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const zipName = `myspace-vault-files-${dateStr}.zip`;

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  triggerZipDownload(blob, zipName);

  return { count, zipName };
}

/**
 * Export a single folder to a ZIP file with real files (No JSON).
 */
export async function exportSingleFolderToZip(
  folder: VaultFolder,
  items: VaultItem[]
): Promise<{ count: number; zipName: string }> {
  if (items.length === 0) {
    throw new Error(`Folder "${folder.name}" has no items to export.`);
  }

  const zip = new JSZip();
  const usedPaths = new Set<string>();
  const folderDirName = sanitizeFileName(folder.name);

  let count = 0;
  for (const item of items) {
    if (addItemToZip(zip, item, folderDirName, usedPaths)) {
      count++;
    }
  }

  const zipName = `${folderDirName}-files.zip`;

  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });

  triggerZipDownload(blob, zipName);

  return { count, zipName };
}

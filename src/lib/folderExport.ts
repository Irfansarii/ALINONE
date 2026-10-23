import type { VaultItem } from "@/lib/db";

function sanitizeFileName(name: string): string {
  const clean = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").trim();
  return clean.slice(0, 80) || "untitled";
}

function getCodeExtension(language?: string): string {
  const map: Record<string, string> = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    html: "html",
    css: "css",
    json: "json",
    markdown: "md",
    sql: "sql",
    shell: "sh",
    bash: "sh",
    rust: "rs",
    go: "go",
    c: "c",
    cpp: "cpp",
    java: "java"
  };
  return (language && map[language.toLowerCase()]) || "txt";
}

export function downloadSingleItem(item: VaultItem) {
  let blob: Blob;
  let filename = sanitizeFileName(item.title);

  if (item.blob) {
    blob = item.blob;
    filename = item.fileName ? sanitizeFileName(item.fileName) : `${filename}.bin`;
  } else if (item.kind === "link") {
    // Standard Windows Internet Shortcut file (.url)
    const content = `[InternetShortcut]\r\nURL=${item.url || ""}\r\n`;
    blob = new Blob([content], { type: "text/plain" });
    filename = `${filename}.url`;
  } else if (item.kind === "code") {
    const ext = getCodeExtension(item.language);
    blob = new Blob([item.body || ""], { type: "text/plain;charset=utf-8" });
    filename = `${filename}.${ext}`;
  } else {
    // Note or general text
    const textContent = [
      `TITLE: ${item.title}`,
      item.description ? `DESCRIPTION: ${item.description}` : "",
      item.tags.length ? `TAGS: ${item.tags.join(", ")}` : "",
      `UPDATED: ${new Date(item.updatedAt).toLocaleString()}`,
      "-".repeat(40),
      item.body || ""
    ].filter(Boolean).join("\n\n");
    blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    filename = `${filename}.txt`;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportToWindowsFolder(items: VaultItem[]): Promise<{ count: number; folderName: string }> {
  if (typeof window === "undefined" || !("showDirectoryPicker" in window)) {
    throw new Error("Your browser does not support the File System Access API. Please use Chrome, Edge, or Brave on Windows.");
  }

  // Prompt user to pick a Windows folder (e.g. Documents, Desktop, or a new folder)
  const dirHandle = await (window as unknown as { showDirectoryPicker: (opts?: unknown) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
    id: "personal-content-vault",
    mode: "readwrite"
  });

  const folderName = dirHandle.name;
  let savedCount = 0;

  // Create subfolders like Windows / Mobile libraries
  const subfolders: Record<string, FileSystemDirectoryHandle> = {
    photo: await dirHandle.getDirectoryHandle("Photos", { create: true }),
    document: await dirHandle.getDirectoryHandle("Documents", { create: true }),
    video: await dirHandle.getDirectoryHandle("Videos", { create: true }),
    note: await dirHandle.getDirectoryHandle("Notes", { create: true }),
    code: await dirHandle.getDirectoryHandle("Code Snippets", { create: true }),
    link: await dirHandle.getDirectoryHandle("Links", { create: true })
  };

  // 1. Save all item files into their respective subfolder
  for (const item of items) {
    try {
      const targetDir = subfolders[item.kind] || dirHandle;
      const baseName = sanitizeFileName(item.title);
      let fileName = baseName;
      let data: Blob | string;

      if (item.blob) {
        fileName = item.fileName ? sanitizeFileName(item.fileName) : `${baseName}.bin`;
        data = item.blob;
      } else if (item.kind === "link") {
        fileName = `${baseName}.url`;
        data = `[InternetShortcut]\r\nURL=${item.url || ""}\r\n`;
      } else if (item.kind === "code") {
        const ext = getCodeExtension(item.language);
        fileName = `${baseName}.${ext}`;
        data = item.body || "";
      } else {
        fileName = `${baseName}.txt`;
        data = [
          `TITLE: ${item.title}`,
          item.description ? `DESCRIPTION: ${item.description}` : "",
          item.tags.length ? `TAGS: ${item.tags.join(", ")}` : "",
          `SAVED: ${new Date(item.updatedAt).toLocaleString()}`,
          "=".repeat(40),
          "",
          item.body || item.description || ""
        ].filter((l) => l !== null).join("\n");
      }

      const fileHandle = await targetDir.getFileHandle(fileName, { create: true });
      const writable = await (fileHandle as unknown as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
      await writable.write(data);
      await writable.close();
      savedCount++;
    } catch (err) {
      console.warn(`Could not write item "${item.title}" to folder:`, err);
    }
  }

  // 2. Generate a human-readable Vault_Index.html so non-IT users can double-click it in Windows File Explorer
  try {
    const htmlRows = items.map((item) => {
      const folderMap: Record<string, string> = {
        photo: "Photos",
        document: "Documents",
        video: "Videos",
        note: "Notes",
        code: "Code Snippets",
        link: "Links"
      };
      const sub = folderMap[item.kind] || "";
      return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 10px; font-weight: 600;">${escapeHtml(item.title)}</td>
        <td style="padding: 12px 10px;"><span style="background: #eef2ff; color: #4338ca; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${escapeHtml(item.kind)}</span></td>
        <td style="padding: 12px 10px; color: #2563eb; font-weight: 500;">📁 ${escapeHtml(sub)} / ${escapeHtml(item.fileName || item.title)}</td>
        <td style="padding: 12px 10px; color: #64748b; font-size: 13px;">${escapeHtml(item.description || item.url || "")}</td>
        <td style="padding: 12px 10px; color: #888; font-size: 13px;">${new Date(item.updatedAt).toLocaleDateString()}</td>
      </tr>
    `;
    }).join("");

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Vault - Local Gallery & Documents</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; margin: 0; }
    .card { max-width: 1100px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06); }
    h1 { margin-top: 0; font-size: 26px; }
    .folder-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin: 24px 0; }
    .folder-box { border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; background: #f8fafc; }
    .folder-box strong { display: block; font-size: 15px; margin-bottom: 4px; }
    .folder-box span { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
    th { text-align: left; padding: 12px 10px; background: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge { display: inline-block; padding: 4px 12px; background: #10b981; color: white; border-radius: 9999px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1>📁 Personal Vault Files</h1>
        <p style="color: #64748b; margin: 0;">Organized into standard folders just like PC and Mobile galleries.</p>
      </div>
      <span class="badge">Local Offline Vault</span>
    </div>

    <div class="folder-grid">
      <div class="folder-box"><strong>🖼️ Photos</strong><span>Saved in /Photos folder</span></div>
      <div class="folder-box"><strong>📄 Documents</strong><span>Saved in /Documents folder</span></div>
      <div class="folder-box"><strong>🎬 Videos</strong><span>Saved in /Videos folder</span></div>
      <div class="folder-box"><strong>📝 Notes</strong><span>Saved in /Notes folder</span></div>
    </div>

    <p><strong>Total items:</strong> ${items.length} &bull; <strong>Exported:</strong> ${new Date().toLocaleString()}</p>
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Type</th>
          <th>Location in this folder</th>
          <th>Details</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${htmlRows}
      </tbody>
    </table>
  </div>
</body>
</html>`;
    const indexHandle = await dirHandle.getFileHandle("Vault_Index.html", { create: true });
    const writableIndex = await (indexHandle as unknown as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
    await writableIndex.write(indexHtml);
    await writableIndex.close();
  } catch (err) {
    console.warn("Could not write Vault_Index.html:", err);
  }

  return { count: savedCount, folderName };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

import type { VaultFolder, VaultItem } from "@/lib/db";

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

const KIND_SUBFOLDERS: Record<string, string> = {
  photo: "Photos",
  video: "Videos",
  code: "Code Snippets",
  document: "Documents",
  note: "Notes",
  link: "Links"
};

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
      item.location ? `LOCATION: ${item.location}` : "",
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

async function writeItemToDir(dirHandle: FileSystemDirectoryHandle, item: VaultItem): Promise<boolean> {
  try {
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
        item.location ? `LOCATION: ${item.location}` : "",
        item.description ? `DESCRIPTION: ${item.description}` : "",
        item.tags.length ? `TAGS: ${item.tags.join(", ")}` : "",
        `SAVED: ${new Date(item.updatedAt).toLocaleString()}`,
        "=".repeat(40),
        "",
        item.body || item.description || ""
      ].filter((l) => l !== null).join("\n");
    }

    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await (fileHandle as unknown as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
    await writable.write(data);
    await writable.close();
    return true;
  } catch (err) {
    console.warn(`Could not write item "${item.title}" to folder:`, err);
    return false;
  }
}

export async function exportToWindowsFolder(
  items: VaultItem[],
  folders: VaultFolder[] = []
): Promise<{ count: number; folderName: string }> {
  if (typeof window === "undefined" || !("showDirectoryPicker" in window)) {
    throw new Error("Your browser does not support the File System Access API. Please use Chrome, Edge, or Brave on Windows.");
  }

  // Prompt user to pick a Windows folder
  const dirHandle = await (window as unknown as { showDirectoryPicker: (opts?: unknown) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
    id: "personal-content-vault",
    mode: "readwrite"
  });

  const folderName = dirHandle.name;
  let savedCount = 0;

  const folderMap = new Map<number, VaultFolder>();
  folders.forEach((f) => {
    if (f.id) folderMap.set(f.id, f);
  });

  // Organize items by custom folder (or Root / General)
  const itemsByFolder = new Map<number | "root", VaultItem[]>();
  itemsByFolder.set("root", []);

  for (const item of items) {
    if (item.folderId && folderMap.has(item.folderId)) {
      const list = itemsByFolder.get(item.folderId) ?? [];
      list.push(item);
      itemsByFolder.set(item.folderId, list);
    } else {
      itemsByFolder.get("root")!.push(item);
    }
  }

  // Save files into their respective folder and subfolders
  for (const [fId, fItems] of itemsByFolder.entries()) {
    if (fItems.length === 0) continue;

    let targetDirHandle: FileSystemDirectoryHandle = dirHandle;
    let folderDisplayName = "General & Uncategorized";

    if (fId !== "root") {
      const folderObj = folderMap.get(fId);
      if (folderObj) {
        folderDisplayName = sanitizeFileName(folderObj.name);
        targetDirHandle = await dirHandle.getDirectoryHandle(folderDisplayName, { create: true });
      }
    }

    // Create respective subfolders (Photos, Videos, Code Snippets, Documents, Notes, Links)
    const subfolderHandles: Record<string, FileSystemDirectoryHandle> = {};
    for (const kind of Object.keys(KIND_SUBFOLDERS)) {
      const hasKind = fItems.some((it) => it.kind === kind);
      if (hasKind) {
        subfolderHandles[kind] = await targetDirHandle.getDirectoryHandle(KIND_SUBFOLDERS[kind], { create: true });
      }
    }

    for (const item of fItems) {
      const targetSub = subfolderHandles[item.kind] || targetDirHandle;
      const success = await writeItemToDir(targetSub, item);
      if (success) savedCount++;
    }
  }

  // Generate Vault_Index.html
  try {
    const htmlRows = items.map((item) => {
      const fObj = item.folderId ? folderMap.get(item.folderId) : undefined;
      const fName = fObj?.name || "General";
      const fLoc = fObj?.location || item.location || "";
      const sub = KIND_SUBFOLDERS[item.kind] || "";
      const pathDisplay = item.folderId
        ? `📁 ${escapeHtml(fName)} / ${escapeHtml(sub)} / ${escapeHtml(item.fileName || item.title)}`
        : `📁 ${escapeHtml(sub)} / ${escapeHtml(item.fileName || item.title)}`;

      return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 10px; font-weight: 600;">${escapeHtml(item.title)}</td>
        <td style="padding: 12px 10px;"><span style="background: #eef2ff; color: #4338ca; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${escapeHtml(item.kind)}</span></td>
        <td style="padding: 12px 10px; color: #2563eb; font-weight: 500;">${pathDisplay}</td>
        <td style="padding: 12px 10px; color: #0284c7; font-size: 12px;">${fLoc ? `📍 ${escapeHtml(fLoc)}` : "-"}</td>
        <td style="padding: 12px 10px; color: #64748b; font-size: 13px;">${escapeHtml(item.description || item.url || "")}</td>
        <td style="padding: 12px 10px; color: #888; font-size: 13px;">${new Date(item.updatedAt).toLocaleDateString()}</td>
      </tr>
    `;
    }).join("");

    const folderSummaryBoxes = folders.map((f) => {
      const count = items.filter((it) => it.folderId === f.id).length;
      return `
        <div class="folder-box" style="border-left: 4px solid ${f.color || "#6558d3"};">
          <strong>${f.icon || "📁"} ${escapeHtml(f.name)}</strong>
          ${f.location ? `<span style="color:#0284c7; display:block; margin:2px 0;">📍 ${escapeHtml(f.location)}</span>` : ""}
          <span>${count} items saved</span>
        </div>
      `;
    }).join("");

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Personal Vault - Local Organized Files</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; margin: 0; }
    .card { max-width: 1200px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06); }
    h1 { margin-top: 0; font-size: 26px; }
    .folder-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin: 24px 0; }
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
        <h1>📁 Personal Vault Files & Folders</h1>
        <p style="color: #64748b; margin: 0;">Organized into respective folders (photos, videos, code, notes, docs).</p>
      </div>
      <span class="badge">Local Offline Vault</span>
    </div>

    ${folderSummaryBoxes ? `<h3 style="margin-top:24px; margin-bottom:12px; font-size:16px;">Folders & Locations</h3><div class="folder-grid">${folderSummaryBoxes}</div>` : ""}

    <div class="folder-grid">
      <div class="folder-box"><strong>🖼️ Photos</strong><span>Saved in /Photos subfolder</span></div>
      <div class="folder-box"><strong>🎬 Videos</strong><span>Saved in /Videos subfolder</span></div>
      <div class="folder-box"><strong>💻 Code Snippets</strong><span>Saved in /Code Snippets subfolder</span></div>
      <div class="folder-box"><strong>📄 Documents</strong><span>Saved in /Documents subfolder</span></div>
      <div class="folder-box"><strong>📝 Notes</strong><span>Saved in /Notes subfolder</span></div>
      <div class="folder-box"><strong>🔗 Links</strong><span>Saved in /Links subfolder</span></div>
    </div>

    <p><strong>Total items:</strong> ${items.length} &bull; <strong>Folders:</strong> ${folders.length} &bull; <strong>Exported:</strong> ${new Date().toLocaleString()}</p>
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Type</th>
          <th>Location in Folder</th>
          <th>Place / Location</th>
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

export async function exportSingleFolderToWindows(
  folder: VaultFolder,
  items: VaultItem[]
): Promise<{ count: number; folderName: string }> {
  if (typeof window === "undefined" || !("showDirectoryPicker" in window)) {
    throw new Error("Your browser does not support the File System Access API. Please use Chrome, Edge, or Brave on Windows.");
  }

  const dirHandle = await (window as unknown as { showDirectoryPicker: (opts?: unknown) => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker({
    id: `vault-folder-${folder.id ?? "custom"}`,
    mode: "readwrite"
  });

  const folderName = dirHandle.name;
  let savedCount = 0;

  // Create respective subfolders (Photos, Videos, Code Snippets, Documents, Notes, Links)
  const subfolderHandles: Record<string, FileSystemDirectoryHandle> = {};
  for (const kind of Object.keys(KIND_SUBFOLDERS)) {
    const hasKind = items.some((it) => it.kind === kind);
    if (hasKind) {
      subfolderHandles[kind] = await dirHandle.getDirectoryHandle(KIND_SUBFOLDERS[kind], { create: true });
    }
  }

  for (const item of items) {
    const targetSub = subfolderHandles[item.kind] || dirHandle;
    const success = await writeItemToDir(targetSub, item);
    if (success) savedCount++;
  }

  // Summary HTML for this specific folder
  try {
    const htmlRows = items.map((item) => {
      const sub = KIND_SUBFOLDERS[item.kind] || "";
      return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 10px; font-weight: 600;">${escapeHtml(item.title)}</td>
        <td style="padding: 12px 10px;"><span style="background: #eef2ff; color: #4338ca; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">${escapeHtml(item.kind)}</span></td>
        <td style="padding: 12px 10px; color: #2563eb; font-weight: 500;">📁 ${escapeHtml(sub)} / ${escapeHtml(item.fileName || item.title)}</td>
        <td style="padding: 12px 10px; color: #0284c7; font-size: 12px;">${item.location ? `📍 ${escapeHtml(item.location)}` : "-"}</td>
        <td style="padding: 12px 10px; color: #64748b; font-size: 13px;">${escapeHtml(item.description || item.url || "")}</td>
        <td style="padding: 12px 10px; color: #888; font-size: 13px;">${new Date(item.updatedAt).toLocaleDateString()}</td>
      </tr>
    `;
    }).join("");

    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(folder.name)} - Vault Folder</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; margin: 0; }
    .card { max-width: 1100px; margin: 0 auto; background: #fff; padding: 30px; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06); }
    h1 { margin-top: 0; font-size: 26px; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
    th { text-align: left; padding: 12px 10px; background: #f1f5f9; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge { display: inline-block; padding: 4px 12px; background: ${folder.color || "#6558d3"}; color: white; border-radius: 9999px; font-size: 12px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h1>${folder.icon || "📁"} ${escapeHtml(folder.name)}</h1>
        ${folder.location ? `<p style="color: #0284c7; font-weight: 600; margin: 4px 0;">📍 Location: ${escapeHtml(folder.location)}</p>` : ""}
        ${folder.description ? `<p style="color: #64748b; margin: 0;">${escapeHtml(folder.description)}</p>` : ""}
      </div>
      <span class="badge">Folder Export</span>
    </div>
    <p style="margin-top: 20px;"><strong>Total items:</strong> ${items.length} &bull; <strong>Exported:</strong> ${new Date().toLocaleString()}</p>
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Type</th>
          <th>Location in Folder</th>
          <th>Item Location</th>
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

    const indexHandle = await dirHandle.getFileHandle("Folder_Index.html", { create: true });
    const writableIndex = await (indexHandle as unknown as { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
    await writableIndex.write(indexHtml);
    await writableIndex.close();
  } catch (err) {
    console.warn("Could not write Folder_Index.html:", err);
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


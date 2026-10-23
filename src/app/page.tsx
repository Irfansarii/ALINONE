"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, Code2, Download, FileText, Film, Image as ImageIcon, Link2,
  Plus, Search, ShieldCheck, StickyNote, Trash2, Upload, X, HardDrive,
  Pencil, ExternalLink, FolderOpen, Database,
  LayoutGrid, List, Images, ChevronLeft, ChevronRight, Play, Eye
} from "lucide-react";
import { db, type ContentKind, type VaultItem } from "@/lib/db";
import { exportBackup, importBackup } from "@/lib/backup";
import { downloadSingleItem, exportToWindowsFolder } from "@/lib/folderExport";

function MediaThumb({ item, alt }: { item: VaultItem; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!item.blob) return;
    const url = URL.createObjectURL(item.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [item.blob]);

  if (!src) return null;
  return <img src={src} alt={alt} />;
}

function LightboxMedia({ item }: { item: VaultItem }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!item.blob) return;
    const url = URL.createObjectURL(item.blob);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [item.blob]);

  if (item.kind === "photo" && src) {
    return <img className="lightbox-img" src={src} alt={item.title} />;
  }
  if (item.kind === "video" && src) {
    return <video className="lightbox-video" src={src} controls autoPlay />;
  }
  if (item.kind === "document") {
    const isPdf = item.mimeType?.includes("pdf") || item.fileName?.toLowerCase().endsWith(".pdf");
    return (
      <div className="lightbox-doc-card">
        <FileText size={52} />
        <h3>{item.title}</h3>
        <p>{item.fileName || "Document file"} &bull; {item.blob ? formatBytes(item.blob.size) : ""}</p>
        {isPdf && src && (
          <div style={{ marginBottom: 18 }}>
            <iframe src={src} style={{ width: "100%", height: "48vh", border: "0", borderRadius: 8, background: "#fff" }} />
          </div>
        )}
        <button className="primary" onClick={() => downloadSingleItem(item)}>
          <Download size={16} /> Download to Computer
        </button>
      </div>
    );
  }
  if (item.kind === "code") {
    return (
      <div className="lightbox-text-card">
        <div style={{ marginBottom: 12, color: "#94a3b8", fontSize: 12 }}>Language: {item.language || "text"}</div>
        <pre><code>{item.body || ""}</code></pre>
      </div>
    );
  }
  return (
    <div className="lightbox-text-card">
      {item.description && <p style={{ color: "#94a3b8", marginBottom: 14 }}>{item.description}</p>}
      <pre style={{ fontFamily: "inherit", whiteSpace: "pre-wrap" }}>{item.body || ""}</pre>
    </div>
  );
}

const kinds: { id: ContentKind | "all"; label: string; icon: typeof Archive }[] = [
  { id: "all", label: "Everything", icon: Archive },
  { id: "photo", label: "Photos", icon: ImageIcon },
  { id: "video", label: "Videos", icon: Film },
  { id: "document", label: "Documents", icon: FileText },
  { id: "note", label: "Notes", icon: StickyNote },
  { id: "link", label: "Links", icon: Link2 },
  { id: "code", label: "Code snippets", icon: Code2 }
];

const blankForm = {
  title: "", kind: "note" as ContentKind, description: "", tags: "",
  url: "", body: "", language: "typescript"
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function itemSize(item: VaultItem) {
  return item.blob?.size ?? new Blob([item.body ?? "", item.description ?? ""]).size;
}

export default function Home() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [activeKind, setActiveKind] = useState<ContentKind | "all">("all");
  const [viewMode, setViewMode] = useState<"gallery" | "cards" | "list">("gallery");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [form, setForm] = useState(blankForm);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persistent?: boolean }>({});
  const [ready, setReady] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const all = await db.items.orderBy("updatedAt").reverse().toArray();
    setItems(all);
  }

  useEffect(() => {
    let alive = true;
    async function init() {
      try {
        await refresh();
        if (navigator.storage?.estimate) {
          const estimate = await navigator.storage.estimate();
          const persistent = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
          if (alive) setStorage({ usage: estimate.usage, quota: estimate.quota, persistent });
        }
      } catch {
        if (alive) setMessage("Could not open local browser storage. Check browser privacy settings.");
      } finally {
        if (alive) setReady(true);
      }
    }
    void init();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const kindMatches = activeKind === "all" || item.kind === activeKind;
      const haystack = [item.title, item.description, item.body, item.url, item.language, ...item.tags].join(" ").toLowerCase();
      return kindMatches && (!q || haystack.includes(q));
    });
  }, [items, activeKind, search]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      if (e.key === "ArrowRight") setLightboxIndex((prev) => (prev !== null && prev < filtered.length - 1 ? prev + 1 : prev));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, filtered.length]);

  function handleKindSelect(kind: ContentKind | "all") {
    setActiveKind(kind);
    if (kind === "photo" || kind === "video") {
      setViewMode("gallery");
    } else if (kind === "document") {
      setViewMode("list");
    }
  }

  const totalBytes = items.reduce((sum, item) => sum + itemSize(item), 0);
  const photos = items.filter((i) => i.kind === "photo").length;

  function openNew(kind: ContentKind = "note") {
    setEditing(null);
    setForm({ ...blankForm, kind });
    setFile(null);
    setMessage("");
    setShowEditor(true);
  }

  function openEdit(item: VaultItem) {
    setEditing(item);
    setForm({
      title: item.title, kind: item.kind, description: item.description ?? "",
      tags: item.tags.join(", "), url: item.url ?? "", body: item.body ?? "",
      language: item.language ?? "typescript"
    });
    setFile(null);
    setMessage("");
    setShowEditor(true);
  }

  async function saveItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");
    const now = new Date().toISOString();
    const next: VaultItem = {
      ...(editing?.id ? { id: editing.id } : {}),
      title: form.title.trim(),
      kind: form.kind,
      description: form.description.trim(),
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
      ...(form.kind === "link" ? { url: form.url.trim() } : {}),
      ...(["note", "code"].includes(form.kind) ? { body: form.body } : {}),
      ...(form.kind === "code" ? { language: form.language } : {}),
      ...(file ? { blob: file, fileName: file.name, mimeType: file.type || "application/octet-stream" } :
        editing?.blob ? { blob: editing.blob, fileName: editing.fileName, mimeType: editing.mimeType } : {})
    };
    if (!next.title) return setMessage("Please enter a title.");
    if (form.kind === "link" && !/^https?:\/\//i.test(form.url.trim())) return setMessage("Enter a full link starting with https:// or http://.");
    if (["photo", "video", "document"].includes(form.kind) && !file && !editing?.blob) return setMessage("Choose a file for this item.");
    try {
      await db.items.put(next);
      setShowEditor(false);
      setEditing(null);
      setFile(null);
      await refresh();
      if (navigator.storage?.estimate) {
        const estimate = await navigator.storage.estimate();
        const persistent = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
        setStorage({ usage: estimate.usage, quota: estimate.quota, persistent });
      }
      setMessage("Saved on this device.");
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "QuotaExceededError") {
        setMessage("Browser storage is full. Delete large files or export a backup before adding more.");
      } else {
        setMessage("Could not save. Your browser may be blocking local storage or may be out of space.");
      }
    }
  }

  async function deleteItem(item: VaultItem) {
    if (!item.id || !window.confirm(`Delete “${item.title}” from this browser? This cannot be undone unless you have a backup.`)) return;
    await db.items.delete(item.id);
    await refresh();
    setMessage("Item deleted from this device.");
  }

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) {
      setMessage("Persistent storage permission is not supported by this browser.");
      return;
    }
    const granted = await navigator.storage.persist();
    setStorage((s) => ({ ...s, persistent: granted }));
    setMessage(granted
      ? "The browser granted persistent storage. Keep backups of important files anyway."
      : "The browser did not grant persistent storage. Export backups regularly.");
  }

  async function handleExport() {
    try {
      await exportBackup(await db.items.toArray());
      setMessage("Backup export started. Keep the downloaded JSON file safe.");
    } catch {
      setMessage("Backup export failed. Very large libraries may need to be exported in smaller batches.");
    }
  }

  async function handleSaveToFolder() {
    try {
      const all = await db.items.toArray();
      if (all.length === 0) {
        setMessage("Your vault is currently empty. Add some items first.");
        return;
      }
      const result = await exportToWindowsFolder(all);
      setMessage(`Saved ${result.count} files into your Windows folder "${result.folderName}"! Open that folder to see your files and double-click "Vault_Index.html".`);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const errMessage = err instanceof Error ? err.message : "Could not save to folder.";
      setMessage(errMessage);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen) return;
    try {
      const imported = await importBackup(chosen);
      if (!window.confirm(`Import ${imported.length} items? Existing items will be kept; imported items will be added as new records.`)) return;
      await db.transaction("rw", db.items, async () => {
        for (const item of imported) {
          const { id: _id, ...newItem } = item;
          await db.items.add(newItem);
        }
      });
      await refresh();
      setMessage(`Imported ${imported.length} items to this browser.`);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setMessage(name === "QuotaExceededError"
        ? "Not enough browser storage for this backup. Try a smaller backup or free up space."
        : "Could not import this backup. It may be invalid or too large.");
    }
  }

  function preview(item: VaultItem) {
    const idx = filtered.findIndex((i) => i.id === item.id);
    if (idx !== -1) {
      setLightboxIndex(idx);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Archive size={20} /></div><div><strong>MySpace Vault</strong><small>Personal library</small></div></div>
        <button className="primary full" onClick={() => openNew()}><Plus size={17} /> Add something</button>
        <div className="nav-label">YOUR SPACE</div>
        <nav className="nav-list">
          {kinds.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeKind === id ? "active" : ""}`} onClick={() => handleKindSelect(id)}>
              <Icon size={17} /><span>{label}</span>
              <span className="nav-count">{id === "all" ? items.length : items.filter((i) => i.kind === id).length}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><ShieldCheck size={18} /><div><strong>Local-first privacy</strong><p>Your content stays in this browser. This app has no content upload API.</p></div></div>
          <div className="storage-label"><HardDrive size={15} /><span>Approx. item data</span><strong>{formatBytes(totalBytes)}</strong></div>
          {storage.quota ? <div className="quota-track"><div style={{ width: `${Math.min(100, ((storage.usage ?? 0) / storage.quota) * 100)}%` }} /></div> : null}
          <button className="text-button" onClick={requestPersistentStorage}>Request persistent storage</button>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div><div className="eyebrow">YOUR PERSONAL SPACE</div><h1>Everything you want to keep.</h1><p className="subtitle">Memories, ideas, files and things worth coming back to.</p></div>
          <div className="top-actions">
            <button className="secondary" onClick={handleSaveToFolder} title="Pick a folder on your computer to save all files directly"><FolderOpen size={16} /> Save to Computer Folder</button>
            <button className="secondary" onClick={handleExport}><Download size={16} /> Export backup</button>
            <button className="secondary" onClick={() => importRef.current?.click()}><Upload size={16} /> Import backup</button>
            <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={handleImport} />
          </div>
        </header>

        <div className="stats-grid">
          <div className="stat-card"><span>Total items</span><strong>{items.length}</strong><Archive size={19} /></div>
          <div className="stat-card"><span>Photos</span><strong>{photos}</strong><ImageIcon size={19} /></div>
          <div className="stat-card"><span>Stored item data</span><strong>{formatBytes(totalBytes)}</strong><Database size={19} /></div>
          <div className="stat-card"><span>Storage mode</span><strong className="local-value">Local</strong><ShieldCheck size={19} /></div>
        </div>

        <div className="content-toolbar">
          <div>
            <h2>{activeKind === "all" ? "Your collection" : kinds.find((k) => k.id === activeKind)?.label}</h2>
            <p>{filtered.length} {filtered.length === 1 ? "item" : "items"} saved on this device</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div className="view-toggle" role="group" aria-label="View mode">
              <button
                className={`view-btn ${viewMode === "gallery" ? "active" : ""}`}
                onClick={() => setViewMode("gallery")}
                title="Gallery view (photos and media like Mobile/PC Photos)"
              >
                <Images size={14} /> Gallery
              </button>
              <button
                className={`view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
                title="File explorer view (like Windows File Explorer / Files app)"
              >
                <List size={14} /> Files
              </button>
              <button
                className={`view-btn ${viewMode === "cards" ? "active" : ""}`}
                onClick={() => setViewMode("cards")}
                title="Cards view"
              >
                <LayoutGrid size={14} /> Cards
              </button>
            </div>
            <label className="search-box">
              <Search size={17} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your vault..." />
            </label>
          </div>
        </div>

        {message && <div className="notice" role="status"><span>{message}</span><button aria-label="Dismiss message" onClick={() => setMessage("")}><X size={16} /></button></div>}

        {!ready ? <div className="empty-state"><div className="spinner" /><h3>Opening your local vault…</h3></div> :
          filtered.length === 0 ? (
            <div className="empty-state"><div className="empty-icon"><FolderOpen size={28} /></div><h3>{search ? "No matches found" : "Your space is ready"}</h3><p>{search ? "Try another keyword or category." : "Add a travel photo, a note, a document, a useful link or a code snippet. It will be saved in this browser."}</p><button className="primary" onClick={() => openNew()}><Plus size={17} /> Add your first item</button></div>
          ) : viewMode === "gallery" ? (
            <div className="gallery-grid">
              {filtered.map((item, index) => {
                const Icon = kinds.find((k) => k.id === item.kind)?.icon ?? Archive;
                return (
                  <article className="gallery-card" key={item.id} onClick={() => setLightboxIndex(index)}>
                    {item.kind === "photo" && item.blob ? (
                      <MediaThumb item={item} alt={item.title} />
                    ) : (
                      <div className="gallery-placeholder">
                        <Icon size={38} />
                      </div>
                    )}
                    <div className="gallery-kind-badge">
                      {item.kind === "video" ? <Play size={10} fill="white" /> : null}
                      <span>{item.kind}</span>
                    </div>
                    <div className="gallery-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="gallery-action-btn" title="Download file" onClick={() => downloadSingleItem(item)}>
                        <Download size={13} />
                      </button>
                      <button className="gallery-action-btn" title="Edit" onClick={() => openEdit(item)}>
                        <Pencil size={13} />
                      </button>
                    </div>
                    <div className="gallery-overlay">
                      <h4>{item.title}</h4>
                      <p>{item.fileName || item.description || new Date(item.updatedAt).toLocaleDateString()}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : viewMode === "list" ? (
            <div className="doc-list">
              <div className="doc-row doc-row-header">
                <span></span>
                <span>Name</span>
                <span>Type</span>
                <span>Size</span>
                <span style={{ textAlign: "right" }}>Actions</span>
              </div>
              {filtered.map((item, index) => {
                const Icon = kinds.find((k) => k.id === item.kind)?.icon ?? Archive;
                return (
                  <div className="doc-row" key={item.id} onClick={() => setLightboxIndex(index)} style={{ cursor: "pointer" }}>
                    <div className={`doc-icon ${item.kind}`}>
                      <Icon size={18} />
                    </div>
                    <div className="doc-title-block">
                      <div className="doc-title">
                        <span>{item.title}</span>
                        {item.fileName && item.fileName !== item.title && (
                          <small style={{ color: "#8a94a6", fontWeight: 400 }}>({item.fileName})</small>
                        )}
                      </div>
                      <div className="doc-meta">
                        {item.description || item.url || (item.tags.length > 0 ? `#${item.tags.join(" #")}` : "No description")}
                      </div>
                    </div>
                    <div className="doc-type">{item.kind}</div>
                    <div className="doc-size">{item.blob ? formatBytes(item.blob.size) : `${(item.body || "").length} chars`}</div>
                    <div className="doc-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="icon-button" title="View details" onClick={() => setLightboxIndex(index)}>
                        <Eye size={16} />
                      </button>
                      <button className="icon-button" title="Download to PC" onClick={() => downloadSingleItem(item)}>
                        <Download size={16} />
                      </button>
                      <button className="icon-button" title="Edit" onClick={() => openEdit(item)}>
                        <Pencil size={16} />
                      </button>
                      <button className="icon-button danger" title="Delete" onClick={() => void deleteItem(item)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="item-grid">
              {filtered.map((item) => {
                const Icon = kinds.find((k) => k.id === item.kind)?.icon ?? Archive;
                const imageUrl = item.kind === "photo" && item.blob ? URL.createObjectURL(item.blob) : null;
                return <article className="item-card" key={item.id}>
                  {imageUrl ? <div className="item-preview" onClick={() => preview(item)} style={{ cursor: "pointer" }}><img src={imageUrl} alt={item.title} onLoad={() => URL.revokeObjectURL(imageUrl)} /></div> :
                    <div className={`item-icon ${item.kind}`} onClick={() => preview(item)} style={{ cursor: "pointer" }}><Icon size={25} /></div>}
                  <div className="item-card-body">
                    <div className="item-kind">{item.kind}</div><h3>{item.title}</h3>
                    {item.description && <p className="item-description">{item.description}</p>}
                    {item.kind === "link" && item.url && <a className="saved-link" href={item.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open link</a>}
                    {item.kind === "code" && <pre className="code-preview"><code>{(item.body ?? "").slice(0, 220)}</code></pre>}
                    {item.kind === "note" && item.body && <p className="note-preview">{item.body.slice(0, 160)}{item.body.length > 160 ? "…" : ""}</p>}
                    {item.tags.length > 0 && <div className="tags">{item.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>}
                    {item.blob && <div className="file-meta">{item.fileName} · {formatBytes(item.blob.size)}</div>}
                    <div className="item-footer"><span>{new Date(item.updatedAt).toLocaleDateString()}</span><div>
                      <button className="icon-button" title="Download file to computer" onClick={() => downloadSingleItem(item)}><Download size={16} /></button>
                      <button className="icon-button" title="Preview or open" onClick={() => preview(item)}><Eye size={16} /></button>
                      <button className="icon-button" title="Edit" onClick={() => openEdit(item)}><Pencil size={16} /></button>
                      <button className="icon-button danger" title="Delete" onClick={() => void deleteItem(item)}><Trash2 size={16} /></button>
                    </div></div>
                  </div>
                </article>;
              })}
            </div>
          )}

        <footer className="footer-note"><ShieldCheck size={15} /><span>Local-first by design. Your saved content is not sent to a database or uploaded by this app.</span></footer>
      </section>

      {showEditor && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowEditor(false); }}>
        <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
          <div className="modal-head"><div><span className="eyebrow">{editing ? "UPDATE YOUR ITEM" : "ADD TO YOUR VAULT"}</span><h2 id="editor-title">{editing ? "Edit item" : "Save something"}</h2></div><button className="icon-button" aria-label="Close" onClick={() => setShowEditor(false)}><X size={20} /></button></div>
          <form onSubmit={saveItem} className="editor-form">
            <label>Type<select value={form.kind} onChange={(e) => { setForm({ ...form, kind: e.target.value as ContentKind }); setFile(null); }} disabled={Boolean(editing)}>{kinds.filter((k) => k.id !== "all").map((k) => <option value={k.id} key={k.id}>{k.label}</option>)}</select>{editing && <small>To change the type, create a new item with the desired type.</small>}</label>
            <label>Title *<input required maxLength={180} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Goa trip, useful React hook..." /></label>
            <label>Description / caption<textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add context, a caption or a short description" /></label>
            {["photo", "video", "document"].includes(form.kind) && <label className="file-drop"><Upload size={22} /><strong>{file?.name ?? (editing?.fileName || "Choose a file")}</strong><span>File stays in this browser. Large files may exceed browser storage limits.</span><input type="file" accept={form.kind === "photo" ? "image/*" : form.kind === "video" ? "video/*" : undefined} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />{editing?.blob && !file && <small>Leave empty to keep the existing file.</small>}</label>}
            {form.kind === "link" && <label>URL *<input required type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com" /></label>}
            {["note", "code"].includes(form.kind) && <label>{form.kind === "code" ? "Code snippet" : "Your note"}<textarea className={form.kind === "code" ? "code-input" : ""} rows={form.kind === "code" ? 9 : 6} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder={form.kind === "code" ? "Paste your code here..." : "Write your note..."} /></label>}
            {form.kind === "code" && <label>Language<input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} placeholder="typescript, python, sql..." /></label>}
            <label>Tags <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="travel, ideas, work (comma-separated)" /></label>
            {message && <div className="notice" role="status">{message}</div>}
            <div className="modal-actions"><button type="button" className="secondary" onClick={() => setShowEditor(false)}>Cancel</button><button type="submit" className="primary"><Plus size={16} /> {editing ? "Save changes" : "Save to this device"}</button></div>
            <p className="privacy-hint"><ShieldCheck size={14} /> Saved locally in this browser, not uploaded to your server.</p>
          </form>
        </section>
      </div>}
      {lightboxIndex !== null && filtered[lightboxIndex] && (() => {
        const currentItem = filtered[lightboxIndex];
        return (
          <div className="lightbox-modal" role="dialog" aria-modal="true">
            <div className="lightbox-topbar">
              <div className="lightbox-title">
                <h3>{currentItem.title}</h3>
                <span>
                  {currentItem.kind.toUpperCase()} &bull; {new Date(currentItem.updatedAt).toLocaleDateString()}
                  {currentItem.fileName ? ` &bull; ${currentItem.fileName}` : ""}
                  {currentItem.blob ? ` &bull; ${formatBytes(currentItem.blob.size)}` : ""}
                </span>
              </div>
              <div className="lightbox-topbar-actions">
                <button className="lightbox-btn" onClick={() => downloadSingleItem(currentItem)} title="Download file to computer">
                  <Download size={15} /> Save to PC
                </button>
                <button className="lightbox-btn" onClick={() => { setLightboxIndex(null); openEdit(currentItem); }} title="Edit item">
                  <Pencil size={15} /> Edit
                </button>
                <button className="lightbox-btn close" onClick={() => setLightboxIndex(null)} title="Close viewer (Esc)">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="lightbox-body">
              {lightboxIndex > 0 && (
                <button className="lightbox-nav-btn prev" onClick={() => setLightboxIndex(lightboxIndex - 1)} title="Previous item (Left Arrow)">
                  <ChevronLeft size={28} />
                </button>
              )}

              <LightboxMedia item={currentItem} />

              {lightboxIndex < filtered.length - 1 && (
                <button className="lightbox-nav-btn next" onClick={() => setLightboxIndex(lightboxIndex + 1)} title="Next item (Right Arrow)">
                  <ChevronRight size={28} />
                </button>
              )}
            </div>

            <div className="lightbox-footer">
              <span>{lightboxIndex + 1} of {filtered.length} items</span>
              <span>&bull;</span>
              <span>Press <strong>Esc</strong> to close, <strong>←</strong> and <strong>→</strong> arrow keys to browse</span>
            </div>
          </div>
        );
      })()}
    </main>
  );
}

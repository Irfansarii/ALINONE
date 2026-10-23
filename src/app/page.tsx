"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  Code2,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Plus,
  Search,
  ShieldCheck,
  StickyNote,
  Trash2,
  Upload,
  X,
  HardDrive,
  Pencil,
  ExternalLink,
  FolderOpen,
  Database,
  LayoutGrid,
  List,
  Images,
  ChevronLeft,
  ChevronRight,
  Play,
  Eye,
  FolderPlus,
  MapPin,
  Folder as FolderIcon,
  Menu,
  Briefcase,
  Laptop,
  Camera,
  Building,
  Home as HomeIcon,
  GraduationCap,
  Palette,
  Rocket,
  Music,
  Car,
  Star,
  Heart,
  Bookmark,
  type LucideIcon
} from "lucide-react";
import { db, type ContentKind, type VaultFolder, type VaultItem } from "@/lib/db";
import { importBackup } from "@/lib/backup";
import { downloadSingleItem, exportToWindowsFolder } from "@/lib/folderExport";
import { exportVaultToZip, exportSingleFolderToZip } from "@/lib/zipExport";

const FOLDER_ICON_OPTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "folder", label: "Folder", icon: FolderIcon },
  { id: "briefcase", label: "Work & Office", icon: Briefcase },
  { id: "laptop", label: "Code & Dev", icon: Laptop },
  { id: "camera", label: "Photos", icon: Camera },
  { id: "film", label: "Videos", icon: Film },
  { id: "location", label: "Places & Travel", icon: MapPin },
  { id: "building", label: "Organization", icon: Building },
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "graduation", label: "Education", icon: GraduationCap },
  { id: "palette", label: "Creative & Art", icon: Palette },
  { id: "rocket", label: "Projects", icon: Rocket },
  { id: "music", label: "Music", icon: Music },
  { id: "car", label: "Travel & Trips", icon: Car },
  { id: "star", label: "Favorites", icon: Star },
  { id: "heart", label: "Personal", icon: Heart },
  { id: "bookmark", label: "Docs & Reading", icon: Bookmark }
];

const FOLDER_GLYPH_MAP: Record<string, LucideIcon> = {
  folder: FolderIcon,
  "📁": FolderIcon,
  default: FolderIcon,
  briefcase: Briefcase,
  "💼": Briefcase,
  laptop: Laptop,
  "💻": Laptop,
  camera: Camera,
  "📸": Camera,
  film: Film,
  "🎬": Film,
  location: MapPin,
  "📍": MapPin,
  building: Building,
  "🏢": Building,
  home: HomeIcon,
  "🏠": HomeIcon,
  graduation: GraduationCap,
  "🎓": GraduationCap,
  palette: Palette,
  "🎨": Palette,
  rocket: Rocket,
  "🚀": Rocket,
  music: Music,
  "🎵": Music,
  car: Car,
  "🚗": Car,
  star: Star,
  "🌟": Star,
  heart: Heart,
  "❤️": Heart,
  bookmark: Bookmark,
  "📝": Bookmark
};

function FolderGlyph({
  icon,
  size = 16,
  className,
  style
}: {
  icon?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const IconComp = icon ? FOLDER_GLYPH_MAP[icon] : undefined;
  if (IconComp) {
    return <IconComp size={size} className={className} style={style} />;
  }
  if (!icon || icon === "📁") {
    return <FolderIcon size={size} className={className} style={style} />;
  }
  return (
    <span
      style={{
        fontSize: size,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        ...style
      }}
      className={className}
    >
      {icon}
    </span>
  );
}

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
        <FileText size={48} />
        <h3>{item.title}</h3>
        <p>{item.fileName || "Document file"} &bull; {item.blob ? formatBytes(item.blob.size) : ""}</p>
        {isPdf && src && (
          <div style={{ marginBottom: 18 }}>
            <iframe src={src} style={{ width: "100%", height: "48vh", border: "0", borderRadius: 8, background: "#fff" }} />
          </div>
        )}
        <button className="primary" onClick={() => downloadSingleItem(item)}>
          <Download size={15} /> Download to Computer
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

const kinds: { id: ContentKind | "all"; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "Everything", icon: Archive },
  { id: "photo", label: "Photos", icon: ImageIcon },
  { id: "video", label: "Videos", icon: Film },
  { id: "code", label: "Code snippets", icon: Code2 },
  { id: "document", label: "Documents", icon: FileText },
  { id: "note", label: "Notes", icon: StickyNote },
  { id: "link", label: "Links", icon: Link2 }
];

const FOLDER_COLORS = [
  "#6558d3", // Indigo
  "#0284c7", // Sky Blue
  "#10b981", // Emerald Green
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#0d9488"  // Teal
];

const blankFolderForm = {
  name: "",
  location: "",
  color: "#6558d3",
  icon: "folder",
  description: ""
};

const blankForm = {
  title: "",
  kind: "note" as ContentKind,
  folderId: "" as number | "",
  location: "",
  description: "",
  tags: "",
  url: "",
  body: "",
  language: "typescript"
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
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [activeKind, setActiveKind] = useState<ContentKind | "all">("all");
  const [activeFolderId, setActiveFolderId] = useState<number | "all" | "unorganized" | "folders_overview">("all");
  const [viewMode, setViewMode] = useState<"gallery" | "cards" | "list">("gallery");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<VaultItem | null>(null);
  const [form, setForm] = useState(blankForm);
  const [file, setFile] = useState<File | null>(null);

  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<VaultFolder | null>(null);
  const [folderForm, setFolderForm] = useState(blankFolderForm);

  const [message, setMessage] = useState<string>("");
  const [ready, setReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const [all, allFolders] = await Promise.all([
      db.items.orderBy("updatedAt").reverse().toArray(),
      db.folders.orderBy("name").toArray()
    ]);
    setItems(all);
    setFolders(allFolders);
    setReady(true);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const folderMap = useMemo(() => {
    const map = new Map<number, VaultFolder>();
    for (const f of folders) {
      if (f.id) map.set(f.id, f);
    }
    return map;
  }, [folders]);

  const activeFolder = useMemo(() => {
    if (typeof activeFolderId === "number") {
      return folderMap.get(activeFolderId);
    }
    return undefined;
  }, [activeFolderId, folderMap]);

  const folderItems = useMemo(() => {
    if (typeof activeFolderId === "number") {
      return items.filter((i) => i.folderId === activeFolderId);
    }
    return [];
  }, [items, activeFolderId]);

  const folderKindCounts = useMemo(() => {
    const res: Record<string, number> = { all: folderItems.length };
    for (const k of kinds) {
      if (k.id !== "all") {
        res[k.id] = folderItems.filter((i) => i.kind === k.id).length;
      }
    }
    return res;
  }, [folderItems]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (activeFolderId === "folders_overview") {
        return false;
      }
      if (typeof activeFolderId === "number") {
        if (item.folderId !== activeFolderId) return false;
      } else if (activeFolderId === "unorganized") {
        if (item.folderId !== undefined) return false;
      }

      if (activeKind !== "all" && item.kind !== activeKind) {
        return false;
      }

      if (search.trim()) {
        const needle = search.toLowerCase();
        const f = item.folderId ? folderMap.get(item.folderId) : undefined;
        const matchesFolder = f ? f.name.toLowerCase().includes(needle) || (f.location && f.location.toLowerCase().includes(needle)) : false;
        const matchesLocation = item.location ? item.location.toLowerCase().includes(needle) : false;
        const matchesTitle = item.title.toLowerCase().includes(needle);
        const matchesDescription = item.description?.toLowerCase().includes(needle);
        const matchesTags = item.tags.some((t) => t.toLowerCase().includes(needle));
        const matchesBody = item.body?.toLowerCase().includes(needle);
        const matchesFile = item.fileName?.toLowerCase().includes(needle);

        if (!matchesTitle && !matchesDescription && !matchesTags && !matchesBody && !matchesFile && !matchesFolder && !matchesLocation) {
          return false;
        }
      }
      return true;
    });
  }, [items, activeKind, activeFolderId, search, folderMap]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev !== null && prev < filtered.length - 1 ? prev + 1 : prev));
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, filtered.length]);

  function handleKindSelect(k: ContentKind | "all") {
    setActiveKind(k);
    if (k === "photo" || k === "video") {
      setViewMode("gallery");
    } else if (k === "document") {
      setViewMode("list");
    } else if (k === "code" || k === "note" || k === "link") {
      setViewMode("cards");
    }
  }

  function openNew(kind?: ContentKind, folderId?: number) {
    setEditing(null);
    setForm({
      ...blankForm,
      kind: kind ?? (activeKind === "all" ? "note" : activeKind),
      folderId: folderId ?? (typeof activeFolderId === "number" ? activeFolderId : ""),
      location: typeof activeFolderId === "number" ? folderMap.get(activeFolderId)?.location ?? "" : ""
    });
    setFile(null);
    setMessage("");
    setShowEditor(true);
  }

  function openEdit(item: VaultItem) {
    setEditing(item);
    setForm({
      title: item.title,
      kind: item.kind,
      folderId: item.folderId ?? "",
      location: item.location ?? "",
      description: item.description ?? "",
      tags: item.tags.join(", "),
      url: item.url ?? "",
      body: item.body ?? "",
      language: item.language ?? "typescript"
    });
    setFile(null);
    setMessage("");
    setShowEditor(true);
  }

  function openNewFolder(initialLocation = "") {
    setEditingFolder(null);
    setFolderForm({ ...blankFolderForm, location: initialLocation, icon: "folder" });
    setShowFolderModal(true);
  }

  function openEditFolder(folder: VaultFolder) {
    setEditingFolder(folder);
    setFolderForm({
      name: folder.name,
      location: folder.location ?? "",
      color: folder.color ?? "#6558d3",
      icon: (!folder.icon || folder.icon === "📁") ? "folder" : folder.icon,
      description: folder.description ?? ""
    });
    setShowFolderModal(true);
  }

  async function saveFolder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = folderForm.name.trim();
    if (!name) {
      setMessage("Please enter a folder name.");
      return;
    }
    const now = new Date().toISOString();
    const folderData: VaultFolder = {
      ...(editingFolder?.id ? { id: editingFolder.id } : {}),
      name,
      location: folderForm.location.trim(),
      color: folderForm.color,
      icon: folderForm.icon || "folder",
      description: folderForm.description.trim(),
      createdAt: editingFolder?.createdAt ?? now,
      updatedAt: now
    };

    try {
      const savedId = await db.folders.put(folderData);
      setShowFolderModal(false);
      setEditingFolder(null);
      await refresh();
      setMessage(`Folder "${name}" saved!`);
      if (!editingFolder?.id) {
        setActiveFolderId(savedId as number);
        setActiveKind("all");
      }
    } catch {
      setMessage("Could not save folder. Storage may be limited.");
    }
  }

  async function deleteFolder(folder: VaultFolder) {
    if (!folder.id) return;
    const count = items.filter((it) => it.folderId === folder.id).length;
    const confirmMsg = count > 0
      ? `Delete folder "${folder.name}"? Its ${count} items will NOT be deleted; they will stay safe in your vault as Unorganized items.`
      : `Delete empty folder "${folder.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    await db.transaction("rw", [db.items, db.folders], async () => {
      const itemsInFolder = await db.items.where("folderId").equals(folder.id!).toArray();
      for (const it of itemsInFolder) {
        if (it.id) {
          await db.items.update(it.id, { folderId: undefined });
        }
      }
      await db.folders.delete(folder.id!);
    });

    if (activeFolderId === folder.id) {
      setActiveFolderId("all");
    }
    await refresh();
    setMessage(`Folder "${folder.name}" deleted.`);
  }

  async function handleExportCurrentFolder(folder: VaultFolder) {
    if (!folder.id) return;
    try {
      const fItems = await db.items.where("folderId").equals(folder.id).toArray();
      if (fItems.length === 0) {
        setMessage(`Folder "${folder.name}" is empty. Add items first.`);
        return;
      }
      setMessage(`Packaging "${folder.name}" with real photos, videos, notes & code into ZIP...`);
      const res = await exportSingleFolderToZip(folder, fItems);
      setMessage(`Downloaded "${res.zipName}" with ${res.count} real files (No JSON)!`);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const errMessage = err instanceof Error ? err.message : "Export failed";
      setMessage(errMessage);
    }
  }

  async function saveItem(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.title.trim()) {
      setMessage("Please enter a title.");
      return;
    }

    const now = new Date().toISOString();
    const tagList = form.tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const fId = typeof form.folderId === "number" ? form.folderId : undefined;

    const base: VaultItem = {
      title: form.title.trim(),
      kind: form.kind,
      folderId: fId,
      location: form.location.trim(),
      description: form.description.trim(),
      tags: tagList,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now
    };

    if (editing?.id) {
      base.id = editing.id;
    }

    if (["photo", "video", "document"].includes(form.kind)) {
      if (file) {
        base.blob = file;
        base.fileName = file.name;
        base.mimeType = file.type || "application/octet-stream";
      } else if (editing?.blob) {
        base.blob = editing.blob;
        base.fileName = editing.fileName;
        base.mimeType = editing.mimeType;
      }
    } else if (form.kind === "link") {
      base.url = form.url.trim();
    } else if (form.kind === "code") {
      base.body = form.body;
      base.language = form.language.trim() || "typescript";
    } else if (form.kind === "note") {
      base.body = form.body;
    }

    try {
      await db.items.put(base);
      setShowEditor(false);
      setEditing(null);
      setFile(null);
      await refresh();
      setMessage("Saved locally to this device.");
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

  async function handleExportZip() {
    try {
      const all = await db.items.toArray();
      if (all.length === 0) {
        setMessage("Your vault is currently empty. Add some items first.");
        return;
      }
      const allFolders = await db.folders.toArray();
      setMessage("Packaging all real photos, videos, notes and code into a ZIP archive (No JSON)...");
      const res = await exportVaultToZip(all, allFolders);
      setMessage(`Downloaded "${res.zipName}" with ${res.count} real files (No JSON)!`);
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : "Export failed";
      setMessage(errMessage);
    }
  }


  async function handleSaveToFolder() {
    try {
      const all = await db.items.toArray();
      if (all.length === 0) {
        setMessage("Your vault is currently empty. Add some items first.");
        return;
      }
      const allFolders = await db.folders.toArray();
      const result = await exportToWindowsFolder(all, allFolders);
      setMessage(`Saved ${result.count} files into your Windows folder "${result.folderName}"! Files are organized by folder and respective types (Photos, Videos, Code, etc.). Double-click "Vault_Index.html" to view.`);
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
      const { items: importedItems, folders: importedFolders } = await importBackup(chosen);
      if (!window.confirm(`Import ${importedItems.length} items and ${importedFolders.length} folders? Existing records will be preserved.`)) return;

      await db.transaction("rw", [db.items, db.folders], async () => {
        for (const f of importedFolders) {
          await db.folders.add(f);
        }
        for (const item of importedItems) {
          await db.items.add(item);
        }
      });
      await refresh();
      setMessage(`Imported ${importedItems.length} items and ${importedFolders.length} folders successfully.`);
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

  const photos = items.filter((i) => i.kind === "photo").length;
  const totalBytes = items.reduce((acc, i) => acc + itemSize(i), 0);
  const unorganizedCount = items.filter((i) => i.folderId === undefined).length;

  return (
    <main className="app-shell">
      {/* Mobile Sticky Header (Hidden on Desktop) */}
      <header className="mobile-header">
        <button
          className="mobile-header-btn"
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div
          className="mobile-brand"
          onClick={() => { setActiveFolderId("all"); setActiveKind("all"); setMobileMenuOpen(false); }}
          role="button"
          tabIndex={0}
        >
          <div className="brand-mark sm"><Archive size={15} /></div>
          <span>MySpace Vault</span>
        </div>

        <div className="mobile-header-actions">
          <button
            className="mobile-header-btn"
            onClick={() => { openNewFolder(); setMobileMenuOpen(false); }}
            title="Create Folder"
            aria-label="Create Folder"
          >
            <FolderPlus size={17} />
          </button>
          <button
            className="mobile-header-action-btn"
            onClick={() => { openNew(); setMobileMenuOpen(false); }}
            title="Add item"
            aria-label="Add item"
          >
            <Plus size={17} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation overlay"
        />
      )}

      {/* Sidebar Drawer */}
      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div
            className="brand"
            onClick={() => { setActiveFolderId("all"); setActiveKind("all"); setMobileMenuOpen(false); }}
            style={{ cursor: "pointer" }}
          >
            <div className="brand-mark"><Archive size={18} /></div>
            <div><strong>MySpace Vault</strong><small>Personal library</small></div>
          </div>
          <button
            className="sidebar-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close sidebar drawer"
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          <button className="primary full" onClick={() => { openNew(); setMobileMenuOpen(false); }}>
            <Plus size={15} /> Add something
          </button>
          <button className="secondary full" onClick={() => { openNewFolder(); setMobileMenuOpen(false); }} title="Create a new folder to store photos, videos, code, etc.">
            <FolderPlus size={15} /> Create Folder
          </button>
        </div>

        {/* FOLDERS & LOCATIONS Navigation */}
        <div className="nav-section-head">
          <div className="nav-label" style={{ margin: "16px 10px 8px" }}>FOLDERS & LOCATIONS</div>
          <button
            className="nav-add-btn"
            onClick={() => { openNewFolder(); setMobileMenuOpen(false); }}
            title="Create a new folder"
            aria-label="Create new folder"
          >
            <Plus size={14} />
          </button>
        </div>

        <nav className="nav-list" style={{ marginBottom: 12 }}>
          <button
            className={`nav-item ${activeFolderId === "folders_overview" ? "active" : ""}`}
            onClick={() => { setActiveFolderId("folders_overview"); setActiveKind("all"); setMobileMenuOpen(false); }}
          >
            <FolderIcon size={15} />
            <span>All Folders</span>
            <span className="nav-count">{folders.length}</span>
          </button>

          {folders.map((folder) => {
            const count = items.filter((it) => it.folderId === folder.id).length;
            const isAct = activeFolderId === folder.id;
            return (
              <div
                key={folder.id}
                className={`folder-nav-item ${isAct ? "active" : ""}`}
                onClick={() => { setActiveFolderId(folder.id!); setActiveKind("all"); setMobileMenuOpen(false); }}
              >
                <div
                  className="folder-nav-icon"
                  style={{
                    background: folder.color ? `${folder.color}20` : "#f0eeff",
                    color: folder.color || "#6558d3"
                  }}
                >
                  <FolderGlyph icon={folder.icon} size={15} />
                </div>
                <div className="folder-nav-text">
                  <span className="folder-nav-name">{folder.name}</span>
                  {folder.location && (
                    <span className="folder-nav-location">
                      <MapPin size={9} /> {folder.location}
                    </span>
                  )}
                </div>
                <span className="nav-count">{count}</span>
                <div className="folder-nav-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="folder-nav-btn" title="Edit folder" onClick={() => { openEditFolder(folder); setMobileMenuOpen(false); }}>
                    <Pencil size={12} />
                  </button>
                  <button className="folder-nav-btn danger" title="Delete folder" onClick={() => void deleteFolder(folder)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            className={`nav-item ${activeFolderId === "unorganized" ? "active" : ""}`}
            onClick={() => { setActiveFolderId("unorganized"); setActiveKind("all"); setMobileMenuOpen(false); }}
          >
            <FolderOpen size={15} />
            <span>Unorganized</span>
            <span className="nav-count">{unorganizedCount}</span>
          </button>
        </nav>

        {/* CONTENT KIND Navigation */}
        <div className="nav-label" style={{ margin: "14px 10px 8px" }}>MEDIA & FILES</div>
        <nav className="nav-list">
          {kinds.map(({ id, label, icon: Icon }) => {
            const count = id === "all" ? items.length : items.filter((i) => i.kind === id).length;
            const isAct = activeKind === id && activeFolderId === "all";
            return (
              <button
                key={id}
                className={`nav-item ${isAct ? "active" : ""}`}
                onClick={() => { setActiveFolderId("all"); handleKindSelect(id); setMobileMenuOpen(false); }}
              >
                <Icon size={16} />
                <span>{label}</span>
                <span className="nav-count">{count}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-card">
            <ShieldCheck size={17} />
            <div>
              <strong>100% On-device storage</strong>
              <p>Everything stays on this computer. No cloud upload. No telemetry.</p>
            </div>
          </div>

          <div className="backup-actions">
            <button
              className="primary full"
              onClick={handleExportZip}
              title="Download all real photos, videos, notes and code files in a ZIP archive (No JSON)"
            >
              <Archive size={14} /> Export All to ZIP
            </button>
            <button
              className="secondary full"
              onClick={handleSaveToFolder}
              title="Save all your files organized directly into a Windows folder"
            >
              <HardDrive size={14} /> Save to PC Folder
            </button>
            <button className="secondary full" onClick={() => fileInputRef.current?.click()} title="Restore from backup JSON">
              <Upload size={14} /> Restore Backup
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              style={{ display: "none" }}
              onChange={handleImport}
            />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="main-panel main-content">
        <header className="topbar">
          <div className="topbar-search-area">
            <div className="search-box">
              <Search size={14} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, folder, location, tag or text..."
              />
              {search && (
                <button className="icon-button" aria-label="Clear search" onClick={() => setSearch("")}>
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="top-actions">
            <button
              className="secondary desktop-only"
              onClick={handleExportZip}
              title="Download all real photos, videos, notes and code files in a ZIP archive (No JSON)"
            >
              <Archive size={14} /> Export to ZIP
            </button>
            <button
              className="secondary desktop-only"
              onClick={handleSaveToFolder}
              title="Save all your files directly into a Windows directory with subfolders for photos, code, etc."
            >
              <HardDrive size={14} /> Save to PC Folder
            </button>
            <button className="secondary desktop-only" onClick={() => openNewFolder()} title="Create a new folder to organize files by location or topic">
              <FolderPlus size={14} /> New Folder
            </button>
            <button className="primary" onClick={() => openNew()}>
              <Plus size={15} /> Add item
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-card">
            <span>Total items</span>
            <strong>{items.length}</strong>
            <Archive size={19} />
          </div>
          <div className="stat-card" style={{ cursor: "pointer" }} onClick={() => setActiveFolderId("folders_overview")}>
            <span>Folders & Locations</span>
            <strong>{folders.length}</strong>
            <FolderIcon size={19} />
          </div>
          <div className="stat-card">
            <span>Photos & Videos</span>
            <strong>{photos + items.filter((i) => i.kind === "video").length}</strong>
            <ImageIcon size={19} />
          </div>
          <div className="stat-card">
            <span>Stored item data</span>
            <strong>{formatBytes(totalBytes)}</strong>
            <Database size={19} />
          </div>
        </div>

        {/* ACTIVE FOLDER HERO BANNER (when viewing a specific folder) */}
        {activeFolder && (
          <div className="folder-hero" style={{ borderLeft: `6px solid ${activeFolder.color || "#6558d3"}` }}>
            <div className="folder-hero-top">
              <div className="folder-hero-info">
                <div
                  className="folder-hero-avatar"
                  style={{
                    background: activeFolder.color ? `${activeFolder.color}25` : "#f0eeff",
                    color: activeFolder.color || "#6558d3"
                  }}
                >
                  <FolderGlyph icon={activeFolder.icon} size={28} />
                </div>
                <div className="folder-hero-title-area">
                  <div className="folder-hero-badge">
                    <FolderIcon size={12} /> Folder
                  </div>
                  <h2>{activeFolder.name}</h2>
                  <div className="folder-hero-meta">
                    {activeFolder.location && (
                      <span className="folder-location-chip">
                        <MapPin size={12} /> {activeFolder.location}
                      </span>
                    )}
                    <span>{folderItems.length} {folderItems.length === 1 ? "item" : "items"} inside</span>
                    <span>&bull;</span>
                    <span>Created {new Date(activeFolder.createdAt).toLocaleDateString()}</span>
                  </div>
                  {activeFolder.description && (
                    <p className="folder-hero-desc">{activeFolder.description}</p>
                  )}
                </div>
              </div>

              <div className="folder-hero-actions">
                <button className="primary" onClick={() => openNew("note", activeFolder.id)}>
                  <Plus size={15} /> Add to folder
                </button>
                <button
                  className="secondary"
                  onClick={() => handleExportCurrentFolder(activeFolder)}
                  title="Export this folder as a ZIP with real photos, videos, notes and code (No JSON)"
                >
                  <Archive size={15} /> Export Folder to ZIP
                </button>
                <button className="secondary" onClick={() => openEditFolder(activeFolder)}>
                  <Pencil size={15} /> Edit
                </button>
                <button className="secondary" style={{ color: "#ef4444" }} onClick={() => void deleteFolder(activeFolder)}>
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>

            {/* Respective item filters in this folder */}
            <div className="folder-subfilters">
              <button
                className={`folder-subfilter-btn ${activeKind === "all" ? "active" : ""}`}
                onClick={() => setActiveKind("all")}
              >
                All <span className="subfilter-count">{folderKindCounts.all}</span>
              </button>
              <button
                className={`folder-subfilter-btn ${activeKind === "photo" ? "active" : ""}`}
                onClick={() => { setActiveKind("photo"); setViewMode("gallery"); }}
              >
                <ImageIcon size={12} style={{ marginRight: 5 }} /> Photos <span className="subfilter-count">{folderKindCounts.photo}</span>
              </button>
              <button
                className={`folder-subfilter-btn ${activeKind === "video" ? "active" : ""}`}
                onClick={() => { setActiveKind("video"); setViewMode("gallery"); }}
              >
                <Film size={12} style={{ marginRight: 5 }} /> Videos <span className="subfilter-count">{folderKindCounts.video}</span>
              </button>
              <button
                className={`folder-subfilter-btn ${activeKind === "code" ? "active" : ""}`}
                onClick={() => { setActiveKind("code"); setViewMode("cards"); }}
              >
                <Code2 size={12} style={{ marginRight: 5 }} /> Code <span className="subfilter-count">{folderKindCounts.code}</span>
              </button>
              <button
                className={`folder-subfilter-btn ${activeKind === "document" ? "active" : ""}`}
                onClick={() => { setActiveKind("document"); setViewMode("list"); }}
              >
                <FileText size={12} style={{ marginRight: 5 }} /> Docs <span className="subfilter-count">{folderKindCounts.document}</span>
              </button>
              <button
                className={`folder-subfilter-btn ${activeKind === "note" ? "active" : ""}`}
                onClick={() => setActiveKind("note")}
              >
                <StickyNote size={12} style={{ marginRight: 5 }} /> Notes <span className="subfilter-count">{folderKindCounts.note}</span>
              </button>
              <button
                className={`folder-subfilter-btn ${activeKind === "link" ? "active" : ""}`}
                onClick={() => setActiveKind("link")}
              >
                <Link2 size={12} style={{ marginRight: 5 }} /> Links <span className="subfilter-count">{folderKindCounts.link}</span>
              </button>
            </div>
          </div>
        )}

        {/* Content Toolbar */}
        <div className="content-toolbar">
          <div>
            <h2>
              {activeFolderId === "folders_overview"
                ? "All Folders & Locations"
                : activeFolder
                  ? `${activeFolder.name} items`
                  : activeFolderId === "unorganized"
                    ? "Unorganized items"
                    : activeKind === "all"
                      ? "Your collection"
                      : kinds.find((k) => k.id === activeKind)?.label}
            </h2>
            <p>
              {activeFolderId === "folders_overview"
                ? `${folders.length} folders created on this device`
                : `${filtered.length} ${filtered.length === 1 ? "item" : "items"} saved on this device`}
            </p>
          </div>

          <div className="toolbar-controls">
            {activeFolderId !== "folders_overview" && (
              <div className="view-toggle" role="group" aria-label="View mode">
                <button
                  className={`view-btn ${viewMode === "gallery" ? "active" : ""}`}
                  onClick={() => setViewMode("gallery")}
                  title="Gallery grid view (best for photos & videos)"
                  aria-label="Gallery grid view"
                >
                  <Images size={15} />
                </button>
                <button
                  className={`view-btn ${viewMode === "cards" ? "active" : ""}`}
                  onClick={() => setViewMode("cards")}
                  title="Card view (best for code snippets & notes)"
                  aria-label="Cards view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  className={`view-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title="Document list view (best for files & documents)"
                  aria-label="List view"
                >
                  <List size={15} />
                </button>
              </div>
            )}

            {activeFolder && (
              <button
                className="secondary"
                onClick={() => openNew(activeKind === "all" ? "note" : activeKind, activeFolder.id)}
              >
                <Plus size={14} /> Add to {activeFolder.name}
              </button>
            )}
          </div>
        </div>

        {/* FOLDERS OVERVIEW GRID VIEW */}
        {activeFolderId === "folders_overview" ? (
          <div>
            <div className="folders-overview-grid">
              {/* Add folder card */}
              <div className="create-folder-card" onClick={() => openNewFolder()}>
                <FolderPlus size={36} />
                <strong>Create New Folder</strong>
                <span>Organize photos, videos, code & notes by location or project</span>
              </div>

              {folders.map((folder) => {
                const folderIts = items.filter((it) => it.folderId === folder.id);
                const pCount = folderIts.filter((i) => i.kind === "photo").length;
                const vCount = folderIts.filter((i) => i.kind === "video").length;
                const cCount = folderIts.filter((i) => i.kind === "code").length;
                const dCount = folderIts.filter((i) => i.kind === "document").length;
                const nCount = folderIts.filter((i) => i.kind === "note").length;

                return (
                  <article
                    className="folder-overview-card"
                    key={folder.id}
                    onClick={() => { setActiveFolderId(folder.id!); setActiveKind("all"); }}
                  >
                    <div className="folder-card-head">
                      <div
                        className="folder-card-avatar"
                        style={{
                          background: folder.color ? `${folder.color}25` : "#f0eeff",
                          color: folder.color || "#6558d3"
                        }}
                      >
                        <FolderGlyph icon={folder.icon} size={22} />
                      </div>
                      <div className="folder-card-head-actions" onClick={(e) => e.stopPropagation()}>
                        <button title="Export folder as ZIP (Real files, no JSON)" onClick={() => handleExportCurrentFolder(folder)}>
                          <Archive size={14} />
                        </button>
                        <button title="Edit folder" onClick={() => openEditFolder(folder)}>
                          <Pencil size={14} />
                        </button>
                        <button title="Delete folder" style={{ color: "#ef4444" }} onClick={() => void deleteFolder(folder)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <h3>{folder.name}</h3>
                    {folder.location && (
                      <div style={{ marginBottom: 8 }}>
                        <span className="location-pill">
                          <MapPin size={10} /> {folder.location}
                        </span>
                      </div>
                    )}
                    <p>{folder.description || "No description provided."}</p>

                    <div className="folder-stats-pills">
                      <span className="stat-pill"><strong>{folderIts.length}</strong> total</span>
                      {pCount > 0 && <span className="stat-pill"><ImageIcon size={11} style={{ marginRight: 4 }} /> {pCount}</span>}
                      {vCount > 0 && <span className="stat-pill"><Film size={11} style={{ marginRight: 4 }} /> {vCount}</span>}
                      {cCount > 0 && <span className="stat-pill"><Code2 size={11} style={{ marginRight: 4 }} /> {cCount}</span>}
                      {dCount > 0 && <span className="stat-pill"><FileText size={11} style={{ marginRight: 4 }} /> {dCount}</span>}
                      {nCount > 0 && <span className="stat-pill"><StickyNote size={11} style={{ marginRight: 4 }} /> {nCount}</span>}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : !ready ? (
          <div className="empty-state">
            <div className="spinner" />
            <h3>Opening your local vault…</h3>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FolderOpen size={30} /></div>
            <h3>{search ? "No matches found" : activeFolder ? `"${activeFolder.name}" is empty` : "Your space is ready"}</h3>
            <p>
              {search
                ? "Try another keyword, location or category."
                : activeFolder
                  ? `Keep photos, videos, code, notes or documents from "${activeFolder.name}" here.`
                  : "Create a folder or save a travel photo, video, note, document or code snippet."}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="primary" onClick={() => openNew("note", activeFolder?.id)}>
                <Plus size={16} /> Add an item
              </button>
              {!activeFolder && (
                <button className="secondary" onClick={() => openNewFolder()}>
                  <FolderPlus size={16} /> Create a folder
                </button>
              )}
            </div>
          </div>
        ) : viewMode === "gallery" ? (
          <div className="gallery-grid">
            {filtered.map((item, index) => {
              const Icon = kinds.find((k) => k.id === item.kind)?.icon ?? Archive;
              const fObj = item.folderId ? folderMap.get(item.folderId) : undefined;
              return (
                <article className="gallery-card" key={item.id} onClick={() => setLightboxIndex(index)}>
                  {item.kind === "photo" && item.blob ? (
                    <MediaThumb item={item} alt={item.title} />
                  ) : (
                    <div className="gallery-placeholder">
                      <Icon size={36} />
                    </div>
                  )}
                  <div className="gallery-kind-badge">
                    {item.kind === "video" ? <Play size={10} style={{ color: "#ffffff", marginRight: 3 }} /> : null}
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
                    <p style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      {fObj && (
                        <span>
                          <FolderGlyph icon={fObj.icon} size={11} style={{ marginRight: 4 }} />
                          {fObj.name}
                        </span>
                      )}
                      {item.location && (
                        <span>
                          <MapPin size={10} style={{ marginRight: 3 }} />
                          {item.location}
                        </span>
                      )}
                      {!fObj && !item.location && <span>{item.fileName || item.description || new Date(item.updatedAt).toLocaleDateString()}</span>}
                    </p>
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
              <span>Folder & Location</span>
              <span>Type</span>
              <span>Size</span>
              <span style={{ textAlign: "right" }}>Actions</span>
            </div>
            {filtered.map((item, index) => {
              const Icon = kinds.find((k) => k.id === item.kind)?.icon ?? Archive;
              const fObj = item.folderId ? folderMap.get(item.folderId) : undefined;
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
                  <div className="doc-folder-col">
                    {fObj ? (
                      <span
                        className="folder-pill"
                        onClick={(e) => { e.stopPropagation(); setActiveFolderId(fObj.id!); }}
                        title="Filter by this folder"
                      >
                        <FolderGlyph icon={fObj.icon} size={11} style={{ marginRight: 4 }} />
                        {fObj.name}
                      </span>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: 11 }}>Unorganized</span>
                    )}
                    {item.location && (
                      <div style={{ marginTop: 3 }}>
                        <span className="location-pill">
                          <MapPin size={9} /> {item.location}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="doc-type">{item.kind}</div>
                  <div className="doc-size">{item.blob ? formatBytes(item.blob.size) : `${(item.body || "").length} chars`}</div>
                  <div className="doc-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-button" title="View details" onClick={() => setLightboxIndex(index)}>
                      <Eye size={15} />
                    </button>
                    <button className="icon-button" title="Download to PC" onClick={() => downloadSingleItem(item)}>
                      <Download size={15} />
                    </button>
                    <button className="icon-button" title="Edit" onClick={() => openEdit(item)}>
                      <Pencil size={15} />
                    </button>
                    <button className="icon-button danger" title="Delete" onClick={() => void deleteItem(item)}>
                      <Trash2 size={15} />
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
              const fObj = item.folderId ? folderMap.get(item.folderId) : undefined;
              const imageUrl = item.kind === "photo" && item.blob ? URL.createObjectURL(item.blob) : null;
              return (
                <article className="item-card" key={item.id}>
                  {imageUrl ? (
                    <div className="item-preview" onClick={() => preview(item)} style={{ cursor: "pointer" }}>
                      <img src={imageUrl} alt={item.title} onLoad={() => URL.revokeObjectURL(imageUrl)} />
                    </div>
                  ) : (
                    <div className={`item-icon ${item.kind}`} onClick={() => preview(item)} style={{ cursor: "pointer" }}>
                      <Icon size={25} />
                    </div>
                  )}
                  <div className="item-card-body">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div className="item-kind">{item.kind}</div>
                      {fObj && (
                        <span
                          className="folder-pill"
                          onClick={() => setActiveFolderId(fObj.id!)}
                          title="View this folder"
                        >
                          <FolderGlyph icon={fObj.icon} size={11} style={{ marginRight: 4 }} />
                          {fObj.name}
                        </span>
                      )}
                    </div>

                    <h3>{item.title}</h3>

                    {item.location && (
                      <div style={{ marginBottom: 8 }}>
                        <span className="location-pill">
                          <MapPin size={10} /> {item.location}
                        </span>
                      </div>
                    )}

                    {item.description && <p className="item-description">{item.description}</p>}
                    {item.kind === "link" && item.url && (
                      <a className="saved-link" href={item.url} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} style={{ marginRight: 4 }} /> Open link
                      </a>
                    )}
                    {item.kind === "code" && (
                      <pre className="code-preview"><code>{(item.body ?? "").slice(0, 220)}</code></pre>
                    )}
                    {item.kind === "note" && item.body && (
                      <p className="note-preview">{item.body.slice(0, 160)}{item.body.length > 160 ? "…" : ""}</p>
                    )}
                    {item.tags.length > 0 && (
                      <div className="tags">{item.tags.slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
                    )}
                    {item.blob && (
                      <div className="file-meta">{item.fileName} &bull; {formatBytes(item.blob.size)}</div>
                    )}

                    <div className="item-footer">
                      <span>{new Date(item.updatedAt).toLocaleDateString()}</span>
                      <div>
                        <button className="icon-button" title="Download file to computer" onClick={() => downloadSingleItem(item)}>
                          <Download size={15} />
                        </button>
                        <button className="icon-button" title="Preview or open" onClick={() => preview(item)}>
                          <Eye size={15} />
                        </button>
                        <button className="icon-button" title="Edit" onClick={() => openEdit(item)}>
                          <Pencil size={15} />
                        </button>
                        <button className="icon-button danger" title="Delete" onClick={() => void deleteItem(item)}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <footer className="footer-note">
          <ShieldCheck size={15} />
          <span>Local-first by design. Your folders, photos, videos and code stay safely stored on this computer.</span>
        </footer>
      </section>

      {/* CREATE / EDIT FOLDER MODAL */}
      {showFolderModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowFolderModal(false); }}>
          <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="folder-modal-title">
            <div className="modal-drag-handle" />
            <div className="modal-head">
              <div>
                <span className="eyebrow">{editingFolder ? "UPDATE FOLDER" : "CREATE FOLDER"}</span>
                <h2 id="folder-modal-title">{editingFolder ? "Edit folder" : "Create a folder"}</h2>
              </div>
              <button className="icon-button" aria-label="Close" onClick={() => setShowFolderModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveFolder} className="editor-form">
              <label>
                Folder Name *
                <input
                  required
                  maxLength={80}
                  value={folderForm.name}
                  onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
                  placeholder="e.g. Goa Vacation 2024, Python Code, Office Workstation..."
                />
              </label>

              <label>
                Location / Place (Optional)
                <div style={{ position: "relative" }}>
                  <input
                    maxLength={100}
                    value={folderForm.location}
                    onChange={(e) => setFolderForm({ ...folderForm, location: e.target.value })}
                    placeholder="e.g. Goa, India &bull; Office Room 4 &bull; Local D:\Code"
                  />
                </div>
                <small>Helps you organize different location items (photos, videos, code, notes) respectively.</small>
              </label>

              <label>
                Color Theme
                <div className="color-picker-grid">
                  {FOLDER_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={`color-swatch ${folderForm.color === c ? "selected" : ""}`}
                      style={{ background: c }}
                      onClick={() => setFolderForm({ ...folderForm, color: c })}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </label>

              <label>
                Folder Icon
                <div className="icon-picker-grid">
                  {FOLDER_ICON_OPTIONS.map((opt) => {
                    const IconComp = opt.icon;
                    const isSel = folderForm.icon === opt.id || (!folderForm.icon && opt.id === "folder") || (folderForm.icon === "📁" && opt.id === "folder");
                    return (
                      <button
                        type="button"
                        key={opt.id}
                        className={`icon-option-btn ${isSel ? "selected" : ""}`}
                        onClick={() => setFolderForm({ ...folderForm, icon: opt.id })}
                        title={opt.label}
                        aria-label={opt.label}
                      >
                        <IconComp size={16} />
                      </button>
                    );
                  })}
                </div>
              </label>

              <label>
                Description (Optional)
                <textarea
                  rows={2}
                  value={folderForm.description}
                  onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                  placeholder="Notes or context for this folder"
                />
              </label>

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowFolderModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  <FolderPlus size={15} /> {editingFolder ? "Save changes" : "Create Folder"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* CREATE / EDIT ITEM MODAL */}
      {showEditor && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowEditor(false); }}>
          <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="editor-title">
            <div className="modal-drag-handle" />
            <div className="modal-head">
              <div>
                <span className="eyebrow">{editing ? "UPDATE YOUR ITEM" : "ADD TO YOUR VAULT"}</span>
                <h2 id="editor-title">{editing ? "Edit item" : "Save something"}</h2>
              </div>
              <button className="icon-button" aria-label="Close" onClick={() => setShowEditor(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={saveItem} className="editor-form">
              <label>
                Type
                <select
                  value={form.kind}
                  onChange={(e) => { setForm({ ...form, kind: e.target.value as ContentKind }); setFile(null); }}
                  disabled={Boolean(editing)}
                >
                  {kinds.filter((k) => k.id !== "all").map((k) => (
                    <option value={k.id} key={k.id}>{k.label}</option>
                  ))}
                </select>
                {editing && <small>To change the type, create a new item with the desired type.</small>}
              </label>

              {/* Folder Selector + Quick Create Folder Button */}
              <label>
                Folder / Album
                <div className="input-with-button">
                  <select
                    value={form.folderId}
                    onChange={(e) => {
                      const val = e.target.value;
                      const fNum = val ? Number(val) : "";
                      const selF = typeof fNum === "number" ? folderMap.get(fNum) : null;
                      setForm({
                        ...form,
                        folderId: fNum,
                        location: form.location || (selF?.location ?? "")
                      });
                    }}
                  >
                    <option value="">No Folder (General / Unorganized)</option>
                    {folders.map((f) => (
                      <option value={f.id} key={f.id}>
                        {f.name} {f.location ? `(📍 ${f.location})` : ""}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => openNewFolder()}
                    title="Create a new folder right now"
                  >
                    <Plus size={13} /> New Folder
                  </button>
                </div>
              </label>

              <label>
                Title *
                <input
                  required
                  maxLength={180}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Sunset in Goa, Python scraper script, Team meeting notes..."
                />
              </label>

              <label>
                Item Location (Optional)
                <input
                  maxLength={100}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="e.g. Anjuna Beach, Office Desk, Server Cluster, Home"
                />
                <small>Record where this photo/video was taken or where this code/file belongs.</small>
              </label>

              <label>
                Description / caption
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Add context, a caption or a short description"
                />
              </label>

              {["photo", "video", "document"].includes(form.kind) && (
                <label className="file-drop">
                  <Upload size={22} />
                  <strong>{file?.name ?? (editing?.fileName || "Choose a file")}</strong>
                  <span>File stays in this browser. Large files may exceed browser storage limits.</span>
                  <input
                    type="file"
                    accept={form.kind === "photo" ? "image/*" : form.kind === "video" ? "video/*" : undefined}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {editing?.blob && !file && <small>Leave empty to keep the existing file.</small>}
                </label>
              )}

              {form.kind === "link" && (
                <label>
                  URL *
                  <input
                    required
                    type="url"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    placeholder="https://example.com"
                  />
                </label>
              )}

              {["note", "code"].includes(form.kind) && (
                <label>
                  {form.kind === "code" ? "Code snippet" : "Your note"}
                  <textarea
                    className={form.kind === "code" ? "code-input" : ""}
                    rows={form.kind === "code" ? 9 : 6}
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    placeholder={form.kind === "code" ? "Paste your code snippet here..." : "Write your note..."}
                  />
                </label>
              )}

              {form.kind === "code" && (
                <label>
                  Language
                  <input
                    value={form.language}
                    onChange={(e) => setForm({ ...form, language: e.target.value })}
                    placeholder="typescript, python, sql, rust, html, bash..."
                  />
                </label>
              )}

              <label>
                Tags
                <input
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="travel, work, ideas, api (comma-separated)"
                />
              </label>

              {message && <div className="notice" role="status">{message}</div>}

              <div className="modal-actions">
                <button type="button" className="secondary" onClick={() => setShowEditor(false)}>
                  Cancel
                </button>
                <button type="submit" className="primary">
                  <Plus size={15} /> {editing ? "Save changes" : "Save to this device"}
                </button>
              </div>

              <p className="privacy-hint">
                <ShieldCheck size={14} /> Saved locally in this browser, not uploaded to your server.
              </p>
            </form>
          </section>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxIndex !== null && filtered[lightboxIndex] && (() => {
        const currentItem = filtered[lightboxIndex];
        const itemFolder = currentItem.folderId ? folderMap.get(currentItem.folderId) : undefined;
        return (
          <div className="lightbox-modal" role="dialog" aria-modal="true">
            <div className="lightbox-topbar">
              <div className="lightbox-title">
                <h3>{currentItem.title}</h3>
                <span>
                  {currentItem.kind.toUpperCase()} &bull; {new Date(currentItem.updatedAt).toLocaleDateString()}
                  {itemFolder ? (
                    <> &bull; <FolderGlyph icon={itemFolder.icon} size={12} style={{ marginRight: 3 }} />{itemFolder.name}</>
                  ) : ""}
                  {currentItem.location ? ` &bull; 📍 ${currentItem.location}` : ""}
                  {currentItem.fileName ? ` &bull; ${currentItem.fileName}` : ""}
                  {currentItem.blob ? ` &bull; ${formatBytes(currentItem.blob.size)}` : ""}
                </span>
              </div>
              <div className="lightbox-topbar-actions">
                <button className="lightbox-btn" onClick={() => downloadSingleItem(currentItem)} title="Download file to computer">
                  <Download size={14} /> Save to PC
                </button>
                <button
                  className="lightbox-btn"
                  onClick={() => { setLightboxIndex(null); openEdit(currentItem); }}
                  title="Edit item"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button className="lightbox-btn close" onClick={() => setLightboxIndex(null)} title="Close viewer (Esc)">
                  <X size={17} />
                </button>
              </div>
            </div>

            <div className="lightbox-body">
              {lightboxIndex > 0 && (
                <button className="lightbox-nav-btn prev" onClick={() => setLightboxIndex(lightboxIndex - 1)} title="Previous item (Left Arrow)">
                  <ChevronLeft size={24} />
                </button>
              )}

              <LightboxMedia item={currentItem} />

              {lightboxIndex < filtered.length - 1 && (
                <button className="lightbox-nav-btn next" onClick={() => setLightboxIndex(lightboxIndex + 1)} title="Next item (Right Arrow)">
                  <ChevronRight size={24} />
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

      {/* Mobile Bottom Navigation Bar (Hidden on Desktop) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <button
          className={`mobile-nav-btn ${activeFolderId === "all" && activeKind === "all" ? "active" : ""}`}
          onClick={() => { setActiveFolderId("all"); setActiveKind("all"); setMobileMenuOpen(false); }}
        >
          <Archive size={18} />
          <span>All</span>
        </button>

        <button
          className={`mobile-nav-btn ${activeFolderId === "folders_overview" ? "active" : ""}`}
          onClick={() => { setActiveFolderId("folders_overview"); setActiveKind("all"); setMobileMenuOpen(false); }}
        >
          <FolderIcon size={18} />
          <span>Folders</span>
          {folders.length > 0 && <span className="mobile-nav-pill">{folders.length}</span>}
        </button>

        <button
          className="mobile-nav-fab"
          onClick={() => { openNew(); setMobileMenuOpen(false); }}
          aria-label="Add item"
          title="Add item"
        >
          <Plus size={20} />
        </button>

        <button
          className={`mobile-nav-btn ${activeKind === "photo" || activeKind === "video" ? "active" : ""}`}
          onClick={() => { setActiveFolderId("all"); setActiveKind("photo"); setViewMode("gallery"); setMobileMenuOpen(false); }}
        >
          <Images size={18} />
          <span>Gallery</span>
        </button>

        <button
          className={`mobile-nav-btn ${mobileMenuOpen ? "active" : ""}`}
          onClick={() => setMobileMenuOpen((o) => !o)}
          aria-label="Menu"
        >
          <Menu size={18} />
          <span>Menu</span>
        </button>
      </nav>
    </main>
  );
}

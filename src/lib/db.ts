import Dexie, { type Table } from "dexie";

export type ContentKind = "photo" | "video" | "document" | "note" | "link" | "code";

export interface VaultFolder {
  id?: number;
  name: string;
  location?: string;
  color?: string;
  icon?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VaultItem {
  id?: number;
  title: string;
  kind: ContentKind;
  folderId?: number;
  location?: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // Binary content stays in this browser's IndexedDB. No upload endpoint exists.
  blob?: Blob;
  fileName?: string;
  mimeType?: string;
  url?: string;
  body?: string;
  language?: string;
}

class VaultDatabase extends Dexie {
  items!: Table<VaultItem, number>;
  folders!: Table<VaultFolder, number>;

  constructor() {
    super("PersonalContentVault");
    this.version(1).stores({
      items: "++id, title, kind, createdAt, updatedAt, *tags"
    });
    this.version(2).stores({
      items: "++id, title, kind, folderId, createdAt, updatedAt, *tags",
      folders: "++id, name, location, createdAt, updatedAt"
    });
  }
}

export const db = new VaultDatabase();


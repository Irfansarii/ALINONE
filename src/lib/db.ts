import Dexie, { type Table } from "dexie";

export type ContentKind = "photo" | "video" | "document" | "note" | "link" | "code";

export interface VaultItem {
  id?: number;
  title: string;
  kind: ContentKind;
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

  constructor() {
    super("PersonalContentVault");
    this.version(1).stores({
      items: "++id, title, kind, createdAt, updatedAt, *tags"
    });
  }
}

export const db = new VaultDatabase();

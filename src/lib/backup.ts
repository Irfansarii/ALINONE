import type { VaultFolder, VaultItem } from "@/lib/db";

type BackupItem = Omit<VaultItem, "blob"> & { blobBase64?: string };

interface BackupPayload {
  app: string;
  version: number;
  exportedAt: string;
  items: BackupItem[];
  folders?: VaultFolder[];
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file for backup."));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, mimeType = "application/octet-stream"): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

export async function exportBackup(items: VaultItem[], folders: VaultFolder[] = []) {
  const output: BackupItem[] = [];
  for (const item of items) {
    const { blob, ...rest } = item;
    output.push({ ...rest, ...(blob ? { blobBase64: await blobToBase64(blob) } : {}) });
  }
  const payload: BackupPayload = {
    app: "PersonalContentVault",
    version: 2,
    exportedAt: new Date().toISOString(),
    folders,
    items: output
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `personal-vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<{ items: VaultItem[]; folders: VaultFolder[] }> {
  const parsed: unknown = JSON.parse(await file.text());
  if (!parsed || typeof parsed !== "object" || !("app" in parsed) || !("items" in parsed)) {
    throw new Error("This does not look like a Personal Content Vault backup.");
  }
  const payload = parsed as BackupPayload;
  if (payload.app !== "PersonalContentVault" || !Array.isArray(payload.items)) {
    throw new Error("Unsupported backup format.");
  }

  const items: VaultItem[] = payload.items.map((item) => {
    const { blobBase64, id, ...rest } = item;
    void id;
    return {
      ...rest,
      ...(blobBase64 ? { blob: base64ToBlob(blobBase64, item.mimeType) } : {}),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: Array.isArray(item.tags) ? item.tags : []
    };
  });

  const folders: VaultFolder[] = Array.isArray(payload.folders)
    ? payload.folders.map((folder) => {
        const { id, ...rest } = folder;
        void id;
        return {
          ...rest,
          createdAt: folder.createdAt || new Date().toISOString(),
          updatedAt: folder.updatedAt || new Date().toISOString()
        };
      })
    : [];

  return { items, folders };
}


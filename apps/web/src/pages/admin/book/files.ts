/**
 * The files in a drop, including everything inside a dropped folder (D86).
 *
 * A dropped folder arrives as a directory entry, not as files; this walks it.
 * Browser API only, no network, so it is a helper the drop zone awaits before
 * handing the files to the machine as one event.
 */

type Entry = FileSystemEntry;

function isFile(entry: Entry): entry is FileSystemFileEntry {
  return entry.isFile;
}

function isDirectory(entry: Entry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

function fileOf(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

/** A directory reader returns entries in batches until an empty one. */
async function childrenOf(entry: FileSystemDirectoryEntry): Promise<Entry[]> {
  const reader = entry.createReader();
  const all: Entry[] = [];
  for (;;) {
    const batch = await new Promise<Entry[]>((resolve, reject) => reader.readEntries(resolve, reject));
    if (batch.length === 0) return all;
    all.push(...batch);
  }
}

async function walk(entry: Entry): Promise<File[]> {
  if (isFile(entry)) return [await fileOf(entry)];
  if (isDirectory(entry)) {
    const nested = await Promise.all((await childrenOf(entry)).map(walk));
    return nested.flat();
  }
  return [];
}

export async function filesFromDrop(data: DataTransfer): Promise<File[]> {
  const entries = Array.from(data.items)
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is Entry => entry !== null);
  if (entries.length === 0) return Array.from(data.files);
  return (await Promise.all(entries.map(walk))).flat();
}

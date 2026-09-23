/**
 * Dropped files → chapters (D86). Pure: no DOM, no network, so it is tested alone.
 *
 * - **PDFs** are ordered by the number in the filename when there is one
 *   (`ch1_descent`, `Chapter 2 - Clocks`, `10 Return`), otherwise by natural
 *   name order (`Chapter 2` before `Chapter 10`). Numbered files come first.
 *   The title is cleaned from the filename.
 * - **Videos** match a chapter by number, then by title. `sample.mp4` is the
 *   public sample. Anything unmatched or ambiguous waits in the tray.
 *
 * A match only proposes. Nothing uploads until the admin confirms.
 */

export type Named = { name: string };

export type PlannedChapter<F extends Named> = { file: F; title: string; number: number | null };

export type ChapterPlan<F extends Named> = {
  chapters: PlannedChapter<F>[];
  /** Not PDFs: listed so nothing is silently lost. */
  skipped: F[];
};

export type ChapterRef = { id: string; number: number; title: string };

export type VideoPlan<F extends Named> = {
  matches: { file: F; chapterId: string }[];
  sample: F | null;
  tray: F[];
  skipped: F[];
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function stem(name: string): string {
  const base = name.split("/").pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(0, dot) : base;
}

function extension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/** Hidden files a folder picker brings along (`.DS_Store`, `._x.pdf`). */
function isJunk(name: string): boolean {
  const base = name.split("/").pop() ?? name;
  return base.startsWith(".") || base.startsWith("._") || base === "Thumbs.db";
}

/** The chapter number a filename carries, or null. */
export function numberIn(name: string): number | null {
  const match = stem(name).match(/\d+/);
  return match ? Number(match[0]) : null;
}

/** `ch1_the_long_descent` → `The long descent`; falls back to the stem. */
export function titleFrom(name: string): string {
  const raw = stem(name);
  const cleaned = raw
    .replace(/[_]+/g, " ")
    .replace(/^\s*(chapter|chap|ch|part|pt)\.?\s*/i, "")
    .replace(/^\s*\d+\s*/, "")
    .replace(/^\s*[-–—.:)\]]+\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return raw.trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function planChapters<F extends Named>(files: F[]): ChapterPlan<F> {
  const pdfs: F[] = [];
  const skipped: F[] = [];
  for (const file of files) {
    if (isJunk(file.name)) continue;
    (extension(file.name) === "pdf" ? pdfs : skipped).push(file);
  }

  const chapters = pdfs
    .map((file) => ({ file, title: titleFrom(file.name), number: numberIn(file.name) }))
    .sort((a, b) => {
      if (a.number !== null && b.number !== null && a.number !== b.number) return a.number - b.number;
      if (a.number !== null && b.number === null) return -1;
      if (a.number === null && b.number !== null) return 1;
      return collator.compare(a.file.name, b.file.name);
    });

  return { chapters, skipped };
}

function normalise(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function planVideos<F extends Named>(files: F[], chapters: ChapterRef[]): VideoPlan<F> {
  const videos: F[] = [];
  const skipped: F[] = [];
  let sample: F | null = null;
  for (const file of files) {
    if (isJunk(file.name)) continue;
    if (extension(file.name) !== "mp4") skipped.push(file);
    else if (!sample && normalise(stem(file.name)) === "sample") sample = file;
    else videos.push(file);
  }

  // A number two videos claim is ambiguous: both go to the tray.
  const byNumber = new Map<number, F[]>();
  for (const file of videos) {
    const n = numberIn(file.name);
    if (n !== null) byNumber.set(n, [...(byNumber.get(n) ?? []), file]);
  }

  const matches: { file: F; chapterId: string }[] = [];
  const tray: F[] = [];
  const taken = new Set<string>();

  for (const file of videos) {
    const n = numberIn(file.name);
    let chapter: ChapterRef | undefined;
    if (n !== null && byNumber.get(n)?.length === 1) {
      chapter = chapters.find((c) => c.number === n);
    }
    if (!chapter) {
      const title = normalise(titleFrom(file.name));
      chapter = chapters.find((c) => normalise(c.title) === title);
    }
    if (chapter && !taken.has(chapter.id)) {
      taken.add(chapter.id);
      matches.push({ file, chapterId: chapter.id });
    } else {
      tray.push(file);
    }
  }

  return { matches, sample, tray, skipped };
}

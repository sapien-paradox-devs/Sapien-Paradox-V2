/**
 * Dev-only visual preview of the book workspace (#166), with sample data and
 * no API. Open http://localhost:5173/harness.html (add ?v=staged or publish). Not part of the build: Vite builds index.html only.
 * The sections take props, so what is drawn here is what staff see.
 */
import { createRoot } from "react-dom/client";
import "./styles/global.css";
import "./pages/admin/admin.css";
import "./pages/admin/book/book.css";
import "./pages/admin/books/books.css";
import { Chapters } from "./pages/admin/book/Chapters";
import { Publish } from "./pages/admin/book/Publish";
import { Uploads } from "./pages/admin/book/Uploads";
import type { BookDetail } from "./pages/admin/types";
import type { UploadItem } from "./pages/admin/book/machine/types";

const f = (name: string) => new File([new Uint8Array(1)], name);
const sized = (name: string, mb: number) => { const x = f(name); Object.defineProperty(x, "size", { value: mb * 1024 * 1024 }); return x; };
const book: BookDetail = {
  id: "1", slug: "tsp", title: "The Sapien Paradox", author: "A. Author", isPublished: false,
  chapterCount: 3, readyCount: 2, hasCover: false, readerCount: 0, createdAt: "", description: "",
  priceMinorUnits: 49900, hasVideo: true, hasSample: false,
  chapters: [
    { id: "10", number: 1, title: "The Long Descent", status: "ready", pageCount: 14, hasVideo: true, hasReaders: false },
    { id: "11", number: 2, title: "Of Clocks and Bells", status: "ready", pageCount: 22, hasVideo: false, hasReaders: false },
    { id: "12", number: 3, title: "A Slower Return", status: "failed", pageCount: null, hasVideo: false, hasReaders: false },
  ],
  checklist: { hasChapters: true, allReady: false, hasCover: false, passes: false },
};
const up = (id: string, name: string, mb: number, dest: UploadItem["target"], status: UploadItem["status"], pct: number, title = ""): UploadItem =>
  ({ id, file: sized(name, mb), target: dest, title, status, loaded: sized(name, mb).size * pct, error: status === "failed" ? "The upload did not finish." : null });
const uploads: UploadItem[] = [
  up("a", "04 Instruments.pdf", 3, { destination: "new_chapter" }, "finishing", 1, "Instruments of Attention"),
  up("b", "05 Return.pdf", 2, { destination: "new_chapter" }, "sending", 0.64, "A Slower Return, again"),
  up("c", "02-clocks.mp4", 180, { destination: "chapter_video", chapterId: "11" }, "sending", 0.31),
  up("d", "intro.mp4", 90, { destination: "book_video" }, "failed", 0),
];
const send = () => {};
const mode = new URLSearchParams(location.search).get("v");
const staged = { chapters: [
  { key: "1", file: f("ch1_the_long_descent.pdf"), title: "The long descent" },
  { key: "2", file: f("Chapter 2 - Clocks.pdf"), title: "Clocks" },
  { key: "3", file: f("10 Return.pdf"), title: "Return" }], skipped: ["notes.docx"] };
function App() {
  return (
    <div className="admin"><nav className="admin-nav"><p className="admin-nav-label">Admin</p><a>Readers</a><a aria-current="page">Books</a></nav>
    <main className="admin-main"><section className="admin-workspace">
      <header className="admin-screen-head"><div><h1>The Sapien Paradox</h1><p className="admin-muted">A. Author</p></div><span className="admin-pill-inline">Draft</span></header>
      <nav className="admin-tabs">{["Details","Chapters","Videos","Publish"].map((t) => <button key={t} className="admin-tab" aria-selected={t.toLowerCase() === (mode ?? "chapters").replace("staged","chapters").replace("board","videos")}>{t}{t==="Chapters"&&<span className="admin-tab-count">3</span>}{t==="Videos"&&<span className="admin-tab-count">1/5</span>}</button>)}</nav>
      {!mode && <Uploads uploads={uploads} send={send} />}
      <div className="admin-section">
        {mode === "publish" && <Publish book={book} working={false} send={send} />}
        {mode === "staged" && <Chapters book={book} staged={staged} uploads={[]} busyChapterId={null} send={send} />}
        {!mode && <Chapters book={book} staged={null} uploads={uploads} busyChapterId={null} send={send} />}
      </div>
    </section></main></div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);

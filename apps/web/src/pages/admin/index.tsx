/**
 * `/admin` — the in-app admin (D82). A layout, a gate, and the screen the path names.
 *
 * **The gate.** Staff only. While the boot session check is out, nothing is
 * decided (D44); after it, anyone who is not staff is sent to `/admin/login`.
 * The API refuses them anyway (StaffAuth); this only keeps the screen honest.
 */

import { useCallback, useEffect, useState } from "react";

import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { BookWorkspace } from "./book";
import { BooksScreen } from "./books";
import { NewBookScreen } from "./book-new";
import { NewReaderScreen } from "./reader-new";
import { ReaderScreen } from "./reader";
import { ReadersScreen } from "./readers";
import { adminRoute, useAdminPath } from "./useAdminPath";
import "./admin.css";

export function AdminPage() {
  const { user, sessionSettled, navigate } = useNavigation();
  const path = useAdminPath();
  const route = adminRoute(path);
  const isStaff = user?.isStaff === true;

  // A message for the next screen, e.g. "Reader added." after creating one.
  const [notice, setNotice] = useState<{ path: string; text: string } | null>(null);

  useEffect(() => {
    if (sessionSettled && !isStaff) navigate("/admin/login");
  }, [sessionSettled, isStaff, navigate]);

  const onCreated = useCallback(
    (id: string, delivered: boolean) => {
      const to = `/admin/readers/${id}`;
      setNotice({ path: to, text: delivered ? labels.admin.form.added : labels.admin.form.notDelivered });
      navigate(to);
    },
    [navigate],
  );

  if (!sessionSettled || !isStaff) {
    return <main className="shell"><p className="admin-muted">{labels.admin.checking}</p></main>;
  }

  const l = labels.admin.nav;
  const inBooks = route.screen === "books" || route.screen === "newBook" || route.screen === "book";

  return (
    <div className="admin">
      <nav className="admin-nav" aria-label={l.label}>
        <p className="admin-nav-label">{l.label}</p>
        <a href="/admin/readers" aria-current={!inBooks ? "page" : undefined}
          onClick={(e) => { e.preventDefault(); navigate("/admin/readers"); }}>
          {l.readers}
        </a>
        <a href="/admin/books" aria-current={inBooks ? "page" : undefined}
          onClick={(e) => { e.preventDefault(); navigate("/admin/books"); }}>
          {l.books}
        </a>
        <a href="/" className="admin-nav-out" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
          {l.library}
        </a>
      </nav>

      <main className="admin-main">
        {route.screen === "books" ? (
          <BooksScreen navigate={navigate} />
        ) : route.screen === "newBook" ? (
          <NewBookScreen navigate={navigate} />
        ) : route.screen === "book" ? (
          <BookWorkspace key={route.id} id={route.id} navigate={navigate} />
        ) : route.screen === "newReader" ? (
          <NewReaderScreen navigate={navigate} onCreated={onCreated} />
        ) : route.screen === "reader" ? (
          // Keyed on the id so opening another reader starts a fresh machine.
          <ReaderScreen key={route.id} id={route.id} selfId={user?.id ?? null}
            notice={notice?.path === path ? notice.text : null} navigate={navigate} />
        ) : (
          <ReadersScreen navigate={navigate} />
        )}
      </main>
    </div>
  );
}

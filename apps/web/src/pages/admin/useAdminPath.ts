/**
 * The current path, kept fresh (D82).
 *
 * The root machine knows only that `/admin/*` is the admin page; which admin
 * screen shows is the admin's own business (D15). Every navigation, ours or the
 * back button, arrives as `popstate` (`pushUrl` dispatches one), so this only
 * subscribes to a browser event and hands the path on, which is what a hook is
 * allowed to do (apps/web/CLAUDE.md).
 */

import { useEffect, useState } from "react";

export function useAdminPath(): string {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  return path;
}

export type AdminRoute =
  | { screen: "readers" }
  | { screen: "newReader" }
  | { screen: "reader"; id: string }
  | { screen: "books" };

/** `/admin/...` → which screen. Anything unknown is the reader list. */
export function adminRoute(path: string): AdminRoute {
  const parts = path.replace(/\/+$/, "").split("/").slice(2); // drop "", "admin"
  if (parts[0] === "books") return { screen: "books" };
  if (parts[0] === "readers" && parts[1] === "new") return { screen: "newReader" };
  if (parts[0] === "readers" && parts[1] && /^\d+$/.test(parts[1])) {
    return { screen: "reader", id: parts[1] };
  }
  return { screen: "readers" };
}

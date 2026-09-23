export type User = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  /** Decides only whether `/admin` is shown (D82). The API checks it again. */
  isStaff: boolean;
};

/**
 * One field. If this grows a domain object (`token`, `grant`, `chapterId`),
 * something from level 1 has leaked into level 0 — move it to a page machine.
 */
export type Context = {
  user: User | null;
};

export type Event =
  | { type: "ROUTE"; path: string } // from sync.ts — the ONLY thing that changes page
  | { type: "NAVIGATE"; to: string } // any page asking to move; pushes URL only
  // login page, after a successful call. `next` is where to land; home when absent
  // (the admin login sends `/admin`, D82).
  | { type: "AUTHENTICATED"; user: User; next?: string }
  | { type: "LOGOUT" };

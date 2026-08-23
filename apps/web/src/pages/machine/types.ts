export type User = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
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
  | { type: "AUTHENTICATED"; user: User } // login page, after a successful call
  | { type: "LOGOUT" };

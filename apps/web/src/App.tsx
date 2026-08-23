/**
 * Placeholder shell. The navigation machine in `pages/machine/` drives this once the
 * login and home slices land — see `CLAUDE.md` in this directory for the three levels.
 */

import { labels } from "./lib/labels";

export function App() {
  return (
    <main className="shell">
      <h1>{labels.app.name}</h1>
    </main>
  );
}

/**
 * The site header — the wordmark home, and the way back to the library.
 *
 * Render props only, no machine (D15). What it shows is `headerContents`; how
 * it moves is `navigate`, so every URL change still goes through `pushUrl`.
 */

import type { MouseEvent, ReactNode } from "react";

import { labels } from "../../lib/labels";
import { headerContents, type HeaderPage } from "./contents";
import "./SiteHeader.css";

type Props = {
  page: HeaderPage;
  userName: string | null;
  navigate: (to: string) => void;
  onLogout: () => void;
  /** The right-hand slot, reserved for the theme toggle (#120). */
  trailing?: ReactNode;
};

export function SiteHeader({ page, userName, navigate, onLogout, trailing }: Props) {
  const contents = headerContents(page, userName !== null);
  if (contents.hidden) return null;

  return (
    // In the reader the chamber's own bar is the one that stays pinned (#150).
    <header className={`ui-header${page === "reader" ? " ui-header-flat" : ""}`}>
      <nav className="ui-header-inner" aria-label={labels.nav.label}>
        <NavLink to="/" navigate={navigate} className="ui-header-mark">
          {labels.app.name}
        </NavLink>

        <div className="ui-header-end">
          {contents.library && (
            <NavLink to="/" navigate={navigate} className="ui-header-link">
              {labels.nav.library}
            </NavLink>
          )}

          {contents.account && userName && (
            <>
              <span className="ui-header-name">{userName}</span>
              <button type="button" className="ui-header-link" onClick={onLogout}>
                {labels.nav.signOut}
              </button>
            </>
          )}

          {contents.signIn && (
            <NavLink to="/login" navigate={navigate} className="ui-header-link">
              {labels.nav.signIn}
            </NavLink>
          )}

          {contents.signUp && (
            <NavLink to="/begin" navigate={navigate} className="ui-header-cta">
              {labels.nav.signUp}
            </NavLink>
          )}

          {trailing}
        </div>
      </nav>
    </header>
  );
}

/**
 * A real `<a href>` whose plain click goes through `navigate` instead of a page
 * load. Modified clicks (new tab, new window) are left to the browser, which is
 * the point of it being a link rather than a button.
 */
function NavLink({
  to,
  navigate,
  className,
  children,
}: {
  to: string;
  navigate: (to: string) => void;
  className: string;
  children: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

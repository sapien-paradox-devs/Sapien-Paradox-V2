/**
 * The site header — the wordmark home, and the way back to the library.
 *
 * Render props only, no machine (D15). What it shows is `headerContents`; how
 * it moves is `navigate`, so every URL change still goes through `pushUrl`.
 *
 * The account area is an avatar that opens a dropdown (#218). Two states
 * (open/closed), no API, no retry — a hook, not a machine.
 */

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { Avatar } from "../Avatar";
import { labels } from "../../lib/labels";
import { headerContents, type HeaderPage } from "./contents";
import "./SiteHeader.css";

type Props = {
  page: HeaderPage;
  userName: string | null;
  userEmail: string | null;
  avatarSeed: string | null;
  navigate: (to: string) => void;
  onLogout: () => void;
  trailing?: ReactNode;
};

export function SiteHeader({ page, userName, userEmail, avatarSeed, navigate, onLogout, trailing }: Props) {
  const contents = headerContents(page, userName !== null);
  if (contents.hidden) return null;

  return (
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

          {contents.account && userName && userEmail && (
            <AccountMenu
              userName={userName}
              userEmail={userEmail}
              avatarSeed={avatarSeed ?? userEmail}
              navigate={navigate}
              onLogout={onLogout}
            />
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

function AccountMenu({
  userName,
  userEmail,
  avatarSeed,
  navigate,
  onLogout,
}: {
  userName: string;
  userEmail: string;
  avatarSeed: string;
  navigate: (to: string) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function close(e: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ui-account" ref={menuRef}>
      <button
        type="button"
        className="ui-account-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Avatar seed={avatarSeed} size={28} />
      </button>

      {open && (
        <div className="ui-account-menu">
          <div className="ui-account-header">
            <Avatar seed={avatarSeed} size={40} />
            <div className="ui-account-identity">
              <span className="ui-account-name">{userName}</span>
              <span className="ui-account-email">{userEmail}</span>
            </div>
          </div>
          <div className="ui-account-divider" />
          <button
            type="button"
            className="ui-account-item"
            onClick={() => { setOpen(false); navigate("/profile"); }}
          >
            {labels.nav.profile}
          </button>
          <button
            type="button"
            className="ui-account-item"
            onClick={() => { setOpen(false); onLogout(); }}
          >
            {labels.nav.signOut}
          </button>
        </div>
      )}
    </div>
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

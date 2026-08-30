/**
 * Name, email, phone, and a logout action. Renders props only — no machine
 * (D15): the root machine owns the session (`user`, `LOGOUT`); this only
 * displays it and calls back out.
 */

import { locale } from "../../lib/locale";
import { Button } from "../Button";
import "./AccountBlock.css";

export type AccountBlockProps = {
  name: string;
  email: string;
  phone: string;
  onLogout: () => void;
  loggingOut?: boolean;
};

export function AccountBlock({
  name,
  email,
  phone,
  onLogout,
  loggingOut = false,
}: AccountBlockProps) {
  return (
    <section className="account-block">
      <p className="account-block-name">{name}</p>
      <p className="account-block-email">{email}</p>
      <p className="account-block-phone">{phone}</p>
      <Button variant="secondary" onClick={onLogout} disabled={loggingOut}>
        {loggingOut ? locale("account.loggingOut") : locale("account.logout")}
      </Button>
    </section>
  );
}

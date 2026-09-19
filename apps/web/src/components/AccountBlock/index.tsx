/** Who you are, and the way out. */

import { Button } from "../Button";
import { labels } from "../../lib/labels";
import "./AccountBlock.css";

export function AccountBlock({
  name,
  onLogout,
}: {
  name: string;
  onLogout: () => void;
}) {
  return (
    <div className="ui-account">
      <span className="ui-account-name">{name}</span>
      <Button variant="text" onClick={onLogout}>{labels.home.logout}</Button>
    </div>
  );
}

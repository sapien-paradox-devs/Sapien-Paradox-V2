import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { useEffect } from "react";
import "./profile.css";

export function ProfilePage() {
  const { user, sessionSettled, navigate } = useNavigation();

  useEffect(() => {
    if (sessionSettled && !user) navigate("/login");
  }, [sessionSettled, user, navigate]);

  if (!sessionSettled || !user) return null;

  return (
    <main className="profile-page">
      <h1 className="profile-heading">{labels.nav.profile}</h1>
      <p className="profile-placeholder">{labels.profile.comingSoon}</p>
    </main>
  );
}

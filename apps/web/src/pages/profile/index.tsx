import { useMachine } from "@xstate/react";
import { useEffect, useState, type FormEvent } from "react";

import { Avatar } from "../../components/Avatar";
import { Button } from "../../components/Button";
import { ErrorNotice } from "../../components/ErrorNotice";
import { Spinner } from "../../components/Spinner";
import { TextField } from "../../components/TextField";
import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { profileMachine } from "./machine";
import type { Profile } from "./machine";
import "./profile.css";

const AVATAR_GRID_COUNT = 15;

function randomSeeds(count: number): string[] {
  const seeds: string[] = [];
  for (let i = 0; i < count; i++) seeds.push(crypto.randomUUID());
  return seeds;
}

export function ProfilePage() {
  const { user, sessionSettled, navigate } = useNavigation();
  const [state, send] = useMachine(profileMachine);

  useEffect(() => {
    if (sessionSettled && !user) navigate("/login");
  }, [sessionSettled, user, navigate]);

  if (!sessionSettled || !user) return null;

  const loading = state.matches({ data: "loading" });
  const error = state.matches({ data: "error" });

  if (loading) return <main className="profile-page"><Spinner label={labels.profile.loading} /></main>;
  if (error) {
    return (
      <main className="profile-page">
        <ErrorNotice action={labels.profile.retry} onAction={() => send({ type: "RETRY" })}>
          {labels.profile.error}
        </ErrorNotice>
      </main>
    );
  }

  const profile = state.context.profile;
  if (!profile) return null;

  return (
    <main className="profile-page">
      <h1 className="profile-heading">{labels.profile.title}</h1>

      <AccountSection profile={profile} state={state} send={send} />
      <PasswordSection profile={profile} state={state} send={send} />
      <BooksSection profile={profile} />
    </main>
  );
}

function AccountSection({
  profile,
  state,
  send,
}: {
  profile: Profile;
  state: ReturnType<typeof useMachine<typeof profileMachine>>[0];
  send: ReturnType<typeof useMachine<typeof profileMachine>>[1];
}) {
  const [name, setName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [avatarSeeds] = useState(() => randomSeeds(AVATAR_GRID_COUNT));
  const [pickedSeed, setPickedSeed] = useState(profile.avatarSeed ?? profile.email);

  useEffect(() => {
    setName(profile.fullName);
    setEmail(profile.email);
    setPickedSeed(profile.avatarSeed ?? profile.email);
  }, [profile]);

  const saving = state.matches({ saving: "saving" });
  const saved = state.matches({ saving: "saved" });
  const failed = state.matches({ saving: "failed" });
  const dirty =
    name !== profile.fullName ||
    email !== profile.email ||
    pickedSeed !== (profile.avatarSeed ?? profile.email);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ev: Record<string, string> = {};
    if (name !== profile.fullName) ev.fullName = name;
    if (email !== profile.email) ev.email = email;
    if (pickedSeed !== (profile.avatarSeed ?? profile.email)) ev.avatarSeed = pickedSeed;
    send({ type: "SAVE", ...ev });
  };

  return (
    <form className="profile-card" onSubmit={onSubmit}>
      <div className="profile-avatar-row">
        <Avatar seed={pickedSeed} size={64} />
        <div className="profile-avatar-info">
          <span className="profile-label">{labels.profile.avatar}</span>
          <span className="profile-hint">{labels.profile.pickAvatar}</span>
        </div>
      </div>

      <div className="profile-avatar-grid">
        {[profile.email, ...avatarSeeds].map((seed) => (
          <button
            key={seed}
            type="button"
            className={`profile-avatar-option${seed === pickedSeed ? " selected" : ""}`}
            onClick={() => setPickedSeed(seed)}
          >
            <Avatar seed={seed} size={36} />
          </button>
        ))}
      </div>

      <TextField
        label={labels.profile.name}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label={labels.profile.email}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="profile-field-static">
        <span className="profile-label">{labels.profile.phone}</span>
        <span className="profile-value">{profile.phone ?? labels.profile.phoneNotSet}</span>
      </div>

      {failed && (
        <p className="profile-error">
          {state.context.saveError === "email_taken"
            ? labels.profile.emailTaken
            : labels.profile.saveError}
        </p>
      )}

      <div className="profile-actions">
        <Button type="submit" disabled={!dirty || saving}>
          {saving ? labels.profile.saving : labels.profile.save}
        </Button>
        {saved && <span className="profile-success">{labels.profile.saved}</span>}
      </div>
    </form>
  );
}

function PasswordSection({
  profile,
  state,
  send,
}: {
  profile: Profile;
  state: ReturnType<typeof useMachine<typeof profileMachine>>[0];
  send: ReturnType<typeof useMachine<typeof profileMachine>>[1];
}) {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const submitting = state.matches({ password: "submitting" });
  const done = state.matches({ password: "done" });
  const failed = state.matches({ password: "failed" });

  useEffect(() => {
    if (done) { setCurrentPw(""); setNewPw(""); }
  }, [done]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    send({
      type: "CHANGE_PASSWORD",
      ...(profile.hasPassword ? { currentPassword: currentPw } : {}),
      newPassword: newPw,
    });
  };

  const passwordErrorText = (() => {
    if (!failed) return null;
    switch (state.context.passwordError) {
      case "wrong_password": return labels.profile.wrongPassword;
      case "too_short": return labels.profile.passwordTooShort;
      default: return labels.profile.passwordError;
    }
  })();

  return (
    <form className="profile-card" onSubmit={onSubmit}>
      <h2 className="profile-section-title">{labels.profile.password}</h2>

      {profile.hasPassword && (
        <TextField
          label={labels.profile.currentPassword}
          type="password"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          autoComplete="current-password"
        />
      )}
      <TextField
        label={labels.profile.newPassword}
        type="password"
        value={newPw}
        onChange={(e) => setNewPw(e.target.value)}
        autoComplete="new-password"
      />

      {passwordErrorText && <p className="profile-error">{passwordErrorText}</p>}

      <div className="profile-actions">
        <Button type="submit" disabled={submitting || !newPw}>
          {submitting
            ? labels.profile.changingPassword
            : profile.hasPassword
              ? labels.profile.changePassword
              : labels.profile.setPassword}
        </Button>
        {done && <span className="profile-success">{labels.profile.passwordChanged}</span>}
      </div>
    </form>
  );
}

function BooksSection({ profile }: { profile: Profile }) {
  if (profile.books.length === 0) return null;

  return (
    <section className="profile-card">
      <h2 className="profile-section-title">{labels.profile.books}</h2>
      <div className="profile-books">
        {profile.books.map((book) => {
          const pct = Math.round(book.progress * 100);
          return (
            <div key={book.title} className="profile-book">
              <div className="profile-book-header">
                <span className="profile-book-title">{book.title}</span>
                <span className="profile-book-pct">{pct}{labels.profile.percentComplete}</span>
              </div>
              <div className="profile-book-bar">
                <div className="profile-book-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="profile-book-detail">
                {book.chaptersUnlocked} / {book.chaptersTotal} {labels.profile.chapters}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

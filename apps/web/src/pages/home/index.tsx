/**
 * Home — the account block and the chapters this reader has earned.
 *
 * No progress bars, no timers. A quiet read mark is the only status (D11).
 */

import { useMachine } from "@xstate/react";

import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { homeMachine } from "./machine";
import "./home.css";

export function HomePage() {
  const [state, send] = useMachine(homeMachine);
  const { navigate } = useNavigation();

  const sending = state.matches({ send: "sending" });

  return (
    <main className="home">
      <h1>{labels.home.greeting}</h1>

      {state.matches({ list: "loading" }) && <p>{labels.health.booting}</p>}

      {state.matches({ list: "empty" }) && <p>{labels.home.empty}</p>}

      {state.matches({ list: "error" }) && (
        <p role="alert">
          {labels.home.error}{" "}
          <button onClick={() => send({ type: "RETRY" })}>
            {labels.home.retry}
          </button>
        </p>
      )}

      {/* The list stays rendered while a send is in flight — that is what the
          parallel region buys (D42). */}
      {state.matches({ list: "ready" }) &&
        state.context.books.map((book) => (
          <section key={book.id}>
            <h2>{book.title}</h2>
            <ul>
              {book.chapters.map((chapter) => (
                <li key={chapter.id}>
                  <button onClick={() => navigate(`/read/${chapter.id}`)}>
                    {labels.home.chapter} {chapter.number} — {chapter.title}
                  </button>
                  {chapter.read && <span aria-label={labels.home.read}>·</span>}
                  <button
                    onClick={() => send({ type: "SEND", chapterId: chapter.id })}
                    disabled={sending}
                  >
                    {sending && state.context.sendingChapterId === chapter.id
                      ? labels.home.sending
                      : labels.home.send}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

      <SendNotice
        state={state.value}
        onDismiss={() => send({ type: "DISMISS" })}
      />
    </main>
  );
}

/** Sent and already-sent both read as success — neither is a failure (D45). */
function SendNotice({
  state,
  onDismiss,
}: {
  state: unknown;
  onDismiss: () => void;
}) {
  const send = typeof state === "object" && state !== null && "send" in state
    ? state.send
    : null;

  if (send !== "sent" && send !== "limited" && send !== "failed") return null;

  const message =
    send === "sent"
      ? labels.home.sent
      : send === "limited"
        ? labels.home.limited
        : labels.home.sendFailed;

  return (
    <p role="status">
      {message} <button onClick={onDismiss}>{labels.home.dismiss}</button>
    </p>
  );
}

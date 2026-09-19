/**
 * Home — the account block and the chapters this reader has earned.
 *
 * No progress bars, no timers. A quiet read mark is the only status (D11).
 */

import { useMachine } from "@xstate/react";

import { AccountBlock } from "../../components/AccountBlock";
import { ChapterList } from "../../components/ChapterList";
import { ErrorNotice } from "../../components/ErrorNotice";
import { Spinner } from "../../components/Spinner";
import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { homeMachine } from "./machine";
import "./home.css";

export function HomePage() {
  const [state, send] = useMachine(homeMachine);
  const { navigate, user, logout } = useNavigation();

  const sendingId = state.matches({ send: "sending" })
    ? state.context.sendingChapterId
    : null;

  return (
    <main className="home">
      {user && <AccountBlock name={user.fullName} onLogout={logout} />}

      <h1>{labels.home.greeting}</h1>

      {state.matches({ list: "loading" }) && <Spinner label={labels.health.booting} />}

      {state.matches({ list: "empty" }) && <p className="home-empty">{labels.home.empty}</p>}

      {state.matches({ list: "error" }) && (
        <ErrorNotice action={labels.home.retry} onAction={() => send({ type: "RETRY" })}>
          {labels.home.error}
        </ErrorNotice>
      )}

      {/* The list stays rendered while a send is in flight — that is what the
          parallel region buys (D42). */}
      {state.matches({ list: "ready" }) &&
        state.context.books.map((book) => (
          <section key={book.id} className="home-book">
            <h2>{book.title}</h2>
            <ChapterList
              chapters={book.chapters}
              sendingChapterId={sendingId}
              onOpen={(id) => navigate(`/read/${id}`)}
              onSend={(id) => send({ type: "SEND", chapterId: id })}
            />
          </section>
        ))}

      {state.matches({ send: "sent" }) && <p className="home-flash">{labels.home.sent}</p>}
      {state.matches({ send: "limited" }) && <p className="home-flash">{labels.home.limited}</p>}
      {state.matches({ send: "failed" }) && (
        <p className="home-flash home-flash-bad">{labels.home.sendFailed}</p>
      )}
    </main>
  );
}

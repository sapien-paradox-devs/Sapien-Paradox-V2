/**
 * Home — the chapters this reader has earned. Who they are, and the way out,
 * live in the site header.
 *
 * No progress bars, no timers. A quiet read mark is the only status (D11).
 */

import { useMachine } from "@xstate/react";

import { ChapterList } from "../../components/ChapterList";
import { ErrorNotice } from "../../components/ErrorNotice";
import { labels } from "../../lib/labels";
import { useNavigation } from "../useNavigation";
import { HomeSkeleton } from "./HomeSkeleton";
import { homeMachine } from "./machine";
import "./home.css";

export function HomePage() {
  const [state, send] = useMachine(homeMachine);
  const { navigate } = useNavigation();

  const sendingId = state.matches({ send: "sending" })
    ? state.context.sendingChapterId
    : null;

  return (
    <main className="home">
      <h1>{labels.home.greeting}</h1>

      {state.matches({ list: "loading" }) && <HomeSkeleton />}

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

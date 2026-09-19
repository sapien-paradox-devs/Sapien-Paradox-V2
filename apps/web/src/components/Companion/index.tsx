/**
 * The companion panel. Closed and silent until the reader opens it (D14).
 *
 * No badge, no notification, no auto-open. The one rule the chamber is designed
 * around is that it never interrupts.
 */

import { useMachine } from "@xstate/react";
import { useState } from "react";

import { labels } from "../../lib/labels";
import { companionMachine } from "./machine";
import "./Companion.css";

export function Companion({ token }: { token: string }) {
  const [state, send] = useMachine(companionMachine, { input: { token } });
  const [question, setQuestion] = useState("");

  if (state.matches("closed")) {
    return (
      <button className="companion-open" onClick={() => send({ type: "OPEN" })}>
        {labels.companion.open}
      </button>
    );
  }

  const asking = state.matches("asking");

  return (
    <aside className="companion">
      <button onClick={() => send({ type: "CLOSE" })}>{labels.companion.close}</button>

      <ol>
        {state.context.exchanges.map((exchange, index) => (
          <li key={index}>
            <p>{exchange.question}</p>
            <p>{exchange.answer}</p>
          </li>
        ))}
      </ol>

      {state.matches("capped") && <p role="status">{labels.companion.capped}</p>}

      {state.matches("error") && (
        <p role="alert">
          {labels.companion.error}{" "}
          <button onClick={() => send({ type: "RETRY" })}>
            {labels.companion.retry}
          </button>
        </p>
      )}

      {!state.matches("capped") && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send({ type: "ASK", question });
            setQuestion("");
          }}
        >
          <input
            value={question}
            placeholder={labels.companion.placeholder}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <button type="submit" disabled={asking}>
            {asking ? labels.companion.thinking : labels.companion.send}
          </button>
        </form>
      )}
    </aside>
  );
}

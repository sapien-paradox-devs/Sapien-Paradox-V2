import { useMachine } from "@xstate/react";

import { labels } from "../../lib/labels";
import { pdfMachine } from "./machine";
import "./PdfChamber.css";

export function PdfChamber({ token }: { token: string }) {
  const [state, send] = useMachine(pdfMachine, { input: { token } });

  if (state.matches("error")) {
    return (
      <div className="pdf-chamber" role="alert">
        {/* Says the link is fine, because it is — the document failed, not the
            grant (D43). */}
        {labels.pdf.error}{" "}
        <button onClick={() => send({ type: "RETRY" })}>{labels.pdf.retry}</button>
      </div>
    );
  }

  if (state.matches("rendered") && state.context.objectUrl) {
    return (
      <object
        className="pdf-chamber"
        data={state.context.objectUrl}
        type="application/pdf"
        aria-label={labels.pdf.loading}
      />
    );
  }

  return <div className="pdf-chamber">{labels.pdf.loading}</div>;
}

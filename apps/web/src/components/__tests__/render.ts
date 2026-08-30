/**
 * A minimal render helper shared by the component tests in this folder. No
 * testing-library — the repo doesn't depend on one, and these are plain
 * prop-driven components (D15), so mounting with `react-dom/client` and
 * reading the real DOM is enough.
 */

import type { ReactElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";

declare global {
  // React's own flag for "act() is being used correctly" — unset by default,
  // which makes every act() call here log a false-positive warning.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

export function renderToContainer(element: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(element);
  });

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

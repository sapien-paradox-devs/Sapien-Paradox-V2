import { describe, expect, it } from "vitest";

import { Spinner } from "../Spinner";
import { renderToContainer } from "./render";

describe("Spinner", () => {
  it("announces the given label as a status", () => {
    const { container, unmount } = renderToContainer(<Spinner label="Loading" />);

    expect(container.querySelector('[role="status"]')?.textContent).toContain("Loading");
    unmount();
  });
});

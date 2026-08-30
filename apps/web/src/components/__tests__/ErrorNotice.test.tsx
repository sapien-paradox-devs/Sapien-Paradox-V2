import { describe, expect, it, vi } from "vitest";

import { ErrorNotice } from "../ErrorNotice";
import { renderToContainer } from "./render";

describe("ErrorNotice", () => {
  it("renders the message as an alert", () => {
    const { container, unmount } = renderToContainer(<ErrorNotice message="Broke" />);

    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Broke");
    unmount();
  });

  it("omits the retry button when no retry is given", () => {
    const { container, unmount } = renderToContainer(<ErrorNotice message="Broke" />);

    expect(container.querySelector("button")).toBeNull();
    unmount();
  });

  it("calls onRetry when the retry button is pressed", () => {
    const onRetry = vi.fn();
    const { container, unmount } = renderToContainer(
      <ErrorNotice message="Broke" onRetry={onRetry} retryLabel="Try again" />,
    );

    container.querySelector("button")?.click();

    expect(onRetry).toHaveBeenCalledTimes(1);
    unmount();
  });
});

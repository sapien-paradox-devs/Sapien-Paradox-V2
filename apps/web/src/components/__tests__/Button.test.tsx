import { describe, expect, it, vi } from "vitest";

import { Button } from "../Button";
import { renderToContainer } from "./render";

describe("Button", () => {
  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    const { container, unmount } = renderToContainer(<Button onClick={onClick}>Go</Button>);

    container.querySelector("button")?.click();

    expect(onClick).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    const { container, unmount } = renderToContainer(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );

    container.querySelector("button")?.click();

    expect(onClick).not.toHaveBeenCalled();
    unmount();
  });

  it("defaults to type button, not submit", () => {
    const { container, unmount } = renderToContainer(<Button>Go</Button>);

    expect(container.querySelector("button")?.type).toBe("button");
    unmount();
  });
});

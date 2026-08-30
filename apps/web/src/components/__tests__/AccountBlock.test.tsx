import { describe, expect, it, vi } from "vitest";

import { AccountBlock } from "../AccountBlock";
import { renderToContainer } from "./render";

describe("AccountBlock", () => {
  it("shows the reader's name, email, and phone", () => {
    const { container, unmount } = renderToContainer(
      <AccountBlock
        name="Ada Lovelace"
        email="ada@example.com"
        phone="+1 555 0100"
        onLogout={() => {}}
      />,
    );

    expect(container.textContent).toContain("Ada Lovelace");
    expect(container.textContent).toContain("ada@example.com");
    expect(container.textContent).toContain("+1 555 0100");
    unmount();
  });

  it("calls onLogout when the logout button is pressed", () => {
    const onLogout = vi.fn();
    const { container, unmount } = renderToContainer(
      <AccountBlock name="Ada" email="ada@example.com" phone="+1" onLogout={onLogout} />,
    );

    container.querySelector("button")?.click();

    expect(onLogout).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("disables the logout button while logging out", () => {
    const { container, unmount } = renderToContainer(
      <AccountBlock
        name="Ada"
        email="ada@example.com"
        phone="+1"
        onLogout={() => {}}
        loggingOut
      />,
    );

    expect(container.querySelector("button")?.hasAttribute("disabled")).toBe(true);
    unmount();
  });
});

import { describe, expect, it, vi } from "vitest";

import { TextField } from "../TextField";
import { renderToContainer } from "./render";

/** Sets an input's value the way a browser does, so React's change handler fires. */
function typeInto(input: HTMLInputElement, value: string) {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  nativeSetter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("TextField", () => {
  it("shows the given value", () => {
    const { container, unmount } = renderToContainer(
      <TextField id="email" label="Email" value="a@b.c" onChange={() => {}} />,
    );

    expect(container.querySelector("input")?.value).toBe("a@b.c");
    unmount();
  });

  it("calls onChange with the new value", () => {
    const onChange = vi.fn();
    const { container, unmount } = renderToContainer(
      <TextField id="email" label="Email" value="" onChange={onChange} />,
    );

    typeInto(container.querySelector("input")!, "new@value.com");

    expect(onChange).toHaveBeenCalledWith("new@value.com");
    unmount();
  });

  it("associates the label with the input", () => {
    const { container, unmount } = renderToContainer(
      <TextField id="email" label="Email" value="" onChange={() => {}} />,
    );

    expect(container.querySelector("label")?.getAttribute("for")).toBe("email");
    unmount();
  });

  it("marks the input invalid and links the error message when one is given", () => {
    const { container, unmount } = renderToContainer(
      <TextField
        id="email"
        label="Email"
        value=""
        onChange={() => {}}
        errorMessage="Required"
      />,
    );

    const input = container.querySelector("input")!;

    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("email-error");
    expect(container.querySelector("#email-error")?.textContent).toBe("Required");
    unmount();
  });

  it("leaves the input valid when no error message is given", () => {
    const { container, unmount } = renderToContainer(
      <TextField id="email" label="Email" value="" onChange={() => {}} />,
    );

    expect(container.querySelector("input")?.getAttribute("aria-invalid")).toBeNull();
    unmount();
  });
});

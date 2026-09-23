import { describe, expect, it } from "vitest";

import { adminRoute } from "../useAdminPath";

describe("adminRoute (D82)", () => {
  it.each([
    ["/admin", { screen: "readers" }],
    ["/admin/", { screen: "readers" }],
    ["/admin/readers", { screen: "readers" }],
    ["/admin/readers/new", { screen: "newReader" }],
    ["/admin/readers/42", { screen: "reader", id: "42" }],
    ["/admin/readers/abc", { screen: "readers" }],
    ["/admin/books", { screen: "books" }],
    ["/admin/whatever", { screen: "readers" }],
  ])("%s", (path, expected) => {
    expect(adminRoute(path)).toEqual(expected);
  });
});

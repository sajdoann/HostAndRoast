import { describe, expect, it } from "vitest";
import { hasLocation, safeLocationUrl } from "../src/domain/location";

/**
 * The location link is pasted by a user and rendered as an href, so the
 * scheme check is a security boundary, not a formatting nicety.
 */
describe("safeLocationUrl", () => {
  it.each([
    "https://maps.app.goo.gl/abc123",
    "https://www.google.com/maps/place/Praha/@50.08,14.42,12z",
    "http://osm.org/go/0EEQjE",
  ])("keeps a real map link: %s", (url) => {
    expect(safeLocationUrl(url)).toBe(new URL(url).toString());
  });

  it("assumes https for a bare host", () => {
    expect(safeLocationUrl("maps.app.goo.gl/abc")).toBe("https://maps.app.goo.gl/abc");
  });

  it.each([
    ["a script url", "javascript:alert(document.cookie)"],
    ["a script url in caps", "JavaScript:alert(1)"],
    ["a data url", "data:text/html,<script>alert(1)</script>"],
    ["a file url", "file:///etc/passwd"],
    ["a vbscript url", "vbscript:msgbox(1)"],
  ])("refuses %s", (_label, url) => {
    expect(safeLocationUrl(url)).toBeUndefined();
  });

  it("ignores blanks", () => {
    expect(safeLocationUrl(undefined)).toBeUndefined();
    expect(safeLocationUrl("   ")).toBeUndefined();
  });
});

describe("hasLocation", () => {
  it("is true for a link or for directions alone", () => {
    expect(hasLocation({ locationUrl: "https://maps.app.goo.gl/x" })).toBe(true);
    expect(hasLocation({ locationNote: "3rd floor, ring twice" })).toBe(true);
    expect(hasLocation({})).toBe(false);
    // A link we refuse to render doesn't count as having somewhere to go.
    expect(hasLocation({ locationUrl: "javascript:alert(1)" })).toBe(false);
  });
});

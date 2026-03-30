import { describe, it, expect } from "vitest";

describe("Example test suite", () => {
  it("should pass a basic assertion", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle string matching", () => {
    expect("vitest setup").toContain("vitest");
  });

  it("should work with objects", () => {
    const config = { framework: "next", version: 16 };
    expect(config).toEqual({ framework: "next", version: 16 });
  });
});

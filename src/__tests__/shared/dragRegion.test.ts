import { describe, expect, it } from "bun:test";

import { resolveMacOSDragRegion } from "../../shared/dragRegion";

const originX = 92;
const titlebarInset = 28;

describe("resolveMacOSDragRegion", () => {
  it("spans from the drag origin to the right edge at the titlebar height", () => {
    expect(
      resolveMacOSDragRegion({
        originX,
        titlebarInset,
      }),
    ).toEqual({ x: originX, height: titlebarInset, maxX: 0 });
  });

  it("drops a negative titlebar height", () => {
    expect(
      resolveMacOSDragRegion({
        originX,
        titlebarInset: -4,
      }).height,
    ).toBe(0);
  });
});

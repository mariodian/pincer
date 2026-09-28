import { describe, expect, it } from "bun:test";

import { resolveMacOSDragRegion } from "../../shared/dragRegion";

const originX = 92;
const titlebarInset = 28;

describe("resolveMacOSDragRegion", () => {
  it("keeps the strip on the sidebar while the gap covers the drag origin", () => {
    expect(
      resolveMacOSDragRegion({
        originX,
        titlebarInset,
        sidebarWidth: 256,
        contentTop: 6,
      }),
    ).toEqual({ x: originX, height: titlebarInset, maxX: 256 });
  });

  it("spans the top gap once the sidebar no longer covers the drag origin", () => {
    expect(
      resolveMacOSDragRegion({
        originX,
        titlebarInset,
        sidebarWidth: 48,
        contentTop: 6,
      }),
    ).toEqual({ x: originX, height: 6, maxX: 0 });
  });

  it("treats a sidebar that ends on the drag origin as too narrow to host the strip", () => {
    expect(
      resolveMacOSDragRegion({
        originX,
        titlebarInset,
        sidebarWidth: originX,
        contentTop: 6,
      }).maxX,
    ).toBe(0);
  });
});

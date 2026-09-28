export type DragRegion = {
  x: number;
  height: number;
  /** Right edge of the strip. 0 spans the rest of the window. */
  maxX: number;
};

/**
 * The strip starts after the traffic lights and runs to the right edge of the
 * window at the titlebar height, over both the sidebar and the content card.
 */
export function resolveMacOSDragRegion(input: {
  originX: number;
  titlebarInset: number;
}): DragRegion {
  return {
    x: input.originX,
    height: Math.max(0, input.titlebarInset),
    maxX: 0,
  };
}

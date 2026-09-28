export type DragRegion = {
  x: number;
  height: number;
  /** Right edge of the strip. 0 spans the rest of the window. */
  maxX: number;
};

/**
 * While the sidebar still covers the drag origin, the strip sits on the sidebar
 * at the titlebar inset. Once the sidebar ends at or before that origin, the
 * strip spans the rest of the window and is only as tall as the content card's top.
 * Width, not the collapsed flag, picks the mode so the strip tracks the collapse animation.
 */
export function resolveMacOSDragRegion(input: {
  originX: number;
  titlebarInset: number;
  sidebarWidth: number;
  contentTop: number;
}): DragRegion {
  const hostsStrip = input.sidebarWidth > input.originX;

  return {
    x: input.originX,
    height: hostsStrip ? input.titlebarInset : Math.max(0, input.contentTop),
    maxX: hostsStrip ? input.sidebarWidth : 0,
  };
}

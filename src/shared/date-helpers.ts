export function formatDate(d: Date | string | number): string {
  const date =
    typeof d === "string"
      ? new Date(d)
      : typeof d === "number"
        ? new Date(d * 1000)
        : d;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

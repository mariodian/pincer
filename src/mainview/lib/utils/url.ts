/**
 * Check if a given URL matches the current route.
 *
 * For the root route (" "), returns true only when currentLocation is exactly "/".
 * For all other routes, returns true when currentLocation is an exact match
 * or starts with the route followed by "/" (supports nested routes).
 */
export function isActiveUrl(currentLocation: string, url: string): boolean {
  if (url === "/") {
    return currentLocation === "/";
  }
  return currentLocation === url || currentLocation.startsWith(url + "/");
}

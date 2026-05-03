export function createDebouncedVisibility(
  source: () => boolean,
  debounceMs: number = 1000,
) {
  let visible = $state(false);
  let hideTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (source()) {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
      visible = true;
      return;
    }

    if (!visible) {
      return;
    }

    hideTimeout = setTimeout(() => {
      visible = false;
      hideTimeout = null;
    }, debounceMs);

    return () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    };
  });

  return {
    get visible() {
      return visible;
    },
  };
}

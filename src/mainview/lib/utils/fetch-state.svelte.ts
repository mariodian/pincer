type FetchRunOptions = {
  silent?: boolean;
  clearError?: boolean;
};

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createFetchState() {
  let initialLoading = $state(true);
  let refreshing = $state(false);
  let error = $state<string | null>(null);

  async function run<T>(
    task: () => Promise<T>,
    options: FetchRunOptions = {},
  ): Promise<T | undefined> {
    const { silent = false, clearError = true } = options;

    if (!silent) {
      initialLoading = true;
    } else {
      refreshing = true;
    }

    if (clearError) {
      error = null;
    }

    try {
      return await task();
    } catch (e) {
      error = toErrorMessage(e);
      return undefined;
    } finally {
      initialLoading = false;
      refreshing = false;
    }
  }

  function clearError() {
    error = null;
  }

  function beginInitialLoading() {
    initialLoading = true;
  }

  return {
    get initialLoading() {
      return initialLoading;
    },
    get refreshing() {
      return refreshing;
    },
    get error() {
      return error;
    },
    run,
    clearError,
    beginInitialLoading,
  };
}

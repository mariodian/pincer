<script>
  import Window from "./Window.svelte";

  let count = $state(0);

  function increment() {
    count += 1;
  }

  function reset() {
    count = 0;
  }
</script>

<Window title="Native Vibrancy Test">
  <h1 class="mb-3 text-5xl font-bold tracking-tight text-white">
    Native macOS Vibrancy
  </h1>
  <p class="mb-8 text-lg text-white/80">
    No CSS backdrop blur is used in this page. What you see should come from
    native window vibrancy only.
  </p>

  <div
    class="mb-6 rounded-2xl border border-white/20 bg-black/30 p-8 shadow-[0_16px_40px_rgba(0,0,0,0.38)]"
  >
    <h2 class="mb-4 text-2xl font-semibold text-white">Interactive Counter</h2>
    <p class="mb-5 text-white/75">
      This panel intentionally has no blur filter. It uses only tint and border
      so native window effects remain visible.
    </p>
    <div class="flex items-center gap-4">
      <button
        onclick={increment}
        class="rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 transition-colors hover:bg-white/90"
      >
        Count: {count}
      </button>
      <button
        onclick={reset}
        class="rounded-lg border border-white/40 bg-white/10 px-4 py-3 font-medium text-white transition-colors hover:bg-white/20"
      >
        Reset
      </button>
    </div>
  </div>

  <div
    class="rounded-2xl border border-white/20 bg-black/24 p-6 shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
  >
    <p class="text-sm leading-6 text-white/80">
      Tip: move this window over bright and dark backgrounds to judge real
      vibrancy and shadow strength. This UI keeps colors simple on purpose.
    </p>
  </div>
</Window>

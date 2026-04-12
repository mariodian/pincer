<script lang="ts">
  import { CheckDot } from "$lib/components/incidents";
  import * as Tooltip from "$lib/components/ui/tooltip";
  import type { Check } from "$shared/types";
  import type { TooltipTether } from "bits-ui";

  interface Props {
    check: Check;
    tether: TooltipTether<Check>;
    onHover?: (check: Check | null) => void;
  }

  let { check, tether, onHover }: Props = $props();

  function handlePointerEnter(_event: PointerEvent) {
    onHover?.(check);
  }

  function handlePointerLeave() {
    onHover?.(null);
  }
</script>

<Tooltip.Trigger {tether} payload={check}>
  {#snippet child({ props })}
    {@const triggerPropsWithHover = {
      ...props,
      onpointerenter: handlePointerEnter,
      onpointerleave: handlePointerLeave,
    }}
    <CheckDot {check} triggerProps={triggerPropsWithHover} />
  {/snippet}
</Tooltip.Trigger>

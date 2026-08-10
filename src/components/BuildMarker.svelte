<script lang="ts">
  const buildHash = (import.meta.env.VITE_GIT_HASH ?? 'local').slice(0, 7);
</script>

<span class="build-marker" data-testid="build-marker">Build {buildHash}</span>

<style>
  .build-marker {
    position: fixed;
    right: 4px;
    bottom: calc(3px + var(--hand-safe-area-bottom, env(safe-area-inset-bottom, 0px)));
    z-index: 10000;
    color: rgba(255, 255, 255, 0.38);
    font: 9px/1 monospace;
    letter-spacing: 0.04em;
    pointer-events: none;
    user-select: text;
  }
</style>

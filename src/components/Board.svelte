<script lang="ts">
  import { gameState } from '../lib/redux-svelte';
  import { settingsStore } from '../lib/settingsStore';
  
  $: orientation = $gameState.game.orientation;
  $: rows = $settingsStore.GRID_ROWS;
  $: cols = $settingsStore.GRID_COLS;
  
  // Reactive grid generation
  $: grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
</script>

<div class="board-container" style:transform="rotate({orientation}deg)">
  <div class="grid" style:--rows={rows} style:--cols={cols}>
    {#each grid as row, y}
      {#each row as cell, x}
        <div class="cell">
          <!-- {x},{y} -->
        </div>
      {/each}
    {/each}
  </div>
  <div class="status-overlay">
    <h2>Game Active</h2>
    <p>Orientation: {orientation}°</p>
  </div>
</div>

<style>
  .board-container {
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 1s ease-in-out;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    grid-template-rows: repeat(var(--rows), 1fr);
    gap: 10px;
    background: #333;
    padding: 10px;
    border-radius: 8px;
    
    /* Responsive sizing maintaining aspect ratio */
    width: 100%;
    height: 100%;
    max-width: 85vw;
    max-height: 85vh;
    aspect-ratio: var(--cols) / var(--rows);
    margin: auto;
  }

  .cell {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.3);
  }

  .status-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    text-shadow: 0 2px 10px black;
  }
</style>

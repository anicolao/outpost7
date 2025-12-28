<script lang="ts">
  import { gameState } from '../lib/redux-svelte';
  import { settingsStore } from '../lib/settingsStore';
  import { getAssetUrl } from '../lib/cardLoader';
  
  $: orientation = $gameState.game.orientation;
  $: rows = $settingsStore.GRID_ROWS;
  $: cols = $settingsStore.GRID_COLS;
  
  // Use grid from game state
  $: grid = $gameState.game.grid;
</script>

<div class="board-container" style:transform="rotate({orientation}deg)">
  {#if grid && grid.length > 0}
  <div class="grid" style:--rows={rows} style:--cols={cols}>
    {#each grid as row, y}
      {#each row as cell, x}
        <div class="cell" class:red={cell.owner === 'red'} class:yellow={cell.owner === 'yellow'}>
          <img src={getAssetUrl(cell.card)} alt="Start" draggable="false" />
        </div>
      {/each}
    {/each}
  </div>
  {/if}
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
    gap: 8px;
    background: #222;
    padding: 12px;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    
    /* Responsive sizing maintaining aspect ratio */
    width: 100%;
    height: 100%;
    max-width: 90vmin;
    max-height: 90vmin;
    aspect-ratio: var(--cols) / var(--rows);
    margin: auto;
  }

  .cell {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    transition: all 0.3s ease;
  }
  
  .cell img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      padding: 4px;
  }

  .cell.red {
      box-shadow: inset 0 0 0 2px #ff4d4d;
      background: rgba(255, 77, 77, 0.1);
  }

  .cell.yellow {
      box-shadow: inset 0 0 0 2px #ffd700;
      background: rgba(255, 215, 0, 0.1);
  }

  .status-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
    text-shadow: 0 2px 10px black;
    opacity: 0; /* Hide by default during play usually, but let's keep it minimal or hide */
    /* The design didn't ask to remove it, but it overlays the board. Let's make it fade out or move it. 
       For now, just keeping it but making it less intrusive if needed. 
       Actually, putting it at top left might be better? 
       Leaving as is for now but maybe hiding it if it blocks view. 
    */
    display: none; 
  }
</style>

<script lang="ts">
  import { gameState } from '../lib/redux-svelte';
  
  $: orientation = $gameState.game.orientation;
  
  // Simple grid generation
  const grid = Array(5).fill(null).map(() => Array(5).fill(null));
</script>

<div class="board-container" style:transform="rotate({orientation}deg)">
  <div class="grid">
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
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
    background: #333;
    padding: 10px;
    border-radius: 8px;
    width: 80vmin;
    height: 80vmin;
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

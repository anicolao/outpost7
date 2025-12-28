<script lang="ts">
  import { gameState } from '../lib/redux-svelte';
  import { settingsStore } from '../lib/settingsStore';
  import { getAssetUrl } from '../lib/cardLoader';
  
  $: orientation = $gameState.game.orientation;
  $: rows = $settingsStore.GRID_ROWS;
  $: cols = $settingsStore.GRID_COLS;
  
  // Game State
  $: grid = $gameState.game.grid;
  $: rowHeaders = $gameState.game.rowHeaders;
  $: colHeaders = $gameState.game.colHeaders;

  // Meeple Icon
  const MeepleIcon = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="${color}" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));"><path d="M9 20h-5a1 1 0 0 1 -1 -1c0 -2 3.378 -4.907 4 -6c-1 0 -4 -.5 -4 -2c0 -2 4 -3.5 6 -4c0 -1.5 .5 -4 3 -4s3 2.5 3 4c2 .5 6 2 6 4c0 1.5 -3 2 -4 2c.622 1.093 4 4 4 6a1 1 0 0 1 -1 1h-5c-1 0 -2 -4 -3 -4s-2 4 -3 4z" /></svg>`;

</script>

<!-- Force 90deg rotation per user request -->
<div class="board-container" style:transform="rotate(90deg)">
  {#if grid && grid.length > 0}
  <div class="game-layout" style:--rows={rows} style:--cols={cols}>
    
    <!-- Top Left Spacer -->
    <div class="spacer"></div>

    <!-- Column Headers (Top) -->
    {#each colHeaders as header, i}
      <div class="header-cell col-header">
        <!-- Removed background image -->
        <div class="population-badge">
             {@html MeepleIcon(header.owner === 'red' ? '#ff4d4d' : '#ffd700')} 
             <span class="pop-count" class:dark-text={header.owner === 'yellow'}>{header.count}</span>
        </div>
      </div>
    {/each}

    <!-- Row Headers (Left) and Grid Rows -->
    {#each grid as row, y}
       <!-- Row Header -->
       {#if rowHeaders && rowHeaders[y]}
       {@const header = rowHeaders[y]}
       <div class="header-cell row-header">
          <!-- Removed background image -->
          <div class="population-badge">
              {@html MeepleIcon(header.owner === 'red' ? '#ff4d4d' : '#ffd700')}
              <span class="pop-count" class:dark-text={header.owner === 'yellow'}>{header.count}</span>
          </div>
       </div>
       {:else}
       <!-- Fallback or empty header slot if data missing -->
       <div class="header-cell row-header placeholder"></div>
       {/if}

       <!-- Grid Cells -->
       {#each row as cell, x}
         <div class="cell empty-cell">
           <!-- Empty slot for now, will hold played cards later -->
         </div>
       {/each}
    {/each}

  </div>
  {/if}
</div>

<style>
  .board-container {
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 1s ease-in-out;
    background: #1a1a1a;
  }

  /* 
     Grid Layout
     Columns: 1 (Header) + 5 (Grid)
     Rows: 1 (Header) + 5 (Grid)
  */
  .game-layout {
    display: grid;
    /* First col is row header, Rest are game cols */
    grid-template-columns: 80px repeat(var(--cols), 1fr);
    /* First row is col header, Rest are game rows */
    grid-template-rows: 80px repeat(var(--rows), 1fr);
    gap: 8px;
    
    width: 95vmin;
    max-width: 800px;
    /* Aspect ratio for standard cards (approx 5/7 or 0.71) to ensure cells aren't square */
    aspect-ratio: 5/7; 
  }

  .spacer {
    /* Top-left corner, empty */
  }

  .header-cell {
    position: relative;
    background: #333; /* Gray background */
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    border: 1px solid #444;
  }

  /* Meeple Container - Side by Side */
  .population-badge {
    display: flex;
    flex-direction: row; /* Side-by-side */
    align-items: center;
    justify-content: center;
    gap: 0; /* Tight spacing as requested (or minor gap if needed) */
    width: 100%;
    height: 100%;
  }

  /* Text inside Meeple */
  .pop-count {
    font-weight: 900;
    font-size: 2.2rem; /* Large text */
    color: white; /* No stroke needed if on gray bg? Or keep style? User said "black with 1px white border" */
    color: black;
    -webkit-text-stroke: 1px white;
    paint-order: stroke fill;
    margin-left: 2px; /* Slight offset from meeple */
    line-height: 1;
  }

  .cell {
    background: rgba(255, 255, 255, 0.03);
    border: 2px dashed rgba(255,255,255,0.1);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .cell:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255,255,255,0.2);
  }

</style>

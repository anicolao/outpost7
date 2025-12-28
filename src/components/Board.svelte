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

  // Meeple and Token icons (simple SVGs for now or placeholders)
  const MeepleIcon = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a2 2 0 0 1 2 2v3h1a1 1 0 0 1 1 1v4h-2v3a1 1 0 0 1-2 0v-2h-3v2a1 1 0 0 1-2 0v-3H7v-4a1 1 0 0 1 1-1h1V5a2 2 0 0 1 2-2V3.73C11.6 3.39 12 2.74 12 2z"/></svg>`;
  const TokenIcon = (color: string) => `<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="10" fill="${color}" stroke="black" stroke-width="2"/></svg>`;

</script>

<div class="board-container" style:transform="rotate({orientation}deg)">
  {#if grid && grid.length > 0}
  <div class="game-layout" style:--rows={rows} style:--cols={cols}>
    
    <!-- Top Left Spacer -->
    <div class="spacer"></div>

    <!-- Column Headers (Top) -->
    {#each colHeaders as header, i}
      <div class="header-cell col-header">
        <img src={getAssetUrl(header.card)} alt="Start" draggable="false" />
        <div class="overlay">
          <div class="population-badge">
             {@html MeepleIcon} <span>{header.count}</span>
          </div>
          <div class="vote-token">
             {@html TokenIcon(header.owner === 'red' ? '#ff4d4d' : '#ffd700')}
          </div>
        </div>
      </div>
    {/each}

    <!-- Row Headers (Left) and Grid Rows -->
    {#each grid as row, y}
       <!-- Row Header -->
       {#if rowHeaders && rowHeaders[y]}
       {@const header = rowHeaders[y]}
       <div class="header-cell row-header">
          <img src={getAssetUrl(header.card)} alt="Start" draggable="false" />
          <div class="overlay">
            <div class="population-badge">
                {@html MeepleIcon} <span>{header.count}</span>
            </div>
            <div class="vote-token">
                {@html TokenIcon(header.owner === 'red' ? '#ff4d4d' : '#ffd700')}
            </div>
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
    aspect-ratio: 1; /* Keep it roughly square overall, though cells might not be perfectly square depending on config */
  }

  .spacer {
    /* Top-left corner, empty */
  }

  .header-cell {
    position: relative;
    background: #333;
    border-radius: 6px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
  }

  .header-cell img {
    width: 100%;
    height: 100%;
    object-fit: cover; /* Start cards often imply filling the space */
    opacity: 0.7;
  }

  .overlay {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    pointer-events: none;
  }

  .population-badge {
    background: rgba(0,0,0,0.6);
    color: white;
    padding: 2px 6px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: bold;
    font-size: 0.9rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.5);
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

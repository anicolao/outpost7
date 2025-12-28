<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import { Peer, type DataConnection } from 'peerjs';
  import { gameState } from '../lib/redux-svelte';
  import { dealCards, playerDiscard } from '../lib/gameSlice';
  import { settingsStore } from '../lib/settingsStore';
  import { store } from '../lib/store';
  import Offer from './Offer.svelte';
  import PlayerQR from './PlayerQR.svelte';

  $: orientation = $gameState.game.orientation;
  $: rows = $settingsStore.GRID_ROWS;
  $: cols = $settingsStore.GRID_COLS;
  
  // Game State
  $: grid = $gameState.game.grid;
  $: rowHeaders = $gameState.game.rowHeaders;
  $: colHeaders = $gameState.game.colHeaders;
  $: hands = $gameState.game.hands;
  $: players = $gameState.game.players;

  const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

  let peer: Peer;
  let hostPeerId: string | null = null;
  let connections: Record<string, DataConnection> = {};

  onMount(() => {
    // Initialize Peer
    peer = new Peer();

    peer.on('open', (id) => {
      hostPeerId = id;
      console.log('Host Peer ID:', id);
    });

    peer.on('connection', (conn) => {
      conn.on('data', (data: any) => {
        console.log('Received data:', data);
        handleData(conn, data);
      });
      
      conn.on('close', () => {
         console.log('Client disconnected');
         // Find and remove connection to restore QR
         const color = Object.keys(connections).find(c => connections[c] === conn);
         if (color) {
             console.log(`Restoring QR for ${color}`);
             delete connections[color];
             connections = connections; // trigger reactivity
         }
      });
    });
  });

  onDestroy(() => {
    if (peer) peer.destroy();
  });

  function handleData(conn: DataConnection, data: any) {
    if (data.type === 'REGISTER') {
        const color = data.color;
        if (color === 'red' || color === 'yellow') {
            connections[color] = conn;
            // Send initial hand
            conn.send({ type: 'HAND_UPDATE', hand: hands[color] });
        }
    } else if (data.type === 'DISCARD') {
        const { color, cardIds } = data;
        store.dispatch(playerDiscard({ color, cardIds }));
    }
  }

  // Reactive updates for hands
  $: if (hands.red && connections.red) {
      connections.red.send({ type: 'HAND_UPDATE', hand: hands.red });
  }
  
  $: if (hands.yellow && connections.yellow) {
      connections.yellow.send({ type: 'HAND_UPDATE', hand: hands.yellow });
  }

  // Meeple Icon
  const MeepleIcon = (color: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="${color}" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));"><path d="M9 20h-5a1 1 0 0 1 -1 -1c0 -2 3.378 -4.907 4 -6c-1 0 -4 -.5 -4 -2c0 -2 4 -3.5 6 -4c0 -1.5 .5 -4 3 -4s3 2.5 3 4c2 .5 6 2 6 4c0 1.5 -3 2 -4 2c.622 1.093 4 4 4 6a1 1 0 0 1 -1 1h-5c-1 0 -2 -4 -3 -4s-2 4 -3 4z" /></svg>`;

  let rotation = 90;

  function isValidMove(rowIndex: number, colIndex: number) { 
      // Simplified check
      return !grid[rowIndex]?.[colIndex];
  }
  function handleCellClick(rowIndex: number, colIndex: number) { 
      console.log(`Cell clicked: ${rowIndex}, ${colIndex}`); 
  }

</script>

<div class="table-top">
  <!-- Rotated Board Container -->
  <div class="board-container" style:transform={`rotate(${rotation}deg)`}>
    {#if rows && cols}
      <div class="game-layout" style:--rows={rows} style:--cols={cols}>
        
        <!-- Top Left Spacer -->
        <div class="header-cell spacer"></div>
        
        <!-- Column Headers (Top) -->
        {#each colHeaders as header, i}
          <div class="header-cell top-header">
             <div class="population-badge">
                 {@html MeepleIcon(header.owner)}
                 <span class="pop-count">{header.count}</span>
             </div>
          </div>
        {/each}

        <!-- Rows -->
        {#each Array(rows) as _, rowIndex}
           <!-- Row Header (Left) -->
           <div class="header-cell row-header">
              {#if rowHeaders[rowIndex]}
                <div class="population-badge">
                    {@html MeepleIcon(rowHeaders[rowIndex].owner)} 
                    <span class="pop-count">{rowHeaders[rowIndex].count}</span>
                </div>
              {/if}
           </div>

           <!-- Grid Cells -->
             {#each Array(cols) as _, colIndex}
                {@const cellId = `${rowIndex}-${colIndex}`}
                {@const cell = grid[rowIndex]?.[colIndex]}
                 <div 
                  class="cell" 
                  class:valid={isValidMove(rowIndex, colIndex)}
                  on:click={() => handleCellClick(rowIndex, colIndex)}
                  on:keydown={(e) => e.key === 'Enter' && handleCellClick(rowIndex, colIndex)}
                  role="button"
                  tabindex="0"
                >
                  {#if cell}
                     <!-- Grid content logic if needed -->
                  {/if}
                 </div>
             {/each}
        {/each}
      </div>
    {/if}
  </div>

  <!-- QR Zones outside rotated container to match player edges -->
  {#if hostPeerId}  
      {#each ['top', 'bottom', 'left', 'right'] as edge}
          {@const player = players.find(p => p.edge === edge)}
          {#if player && !connections[player.color]}
             <div class="qr-zone {edge}"> 
                 <PlayerQR 
                     url={`${window.location.origin}${baseUrl}#/hand?host=${hostPeerId}&color=${player.color}`} 
                     color={player.color === 'yellow' ? '#ffd700' : '#ff4d4d'} 
                 />
             </div>
          {/if}
      {/each}
  {/if}

  <!-- Static Overlay Elements (Offer) -->
  <div class="offer-overlay">
      <Offer />
  </div>
</div>


<style>
  .table-top {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #1a1a1a;
  }

  .board-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 1s ease-in-out;
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

  /* Counter-rotate Row Headers (Visually Top Strip) to be Horizontal */
  /* Row Headers are Left Grid Column -> Visually Top Strip when board is 90deg */
  .row-header .population-badge {
      transform: rotate(-90deg);
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

  .qr-zone {
      position: absolute;
      z-index: 50;
      /* Default Center Horizontal */
      left: 50%;
      transform: translateX(-50%);
  }

  .qr-zone.top {
      top: 20px; 
      /* Ensure left/transform are kept or reset if needed */
  }

  .qr-zone.bottom {
      bottom: 20px; 
  }

  /* Support Left/Right just in case */
  .qr-zone.left {
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
      right: auto;
  }
  .qr-zone.right {
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
      left: auto;
  }
  
  .offer-overlay {
      position: absolute;
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 40;
  }

</style>

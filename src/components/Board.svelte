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
         // Handle disconnection if needed
         console.log('Client disconnected');
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

  // Dummy variables for the new grid structure, as they are not defined in the original code
  let rotation = 90; // Assuming a default rotation
  let population = [1, 2, 3, 4, 5]; // Dummy data
  let roundCount = [1, 2, 3, 4, 5]; // Dummy data
  function isValidMove(rowIndex: number, colIndex: number) { return (rowIndex + colIndex) % 2 === 0; } // Dummy function
  function handleCellClick(rowIndex: number, colIndex: number) { console.log(`Cell clicked: ${rowIndex}, ${colIndex}`); } // Dummy function

</script>

<div class="table-top">
  <!-- Rotated Board Container -->
  <div class="board-container" style:transform={`rotate(${rotation}deg)`}>
    {#if rows && cols}
      <div class="board-grid" style:grid-template-columns={`repeat(${cols}, 1fr)`}>
        <!-- Headers (Population) -->
        <div class="header-cell empty"></div> <!-- Top-left corner -->
        {#each Array(cols) as _, colIndex}
          <div class="header-cell top-header">
            <span class="star-icon">★</span> {population[colIndex]}
          </div>
        {/each}

        <!-- Rows -->
        {#each Array(rows) as _, rowIndex}
           <!-- Row Header (Red Player meeple count needed? No, purely grid logic here) -->
           <!-- Wait, the design has headers on left too? Based on screenshot, yes on right side. -->
           <!-- Let's check screenshot again. Stars on top. Meeples on Right. -->
           <!-- The grid logic below iterates cells. -->
             {#each Array(cols) as _, colIndex}
                {@const cellId = `${rowIndex}-${colIndex}`}
                {@const cell = grid[cellId]}
                 <div 
                  class="cell" 
                  class:valid={isValidMove(rowIndex, colIndex)}
                  on:click={() => handleCellClick(rowIndex, colIndex)}
                  on:keydown={(e) => e.key === 'Enter' && handleCellClick(rowIndex, colIndex)}
                  role="button"
                  tabindex="0"
                >
                  {#if cell}
                     <div class="meeple {cell.color}">
                        {@html MeepleIcon(cell.color)}
                     </div>
                  {/if}
                 </div>
             {/each}
             <!-- Right Header for Row -->
             <div class="header-cell right-header">
                {@html MeepleIcon('red')} {rowIndex % 2 === 0 ? 2 : 1} <!-- Dummy logic or from state? -->
                <span class="header-value">{roundCount[rowIndex]}</span>
             </div>
        {/each}
      </div>
    {/if}
    
    <!-- QR Zones inside rotated container to match player edges -->
    {#if hostPeerId}
        {@const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`}
        <div class="qr-zone top">
            <PlayerQR 
                url={`${window.location.origin}${baseUrl}#/hand?host=${hostPeerId}&color=yellow`} 
                label="Yellow Player" 
                color="#ffd700" 
            />
        </div>
        <div class="qr-zone bottom">
            <PlayerQR 
                url={`${window.location.origin}${baseUrl}#/hand?host=${hostPeerId}&color=red`} 
                label="Red Player" 
                color="#ff4d4d" 
            />
        </div>
    {/if}
  </div>

  <!-- Static Overlay Elements (Offer) -->
  <div class="offer-overlay">
      <Offer />
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
  }

  /* Board is rotated 90deg inside .board-container */
  /* Top corresponds to Yellow (Edge Top) */
  .qr-zone.top {
      top: 10px;
      /* Center horizontally relative to the rotated container? No, vertically since it's flex row.. wait. */
      /* .board-container is flex centered. */
      top: -120px; /* Outside the grid */
  }

  /* Bottom corresponds to Red (Edge Bottom) */
  .qr-zone.bottom {
      bottom: -120px; /* Outside the grid */
  }

</style>

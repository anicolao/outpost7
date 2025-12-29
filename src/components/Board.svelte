<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  import { Peer, type DataConnection } from 'peerjs';
  import { gameState } from '../lib/redux-svelte';
  import { dealCards, playerDiscard } from '../lib/gameSlice';
  import { getAssetUrl, type CardData } from '../lib/cardLoader';
  import { settingsStore } from '../lib/settingsStore';
  import { store } from '../lib/store';
  import Offer from './Offer.svelte';
  import PlayerQR from './PlayerQR.svelte';
  import CardDisplay from './Card.svelte';

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

  import { playCard } from '../lib/gameSlice';

  // State for peer selections
  let peerSelections: Record<string, { playCardId: string | null, payCardId: string | null }> = {
      red: { playCardId: null, payCardId: null },
      yellow: { playCardId: null, payCardId: null }
  };

  // derived state for active selections
  $: hasSelection = (color: string) => {
      const s = peerSelections[color];
      return s && s.playCardId && s.payCardId;
  };

  // Turn management
  
  // Animation State
  let animatingCard: {
      id: string;
      startRect: DOMRect;
      endRect: DOMRect;
      cardData: CardData | null; // Full card data
  } | null = null;


  function handleData(conn: DataConnection, data: any) {
    if (data.type === 'REGISTER') {
        const color = data.color;
        if (color === 'red' || color === 'yellow') {
            connections[color] = conn;
            // Send initial hand
            conn.send({ type: 'HAND_UPDATE', hand: hands[color], turn: $gameState.game.currentTurn });
        }
    } else if (data.type === 'DISCARD') {
        const { color, cardIds } = data;
        store.dispatch(playerDiscard({ color, cardIds }));
    } else if (data.type === 'SELECTION_UPDATE') {
        const { color, playCardId, payCardId } = data;
        if (peerSelections[color]) {
            peerSelections[color] = { playCardId, payCardId };
            peerSelections = peerSelections; // Trigger reactivity
        }
    } else if (data.type === 'PLAYER_DISCARD') {
        store.dispatch(playerDiscard({
            color: data.color,
            cardIds: data.cardIds
        }));
    }
  }

  // Reactive updates for hands
  $: if (hands.red && connections.red) {
      connections.red.send({ type: 'HAND_UPDATE', hand: hands.red, turn: $gameState.game.currentTurn });
  }
  
  $: if (hands.yellow && connections.yellow) {
      connections.yellow.send({ type: 'HAND_UPDATE', hand: hands.yellow, turn: $gameState.game.currentTurn });
  }

  // Meeple Icon
  const MeepleIcon = (owner: string) => {
      const fill = owner === 'yellow' ? '#ffd700' : '#ff4d4d';
      return `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="${fill}" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));"><path d="M9 20h-5a1 1 0 0 1 -1 -1c0 -2 3.378 -4.907 4 -6c-1 0 -4 -.5 -4 -2c0 -2 4 -3.5 6 -4c0 -1.5 .5 -4 3 -4s3 2.5 3 4c2 .5 6 2 6 4c0 1.5 -3 2 -4 2c.622 1.093 4 4 4 6a1 1 0 0 1 -1 1h-5c-1 0 -2 -4 -3 -4s-2 4 -3 4z" /></svg>`;
  };

  let rotation = 90;

  function isValidMove(rowIndex: number, colIndex: number) { 
      return !grid[rowIndex]?.[colIndex] && (hasSelection('red') || hasSelection('yellow'));
  }

  async function handleCellClick(rowIndex: number, colIndex: number) { 
      // Determine active player (who has selection?)
      let color: 'red' | 'yellow' | null = null;
      if (hasSelection('red')) color = 'red';
      else if (hasSelection('yellow')) color = 'yellow';

      if (!color || !peerSelections[color]) return;

      const sel = peerSelections[color];
      if (!sel.playCardId || !sel.payCardId) return;

      // Enforce Turn
      if ($gameState.game.currentTurn !== color) {
          console.log(`Not ${color}'s turn!`);
          return;
      }

      if (!isValidMove(rowIndex, colIndex)) return;

      // Execute Move
      
      // 1. Get positions for animation
      // Find the "Face Down" card Element at the player's edge
      const edge = players.find(p => p.color === color)?.edge;
      const startEl = document.querySelector(`.face-down-card.${edge}`);
      const targetEl = document.querySelector(`[data-cell-id="${rowIndex}-${colIndex}"]`);

      if (startEl && targetEl) {
          const startRect = startEl.getBoundingClientRect();
          const endRect = targetEl.getBoundingClientRect();
          
          // Get Card Data for Face
          const hand = hands[color];
          const card = hand.find(c => c.id === sel.playCardId);

          // Trigger Animation
          animatingCard = {
              id: sel.playCardId,
              startRect,
              endRect,
              cardData: card || null
          };

          // Temporarily lock UI or wait
          await new Promise(r => setTimeout(r, 600)); // Wait for animation duration

          animatingCard = null;

          // Dispatch Action
          store.dispatch(playCard({
              color,
              playCardId: sel.playCardId,
              payCardId: sel.payCardId,
              row: rowIndex,
              col: colIndex,
              settings: $settingsStore
          }));

          // Clear selection implicitly updates via store -> hand -> client
          peerSelections[color] = { playCardId: null, payCardId: null };
      }
  }

</script>

<div class="table-top">
  <!-- Rotated Board Container -->
  <div class="board-container" style:transform={`rotate(${rotation}deg)`}>
    {#if rows && cols}
      <div class="game-layout" style:--rows={rows} style:--cols={cols}>
        
        <!-- Top Left Spacer -->
        <!-- Top Left Spacer / Turn Indicator -->
        <div class="header-cell spacer">
            <div class="turn-indicator" class:red-turn={$gameState.game.currentTurn === 'red'} class:yellow-turn={$gameState.game.currentTurn === 'yellow'}>
                {$gameState.game.currentTurn.toUpperCase()} TURN
            </div>
        </div>
        
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
                  data-cell-id="{cellId}"
                  class:valid={isValidMove(rowIndex, colIndex)}
                  on:click={() => handleCellClick(rowIndex, colIndex)}
                  on:keydown={(e) => e.key === 'Enter' && handleCellClick(rowIndex, colIndex)}
                  role="button"
                  tabindex="0"
                >
                  {#if cell}
                     <div class="played-card">
                         <CardDisplay card={cell} />
                     </div>
                  {/if}
                 </div>
             {/each}
        {/each}
      </div>
    {/if}
  </div>

  <!-- QR Zones & Face Down Cards -->
  {#if hostPeerId}  
      {#each ['top', 'bottom', 'left', 'right'] as edge}
          {@const player = players.find(p => p.edge === edge)}
          <!-- QR Code (Only if not connected) -->
          {#if player && !connections[player.color]}
             <div class="qr-zone {edge}"> 
                 <PlayerQR 
                     url={`${window.location.origin}${baseUrl}#/hand?host=${hostPeerId}&color=${player.color}`} 
                     color={player.color === 'yellow' ? '#ffd700' : '#ff4d4d'} 
                 />
             </div>
          {/if}

          <!-- Face Down Card (If connected and has selection) -->
          {@const pSel = player ? peerSelections[player.color] : null}
          {#if player && connections[player.color] && pSel && pSel.playCardId && pSel.payCardId}
             <div class="face-down-card {edge}">
                 <img src="assets/module_back.svg" alt="Card Back" />
             </div>
          {/if}
      {/each}
  {/if}

  <!-- Flying Card Animation -->
  {#if animatingCard}
      <div 
        class="flying-card"
        style:--start-x="{animatingCard.startRect.left}px"
        style:--start-y="{animatingCard.startRect.top}px"
        style:--end-x="{animatingCard.endRect.left}px"
        style:--end-y="{animatingCard.endRect.top}px"
      >
          <div class="flipper">
              <div class="front">
                  {#if animatingCard.cardData}
                      <CardDisplay card={animatingCard.cardData} />
                  {:else}
                      <img src="assets/module_back.svg" alt="Card Front" />
                  {/if}
              </div>
              <div class="back">
                  <img src="assets/module_back.svg" alt="Card Back" />
              </div>
          </div>
      </div>
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
    aspect-ratio: 0.76; 
  }

  .spacer {
    /* Top-left corner, now turn indicator */
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .turn-indicator {
      font-weight: bold;
      font-size: 0.9rem;
      padding: 5px;
      border-radius: 4px;
      text-align: center;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
  }

  .turn-indicator.red-turn {
      background: #ff4d4d;
      color: black;
      box-shadow: 0 0 10px #ff4d4d;
  }

  .turn-indicator.yellow-turn {
      background: #ffd700;
      color: black;
      box-shadow: 0 0 10px #ffd700;
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

  /* Face Down Card at Edges */
  .face-down-card {
      position: absolute;
      width: 60px; /* Adjust size */
      height: 84px;
      z-index: 60;
      /* Animation for appearance */
      animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  
  .face-down-card img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 5px 10px rgba(0,0,0,0.5));
  }

  .face-down-card.top { top: 20px; left: 50%; transform: translateX(-50%); }
  .face-down-card.bottom { bottom: 20px; left: 50%; transform: translateX(-50%); }
  .face-down-card.left { left: 20px; top: 50%; transform: translateY(-50%) rotate(90deg); }
  .face-down-card.right { right: 20px; top: 50%; transform: translateY(-50%) rotate(-90deg); }

  /* Valid Move Highlight */
  .cell.valid {
      background: rgba(255, 255, 255, 0.15); /* Brighter gray */
      border-color: rgba(255, 255, 255, 0.4);
      cursor: pointer;
      box-shadow: inset 0 0 20px rgba(255,255,255,0.1);
      animation: pulse-valid 2s infinite;
  }
  
  @keyframes pulse-valid {
      0% { background: rgba(255, 255, 255, 0.15); }
      50% { background: rgba(255, 255, 255, 0.25); }
      100% { background: rgba(255, 255, 255, 0.15); }
  }

  @keyframes popIn {
      from { transform: scale(0); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
  }


  /* Flying Card Animation */
  .flying-card {
      position: absolute;
      left: 0;
      top: 0;
      width: 80px; /* Should match cell size approx */
      height: 112px;
      z-index: 100;
      perspective: 1000px;
      pointer-events: none;
      
      /* Identify start and end via vars, animate via keyframes */
      animation: flyAndFlip 0.6s ease-in-out forwards;
  }

  .flipper {
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      animation: flipOnly 0.6s ease-in-out forwards;
  }
  
  .flipper .front, .flipper .back {
      position: absolute;
      width: 100%;
      height: 100%;
      backface-visibility: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
  }
  
  .flipper .front img, .flipper .back img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 6px;
      box-shadow: 0 10px 20px rgba(0,0,0,0.5);
  }

  .flipper .back {
      transform: rotateY(0deg); /* Starts facing viewer (if we assume it started back-up) */
  }
  
  .flipper .front {
      transform: rotateY(180deg);
  }

  @keyframes flyAndFlip {
      0% {
          transform: translate(var(--start-x), var(--start-y)) scale(0.8);
      }
      50% {
          transform: translate(calc(var(--start-x) + (var(--end-x) - var(--start-x)) * 0.5), calc(var(--start-y) + (var(--end-y) - var(--start-y)) * 0.5)) scale(1.2);
      }
      100% {
          transform: translate(var(--end-x), var(--end-y)) scale(1);
      }
  }

  @keyframes flipOnly {
      0% { transform: rotateY(0deg); }
      100% { transform: rotateY(180deg); }
  }

  .played-card {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
  }
  
  .played-card img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 4px;
      /* Remove drop shadow for placed cards, or keep shallow? */
  }

</style>

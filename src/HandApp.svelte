<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Peer, type DataConnection } from 'peerjs';
  import CardDisplay from './components/Card.svelte';
  import type { Card } from './lib/gameSlice';

  let hostId: string | null = null;
  let playerColor: 'red' | 'yellow' | null = null;
  let peer: Peer;
  let conn: DataConnection;
  

  let hand: Card[] = [];
  let status = 'Initializing...';
  
  // Selection logic
  let playCardId: string | null = null;
  let payCardId: string | null = null;
  let discardSelection: Set<string> = new Set();
  let currentTurn: string | null = null;

  onMount(() => {
    // Parse query params from hash
    // Hash format: #/hand?host=...&color=...
    const hash = window.location.hash;
    const queryPart = hash.split('?')[1];
    const urlParams = new URLSearchParams(queryPart);
    
    hostId = urlParams.get('host');
    const colorParam = urlParams.get('color');

    if (colorParam === 'red' || colorParam === 'yellow') {
        playerColor = colorParam;
    }

    if (!hostId || !playerColor) {
        status = 'Error: Missing host ID or player color';
        return;
    }

    status = 'Connecting to server...';
    peer = new Peer();

    peer.on('open', (id) => {
        console.log('Client Peer ID:', id);
        connectToHost();
    });

    peer.on('error', (err) => {
        console.error(err);
        status = `Connection Error: ${err.message}`;
    });
  });

  function connectToHost() {
    if (!hostId || !peer) return;

    conn = peer.connect(hostId);

    conn.on('open', () => {
        status = 'Connected';
        // Register this player
        conn.send({ type: 'REGISTER', color: playerColor });
    });

    conn.on('data', (data: any) => {
        if (data.type === 'HAND_UPDATE') {
            const newHand = data.hand;
            // Only clear selection if hand IDs changed
            const currentIds = hand.map(c => c.id).sort().join(',');
            const newIds = newHand.map((c: any) => c.id).sort().join(',');
            
            if (currentIds !== newIds) {
                hand = newHand;
                playCardId = null;
                payCardId = null;
                discardSelection = new Set();
            } else {
                // Just update hand data (in case costs/images changed - unlikely)
                hand = newHand;
            }
            if (data.turn) currentTurn = data.turn;
        }
    });

    conn.on('close', () => {
        status = 'Disconnected from Host';
    });
  }

  onDestroy(() => {
    if (peer) peer.destroy();
  });

  $: handCount = hand.length;
  $: totalCost = hand.reduce((acc, c) => acc + c.cost, 0);
  
  // Logic for Play/Pay State
  $: {
      if (conn && conn.open) {
          conn.send({ 
              type: 'SELECTION_UPDATE', 
              color: playerColor, 
              playCardId, 
              payCardId 
          });
      }
  }

  // Over limit based on CURRENT hand (to show alert)
  // For basic game flow, let's keep the play/pay focus for now.
  // We can re-enable discard logic if needed, but the prompt focuses on Play/Pay.
  // The 'discard to pay' is part of the move. 
  // Let's hide the old manual discard for now unless user needs it (prompt implies move-driven discard).
  // Actually, user prompt says: "When the player doesn't need to discard and selects a card..." 
  // This implies we ARE in the Play phase.
  $: isOverLimit = handCount > 7 || totalCost > 12;
  
  function handleCardTap(cardId: string) {
      if (isOverLimit) {
          // Discard Mode: Just toggle selection for discard
          // We can reuse playCardId/payCardId slots or add a new 'discardSelection' set.
          // Since we might need to discard multiple cards (e.g. if limit is 7 and we have 9),
          // we should support multi-select.
          // BUT, to keep it simple and reuse existing UI cues:
          // Let's use a `discardSelection` Set.
          if (discardSelection.has(cardId)) {
              discardSelection.delete(cardId);
          } else {
              discardSelection.add(cardId);
          }
          discardSelection = discardSelection; // Trigger reactivity
          return;
      }

      console.log('Tapped card:', cardId);
      if (playCardId && payCardId) {
          // If both selected, any tap resets
          console.log('Both selected, resetting.');
          playCardId = null;
          payCardId = null;
          return;
      }

      if (!playCardId) {
          // Select to Play
          console.log('Selecting PLAY:', cardId);
          playCardId = cardId;
      } else if (playCardId === cardId) {
          // Toggle off Play
          console.log('Deselecting PLAY');
          playCardId = null;
      } else {
          // Play is selected, this is a different card -> Select to Pay
          if (payCardId === cardId) {
              console.log('Deselecting PAY');
              payCardId = null; // Toggle off Pay
          } else {
              console.log('Selecting PAY:', cardId);
              payCardId = cardId;
          }
      }
      console.log('State:', { playCardId, payCardId });
  }

  function clearSelection() {
      playCardId = null;
      payCardId = null;
      discardSelection = new Set();
  }

  function confirmDiscard() {
      if (discardSelection.size === 0) return;
      
      // Send message to host to discard
      if (conn && conn.open) {
          conn.send({
              type: 'PLAYER_DISCARD',
              color: playerColor,
              cardIds: Array.from(discardSelection)
          });
          // Clear locally immediately or wait for update? 
          // Wait for update is safer, but clear selection now.
          discardSelection = new Set();
      }
  }

</script>

<div class="hand-container" class:over-limit={isOverLimit}>
  <header>
    <div class="info">
        <span class="player-badge" class:is-red={playerColor === 'red'} class:is-yellow={playerColor === 'yellow'}>
            {playerColor ? playerColor.toUpperCase() : 'UNKNOWN'}
        </span>
        <span class="status">{status}</span>
    </div>
    <div class="stats">
        {#if currentTurn}
            <div class="stat turn-stat" class:my-turn={currentTurn === playerColor}>
                {currentTurn === playerColor ? 'YOUR TURN' : 'OPPONENT TURN'}
            </div>
        {/if}
        <div class="stat">Cards: {handCount}</div>
        <div class="stat">Value: {totalCost}</div>
    </div>
  </header>

  {#if isOverLimit}
      <div class="alert-banner">
          ⚠️ Hand Limit Exceeded! Select cards to discard.
      </div>
  {/if}

  <main class="card-list">
      {#each hand as card}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div 
          class="card-wrapper" 
          class:play-selected={!isOverLimit && playCardId === card.id}
          class:pay-selected={!isOverLimit && payCardId === card.id}
          class:discard-selected={isOverLimit && discardSelection.has(card.id)}
          on:click={() => handleCardTap(card.id)}
        >
            <CardDisplay {card} />
            {#if !isOverLimit && playCardId === card.id}
                <div class="selected-overlay play">✓</div>
            {/if}
            {#if !isOverLimit && payCardId === card.id}
                <div class="selected-overlay pay">✕</div>
            {/if}
            {#if isOverLimit && discardSelection.has(card.id)}
                <div class="selected-overlay discard">🗑️</div>
            {/if}
        </div>
      {/each}
  </main>

  {#if isOverLimit}
    <footer class="actions">
        <button class="clear-btn" on:click={clearSelection} disabled={discardSelection.size === 0}>Clear</button>
        <button class="discard-btn" on:click={confirmDiscard} disabled={discardSelection.size === 0}>Confirm Discard</button>
    </footer>
  {/if}
</div>

<style>
  :global(body) {
      margin: 0;
      background: #222;
      color: white;
      font-family: sans-serif;
  }

  .hand-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      padding: 10px;
      box-sizing: border-box;
  }

  .hand-container.over-limit {
      box-shadow: inset 0 0 20px rgba(255, 0, 0, 0.2);
  }

  header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 1px solid #444;
  }

  .player-badge {
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: bold;
      color: black;
      margin-right: 10px;
  }
  .is-red { background: #ff4d4d; }
  .is-yellow { background: #ffd700; }

  .stats {
      display: flex;
      gap: 15px;
  }

  .stat {
      font-size: 1.1rem;
      font-weight: bold;
  }
  .stat.danger {
      color: #ff4d4d;
      animation: pulse 2s infinite;
  }

  .turn-stat {
      padding: 2px 6px;
      border-radius: 4px;
      background: #444;
      font-size: 0.8rem;
  }
  .turn-stat.my-turn {
      background: #00ff00;
      color: black;
      animation: pulse 2s infinite;
  }

  .alert-banner {
      background: #ff4d4d;
      color: white;
      text-align: center;
      padding: 8px;
      font-weight: bold;
      border-radius: 4px;
      margin-top: 10px;
  }

  .card-list {
      flex: 1;
      display: flex; /* Horizontal scroll */
      overflow-x: auto;
      gap: 10px;
      padding: 20px 0;
      align-items: center;
  }

  .card {
      min-width: 100px;
      height: 140px;
      background: white;
      color: black;
      border-radius: 8px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: default;
      transition: transform 0.2s, border 0.2s;
      border: 3px solid transparent;
      user-select: none;
  }

  .card-wrapper {
    position: relative;
    width: 80px;
    border-radius: 8px;
    cursor: pointer;
    transition: transform 0.2s;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  }

  .card-wrapper.play-selected {
    transform: translateY(-20px);
    box-shadow: 0 0 15px #00ff00;
    outline: 3px solid #00ff00;
  }
  
  .card-wrapper.pay-selected {
    transform: translateY(10px) scale(0.9);
    filter: grayscale(0.5);
    box-shadow: 0 0 10px #ff0000;
    outline: 3px solid #ff0000;
  }

  .card-wrapper.discard-selected {
    transform: translateY(10px);
    opacity: 0.7;
    box-shadow: 0 0 10px #ff4d4d;
    outline: 3px dashed #ff4d4d;
  }
  
  .selected-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 3rem;
      text-shadow: 0 0 5px black;
      pointer-events: none;
      z-index: 20;
      font-weight: bold;
  }

  .selected-overlay.play {
      color: #00ff00;
  }

  .selected-overlay.pay {
      color: #ff0000;
  }

  .selected-overlay.discard {
      color: #ffcccc;
  }

  .card.selectable {
      cursor: pointer;
  }

  .card.selectable:hover {
      transform: translateY(-5px);
  }

  .card.selected {
      border-color: red;
      transform: translateY(-10px);
      box-shadow: 0 5px 15px rgba(255, 0, 0, 0.4);
  }

  .card-inner {
      text-align: center;
  }

  .card-type {
      font-size: 12px;
      font-weight: bold;
      text-transform: uppercase;
  }

  .card-cost {
      font-size: 24px;
      color: #d00;
      margin-top: 5px;
  }

  footer.actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 10px;
      border-top: 1px solid #444;
  }

  button {
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      font-weight: bold;
      cursor: pointer;
  }
  
  button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
  }

  .clear-btn {
      background: #444;
      color: white;
  }

  .discard-btn {
      background: #ff4d4d;
      color: white;
  }

  @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.6; }
      100% { opacity: 1; }
  }
</style>

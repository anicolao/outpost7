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
  
  // Modes: 'play' | 'discard'
  // Auto-switch to discard if over limit, otherwise user can toggle?
  // User asked to RESTORE old logic. Old logic likely didn't have modes, just worked?
  // But Play/Pay consumes taps.
  // I will add an explicit toggle.
  let selectionMode: 'play' | 'discard' = 'play';

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
    
    // Check for explicit client ID for testing
    // note: window.location.hash logic above handles 'host' and 'color'
    // but we might want clientId in the main search params or hash?
    // Let's check main search params first as that's typical for test overrides
    const searchParams = new URLSearchParams(window.location.search);
    // Also check hash params (for QR code injection)
    const forcedClientId = searchParams.get('clientId') || urlParams.get('clientId');


    const peerConfig = import.meta.env.VITE_PEER_HOST ? {
        host: import.meta.env.VITE_PEER_HOST,
        port: parseInt(import.meta.env.VITE_PEER_PORT || '9000'),
        path: '/',
        config: { iceServers: [] }
    } : undefined;

    peer = forcedClientId ? new Peer(forcedClientId, peerConfig) : new Peer(peerConfig);

    peer.on('open', (id) => {
        console.log('Client Peer ID:', id);
        connectToHost();
    });

    peer.on('error', (err) => {
        console.error(err);
        status = `Connection Error: ${err.message}`;
    });
  });

  let connectionRetryTimeout: NodeJS.Timeout;
  let retryCount = 0;
  const RETRY_DELAY = 3000; // User requested 3000ms
  const MAX_RETRIES = 5;

  function connectToHost() {
    if (!hostId || !peer) return;

    if (retryCount > 0) {
       status = `Connecting... (Attempt ${retryCount + 1})`;
    }

    // Close previous connection if exists
    if (conn) conn.close();

    conn = peer.connect(hostId);
    clearTimeout(connectionRetryTimeout);

    // Set a timeout to retry if connection doesn't open
    connectionRetryTimeout = setTimeout(() => {
        if (status !== 'Connected' && retryCount < MAX_RETRIES) {
             console.log(`Connection attempt ${retryCount + 1} timed out or failed. Retrying in ${RETRY_DELAY}ms...`);
             retryCount++;
             connectToHost();
        } else if (retryCount >= MAX_RETRIES) {
             status = 'Connection Failed: Timeout';
        }
    }, RETRY_DELAY);

    conn.on('open', () => {
        clearTimeout(connectionRetryTimeout);
        status = 'Connected';
        retryCount = 0;
        // Register this player
        conn.send({ type: 'REGISTER', color: playerColor });
    });

    conn.on('error', (err) => {
        console.error('DataConnection Error:', err);
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

  // Over limit based on Hand Count (7)
  // Value limit only applies at start and is not enforced here for general play
  $: isOverLimit = handCount > 7;
  
  function handleCardTap(cardId: string) {
      if (isOverLimit) {
          // Force Discard Mode behavior if over limit?
          // Or just ensure we are in a state that allows it.
          // Let's rely on selectionMode, but force it to discard if over limit?
          // User said "discard logic is not the same".
          // I'll adhere to selectionMode, but auto-set mode to discard if over limit?
      }
      
      if (selectionMode === 'discard' || isOverLimit) {
          if (discardSelection.has(cardId)) {
              discardSelection.delete(cardId);
          } else {
              discardSelection.add(cardId);
          }
          discardSelection = discardSelection; 
          return;
      }

      // Play Mode
      console.log('Tapped card:', cardId);

      if (playCardId && payCardId) {
          console.log('Both selected, resetting.');
          playCardId = null;
          payCardId = null;
          return;
      }

      const card = hand.find(c => c.id === cardId);
      if (!card) return;

      if (!playCardId) {
          // Selecting PLAY card
          // Must have at least one OTHER card with cost >= this card's cost
          const hasValidPayer = hand.some(c => c.id !== cardId && c.cost >= card.cost);
          if (!hasValidPayer) {
               console.log('Cannot Play: No valid payer in hand');
               return;
          }
          console.log('Selecting PLAY:', cardId);
          playCardId = cardId;
      } else if (playCardId === cardId) {
          console.log('Deselecting PLAY');
          playCardId = null;
      } else {
          // Selecting PAY card
          // Must be >= Play Card Cost
          const playCard = hand.find(c => c.id === playCardId);
          if (!playCard) return;

          if (card.cost < playCard.cost) {
              console.log('Cannot Pay: Cost too low');
              return;
          }

          if (payCardId === cardId) {
              console.log('Deselecting PAY');
              payCardId = null; 
          } else {
              console.log('Selecting PAY:', cardId);
              payCardId = cardId;
          }
      }
  }

  function clearSelection() {
      playCardId = null;
      payCardId = null;
      discardSelection = new Set();
  }

  // Calculate potential state after discard
  $: selectedCards = hand.filter(c => discardSelection.has(c.id));
  $: selectedCost = selectedCards.reduce((acc, c) => acc + (c.cost || 0), 0);
  
  // Dynamic Limits for Display
  $: remainingHandCount = handCount - discardSelection.size;
  $: remainingCost = totalCost - selectedCost;

  $: remainsValid = !isOverLimit || (remainingHandCount <= 7);

  function confirmDiscard() {
      if (discardSelection.size === 0) return;
      if (!remainsValid) return; // Prevent insufficient discard
      
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
        <div class="stat" class:danger={remainingHandCount > 7}>
            Cards: {remainingHandCount}/7
        </div>
        <div class="stat">
            Value: {remainingCost}
        </div>
    </div>
    <div class="mode-switch">
        <button class:active={selectionMode === 'play' && !isOverLimit} on:click={() => { selectionMode = 'play'; clearSelection(); }} disabled={isOverLimit}>Play</button>
        <button class:active={selectionMode === 'discard' || isOverLimit} on:click={() => { selectionMode = 'discard'; clearSelection(); }}>Discard</button>
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
        {@const isPlayable = selectionMode === 'play' && !isOverLimit && !playCardId && hand.some(c => c.id !== card.id && c.cost >= card.cost)}
        {@const isPayable = selectionMode === 'play' && !isOverLimit && playCardId && playCardId !== card.id && (card.cost >= (hand.find(c => c.id === playCardId)?.cost || 99))}
        {@const isDisabled = selectionMode === 'play' && !isOverLimit && ((!playCardId && !isPlayable) || (playCardId && playCardId !== card.id && !isPayable))}
        
        <div 
          class="card-wrapper" 
          data-card-id={card.id}
          class:play-selected={selectionMode === 'play' && !isOverLimit && playCardId === card.id}
          class:pay-selected={selectionMode === 'play' && !isOverLimit && payCardId === card.id}
          class:discard-selected={(selectionMode === 'discard' || isOverLimit) && discardSelection.has(card.id)}
          class:disabled={isDisabled}
          on:click={() => !isDisabled && handleCardTap(card.id)}
        >
            <CardDisplay {card} />
            {#if selectionMode === 'play' && !isOverLimit && playCardId === card.id}
                <div class="selected-overlay play">✓</div>
            {/if}
            {#if selectionMode === 'play' && !isOverLimit && payCardId === card.id}
                <div class="selected-overlay pay">✕</div>
            {/if}
            {#if (selectionMode === 'discard' || isOverLimit) && discardSelection.has(card.id)}
                <div class="selected-overlay discard">🗑️</div>
            {/if}
        </div>
      {/each}
  </main>

  <!-- Contextual Footer -->
  <footer class="actions">
    {#if selectionMode === 'discard' || isOverLimit}
      <button class="clear-btn" on:click={clearSelection} disabled={discardSelection.size === 0}>Clear</button>
      <button class="discard-btn" on:click={confirmDiscard} disabled={discardSelection.size === 0 || !remainsValid}>Confirm Discard ({discardSelection.size})</button>
    {:else}
      <button class="clear-btn" on:click={clearSelection} disabled={!playCardId}>Clear</button>
      <div class="hint">Tap 1: Play, Tap 2: Pay</div>
    {/if}
  </footer>
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
  
  .mode-switch {
      display: flex;
      gap: 5px;
      margin-left: 10px;
  }
  .mode-switch button {
      padding: 4px 8px;
      font-size: 0.8rem;
      background: #333;
      color: #aaa;
      border: 1px solid #555;
  }
  .mode-switch button.active {
      background: #666;
      color: white;
      border-color: #888;
      box-shadow: inset 0 0 5px rgba(0,0,0,0.5);
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

  .card-wrapper.disabled {
      opacity: 0.3;
      filter: grayscale(1);
      cursor: not-allowed;
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

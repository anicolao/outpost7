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
  let selectedCards: Set<string> = new Set();

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
            hand = data.hand;
            // Clear selection on new hand if invalid? Or keep? 
            // Better to clear to avoid stale state
            selectedCards = new Set();
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
  
  // Projected state based on selection
  $: projectedHand = hand.filter(c => !selectedCards.has(c.id));
  $: projectedCount = projectedHand.length;
  $: projectedValue = projectedHand.reduce((acc, c) => acc + c.cost, 0);

  // Over limit based on CURRENT hand (to show alert)
  $: isOverLimit = handCount > 7 || totalCost > 12;
  
  // Valid discard state (projected hand is within limits)
  $: isValidDiscard = projectedCount <= 7 && projectedValue <= 12;

  function toggleSelect(cardId: string) {
    // Allow toggling selection freely
    if (selectedCards.has(cardId)) {
        selectedCards.delete(cardId);
        selectedCards = selectedCards; // trigger reactivity
    } else {
        selectedCards.add(cardId);
        selectedCards = selectedCards;
    }
  }

  function confirmDiscard() {
    if (isValidDiscard) {
        // Send Discard
        conn.send({ 
            type: 'DISCARD', 
            color: playerColor, 
            cardIds: Array.from(selectedCards) 
        });
        // We wait for host to send new hand
    } else {
        alert('You must discard enough cards to meet the limits (Max 7 cards, Max 12 value).');
    }
  }
  
  function clearSelection() {
      selectedCards = new Set();
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
        <!-- Show PROJECTED values if cards are selected, otherwise current -->
        <div class="stat" class:danger={projectedCount > 7}>
            Cards: {projectedCount} / 7
        </div>
        <div class="stat" class:danger={projectedValue > 12}>
            Value: {projectedValue} / 12
        </div>
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
          class:selected={selectedCards.has(card.id)}
          on:click={() => toggleSelect(card.id)}
        >
            <CardDisplay {card} />
            {#if selectedCards.has(card.id)}
                <div class="selected-overlay">✓</div>
            {/if}
        </div>
      {/each}
  </main>

  {#if isOverLimit}
    <footer class="actions">
        <button class="clear-btn" on:click={clearSelection} disabled={selectedCards.size === 0}>Clear</button>
        <button class="discard-btn" on:click={confirmDiscard} disabled={!isValidDiscard}>Confirm Discard</button>
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

  .card-wrapper.selected {
    transform: translateY(-10px);
    box-shadow: 0 0 10px #ffea00;
    outline: 2px solid #ffea00;
  }
  
  .selected-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 2rem;
      color: #ffea00;
      text-shadow: 0 0 5px black;
      pointer-events: none;
      z-index: 20;
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

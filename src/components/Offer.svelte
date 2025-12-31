<script lang="ts">
  import { gameState } from '../lib/redux-svelte';
  import { store } from '../lib/store';
  import { salvage } from '../lib/gameSlice';
  import Card from './Card.svelte';
  
  $: offer = $gameState.game.offer;
  $: currentTurn = $gameState.game.currentTurn;
  $: currentPlayerHand = $gameState.game.hands[currentTurn] || [];
  $: pendingBonuses = $gameState.game.pendingBonuses || [];
  
  // Selection State
  let selectedIds: Set<string> = new Set();
  
  // Reset selection on turn change
  let lastTurn = currentTurn;
  $: if (currentTurn !== lastTurn) {
      selectedIds = new Set();
      lastTurn = currentTurn;
  }

  function toggleSelection(cardId: string) {
      if (pendingBonuses.length > 0) return; // Disable during bonus resolution

      if (selectedIds.has(cardId)) {
          selectedIds.delete(cardId);
      } else {
          selectedIds.add(cardId);
      }
      selectedIds = selectedIds;
  }
  
  // Derived Validation
  $: selectedCards = offer.filter(c => selectedIds.has(c.id));
  $: totalCost = selectedCards.reduce((acc, c) => acc + c.cost, 0);
  $: isValidCost = totalCost <= 12;
  $: isValidHandSize = (currentPlayerHand.length + selectedCards.length) <= 7;
  $: canSalvage = selectedCards.length > 0 && isValidCost && isValidHandSize && pendingBonuses.length === 0;

  function handleSalvage() {
      if (!canSalvage) return;
      
      store.dispatch(salvage({
          color: currentTurn,
          cardIds: Array.from(selectedIds)
      }));
      selectedIds = new Set();
  }

  // Meeple Icon for current turn indicator
  const MeepleIcon = (color: string) => {
      const fill = color === 'yellow' ? '#ffd700' : '#ff4d4d';
      return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${fill}" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 20h-5a1 1 0 0 1 -1 -1c0 -2 3.378 -4.907 4 -6c-1 0 -4 -.5 -4 -2c0 -2 4 -3.5 6 -4c0 -1.5 .5 -4 3 -4s3 2.5 3 4c2 .5 6 2 6 4c0 1.5 -3 2 -4 2c.622 1.093 4 4 4 6a1 1 0 0 1 -1 1h-5c-1 0 -2 -4 -3 -4s-2 4 -3 4z" /></svg>`;
  };

</script>

<div class="offer-container" class:active={canSalvage}>
  <header>
      <h3>Offer</h3>
      <div class="salvage-controls">
          {#if selectedIds.size > 0}
            <div class="stats-pill" class:invalid={!isValidCost || !isValidHandSize}>
                <span class="cost">Cost: {totalCost}/12</span>
                <span class="count">Hand: {currentPlayerHand.length + selectedCards.length}/7</span>
            </div>
            <button 
                class="salvage-btn" 
                disabled={!canSalvage}
                on:click={handleSalvage}
            >
                Salvage ({selectedIds.size})
            </button>
          {/if}
      </div>
  </header>

  <div class="cards">
    {#each offer as card (card.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div 
        class="card-wrapper" 
        class:selected={selectedIds.has(card.id)}
        class:disabled={pendingBonuses.length > 0}
        on:click={() => toggleSelection(card.id)}
      >
        <Card {card} />
        {#if selectedIds.has(card.id)}
            <div class="selection-marker">
                {@html MeepleIcon(currentTurn)}
            </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .offer-container {
    position: absolute;
    left: 20px;
    top: 50%;
    transform: translateY(-50%) rotate(90deg);
    background: rgba(30, 30, 30, 0.9);
    padding: 15px;
    border-radius: 12px;
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    border: 1px solid #444;
    transition: border-color 0.3s;
    width: 400px; /* Fixed width to contain cards comfortably */
  }

  .offer-container.active {
      border-color: #4CAF50;
      box-shadow: 0 0 15px rgba(76, 175, 80, 0.3);
  }

  header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
  }

  h3 {
      margin: 0;
      font-size: 1.1rem;
      color: #aaa;
  }

  .salvage-controls {
      display: flex;
      align-items: center;
      gap: 10px;
  }

  .stats-pill {
      display: flex;
      flex-direction: column;
      font-size: 0.7rem;
      text-align: right;
      color: #888;
  }

  .stats-pill.invalid {
      color: #ff4d4d;
  }

  .salvage-btn {
      background: #4CAF50;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      font-size: 0.8rem;
  }

  .salvage-btn:disabled {
      background: #444;
      color: #888;
      cursor: not-allowed;
  }

  .cards {
    display: flex;
    flex-direction: row;
    gap: 10px;
    width: 100%;
    justify-content: center;
  }

  .card-wrapper {
    position: relative;
    width: 60px;
    height: 84px;
    cursor: pointer;
    transition: transform 0.2s, opacity 0.2s;
    border-radius: 4px;
  }

  .card-wrapper:hover {
      transform: translateY(-5px);
  }

  .card-wrapper.selected {
      transform: translateY(-8px);
      box-shadow: 0 0 0 2px #4CAF50;
      z-index: 10;
  }
  
  .card-wrapper.disabled {
      opacity: 0.5;
      pointer-events: none;
      filter: grayscale(1);
  }

  .selection-marker {
      position: absolute;
      top: -10px;
      right: -10px;
      background: white;
      border-radius: 50%;
      padding: 2px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  @keyframes popIn {
      from { transform: scale(0); }
      to { transform: scale(1); }
  }
</style>

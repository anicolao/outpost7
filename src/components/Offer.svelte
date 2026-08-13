<script lang="ts">
  import { gameState } from '../lib/redux-svelte';
  import { store } from '../lib/store';
  import { salvage } from '../lib/gameSlice';
  import Card from './Card.svelte';

  export let aiSelectedIds: string[] = [];
  export let aiLatestSelectedId: string | null = null;
  export let aiActive = false;
  
  $: offer = $gameState.game.offer;
  $: currentTurn = $gameState.game.currentTurn;
  $: currentPlayerHand = $gameState.game.hands[currentTurn] || [];
  $: pendingBonuses = $gameState.game.pendingBonuses || [];
  $: settings = $gameState.game.settings;
  $: deckCount = $gameState.game.deck.length;
  $: discardCount = $gameState.game.discard.length;
  $: redHandCount = $gameState.game.hands.red.length;
  $: yellowHandCount = $gameState.game.hands.yellow.length;
  
  // Selection State
  let selectedIds: Set<string> = new Set();
  
  // Reset selection on turn change
  let lastTurn = currentTurn;
  $: if (currentTurn !== lastTurn) {
      selectedIds = new Set();
      lastTurn = currentTurn;
  }

  function toggleSelection(cardId: string) {
      if (pendingBonuses.length > 0 || aiActive) return; // Disable during bonus resolution and AI feedback

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
  $: isValidCost = totalCost <= settings.SALVAGE_MAX_COST;
  $: isValidHandSize = (currentPlayerHand.length + selectedCards.length) <= settings.MAX_HAND_SIZE;
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

<div
  class="offer-container"
  class:active={canSalvage}
  class:ai-active={aiActive}
  style:--ai-color={currentTurn === 'yellow' ? '#ffd700' : '#ff4d4d'}
>
  <header>
      <h3>Offer</h3>
      <div class="game-counts" aria-label="Public game counts">
          <span class="game-count" data-pile="deck">
              <span class="count-label">Deck</span>
              <strong class="count-value">{deckCount}</strong>
          </span>
          <span class="game-count" data-pile="discard">
              <span class="count-label">Discard</span>
              <strong class="count-value">{discardCount}</strong>
          </span>
          <span class="game-count" data-pile="red">
              <span class="count-label">Red</span>
              <strong class="count-value">{redHandCount}</strong>
          </span>
          <span class="game-count" data-pile="yellow">
              <span class="count-label">Yellow</span>
              <strong class="count-value">{yellowHandCount}</strong>
          </span>
      </div>
      <div class="salvage-controls">
          {#if selectedIds.size > 0}
            <div class="stats-pill" class:invalid={!isValidCost || !isValidHandSize}>
                <span class="cost">Cost: {totalCost}/{settings.SALVAGE_MAX_COST}</span>
                <span class="count">Hand: {currentPlayerHand.length + selectedCards.length}/{settings.MAX_HAND_SIZE}</span>
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
        data-card-id={card.id}
        class:selected={selectedIds.has(card.id)}
        class:ai-selected={aiSelectedIds.includes(card.id)}
        class:ai-new-selection={aiLatestSelectedId === card.id}
        class:disabled={pendingBonuses.length > 0}
        on:click={() => toggleSelection(card.id)}
      >
        <Card {card} />
        {#if selectedIds.has(card.id) || aiSelectedIds.includes(card.id)}
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
    position: relative;
    transform: rotate(90deg);
    background: rgba(30, 30, 30, 0.9);
    padding: 8px;
    border-radius: 12px;
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.6);
    border: 1px solid #444;
    transition: border-color 0.3s;
    width: max-content;
  }

  .offer-container.active {
      border-color: #4CAF50;
      box-shadow: 0 0 15px rgba(76, 175, 80, 0.3);
  }

  .offer-container.ai-active {
      pointer-events: none;
  }

  header {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
  }

  h3 {
      margin: 0;
      font-size: 1.1rem;
      color: #aaa;
  }

  .game-counts {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      flex: 1;
  }

  .game-count {
      display: inline-flex;
      align-items: baseline;
      gap: 3px;
      padding: 2px 5px;
      border: 1px solid #555;
      border-radius: 4px;
      background: #292929;
      color: #aaa;
      font-size: 0.65rem;
      line-height: 1;
      white-space: nowrap;
  }

  .game-count[data-pile='red'] {
      border-bottom-color: #ef4444;
  }

  .game-count[data-pile='yellow'] {
      border-bottom-color: #facc15;
  }

  .count-value {
      color: #fff;
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
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
    gap: var(--table-gap);
    justify-content: center;
  }

  .card-wrapper {
    position: relative;
    width: var(--table-card-width);
    height: var(--table-card-height);
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

  .card-wrapper.ai-selected {
      transform: translateY(-8px);
      outline: 3px solid var(--ai-color);
      box-shadow: 0 0 18px 5px var(--ai-color);
      z-index: 10;
  }

  .card-wrapper.ai-new-selection {
      animation: ai-offer-selection 1.1s cubic-bezier(0.16, 1, 0.3, 1) both;
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

  @keyframes ai-offer-selection {
      0% { transform: translateY(0); filter: brightness(1); }
      35% { transform: translateY(-18px); filter: brightness(1.75); }
      100% { transform: translateY(-8px); filter: brightness(1.2); }
  }

  @media (prefers-reduced-motion: reduce) {
      .card-wrapper.ai-new-selection {
          animation-duration: 0.01ms;
      }
  }
</style>

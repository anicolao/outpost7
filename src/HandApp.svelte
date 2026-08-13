<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import CardDisplay from './components/Card.svelte';
  import type { Card } from './lib/gameSlice';
  import { createActionRepository, type ActionRepository, type HandUpdatedPayload } from './lib/action-repository';
  import { initializeFirebase } from './lib/firebase';
  import { calculateRepairCubes } from './lib/repairRules';
  import { DEFAULT_GAME_SETTINGS, type GameSettings } from './lib/settingsStore';
  import BuildMarker from './components/BuildMarker.svelte';

  let gameId: string | null = null;
  let playerColor: 'red' | 'yellow' | null = null;
  let repository: ActionRepository | undefined;
  let unsubscribe: (() => void) | undefined;
  let selectionSignature = '';

  let hand: Card[] = [];
  let status = 'Initializing...';
  
  // Selection logic
  let playCardId: string | null = null;
  let payCardId: string | null = null;
  let discardSelection: Set<string> = new Set();
  let currentTurn: string | null = null;
  let turnCount: number = 0;
  let pendingBonusCardIds: string[] = [];
  let settings: GameSettings = { ...DEFAULT_GAME_SETTINGS };

  onMount(async () => {
    const hash = window.location.hash;
    const queryPart = hash.split('?')[1];
    const urlParams = new URLSearchParams(queryPart);

    gameId = urlParams.get('game');
    const colorParam = urlParams.get('color');

    if (colorParam === 'red' || colorParam === 'yellow') {
        playerColor = colorParam;
    }

    if (!gameId || !playerColor) {
        status = 'Error: Missing game ID or player color';
        return;
    }

    status = 'Connecting to Firebase...';
    try {
        const { auth, db } = await initializeFirebase();
        repository = createActionRepository(db, gameId, auth.currentUser!.uid);
        unsubscribe = repository.subscribe(
            (events) => {
                const latest = events
                    .filter((event) =>
                        event.type === 'host/hand-updated' && event.payload.color === playerColor
                    )
                    .at(-1);
                if (!latest) return;

                const update = latest.payload as HandUpdatedPayload;
                const currentIds = hand.map((card) => card.id).sort().join(',');
                const newIds = update.hand.map((card) => card.id).sort().join(',');
                const nextPendingBonusCardIds = Array.isArray(update.pendingBonusCardIds)
                    ? update.pendingBonusCardIds.filter((id): id is string => typeof id === 'string')
                    : [];
                const bonusActionsStarted = pendingBonusCardIds.length === 0 && nextPendingBonusCardIds.length > 0;
                hand = update.hand;
                currentTurn = update.turn;
                turnCount = update.turnCount;
                settings = update.settings ?? settings;
                pendingBonusCardIds = nextPendingBonusCardIds;
                if (currentIds !== newIds || bonusActionsStarted) clearSelection();
            },
            (error) => {
                status = `Connection Error: ${error.message}`;
            },
            (firebaseStatus) => {
                status = firebaseStatus === 'offline' ? 'Reconnecting...' : 'Connected';
            },
        );
        await repository.append('player/registered', { color: playerColor });
    } catch (error) {
        status = `Connection Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  $: handCount = hand.length;
  $: totalCost = hand.reduce((acc, c) => acc + c.cost, 0);
  $: isBonusBlocked = pendingBonusCardIds.length > 0;
  
  // Logic for Play/Pay State
  $: {
      const nextSignature = `${playCardId ?? ''}:${payCardId ?? ''}`;
      if (repository && playerColor && nextSignature !== selectionSignature) {
          selectionSignature = nextSignature;
          repository.append('player/selection-updated', {
              color: playerColor,
              playCardId,
              payCardId,
          }).catch((error) => {
              status = `Connection Error: ${error instanceof Error ? error.message : String(error)}`;
          });
      }
  }

  $: isFirstTurn = (playerColor === 'red' && turnCount === 1) || (playerColor === 'yellow' && turnCount === 2);
  $: valueLimit = playerColor === 'yellow'
      ? settings.OPENING_HAND_VALUE_LIMIT_P2
      : settings.OPENING_HAND_VALUE_LIMIT_P1;
  
  $: isOverLimit = isFirstTurn 
      ? (totalCost > valueLimit || handCount > settings.MAX_HAND_SIZE)
      : (handCount > settings.MAX_HAND_SIZE);

  function isLegalRepairPair(playCard: Card, payCard: Card) {
      if (playCard.id === payCard.id || payCard.cost < playCard.cost) return false;
      return calculateRepairCubes(playCard, payCard, settings) > 0
          || settings.ALLOW_ZERO_CUBE_REPAIRS;
  }
  
  function handleCardTap(cardId: string) {
      if (isBonusBlocked) return;

      if (isOverLimit) {
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
          const hasValidPayer = hand.some(candidate => isLegalRepairPair(card, candidate));
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

          if (!isLegalRepairPair(playCard, card)) {
              console.log('Cannot Pay: This pair would not produce a legal repair');
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

  $: remainsValid = !isOverLimit || (isFirstTurn
      ? (remainingCost <= valueLimit && remainingHandCount <= settings.MAX_HAND_SIZE)
      : (remainingHandCount <= settings.MAX_HAND_SIZE));

  async function confirmDiscard() {
      if (discardSelection.size === 0) return;
      if (!remainsValid) return; // Prevent insufficient discard

      if (repository) {
          await repository.append('player/discarded', {
              color: playerColor,
              cardIds: Array.from(discardSelection),
          });
          discardSelection = new Set();
      }
  }

</script>

<div
  class="hand-container"
  class:over-limit={isOverLimit}
  style:--maximum-hand-size={Math.max(settings.MAX_HAND_SIZE, 1)}
>
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
        <div class="stat" class:danger={remainingHandCount > settings.MAX_HAND_SIZE}>
            Cards: {remainingHandCount}/{settings.MAX_HAND_SIZE}
        </div>
        <div class="stat" class:danger={isFirstTurn && remainingCost > valueLimit}>
            Value: {remainingCost}{isFirstTurn ? `/${valueLimit}` : ''}
        </div>
    </div>
  </header>

  {#if isBonusBlocked}
      <div class="alert-banner bonus-blocked-banner">
          Resolve cube actions on the glowing cards on the tabletop.
      </div>
  {:else if isOverLimit}
      <div class="alert-banner">
          ⚠️ Hand Limit Exceeded! Select cards to discard.
      </div>
  {/if}

  <main class="card-list">
      {#each hand as card}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        {@const isPlayable = !isOverLimit && !playCardId && hand.some(candidate => isLegalRepairPair(card, candidate))}
        {@const selectedPlayCard = hand.find(candidate => candidate.id === playCardId)}
        {@const isPayable = !isOverLimit && selectedPlayCard && isLegalRepairPair(selectedPlayCard, card)}
        {@const isDisabled = isBonusBlocked || (!isOverLimit && ((!playCardId && !isPlayable) || (playCardId && playCardId !== card.id && !isPayable)))}
        
        <div 
          class="card-wrapper" 
          data-card-id={card.id}
          class:play-selected={!isOverLimit && playCardId === card.id}
          class:pay-selected={!isOverLimit && payCardId === card.id}
          class:discard-selected={isOverLimit && discardSelection.has(card.id)}
          class:disabled={isDisabled}
          on:click={() => !isDisabled && handleCardTap(card.id)}
        >
            <CardDisplay {card} />
            {#if isDisabled}
                <div class="unavailable-overlay" aria-hidden="true">
                    <span>Unavailable</span>
                </div>
            {/if}
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

  <!-- Contextual Footer -->
  <footer class="actions">
    {#if isBonusBlocked}
      <div class="hint">Waiting for tabletop cube actions</div>
    {:else if isOverLimit}
      <button class="clear-btn" on:click={clearSelection} disabled={discardSelection.size === 0}>Clear</button>
      <button class="discard-btn" on:click={confirmDiscard} disabled={discardSelection.size === 0 || !remainsValid}>Confirm Discard ({discardSelection.size})</button>
    {:else}
      <button class="clear-btn" on:click={clearSelection} disabled={!playCardId}>Clear</button>
      <div class="hint">Tap 1: Play, Tap 2: Pay</div>
    {/if}
  </footer>
  <BuildMarker />
</div>

<style>
  :global(body) {
      margin: 0;
      background: #222;
      color: white;
      font-family: sans-serif;
      overflow: hidden;
  }

  .hand-container {
      --hand-safe-area-bottom: max(
          env(safe-area-inset-bottom, 0px),
          var(--simulated-safe-area-inset-bottom, 0px)
      );
      display: flex;
      flex-direction: column;
      height: 100vh;
      height: 100dvh;
      width: 100vw;
      padding: 10px 10px calc(10px + var(--hand-safe-area-bottom));
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

  .bonus-blocked-banner {
      background: #ffd700;
      color: black;
      box-shadow: 0 0 12px rgba(255, 215, 0, 0.75);
  }

  .card-list {
      flex: 1;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      align-content: center;
      align-items: center;
      min-height: 0;
      overflow: hidden;
      gap: clamp(4px, 1vw, 10px);
      padding: clamp(4px, 2vh, 12px) 0;
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
    flex: 0 0 auto;
    width: min(11vw, calc((100dvh - 190px) / 4.2));
    aspect-ratio: 2.5 / 3.5;
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
      cursor: not-allowed;
  }

  .unavailable-overlay {
      position: absolute;
      inset: 0;
      z-index: 15;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      border: 2px solid rgba(255, 255, 255, 0.7);
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.32);
      pointer-events: none;
  }

  .unavailable-overlay span {
      padding: 0.25em 0.45em;
      border-radius: 4px;
      background: rgba(20, 20, 20, 0.9);
      color: #fff;
      font-size: clamp(0.55rem, 2.5vw, 0.8rem);
      font-weight: 700;
      letter-spacing: 0.04em;
      line-height: 1;
      text-transform: uppercase;
      text-shadow: 0 1px 2px #000;
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

  @media (max-width: 600px) and (orientation: portrait) {
      .hand-container {
          padding: 8px 8px calc(8px + var(--hand-safe-area-bottom));
      }

      header {
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 6px;
          padding-bottom: 6px;
      }

      .info,
      .stats {
          display: flex;
          align-items: center;
      }

      .status {
          font-size: 0.75rem;
      }

      .stats {
          width: 100%;
          justify-content: space-between;
          gap: 6px;
      }

      .stat {
          font-size: 0.85rem;
      }

      .alert-banner {
          margin-top: 6px;
          padding: 6px;
          font-size: 0.85rem;
      }

      .card-wrapper {
          width: min(
              calc((100vw - 36px) / 3),
              calc((100dvh - 190px - var(--hand-safe-area-bottom)) / 4.2)
          );
      }

      footer.actions {
          min-height: 40px;
          align-items: center;
          padding-top: 6px;
      }

      button {
          padding: 8px 12px;
          font-size: 0.9rem;
      }

      .hint {
          font-size: 0.85rem;
      }
  }

  @media (max-height: 500px) and (orientation: landscape) {
      .hand-container {
          padding: 6px 6px calc(6px + var(--hand-safe-area-bottom));
      }

      header {
          padding-bottom: 4px;
      }

      .status,
      .stat,
      .hint {
          font-size: 0.75rem;
      }

      .alert-banner {
          margin-top: 4px;
          padding: 4px;
          font-size: 0.75rem;
      }

      .card-list {
          flex-wrap: nowrap;
          padding: 4px 0;
      }

      .card-wrapper {
          width: min(
              calc((100vw - 72px) / var(--maximum-hand-size)),
              calc((100dvh - 105px - var(--hand-safe-area-bottom)) / 1.4)
          );
      }

      footer.actions {
          min-height: 34px;
          padding-top: 4px;
      }

      button {
          padding: 6px 10px;
          font-size: 0.8rem;
      }
  }
</style>

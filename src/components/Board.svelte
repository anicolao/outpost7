<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';

  import { gameState } from '../lib/redux-svelte';
  import { dealCards, playerDiscard, resolveBonus, salvage, type BonusInstance } from '../lib/gameSlice';
  import { createActionRepository, type ActionRepository, type ControllerEvent } from '../lib/action-repository';
  import { initializeFirebase } from '../lib/firebase';
  import type { Card, Edge, PlayerColor } from '../lib/types';
  import { store } from '../lib/store';
  import Offer from './Offer.svelte';
  import PlayerQR from './PlayerQR.svelte';
  import CardDisplay from './Card.svelte';
  import E2EHandDisplay from './E2EHandDisplay.svelte';

  // @ts-ignore
  const isE2E = typeof window !== 'undefined' && (window.E2E_TEST === true || window.E2E_TEST === 'true');

  $: orientation = $gameState.game.orientation;
  $: rules = $gameState.game.settings;
  $: rows = rules.GRID_ROWS;
  $: cols = rules.GRID_COLS;
  
  // Game State
  $: grid = $gameState.game.grid;
  $: rowHeaders = $gameState.game.rowHeaders;
  $: colHeaders = $gameState.game.colHeaders;
  $: hands = $gameState.game.hands;
  $: players = $gameState.game.players;
  $: pendingBonuses = $gameState.game.pendingBonuses || [];
  $: currentTurn = $gameState.game.currentTurn;

  const baseUrl = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;

  let gameId: string | null = null;
  let repository: ActionRepository | undefined;
  let unsubscribe: (() => void) | undefined;
  let connectedPlayers: Partial<Record<PlayerColor, string>> = {};
  let repositoryStatus: 'connecting' | 'ready' | 'offline' | 'error' = 'connecting';
  let initialSnapshotReceived = false;
  const handledDiscardEvents = new Set<string>();
  const publishedHands: Partial<Record<PlayerColor, string>> = {};

  onMount(async () => {
    const urlParams = new URLSearchParams(window.location.search);
    gameId = urlParams.get('gameId') ?? crypto.randomUUID().replaceAll('-', '').slice(0, 12);

    try {
      const { auth, db } = await initializeFirebase();
      repository = createActionRepository(db, gameId, auth.currentUser!.uid);
      unsubscribe = repository.subscribe(
        handleEvents,
        (error) => {
          repositoryStatus = 'error';
          console.error('Firebase controller connection failed:', error);
        },
        (status) => {
          repositoryStatus = status === 'offline' ? 'offline' : 'ready';
        },
      );
    } catch (error) {
      repositoryStatus = 'error';
      console.error('Firebase initialization failed:', error);
    }
  });

  onDestroy(() => {
    unsubscribe?.();
  });

  import { playCard } from '../lib/gameSlice';

  // State for private controller selections
  let controllerSelections: Record<string, { playCardId: string | null, payCardId: string | null }> = {
      red: { playCardId: null, payCardId: null },
      yellow: { playCardId: null, payCardId: null }
  };

  // derived state for active selections
  $: hasSelection = (color: string) => {
      const s = controllerSelections[color];
      return !!(s && s.playCardId && s.payCardId);
  };

  // Turn management
  
  import { BasicAI } from '../lib/ai/BasicAI';
  
  // AI Instances
  const aiInstances: Record<string, BasicAI> = {};
  const AI_STAGE_EVENT = 'outpost7:continue-ai-stage';

  type AIStage =
      | 'thinking'
      | 'repair-selection'
      | 'repair-flight'
      | 'salvage-selection'
      | 'salvage-flight'
      | 'bonus'
      | 'pass';

  type AIPresentation = {
      color: PlayerColor;
      edge: Edge;
      stage: AIStage;
      playCard?: Card;
      payCard?: Card;
      selectedCardIds?: string[];
      latestSelectedCardId?: string;
  };

  type SalvageFlight = {
      card: Card;
      startRect: DOMRect;
      endRect: DOMRect;
  };

  let aiPresentation: AIPresentation | null = null;
  let aiSalvageFlights: SalvageFlight[] = [];
  let aiRunning = false;
  let lastAIStateSignature = '';

  async function holdAIStage(stage: string) {
      await tick();
      const holds = (window as typeof window & { E2E_AI_STAGE_HOLDS?: string[] }).E2E_AI_STAGE_HOLDS;
      const holdIndex = holds?.indexOf(stage) ?? -1;
      if (holdIndex < 0 || !holds) return;

      holds.splice(holdIndex, 1);
      await new Promise<void>((resolve) => {
          window.addEventListener(AI_STAGE_EVENT, () => resolve(), { once: true });
      });
  }

  async function waitForStageAnimations(selector: string) {
      await tick();
      const animations = Array.from(document.querySelectorAll<HTMLElement>(selector))
          .flatMap((element) => element.getAnimations({ subtree: true }))
          .filter((animation) => animation.effect?.getTiming().iterations !== Infinity);
      await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));
  }

  async function presentAIStage(stageKey: string, selector: string) {
      await holdAIStage(stageKey);
      await waitForStageAnimations(selector);
  }

  function destinationRect(edge: Edge, sourceRect: DOMRect) {
      const margin = 20;
      const left = edge === 'left'
          ? margin
          : edge === 'right'
            ? window.innerWidth - sourceRect.width - margin
            : (window.innerWidth - sourceRect.width) / 2;
      const top = edge === 'top'
          ? margin
          : edge === 'bottom'
            ? window.innerHeight - sourceRect.height - margin
            : (window.innerHeight - sourceRect.height) / 2;
      return new DOMRect(left, top, sourceRect.width, sourceRect.height);
  }

  function aiStateSignature() {
      const game = $gameState.game;
      return JSON.stringify({
          phase: game.phase,
          turn: game.currentTurn,
          turnCount: game.turnCount,
          hand: game.hands[game.currentTurn].map((card) => card.id),
          offer: game.offer.map((card) => card.id),
          grid: game.grid.flat().map((card) => card?.id ?? null),
          bonuses: game.pendingBonuses.map((bonus) => bonus.id),
      });
  }

  async function executeAIMove(turnColor: PlayerColor, edge: Edge, ai: BasicAI) {
      aiPresentation = { color: turnColor, edge, stage: 'thinking' };
      await presentAIStage('thinking', '.ai-action-feedback');

      if ($gameState.game.currentTurn !== turnColor) return;
      const move = ai.computeMove($gameState.game);
      if (!move) return;
      console.log(`AI (${turnColor}) doing:`, move);

      if (move.type === 'PASS') {
          aiPresentation = { color: turnColor, edge, stage: 'pass' };
          await presentAIStage('pass', '.ai-action-feedback');
          store.dispatch({ type: 'game/passTurn', payload: { color: turnColor } });
          return;
      }

      if (move.type === 'RESOLVE_BONUS') {
          aiPresentation = { color: turnColor, edge, stage: 'bonus' };
          executingBonuses.add(move.bonusId);
          executingBonuses = new Set(executingBonuses);
          await presentAIStage('bonus', '.ai-action-feedback, .player-cube.executing');
          store.dispatch(resolveBonus({ bonusId: move.bonusId }));
          executingBonuses.delete(move.bonusId);
          executingBonuses = new Set(executingBonuses);
          return;
      }

      if (move.type === 'REPAIR') {
          const hand = $gameState.game.hands[turnColor];
          const play = hand.find((card) => card.id === move.playCardId);
          const pay = hand.find((card) => card.id === move.payCardId);
          const target = document.querySelector<HTMLElement>(`[data-cell-id="${move.row}-${move.col}"]`);
          if (!play || !pay || !target) return;

          aiPresentation = {
              color: turnColor,
              edge,
              stage: 'repair-selection',
              playCard: play,
              payCard: pay,
          };
          await presentAIStage('repair-selection', '.ai-repair-choice .choice-card');

          const source = document.querySelector<HTMLElement>('.ai-repair-choice .play-choice .choice-card');
          if (!source) return;
          animatingCard = {
              id: play.id,
              startRect: source.getBoundingClientRect(),
              endRect: target.getBoundingClientRect(),
              cardData: play,
              controlledByAI: true,
          };
          aiPresentation = { ...aiPresentation, stage: 'repair-flight' };
          await presentAIStage('repair-flight', '.flying-card.ai-controlled');

          animatingCard = null;
          store.dispatch(playCard({
              color: turnColor,
              playCardId: move.playCardId,
              payCardId: move.payCardId,
              row: move.row,
              col: move.col,
          }));
          return;
      }

      const selectedCards = move.cardIds
          .map((cardId) => $gameState.game.offer.find((card) => card.id === cardId))
          .filter((card): card is Card => Boolean(card));
      const selectedCardIds: string[] = [];
      for (const card of selectedCards) {
          selectedCardIds.push(card.id);
          aiPresentation = {
              color: turnColor,
              edge,
              stage: 'salvage-selection',
              selectedCardIds: [...selectedCardIds],
              latestSelectedCardId: card.id,
          };
          await presentAIStage(
              `salvage-selection:${selectedCardIds.length}`,
              `.offer-container [data-card-id="${card.id}"].ai-new-selection`,
          );
      }

      aiSalvageFlights = selectedCards.flatMap((card) => {
          const source = document.querySelector<HTMLElement>(
              `.offer-container [data-card-id="${card.id}"]`,
          );
          if (!source) return [];
          const startRect = source.getBoundingClientRect();
          return [{ card, startRect, endRect: destinationRect(edge, startRect) }];
      });
      aiPresentation = {
          color: turnColor,
          edge,
          stage: 'salvage-flight',
          selectedCardIds: [...selectedCardIds],
      };
      await presentAIStage('salvage-flight', '.ai-salvage-card');

      aiSalvageFlights = [];
      store.dispatch(salvage({ color: turnColor, cardIds: move.cardIds }));
  }

  // AI Loop
  $: if ($gameState.game.phase === 'playing' && !aiRunning) {
      const turnColor = $gameState.game.currentTurn;
      const player = $gameState.game.players.find(p => p.color === turnColor);
      if (player && player.type === 'ai') {
          if (!aiInstances[turnColor]) {
              aiInstances[turnColor] = new BasicAI(turnColor, $gameState.game.seed, rules);
          }
          const signature = aiStateSignature();
          if (signature !== lastAIStateSignature) {
              lastAIStateSignature = signature;
              aiRunning = true;
              void executeAIMove(turnColor, player.edge, aiInstances[turnColor])
                  .finally(() => {
                      aiPresentation = null;
                      aiRunning = false;
                  });
          }
      }
  }
  
  // Animation State
  let animatingCard: {
      id: string;
      startRect: DOMRect;
      endRect: DOMRect;
      cardData: Card | null;
      controlledByAI?: boolean;
  } | null = null;


  function handleEvents(events: ControllerEvent[]) {
    const nextConnections: Partial<Record<PlayerColor, string>> = {};
    const nextSelections = {
      red: { playCardId: null as string | null, payCardId: null as string | null },
      yellow: { playCardId: null as string | null, payCardId: null as string | null },
    };

    for (const event of events) {
      const color = event.payload.color;
      if (color !== 'red' && color !== 'yellow') continue;

      if (event.type === 'player/registered') {
        nextConnections[color] = event.actorUid;
      } else if (event.type === 'player/selection-updated') {
        nextSelections[color] = {
          playCardId: typeof event.payload.playCardId === 'string' ? event.payload.playCardId : null,
          payCardId: typeof event.payload.payCardId === 'string' ? event.payload.payCardId : null,
        };
      }
    }

    connectedPlayers = nextConnections;
    controllerSelections = nextSelections;

    const discardEvents = events.filter((event) => event.type === 'player/discarded');
    if (!initialSnapshotReceived) {
      discardEvents.forEach((event) => handledDiscardEvents.add(event.id));
      initialSnapshotReceived = true;
      return;
    }

    for (const event of discardEvents) {
      if (handledDiscardEvents.has(event.id)) continue;
      handledDiscardEvents.add(event.id);
      const color = event.payload.color;
      const cardIds = event.payload.cardIds;
      if (
        (color === 'red' || color === 'yellow') &&
        Array.isArray(cardIds) &&
        cardIds.every((id) => typeof id === 'string') &&
        connectedPlayers[color] === event.actorUid
      ) {
        store.dispatch(playerDiscard({ color, cardIds }));
      }
    }
  }

  function publishHand(
    color: PlayerColor,
    activeBonuses: BonusInstance[],
    turn: PlayerColor,
    turnCount: number,
  ) {
    if (!repository) return;
    const payload = {
      color,
      hand: hands[color],
      turn,
      turnCount,
      settings: rules,
      pendingBonusCardIds: [...new Set(activeBonuses.map((bonus) => bonus.sourceCardId))],
    };
    const signature = JSON.stringify(payload);
    if (publishedHands[color] === signature) return;
    publishedHands[color] = signature;
    repository.append('host/hand-updated', payload).catch((error) => {
      repositoryStatus = 'error';
      console.error('Firebase hand update failed:', error);
    });
  }

  $: if (repository && hands.red) publishHand('red', pendingBonuses, currentTurn, $gameState.game.turnCount);
  $: if (repository && hands.yellow) publishHand('yellow', pendingBonuses, currentTurn, $gameState.game.turnCount);

  // Meeple Icon
  const MeepleIcon = (owner: string) => {
      const fill = owner === 'yellow' ? '#ffd700' : '#ff4d4d';
      return `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="${fill}" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.6));"><path d="M9 20h-5a1 1 0 0 1 -1 -1c0 -2 3.378 -4.907 4 -6c-1 0 -4 -.5 -4 -2c0 -2 4 -3.5 6 -4c0 -1.5 .5 -4 3 -4s3 2.5 3 4c2 .5 6 2 6 4c0 1.5 -3 2 -4 2c.622 1.093 4 4 4 6a1 1 0 0 1 -1 1h-5c-1 0 -2 -4 -3 -4s-2 4 -3 4z" /></svg>`;
  };

  function aiActionLabel(presentation: AIPresentation) {
      const prefix = `${presentation.color.toUpperCase()} AI`;
      if (presentation.stage === 'thinking') return `${prefix} IS THINKING`;
      if (presentation.stage === 'repair-selection') return `${prefix} CHOOSES A REPAIR`;
      if (presentation.stage === 'repair-flight') return `${prefix} PLAYS`;
      if (presentation.stage === 'salvage-selection') return `${prefix} SELECTS TO SALVAGE`;
      if (presentation.stage === 'salvage-flight') return `${prefix} SALVAGES`;
      if (presentation.stage === 'bonus') return `${prefix} ACTIVATES A BONUS`;
      return `${prefix} PASSES`;
  }

  function isValidMove(rowIndex: number, colIndex: number) { 
      return pendingBonuses.length === 0 &&
          !grid[rowIndex]?.[colIndex] &&
          hasSelection(currentTurn);
  }

  async function handleCellClick(rowIndex: number, colIndex: number) { 
      // If pending bonuses exist, block normal play
      if (pendingBonuses.length > 0) return;

      const color = currentTurn;
      // Evaluate phase
      const phase = $gameState.game?.phase;
      if (phase !== 'playing') return;

      const pSel = controllerSelections[color];

      if (!pSel || !pSel.playCardId || !pSel.payCardId) return;
      
      const isValid = isValidMove(rowIndex, colIndex);
      if (!isValid) return;

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
          const card = hand.find(c => c.id === pSel.playCardId);

          // Trigger Animation
          animatingCard = {
              id: pSel.playCardId,
              startRect,
              endRect,
              cardData: card || null
          };

          // Dispatch Logic
          const performDispatch = () => {
              animatingCard = null;
              store.dispatch(playCard({
                  color,
                  playCardId: pSel.playCardId as string,
                  payCardId: pSel.payCardId,
                  row: rowIndex,
                  col: colIndex,
              }));
              controllerSelections[color] = { playCardId: null, payCardId: null };
          };

          // @ts-ignore
          if (window.E2E_TEST) {
              performDispatch();
          } else {
              setTimeout(performDispatch, 600);
          }
      }
    }

    let executingBonuses = new Set<string>();

    async function handleBonusClick(rowIndex: number, colIndex: number, slotIndex: number) {
        
        const bonus = pendingBonuses.find(b => 
            b.sourceRow === rowIndex && 
            b.sourceCol === colIndex && 
            b.cubeSlot === slotIndex
        );

        if (!bonus) return;

        // 1. Mark as executing (triggers animation in UI)
        executingBonuses.add(bonus.id);
        executingBonuses = executingBonuses; // Trigger reactivity

        // 2. Wait for animation
        // @ts-ignore
        if (!window.E2E_TEST) {
             await new Promise(r => setTimeout(r, 600));
        }

        // 3. Resolve State (Store updates persistence)
        store.dispatch(resolveBonus({ bonusId: bonus.id })); 

        // 4. Cleanup UI state
        executingBonuses = executingBonuses;
    }
    


</script>

<div
  class="table-top"
  data-transport-status={repositoryStatus}
  style:--rows={rows}
  style:--cols={cols}
  style:--vertical-card-count={Math.max(cols, rules.OFFER_SIZE)}
  style:--row-depth={(1.4 * (rows + 1)).toFixed(1)}
>
  <!-- Board stage reserves the offer strip; the grid itself is rotated below. -->
  <div class="board-container">
    {#if rows && cols}
      <div class="game-layout">
        
        <!-- Top Left Spacer -->
        <!-- Top Left Spacer / Turn Indicator -->
        <div class="header-cell spacer">
            <div class="turn-indicator" 
                 class:red-turn={$gameState.game.currentTurn === 'red'} 
                 class:yellow-turn={$gameState.game.currentTurn === 'yellow'}
                 class:bonus-active={pendingBonuses.length > 0}>
                {#if pendingBonuses.length > 0}
                    BONUS ACTIONS
                {:else}
                    {$gameState.game.currentTurn.toUpperCase()} TURN
                {/if}
            </div>
        </div>
        
        <!-- Column Headers (Top) -->
        {#each colHeaders as header, i}
          <div class="header-cell top-header">
             <div class="population-badge">
                 {@html MeepleIcon(header.owner || 'gray')}
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
                    {@html MeepleIcon(rowHeaders[rowIndex].owner || 'gray')} 
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
                     <div
                       class="played-card"
                       class:needs-attention={pendingBonuses.some(b => b.sourceRow === rowIndex && b.sourceCol === colIndex)}
                     >
                         <CardDisplay 
                             card={cell} 
                             activeBonusSlots={pendingBonuses.filter(b => b.sourceRow === rowIndex && b.sourceCol === colIndex).map(b => b.cubeSlot)}
                             executingBonusSlots={pendingBonuses.filter(b => b.sourceRow === rowIndex && b.sourceCol === colIndex && executingBonuses.has(b.id)).map(b => b.cubeSlot)}
                             completedBonusSlots={cell.completedBonuses || []}
                             on:bonusClick={(e) => handleBonusClick(rowIndex, colIndex, e.detail.slotIndex)}
                         />
                     </div>
                  {/if}
                 </div>
             {/each}
        {/each}
      </div>
    {/if}
  </div>

  <!-- QR Zones & Face Down Cards -->
  <!-- QR Zones & Face Down Cards -->
  {#if gameId && repositoryStatus !== 'connecting' && repositoryStatus !== 'error'}
      {#each ['top', 'bottom', 'left', 'right'] as edge (edge)}
          {@const player = players.find(p => p.edge === edge)}
          <!-- QR Code (Only if not connected) -->
          {#if player?.type === 'human' && !connectedPlayers[player.color]}
             <div class="qr-zone {edge}"> 
                 <PlayerQR 
                     url={`${window.location.origin}${baseUrl}#/hand?game=${gameId}&color=${player.color}`}
                     label={`${player.color.toUpperCase()} JOIN`}
                     color={player.color === 'yellow' ? '#ffd700' : '#ff4d4d'} 
                 />
             </div>
          {/if}
    
          <!-- Face Down Card (If connected and has selection) -->
          {@const pSel = player ? controllerSelections[player.color] : null}
          {#if player && connectedPlayers[player.color] && pSel && pSel.playCardId && pSel.payCardId}
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
        class:ai-controlled={animatingCard.controlledByAI}
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

  {#if aiPresentation}
      <div
        class="ai-action-feedback"
        data-stage={aiPresentation.stage}
        style:--ai-color={aiPresentation.color === 'yellow' ? '#ffd700' : '#ff4d4d'}
      >
          <div class="ai-action-label">{aiActionLabel(aiPresentation)}</div>

          {#if aiPresentation.playCard && aiPresentation.payCard && aiPresentation.stage.startsWith('repair')}
              <div class="ai-repair-choice {aiPresentation.edge}" class:card-in-flight={aiPresentation.stage === 'repair-flight'}>
                  <div class="play-choice">
                      <span>PLAY</span>
                      <div class="choice-card"><CardDisplay card={aiPresentation.playCard} /></div>
                  </div>
                  <div class="pay-choice">
                      <span>PAY</span>
                      <div class="choice-card"><CardDisplay card={aiPresentation.payCard} /></div>
                  </div>
              </div>
          {/if}
      </div>
  {/if}

  {#each aiSalvageFlights as flight, index (flight.card.id)}
      <div
        class="ai-salvage-card"
        style:--start-x="{flight.startRect.left}px"
        style:--start-y="{flight.startRect.top}px"
        style:--end-x="{flight.endRect.left}px"
        style:--end-y="{flight.endRect.top}px"
        style:--flight-delay="{index * 120}ms"
      >
          <CardDisplay card={flight.card} />
      </div>
  {/each}

  <!-- Static Overlay Elements (Offer) -->
  <div class="offer-overlay">
      <Offer
        aiSelectedIds={aiPresentation?.selectedCardIds ?? []}
        aiLatestSelectedId={aiPresentation?.latestSelectedCardId ?? null}
        aiActive={Boolean(aiPresentation)}
      />
  </div>

  {#if isE2E}
      <E2EHandDisplay />
  {/if}
</div>


<style>
  .table-top {
      position: relative;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #1a1a1a;
      --table-card-width: min(
          calc((100vh - 96px) / var(--vertical-card-count)),
          calc((100vw - 150px) / var(--row-depth))
      );
      --table-card-height: calc(var(--table-card-width) * 1.4);
      --table-header-size: 56px;
      --table-gap: 6px;
      --offer-depth: calc(var(--table-card-height) + 52px);
  }

  .board-container {
    position: absolute;
    inset: 0 8px 0 var(--offer-depth);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* The grid has one header row/column plus the configured board dimensions. */
  .game-layout {
    display: grid;
    /* First col is row header, Rest are game cols */
    grid-template-columns: var(--table-header-size) repeat(var(--cols), var(--table-card-width));
    /* First row is col header, Rest are game rows */
    grid-template-rows: var(--table-header-size) repeat(var(--rows), var(--table-card-height));
    gap: var(--table-gap);
    transform: rotate(90deg);
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
    outline: 2px dashed rgba(255,255,255,0.1);
    outline-offset: -2px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .cell:hover {
      background: rgba(255, 255, 255, 0.05);
      outline-color: rgba(255,255,255,0.2);
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
      inset: 0 auto 0 8px;
      width: var(--offer-depth);
      z-index: 40;
      display: flex;
      align-items: center;
      justify-content: center;
  }

  /* Face Down Card at Edges */
  .face-down-card {
      position: absolute;
      width: var(--table-card-width);
      height: var(--table-card-height);
      z-index: 60;
      /* Animation for appearance */
      animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  
  .face-down-card img {
      display: block;
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
      outline-color: rgba(255, 255, 255, 0.4);
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
      from { opacity: 0; }
      to { opacity: 1; }
  }

  .ai-action-feedback {
      position: absolute;
      inset: 0;
      z-index: 90;
      pointer-events: none;
  }

  .ai-action-label {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 16px;
      border: 2px solid var(--ai-color);
      border-radius: 999px;
      background: rgba(18, 18, 18, 0.94);
      color: var(--ai-color);
      box-shadow: 0 0 18px color-mix(in srgb, var(--ai-color) 65%, transparent);
      font-size: 0.85rem;
      font-weight: 900;
      letter-spacing: 0.12em;
      white-space: nowrap;
      animation: ai-label-arrival 0.9s ease both;
  }

  .ai-repair-choice {
      position: absolute;
      display: flex;
      gap: 12px;
      filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.75));
  }

  .ai-repair-choice.top {
      top: 58px;
      left: 50%;
      transform: translateX(-50%);
  }

  .ai-repair-choice.bottom {
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
  }

  .ai-repair-choice.left {
      left: 20px;
      top: 50%;
      transform: translateY(-50%);
  }

  .ai-repair-choice.right {
      right: 20px;
      top: 50%;
      transform: translateY(-50%);
  }

  .play-choice,
  .pay-choice {
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: center;
      color: white;
      font-size: 0.75rem;
      font-weight: 900;
      letter-spacing: 0.12em;
  }

  .choice-card {
      width: var(--table-card-width);
      height: var(--table-card-height);
      border-radius: 6%;
      outline: 3px solid var(--ai-color);
      box-shadow: 0 0 18px var(--ai-color);
      animation: ai-choice-reveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .pay-choice .choice-card {
      animation-delay: 0.24s;
  }

  .ai-repair-choice.card-in-flight .play-choice {
      visibility: hidden;
  }

  @keyframes ai-label-arrival {
      from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
      35% { opacity: 1; }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @keyframes ai-choice-reveal {
      from { opacity: 0; transform: translateY(-32px) rotateY(90deg); }
      45% { opacity: 1; }
      to { opacity: 1; transform: translateY(0) rotateY(0); }
  }


  /* Flying Card Animation */
  .flying-card {
      position: absolute;
      left: 0;
      top: 0;
      width: var(--table-card-width);
      height: var(--table-card-height);
      z-index: 100;
      perspective: 1000px;
      pointer-events: none;
      
      /* Identify start and end via vars, animate via keyframes */
      animation: flyAndFlip 0.6s ease-in-out forwards;
  }

  .flying-card.ai-controlled,
  .flying-card.ai-controlled .flipper {
      animation-duration: 1.6s;
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
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
          transform: translate(var(--start-x), var(--start-y));
      }
      50% {
          transform: translate(calc(var(--start-x) + (var(--end-x) - var(--start-x)) * 0.5), calc(var(--start-y) + (var(--end-y) - var(--start-y)) * 0.5));
      }
      100% {
          transform: translate(var(--end-x), var(--end-y));
      }
  }

  @keyframes flipOnly {
      0% { transform: rotateY(0deg); }
      100% { transform: rotateY(180deg); }
  }

  .ai-salvage-card {
      position: absolute;
      left: 0;
      top: 0;
      width: var(--table-card-width);
      height: var(--table-card-height);
      z-index: 100;
      pointer-events: none;
      filter: drop-shadow(0 8px 14px rgba(0, 0, 0, 0.75));
      animation: ai-salvage-flight 1.6s cubic-bezier(0.4, 0, 0.2, 1) var(--flight-delay) both;
  }

  @keyframes ai-salvage-flight {
      0% {
          opacity: 1;
          transform: translate(var(--start-x), var(--start-y));
      }
      75% { opacity: 1; }
      100% {
          opacity: 0.25;
          transform: translate(var(--end-x), var(--end-y));
      }
  }

  @media (prefers-reduced-motion: reduce) {
      .ai-action-label,
      .choice-card,
      .flying-card.ai-controlled,
      .flying-card.ai-controlled .flipper,
      .ai-salvage-card {
          animation-duration: 0.01ms;
          animation-delay: 0ms;
      }
  }

  .played-card {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
  }

  .played-card.needs-attention {
      position: relative;
      z-index: 5;
      border-radius: 6px;
      outline: 3px solid #ffd700;
      box-shadow: 0 0 12px 4px #ffd700, inset 0 0 8px rgba(255, 255, 255, 0.8);
      animation: attention-glow 1.2s ease-in-out infinite;
  }

  @keyframes attention-glow {
      50% {
          box-shadow: 0 0 20px 8px #ffd700, inset 0 0 12px white;
      }
  }
  
  .played-card img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      border-radius: 4px;
      /* Remove drop shadow for placed cards, or keep shallow? */
  }

</style>

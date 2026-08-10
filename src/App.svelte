<script lang="ts">
  import { onMount } from 'svelte';
  import { gameState } from './lib/redux-svelte';
  import { store } from './lib/store';
  import { startGame } from './lib/gameSlice';
  import { loadCards, type CardData } from './lib/cardLoader';
  import {
    BUNDLED_CARD_SET_ID,
    cardsFromSet,
    getActiveCardSetId,
    loadCardSet,
    setActiveCardSetId,
  } from './lib/card-set-repository';
  import { initializeFirebase } from './lib/firebase';
  import { getGameSeed } from './lib/random';
  import { settingsStore } from './lib/settingsStore';
  
  import Lobby from './components/Lobby.svelte';
  import Board from './components/Board.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import CardsModal from './components/CardsModal.svelte';
  import GameOver from './components/GameOver.svelte';

  $: phase = $gameState.game.phase;

  let showSettings = false;
  let showCards = false;

  let deck: any[] = [];
  let headerDeck: any[] = [];

  function installCards(cardsData: CardData[]) {
      // Sort deterministically to ensure seeding works consistently
      const sortedCards = [...cardsData].sort((a, b) => a.background.localeCompare(b.background));

      // Filter for module cards (deck)
      deck = sortedCards
        .filter(c => c.background.toLowerCase().includes('module'))
        .map((c, i) => ({ 
            ...c, 
            id: `card_${i}`
        }));

      // Filter for start cards (headers)
      headerDeck = sortedCards
        .filter(c => c.background.toLowerCase().includes('start'))
        .map((c, i) => ({ ...c, id: `start_${i}` }));
  }

  onMount(async () => {
      const bundledCards = await loadCards();
      const activeSetId = getActiveCardSetId();
      if (activeSetId === BUNDLED_CARD_SET_ID) {
          installCards(bundledCards);
          return;
      }

      try {
          const { db } = await initializeFirebase();
          installCards(cardsFromSet(await loadCardSet(db, activeSetId)));
      } catch (error) {
          console.warn('Falling back to bundled cards:', error);
          setActiveCardSetId(BUNDLED_CARD_SET_ID);
          installCards(bundledCards);
      }
  });

  function handleCardSetSelection(event: CustomEvent<{ cards: CardData[] }>) {
      installCards(event.detail.cards);
  }

  function handleSettings() {
      showSettings = true;
  }

  function handleCardsRequest() {
      showCards = true;
  }

  function closeSettings() {
      showSettings = false;
  }

  function start() {
      // Dispatch startGame with loaded deck
      if (deck.length > 0) {
          const seed = getGameSeed(window.location.search);

          store.dispatch(startGame({ 
            deck: deck,
            headers: headerDeck,
            seed,
            settings: { ...$settingsStore },
          }));
      } else {
          console.error("Deck not loaded yet!");
      }
  }

  // Icons

</script>

<main>
  {#if phase === 'lobby'}
    <Lobby on:requestSettings={handleSettings} on:startGame={start} />
  {:else if phase === 'playing'}
    <Board />
  {:else if phase === 'game_over'}
    <GameOver on:playAgain={() => phase = 'lobby'} />
  {/if}

  {#if showSettings}
    <SettingsModal 
        on:close={() => showSettings = false} 
        on:openCards={() => { showSettings = false; showCards = true; }} 
    />
  {/if}

  {#if showCards}
    <CardsModal
        on:close={() => showCards = false}
        on:selectCardSet={handleCardSetSelection}
    />
  {/if}
</main>

<style>
  main {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background-color: #1a1a1a;
  }
</style>

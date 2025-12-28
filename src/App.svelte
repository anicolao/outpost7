<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { gameState } from './lib/redux-svelte';
  import { store } from './lib/store';
  import { startGame, type Card } from './lib/gameSlice';
  import { loadCards } from './lib/cardLoader';
  import { settingsStore } from './lib/settingsStore';
  
  import Lobby from './components/Lobby.svelte';
  import Board from './components/Board.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import CardsModal from './components/CardsModal.svelte';

  $: phase = $gameState.game.phase;

  const dispatch = createEventDispatcher();
  
  let showSettings = false;
  let showCards = false;

  let deck: any[] = [];
  let headerDeck: any[] = [];

  onMount(async () => {
      const cardsData = await loadCards();
      
      // Filter for module cards (deck)
      deck = cardsData
        .filter(c => c.background.toLowerCase().includes('module'))
        .map((c, i) => ({ 
            ...c, 
            id: `card_${i}`,
            // Parse cost from text_module_resource_1 (e.g. "3" -> 3)
            cost: parseInt(c.text_module_resource_1 || '0', 10)
        }));

      // Filter for start cards (headers)
      headerDeck = cardsData
        .filter(c => c.background.toLowerCase().includes('start'))
        .map((c, i) => ({ ...c, id: `start_${i}` }));
  });

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
          store.dispatch(startGame({ 
        rows: $settingsStore.GRID_ROWS, 
        cols: $settingsStore.GRID_COLS,
        deck: deck,
        headers: headerDeck
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
  {/if}

  {#if showSettings}
    <SettingsModal 
        on:close={() => showSettings = false} 
        on:openCards={() => { showSettings = false; showCards = true; }} 
    />
  {/if}

  {#if showCards}
    <CardsModal on:close={() => showCards = false} />
  {/if}
</main>

<style>
  main {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background-color: #1a1a1a;
    position: relative;
  }
</style>

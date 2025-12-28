<script lang="ts">
  import { gameState } from './lib/redux-svelte';
  import Lobby from './components/Lobby.svelte';
  import Board from './components/Board.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import CardsModal from './components/CardsModal.svelte';

  $: phase = $gameState.game.phase;

  let showSettings = false;
  let showCards = false;

  // Icons

</script>

<main>
  {#if phase === 'lobby'}
    <Lobby on:requestSettings={() => showSettings = true} />
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

<script lang="ts">
  import { gameState } from './lib/redux-svelte';
  import Lobby from './components/Lobby.svelte';
  import Board from './components/Board.svelte';

  $: phase = $gameState.game.phase;
</script>

<main>
  {#if phase === 'lobby'}
    <Lobby />
  {:else if phase === 'playing'}
    <Board />
  {/if}
</main>

<style>
  main {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    background-color: #1a1a1a;
  }
</style>

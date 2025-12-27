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
  const GearIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
</script>

<main>
  {#if phase === 'lobby'}
    <Lobby />
  {:else if phase === 'playing'}
    <Board />
  {/if}

  <div class="global-controls">
      <button class="nav-btn" onclick={() => showCards = true} title="View Cards">
        Cards...
      </button>
      <button class="nav-btn icon-only" onclick={() => showSettings = true} title="Settings">
        {@html GearIcon}
      </button>
  </div>

  {#if showSettings}
    <SettingsModal on:close={() => showSettings = false} />
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

  .global-controls {
    position: absolute;
    top: 1rem;
    right: 1rem;
    display: flex;
    gap: 0.8rem;
    z-index: 50;
  }

  .nav-btn {
    background: rgba(30,30,30,0.8);
    border: 1px solid rgba(255,255,255,0.2);
    color: #eee;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.2s;
    backdrop-filter: blur(4px);
  }

  .nav-btn:hover {
    background: rgba(50,50,50,0.9);
    border-color: rgba(255,255,255,0.5);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }

  .nav-btn.icon-only {
    padding: 0.5rem;
  }
</style>

<script lang="ts">
  import { gameState } from '../lib/redux-svelte';
  import { store } from '../lib/store';
  import { addPlayer, removePlayer, startGame, type Edge, type PlayerColor } from '../lib/gameSlice';
  import { fade } from 'svelte/transition';

  // Derived state from store
  $: players = $gameState.game.players;
  $: canStart = players.length === 2;

  const EDGES: Edge[] = ['bottom', 'left', 'top', 'right'];
  const COLORS: PlayerColor[] = ['red', 'yellow'];

  function getPlayerAt(edge: Edge) {
    return players.find(p => p.edge === edge);
  }

  function getAvailableColors() {
    const taken = players.map(p => p.color);
    return COLORS.filter(c => !taken.includes(c));
  }

  let selectingStore: Edge | null = null; // Track which edge is selecting color

  function handleAddClick(edge: Edge) {
      selectingStore = edge;
  }

  function selectColor(edge: Edge, color: PlayerColor) {
      store.dispatch(addPlayer({ edge, color }));
      selectingStore = null;
  }



  function handleRemove(edge: Edge) {
    store.dispatch(removePlayer(edge));
  }

  function handleStart() {
    store.dispatch(startGame());
  }

  // Icons
  const PlusIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
  const PlayIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  const UserIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const XIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

</script>

<div class="lobby-container">
  <!-- Center Play Button -->
  <div class="center-stage">
    <h1>Outpost Seven</h1>
    {#if canStart}
      <button class="play-btn" in:fade onclick={handleStart}>
        {@html PlayIcon}
      </button>
    {:else}
      <div class="waiting-msg" in:fade>
        Waiting for {2 - players.length} players...
      </div>
    {/if}
  </div>

  <!-- Edges -->
  {#each EDGES as edge}
    {@const player = players.find(p => p.edge === edge)}
    <div class="edge-control {edge}" class:occupied={!!player} style:--color={player?.color === 'red' ? '#ff4d4d' : '#ffd700'}>
      <div class="content-rotator">
        {#if player}
            <div class="player-token" in:fade>
              {@html UserIcon}
              <button class="remove-btn" onclick={() => handleRemove(edge)}>
                {@html XIcon}
              </button>
            </div>
            <span class="player-label">{player.color.toUpperCase()}</span>
        {:else}
            {@const available = getAvailableColors()}
            {#if selectingStore === edge}
                <div class="color-picker" transition:fade>
                  {#each available as color}
                    <button class="color-btn" style:background-color={color === 'red' ? '#ff4d4d' : '#ffd700'} onclick={() => selectColor(edge, color)} title={color}>
                    </button>
                  {/each}
                  <button class="close-picker" onclick={() => selectingStore = null}>{@html XIcon}</button>
                </div>
            {:else}
               <button class="add-btn" onclick={() => handleAddClick(edge)} disabled={players.length >= 2 || available.length === 0}>
                   {@html PlusIcon}
               </button>
            {/if}
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .lobby-container {
    position: relative;
    width: 100%;
    height: 100vh;
    background-color: #1a1a1a;
    color: white;
    overflow: hidden;
  }

  .center-stage {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    z-index: 10;
  }

  .play-btn {
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 50%;
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    transition: transform 0.2s, background-color 0.2s;
  }

  .play-btn:hover {
    transform: scale(1.1);
    background-color: #45a049;
  }

  .waiting-msg {
    opacity: 0.6;
    font-size: 0.9rem;
    letter-spacing: 1px;
  }

  .edge-control {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }

  /* Positioning and Rotation logic via transforms */
  /* We want controls to be centered along the edge, and rotated to face inward (or outward depending on POV).
     Prompt says: "Text and controls for a player MUST be rotated to face them."
     So 'Bottom' faces 0deg (upright). 'Top' faces 180deg. 'Left' faces 90deg CW (so text runs bottom-to-top). 'Right' faces 270deg.
  */

  .bottom {
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    padding-bottom: 2rem;
  }

  .top {
    top: 0;
    left: 50%;
    transform: translateX(-50%) rotate(180deg);
    padding-bottom: 2rem; /* Becomes padding-top visually due to rotation? No, inside the container logic */
    /* Wait, if I rotate the div 180, padding-bottom is literally at the 'bottom' of the div which is now at the top of the screen. Yes. */
  }

  .left {
    left: 0;
    top: 50%;
    transform: translateY(-50%) rotate(90deg);
    padding-bottom: 2rem;
  }

  .right {
    right: 0;
    top: 50%;
    transform: translateY(-50%) rotate(-90deg);
    padding-bottom: 2rem;
  }

  /* Shared Styling */
  .add-btn {
    background: rgba(255,255,255,0.1);
    border: 2px dashed rgba(255,255,255,0.3);
    color: white;
    width: 60px;
    height: 60px;
    border-radius: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .add-btn:hover:not(:disabled) {
    background: rgba(255,255,255,0.2);
    border-color: white;
  }

  .add-btn:disabled {
    opacity: 0.2;
    cursor: not-allowed;
  }

  .player-token {
    width: 60px;
    height: 60px;
    background-color: var(--color);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: black; /* Contrast for yellow/red */
    position: relative;
    box-shadow: 0 0 15px var(--color);
  }

  .remove-btn {
    position: absolute;
    top: -10px;
    right: -10px;
    background: white;
    color: black;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  }

  .player-label {
    display: block;
    margin-top: 0.5rem;
    font-size: 0.8rem;
    font-weight: bold;
    color: var(--color);
    text-shadow: 0 0 10px rgba(0,0,0,0.5);
  }
  .color-picker {
    display: flex;
    gap: 8px;
    background: rgba(0,0,0,0.8);
    padding: 8px;
    border-radius: 12px;
    align-items: center;
  }

  .color-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid white;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .color-btn:hover {
    transform: scale(1.1);
  }

  .close-picker {
    width: 24px;
    height: 24px;
    background: transparent;
    border: none;
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>

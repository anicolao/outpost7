<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { gameState } from '../lib/redux-svelte';
  import { store } from '../lib/store';
  import { resetGame } from '../lib/gameSlice';

  const dispatch = createEventDispatcher();

  $: winner = $gameState.game.winner;
  $: scores = $gameState.game.scores;

  function handlePlayAgain() {
    store.dispatch(resetGame());
    dispatch('playAgain');
  }
</script>

<div class="game-over-overlay">
  <div class="game-over-modal">
    <h1>Game Over</h1>
    
    <div class="result">
        {#if winner === 'draw'}
            <h2 class="draw">It's a Draw!</h2>
        {:else}
            <h2 class:red={winner === 'red'} class:yellow={winner === 'yellow'}>
                {winner?.toUpperCase()} Wins!
            </h2>
        {/if}
    </div>

    <div class="scores">
        <div class="score red-score">
            <span>Red Population</span>
            <strong>{scores.red}</strong>
        </div>
        <div class="score yellow-score">
            <span>Yellow Population</span>
            <strong>{scores.yellow}</strong>
        </div>
    </div>

    <button on:click={handlePlayAgain}>Play Again</button>
  </div>
</div>

<style>
  .game-over-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .game-over-modal {
    background: #1e1e1e;
    padding: 3rem;
    border-radius: 12px;
    text-align: center;
    color: white;
    box-shadow: 0 0 20px rgba(0,0,0,0.5);
    border: 1px solid #333;
    min-width: 400px;
  }

  h1 {
    font-size: 3rem;
    margin-bottom: 2rem;
    color: #eee;
  }

  .result h2 {
    font-size: 2.5rem;
    margin-bottom: 2rem;
  }

  .red { color: #ff4d4d; }
  .yellow { color: #ffd700; }
  .draw { color: #aaa; }

  .scores {
    display: flex;
    justify-content: space-around;
    margin-bottom: 3rem;
    gap: 2rem;
  }

  .score {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .score span {
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #888;
  }

  .score strong {
    font-size: 3rem;
  }

  .red-score strong { color: #ff4d4d; }
  .yellow-score strong { color: #ffd700; }

  button {
    background: #444;
    color: white;
    border: none;
    padding: 1rem 2rem;
    font-size: 1.2rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  button:hover {
    background: #555;
    transform: translateY(-2px);
  }
</style>

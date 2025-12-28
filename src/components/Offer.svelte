<script lang="ts">
  import { gameState } from '../lib/redux-svelte';
  import Card from './Card.svelte';
  
  $: offer = $gameState.game.offer;
</script>

<div class="offer-container">
  <h3>Offer</h3>
  <div class="cards">
    {#each offer as card}
      <div class="card-wrapper">
        <Card {card} />
      </div>
    {/each}
  </div>
</div>

<style>
  .offer-container {
    position: absolute;
    left: 20px; /* Spacing from edge */
    top: 50%;
    transform: translateY(-50%) rotate(90deg);
    /* transform-origin: center center; Default is center */
    background: rgba(0, 0, 0, 0.5);
    padding: 10px;
    border-radius: 8px;
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
  }

  .cards {
    display: flex;
    flex-direction: row; /* Side by side */
    gap: 10px;
  }

  .card-wrapper {
    width: 60px;
    height: 90px; /* Aspect 2.5/3.5 matches card component roughly? Card is aspect based width. */
    /* Card component is width:100% of parent. Parent is 60px wide. */
  }
</style>

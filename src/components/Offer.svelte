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
    left: 0;
    top: 50%;
    transform: translateY(-50%) rotate(-90deg);
    transform-origin: left center;
    background: rgba(0, 0, 0, 0.5);
    padding: 10px;
    border-radius: 8px;
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Adjust positioning after rotation */
    margin-left: 20px; 
  }

  .cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .card-wrapper {
    width: 60px;
    height: 90px; /* Aspect 2.5/3.5 matches card component roughly? Card is aspect based width. */
    /* Card component is width:100% of parent. Parent is 60px wide. */
  }
</style>

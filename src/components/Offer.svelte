<script lang="ts">
  import { gameState } from '../lib/redux-svelte';
  
  $: offer = $gameState.game.offer;
</script>

<div class="offer-container">
  <h3>Offer</h3>
  <div class="cards">
    {#each offer as card}
      <div class="card">
        <span class="type">{card.type}</span>
        <span class="cost">{card.cost}</span>
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
    gap: 10px;
  }

  .card {
    width: 60px;
    height: 90px;
    background: white;
    color: black;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    border-radius: 4px;
    border: 1px solid #ccc;
  }

  .type {
    font-size: 10px;
    font-weight: bold;
  }
  
  .cost {
    font-size: 14px;
    color: red;
  }
</style>

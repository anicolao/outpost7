<script lang="ts">
  import { gameState } from '../lib/redux-svelte';
  import CardDisplay from './Card.svelte';
  
  $: currentTurn = $gameState.game.currentTurn;
  $: hand = $gameState.game.hands[currentTurn] || [];
</script>

<div class="e2e-hand-display" class:red={currentTurn === 'red'} class:yellow={currentTurn === 'yellow'}>
    <div class="label">{currentTurn.toUpperCase()} HAND (E2E VIEW)</div>
    <div class="cards">
        {#each hand as card (card.id)}
            <div class="card-wrapper">
                <CardDisplay card={card} />
            </div>
        {/each}
    </div>
</div>

<style>
    .e2e-hand-display {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        padding: 10px;
        border-top-left-radius: 10px;
        border-top-right-radius: 10px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        border: 2px solid #555;
    }

    .e2e-hand-display.red { border-color: #ff4d4d; }
    .e2e-hand-display.yellow { border-color: #ffd700; }

    .label {
        color: white;
        font-weight: bold;
        margin-bottom: 5px;
        font-size: 0.8rem;
    }

    .cards {
        display: flex;
        gap: 5px;
    }

    .card-wrapper {
        width: 60px; /* Small preview */
        height: 84px;
    }
</style>

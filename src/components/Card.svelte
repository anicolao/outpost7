<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { getAssetUrl, type CardData } from '../lib/cardLoader';

  export let card: CardData;
  export let activeBonusSlots: number[] = []; // Slot indices (1-6) that are clickable
  export let executingBonusSlots: number[] = []; // Slot indices that are currently animating
  export let completedBonusSlots: number[] = []; // Slot indices that have finished executing

  const dispatch = createEventDispatcher();

  function handleCubeClick(slotIndex: number) {
      if (activeBonusSlots.includes(slotIndex)) {
          dispatch('bonusClick', { slotIndex });
      }
  }
</script>

<div class="card-preview">
  <!-- Background Base -->
  <img
    src={getAssetUrl(card.background)}
    class="card-bg"
    alt="Background"
  />

  <!-- Top Left: Value and Resource -->
  {#if card.text_module_resource_1}
  <div class="value-container">
    <span class="card-value">{card.text_module_resource_1}</span>
    <div class="resource-icon-wrapper">
      <img
        src={getAssetUrl(card.module_resource_1)}
        class="resource-icon"
        alt="Resource"
      />
    </div>
  </div>
  {/if}

  <!-- Right Side: Cube Slots -->
  <div class="slots-container">
    {#each [card.cube_1, card.cube_2, card.cube_3, card.cube_4, card.cube_5, card.cube_6] as cube, i}
      {#if cube}
        {@const slotIndex = i + 1}
        <div class="slot-wrapper" class:bonus={cube.includes('bonus')}>
            <img
            src={getAssetUrl(cube)}
            class="slot-icon"
            alt={`Slot ${slotIndex}`}
            />
            
            <!-- Standard Player Cube -->
            {#if card.cubes && i < card.cubes && card.owner}
                <div 
                  class="player-cube" 
                  class:red={card.owner === 'red'} 
                  class:yellow={card.owner === 'yellow'}
                  class:interactive={activeBonusSlots.includes(slotIndex)}
                  class:executing={executingBonusSlots.includes(slotIndex)}
                  class:completed={completedBonusSlots.includes(slotIndex)}
                  on:click|stopPropagation={() => handleCubeClick(slotIndex)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => e.key === 'Enter' && handleCubeClick(slotIndex)}
                ></div>
            {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .card-preview {
    width: 100%;
    aspect-ratio: 2.5/3.5;
    position: relative;
    overflow: hidden;
    border-radius: 6%;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
    background: #111;
  }

  .card-bg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 0;
  }

  .value-container {
    position: absolute;
    top: 4%;
    left: 4%;
    width: 25%;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 10;
  }

  .card-value {
    font-size: 200%; /* Relative to container/parent font size */
    font-weight: 900;
    color: black;
    -webkit-text-stroke: 1px white;
    line-height: 1;
    margin-bottom: -3px;
    font-family: sans-serif;
    text-align: center;
  }

  .resource-icon-wrapper {
    width: 80%;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .resource-icon {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .slots-container {
    position: absolute;
    top: 6%;
    right: 8%;
    width: 30%;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 10;
  }

  .slot-wrapper {
      position: relative;
      width: 100%;
      /* Remove aspect-ratio: 1 to fix excess vertical space */
      display: flex;
      justify-content: center;
  }

  .slot-icon {
    width: 100%;
    /* Remove height 100% to allow natural height */
    object-fit: contain;
    display: block; /* Remove inline whitespace */
  }

  .player-cube {
      position: absolute;
      width: 25%;
      height: 50%;
      border-radius: 2px;
      box-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.4);
      
      /* User Request: 25%w, 50%h, 20%t, 60%l */
      top: 20%;
      left: 60%;
      transition: transform 0.3s ease-out, box-shadow 0.3s;
  }

  /* Bonus Slots: Top 20%, Left 10% */
  .slot-wrapper.bonus .player-cube {
      top: 20%;
      left: 10%;
  }

  .player-cube.red {
      background: linear-gradient(135deg, #ff6666, #cc0000);
      border-color: #ff9999;
  }

  .player-cube.yellow {
      background: linear-gradient(135deg, #ffeb3b, #fbc02d);
      border-color: #fff176;
  }

  /* Interactive States */
  .player-cube.interactive {
      cursor: pointer;
      box-shadow: 0 0 8px #ffd700, inset 0 0 4px #fff;
      border-color: #ffd700;
      animation: pulse-glow 1.5s infinite;
  }

  .player-cube.executing {
      transform: translateX(200%); /* Slide Right */
      opacity: 0;
      transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.5s 0.1s;
  }

  .player-cube.completed {
      transform: translateX(200%); /* Slide Right and Stay */
      opacity: 1; /* Stay Visible */
      box-shadow: none;
      animation: none;
      border-color: rgba(255,255,255,0.4);
  }

  @keyframes pulse-glow {
      0% { box-shadow: 0 0 5px #ffd700; }
      50% { box-shadow: 0 0 12px #ffd700, 0 0 5px #fff; }
      100% { box-shadow: 0 0 5px #ffd700; }
  }
</style>

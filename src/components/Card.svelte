<script lang="ts">
  import { getAssetUrl, type CardData } from '../lib/cardLoader';

  export let card: CardData;
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
        <div class="slot-wrapper" class:bonus={cube.includes('bonus')}>
            <img
            src={getAssetUrl(cube)}
            class="slot-icon"
            alt={`Slot ${i + 1}`}
            />
            {#if card.cubes && i < card.cubes && card.owner}
                <div class="player-cube" class:red={card.owner === 'red'} class:yellow={card.owner === 'yellow'}></div>
            {/if}
        </div>
      {/if}
    {/each}
  </div>
</div>

<style>
  .card-preview {
    width: 100%;
    aspect-ratio: 0.76;
    position: relative;
    overflow: hidden;
    border-radius: 6%;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
    background: #111;
  }

  /* ... */

  .slot-wrapper {
      position: relative;
      width: 100%;
      /* Remove aspect-ratio: 1 */
      display: flex; /* Ensure tight fit */
      justify-content: center;
  }

  .slot-icon {
    width: 100%;
    /* wrapper fits width, height is auto */
    object-fit: contain;
    display: block; /* Remove inline whitespace */
  }

  .player-cube {
      position: absolute;
      width: 35%;
      height: 50%;
      border-radius: 2px;
      box-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.4);
      
      /* Default: Top 7.5%, Centered Left 32.5% */
      top: 7.5%;
      left: 32.5%;
  }

  /* Bonus Slots: Top 30%, Left 5% */
  .slot-wrapper.bonus .player-cube {
      top: 30%;
      left: 5%;
  }

  .player-cube.red {
      background: linear-gradient(135deg, #ff6666, #cc0000);
      border-color: #ff9999;
  }

  .player-cube.yellow {
      background: linear-gradient(135deg, #ffeb3b, #fbc02d);
      border-color: #fff176;
  }
</style>

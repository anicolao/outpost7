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
    /* Match Board Grid Aspect Ratio (0.76) for consistency */
    aspect-ratio: 0.76;
    position: relative;
    overflow: hidden;
    border-radius: 6%;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.4);
    background: #111;
  }

  /* ... (Background styles skipped) ... */

  /* ... */
  
  .player-cube {
      position: absolute;
      width: 35%;
      height: 50%; /* Adjusted height */
      border-radius: 2px;
      box-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      border: 1px solid rgba(255,255,255,0.4);
      
      /* Default (one-cube/empty slots): Top 7.5%, Centered Left 32.5% */
      top: 7.5%;
      left: 32.5%;
  }

  /* Bonus Slots (2-space actions): Top 30%, Left 5% - User instruction overrides or additions?
     User said "top should now be @ 7.5%". 
     This likely implies the previous "55%" was wrong for standard slots, or generally.
     I will start with standard slots.
     For Bonus slots, 7.5% might be too high if it's supposed to sit in a specific spot?
     But "For one-cube spaces, 55% positions the cube correctly" was the PREVIOUS comment.
     Current comment: "for cubes top should now be @ 7.5%". 
     Maybe they mean "For the CUBE inside the slot"?
     I'll apply to standard. For bonus, I'll keep the special positioning unless it looks wrong, 
     but 7.5% is top-aligned.
     I'll apply 7.5% primarily to standard as that's the "default".
     If "bonus" needs adjustment, I'll stick to 30% or adjust if needed.
     Actually, "top: 30% ... positions correctly for 2-space". 
     "For one-cube spaces... 55%".
     NEW: "top should now be @ 7.5%". 
     This contradicts the 55%. I will update the default (one-cube) to 7.5%.
  */

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

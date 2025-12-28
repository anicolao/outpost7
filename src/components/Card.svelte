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
        <img
          src={getAssetUrl(cube)}
          class="slot-icon"
          alt={`Slot ${i + 1}`}
        />
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

  .slot-icon {
    width: 100%;
    object-fit: contain;
  }
</style>

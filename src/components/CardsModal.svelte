<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { fade, scale } from "svelte/transition";
  import { loadCards, getAssetUrl, type CardData } from "../lib/cardLoader";

  const dispatch = createEventDispatcher();

  let cards: CardData[] = [];
  let loading = true;
  let error = "";

  onMount(async () => {
    try {
      cards = await loadCards();
    } catch (e) {
      error = "Failed to load cards.";
    } finally {
      loading = false;
    }
  });

  function close() {
    dispatch("close");
  }
</script>

<div class="backdrop" on:click={close} transition:fade>
  <div class="modal" on:click|stopPropagation transition:scale>
    <div class="header">
      <h2>Card Library</h2>
      <button class="close-btn" on:click={close}>&times;</button>
    </div>

    <div class="content">
      {#if loading}
        <div class="loading">Loading cards...</div>
      {:else if error}
        <div class="error">{error}</div>
      {:else}
        <div class="card-grid">
          {#each cards as card}
            <div class="card-item">
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
              <div class="card-info">
                <span>ID: {card.index}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.85);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(5px);
  }

  .modal {
    background: #2a2a2a;
    color: white;
    width: 95%;
    height: 90%;
    border-radius: 12px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #444;
  }

  .header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #444;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #333;
    flex-shrink: 0;
  }

  .header h2 {
    margin: 0;
  }

  .close-btn {
    background: none;
    border: none;
    color: #aaa;
    font-size: 2rem;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  }

  .close-btn:hover {
    color: white;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 1.5rem;
    padding-bottom: 2rem;
  }

  .card-item {
    background: transparent;
    border: none;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .card-preview {
    width: 100%;
    aspect-ratio: 2.5/3.5;
    position: relative;
    overflow: hidden;
    border-radius: 6%;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
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
    /* Using container query units could differ, but REM/EM relies on font size. 
       Let's use a large font size but clamp it or rely on `minmax` ensuring width is enough. */
    font-size: 60px;
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

  .card-info {
    font-size: 0.8rem;
    color: #888;
    margin-top: 0.5rem;
  }

  .loading,
  .error {
    text-align: center;
    margin-top: 2rem;
    font-size: 1.2rem;
  }

  .error {
    color: #ff4d4d;
  }
</style>

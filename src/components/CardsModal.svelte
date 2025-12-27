<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { loadCards, getAssetUrl, type CardData } from '../lib/cardLoader';

  const dispatch = createEventDispatcher();

  let cards: CardData[] = [];
  let loading = true;
  let error = '';

  onMount(async () => {
    try {
        cards = await loadCards();
    } catch (e) {
        error = 'Failed to load cards.';
    } finally {
        loading = false;
    }
  });

  function close() {
    dispatch('close');
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
                            <!-- Background -->
                            <img src={getAssetUrl(card.background)} alt="Card Background" class="card-bg" />
                            
                            <!-- Resource Icon (Top Left?) - The CSV defines existing visual composition roughly?
                                 Actually, the images in assets like 'blue_module_3.png' are typically FULL cards.
                                 If the CSV points to 'blue_module_3.pdf' as background and 'blue_resource.pdf' as resource, 
                                 it implies the game constructs cards via layers OR uses pre-made cards.
                                 Let's look at the filenames. 'blue_module_3.png' likely is the full card.
                                 Wait, the CSV has 'blue_module_3.pdf' as '@background'. 
                                 If 'blue_module_3.png' is the full card image, I just display that. 
                                 But there are cols for '@cube_1' etc. which are for STATE? Or printed bonuses?
                                 'bonus_add_cube.pdf' in cube_1 column implies these are Pre-Printed bonuses on the card? 
                                 Or where to place cubes? 
                                 The 'blue_module_3.png' file size is ~170KB. 
                                 Let's assume 'background' column points to the main card image.
                            -->
                             <img src={getAssetUrl(card.background)} class="card-image" alt={`Card ${card.index}`} />
                             
                             <!-- Overlay content if needed? 
                                  For the "Cards..." view, just showing the base card image is usually enough if it contains the info.
                                  The CSV describes 'text_module_resource_1' (value) etc.
                                  If the images are "bare" and we need to composite:
                                  Let's check if 'blue_module_3.png' has the number '3' on it. 
                                  Filename implies yes.
                                  So we probably just show the image from 'background' column.
                             -->
                        </div>
                        <div class="card-info">
                            <span>ID: {card.index}</span>
                            <span>Val: {card.text_module_resource_1}</span>
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
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
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

  .content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
    padding-bottom: 2rem;
  }

  .card-item {
    background: #1a1a1a;
    border-radius: 8px;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid #333;
  }

  .card-preview {
    width: 100%;
    aspect-ratio: 1; /* Approximate, cards are usually rect but let's see */
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.5rem;
  }

  .card-image {
    max-width: 100%;
    max-height: 200px;
    border-radius: 4px;
  }

  .card-info {
    font-size: 0.8rem;
    color: #aaa;
    display: flex;
    gap: 0.5rem;
  }

  .loading, .error {
    text-align: center;
    margin-top: 2rem;
    font-size: 1.2rem;
  }
  
  .error { color: #ff4d4d; }
</style>

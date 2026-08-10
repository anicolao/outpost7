<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { loadCards, getAssetUrl, type CardData } from '../lib/cardLoader';
  import {
    BUNDLED_CARD_SET_ID,
    cardsFromSet,
    createCardSet,
    getActiveCardSetId,
    listCardSets,
    setActiveCardSetId,
    type CardSetRecord,
  } from '../lib/card-set-repository';
  import { initializeFirebase } from '../lib/firebase';

  const dispatch = createEventDispatcher<{
    close: void;
    selectCardSet: { cards: CardData[] };
  }>();

  let cards: CardData[] = [];
  let bundledCards: CardData[] = [];
  let storedSets: CardSetRecord[] = [];
  let activeSetId = BUNDLED_CARD_SET_ID;
  let viewedSetId = BUNDLED_CARD_SET_ID;
  let loading = true;
  let uploading = false;
  let showImporter = false;
  let cardSetName = '';
  let cardSetSource = '';
  let error = '';

  onMount(async () => {
    try {
      const servicesPromise = initializeFirebase();
      bundledCards = await loadCards();
      const { db } = await servicesPromise;
      storedSets = await listCardSets(db);
      activeSetId = getActiveCardSetId();

      const activeSet = storedSets.find(({ id }) => id === activeSetId);
      if (activeSet) {
        cards = cardsFromSet(activeSet);
        viewedSetId = activeSet.id;
        dispatch('selectCardSet', { cards });
      } else {
        activeSetId = BUNDLED_CARD_SET_ID;
        viewedSetId = BUNDLED_CARD_SET_ID;
        setActiveCardSetId(activeSetId);
        cards = bundledCards;
      }
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Failed to load card sets.';
      cards = bundledCards;
    } finally {
      loading = false;
    }
  });

  function close() {
    dispatch('close');
  }

  function viewBundledCards() {
    error = '';
    viewedSetId = BUNDLED_CARD_SET_ID;
    cards = bundledCards;
  }

  function viewStoredSet(cardSet: CardSetRecord) {
    try {
      error = '';
      viewedSetId = cardSet.id;
      cards = cardsFromSet(cardSet);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Failed to parse this card set.';
    }
  }

  function activateSet(id: string, nextCards: CardData[]) {
    activeSetId = id;
    setActiveCardSetId(id);
    dispatch('selectCardSet', { cards: nextCards });
  }

  function activateBundledCards() {
    viewBundledCards();
    activateSet(BUNDLED_CARD_SET_ID, bundledCards);
  }

  function activateStoredSet(cardSet: CardSetRecord) {
    viewStoredSet(cardSet);
    if (!error) activateSet(cardSet.id, cards);
  }

  async function uploadCardSet() {
    uploading = true;
    error = '';
    try {
      const { auth, db } = await initializeFirebase();
      if (!auth.currentUser) throw new Error('Firebase authentication is not ready.');
      const cardSet = await createCardSet(
        db,
        auth.currentUser.uid,
        cardSetName,
        cardSetSource,
      );
      storedSets = [...storedSets, cardSet].sort((left, right) =>
        left.name.localeCompare(right.name),
      );
      viewStoredSet(cardSet);
      cardSetName = '';
      cardSetSource = '';
      showImporter = false;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Failed to upload the card set.';
    } finally {
      uploading = false;
    }
  }
</script>

<div class="backdrop" on:click={close} transition:fade>
  <div class="modal" on:click|stopPropagation transition:scale role="dialog" aria-modal="true">
    <div class="header">
      <div>
        <h2>Card Library</h2>
        <p>Review card sets and choose the deck used by the next game.</p>
      </div>
      <button class="close-btn" on:click={close} aria-label="Close card library">&times;</button>
    </div>

    {#if loading}
      <div class="loading">Loading card sets...</div>
    {:else}
      <div class="content">
        <aside class="set-browser">
          <div class="set-browser-heading">
            <h3>Card sets</h3>
            <button class="add-set-btn" on:click={() => showImporter = !showImporter}>
              {showImporter ? 'Cancel' : 'Add card set'}
            </button>
          </div>

          {#if showImporter}
            <form class="card-set-import" on:submit|preventDefault={uploadCardSet}>
              <label for="card-set-name">Card set name</label>
              <input
                id="card-set-name"
                bind:value={cardSetName}
                maxlength="80"
                placeholder="v49"
                autocomplete="off"
              />
              <label for="card-set-tsv">Card set TSV</label>
              <textarea
                id="card-set-tsv"
                bind:value={cardSetSource}
                placeholder="Paste the header row and cards from a spreadsheet"
                spellcheck="false"
              ></textarea>
              <button class="primary-btn" type="submit" disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload card set'}
              </button>
            </form>
          {/if}

          {#if error}
            <div class="error" role="alert">{error}</div>
          {/if}

          <div class="set-list">
            <div class="card-set-option" class:viewing={viewedSetId === BUNDLED_CARD_SET_ID}>
              <button class="set-summary" on:click={viewBundledCards}>
                <strong>Bundled cards</strong>
                <span>{bundledCards.length} cards</span>
              </button>
              {#if activeSetId === BUNDLED_CARD_SET_ID}
                <span class="active-badge">Active</span>
              {:else}
                <button class="use-set-btn" on:click={activateBundledCards}>Use this set</button>
              {/if}
            </div>

            {#each storedSets as cardSet (cardSet.id)}
              <div class="card-set-option" class:viewing={viewedSetId === cardSet.id}>
                <button class="set-summary" on:click={() => viewStoredSet(cardSet)}>
                  <strong>{cardSet.name}</strong>
                  <span>{cardSet.cardCount} cards</span>
                </button>
                {#if activeSetId === cardSet.id}
                  <span class="active-badge">Active</span>
                {:else}
                  <button class="use-set-btn" on:click={() => activateStoredSet(cardSet)}>
                    Use this set
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        </aside>

        <section class="card-browser" aria-label="Cards in selected set">
          <div class="card-grid">
            {#each cards as card}
              <div class="card-item">
                <div class="card-preview">
                  <img src={getAssetUrl(card.background)} class="card-bg" alt="Background" />
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
                  <div class="slots-container">
                    {#each [card.cube_1, card.cube_2, card.cube_3, card.cube_4, card.cube_5, card.cube_6] as cube, i}
                      {#if cube}
                        <img src={getAssetUrl(cube)} class="slot-icon" alt={`Slot ${i + 1}`} />
                      {/if}
                    {/each}
                  </div>
                </div>
                <div class="card-info">ID: {card.index}</div>
              </div>
            {/each}
          </div>
        </section>
      </div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
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
    padding: 0.8rem 1.25rem;
    border-bottom: 1px solid #444;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #333;
    flex-shrink: 0;
  }

  .header h2,
  .header p,
  .set-browser-heading h3 {
    margin: 0;
  }

  .header p {
    color: #bbb;
    font-size: 0.85rem;
    margin-top: 0.2rem;
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
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(250px, 300px) 1fr;
  }

  .set-browser {
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
    border-right: 1px solid #444;
    background: #242424;
  }

  .set-browser-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.8rem;
  }

  button,
  input,
  textarea {
    font: inherit;
  }

  .add-set-btn,
  .use-set-btn,
  .primary-btn {
    border: 1px solid #666;
    border-radius: 6px;
    color: white;
    cursor: pointer;
  }

  .add-set-btn,
  .use-set-btn {
    background: #444;
    padding: 0.4rem 0.6rem;
    font-size: 0.78rem;
  }

  .primary-btn {
    background: #2e7d32;
    padding: 0.55rem 0.75rem;
    font-weight: 700;
  }

  .primary-btn:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .card-set-import {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem;
    margin-bottom: 0.8rem;
    background: #181818;
    border: 1px solid #555;
    border-radius: 8px;
  }

  .card-set-import label {
    color: #ddd;
    font-size: 0.8rem;
    font-weight: 700;
  }

  .card-set-import input,
  .card-set-import textarea {
    box-sizing: border-box;
    width: 100%;
    border: 1px solid #666;
    border-radius: 5px;
    background: #111;
    color: white;
    padding: 0.5rem;
  }

  .card-set-import textarea {
    min-height: 150px;
    resize: vertical;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
  }

  .set-list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .card-set-option {
    padding: 0.65rem;
    border: 1px solid #494949;
    border-radius: 8px;
    background: #303030;
  }

  .card-set-option.viewing {
    border-color: #80cbc4;
    box-shadow: inset 3px 0 #80cbc4;
  }

  .set-summary {
    display: flex;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: white;
    cursor: pointer;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }

  .set-summary span {
    margin-top: 0.15rem;
    color: #aaa;
    font-size: 0.78rem;
  }

  .active-badge,
  .use-set-btn {
    display: inline-block;
    margin-top: 0.55rem;
  }

  .active-badge {
    padding: 0.25rem 0.55rem;
    border-radius: 999px;
    color: #b9f6ca;
    background: #1b5e20;
    font-size: 0.74rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .error {
    color: #ffcdd2;
    background: #5d1f1f;
    border: 1px solid #a94442;
    border-radius: 6px;
    padding: 0.65rem;
    margin-bottom: 0.75rem;
    font-size: 0.8rem;
  }

  .card-browser {
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1.2rem;
    padding-bottom: 1rem;
  }

  .card-item {
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
    inset: 0;
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
    font-size: clamp(28px, 4vw, 52px);
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
    font-size: 0.75rem;
    color: #999;
    margin-top: 0.4rem;
  }

  .loading {
    margin: auto;
    font-size: 1.2rem;
  }

  @media (max-width: 760px) {
    .modal {
      width: calc(100% - 16px);
      height: calc(100% - 16px);
    }

    .content {
      grid-template-columns: minmax(190px, 42%) 1fr;
    }

    .set-browser,
    .card-browser {
      padding: 0.65rem;
    }

    .card-grid {
      grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
      gap: 0.7rem;
    }
  }
</style>

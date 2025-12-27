<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { GAME_SETTINGS, SETTINGS_DESCRIPTIONS } from '../settings';

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }
</script>

<div class="backdrop" on:click={close} transition:fade>
  <div class="modal" on:click|stopPropagation transition:scale>
    <div class="header">
        <h2>Game Settings</h2>
        <button class="close-btn" on:click={close}>&times;</button>
    </div>
    
    <div class="content">
        <ul class="settings-list">
        {#each Object.entries(GAME_SETTINGS) as [key, value]}
            <li class="setting-item">
                <span class="label">{SETTINGS_DESCRIPTIONS[key as keyof typeof SETTINGS_DESCRIPTIONS] || key}</span>
                <span class="value">{value}</span>
            </li>
        {/each}
        </ul>
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
    background: rgba(0, 0, 0, 0.7);
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(5px);
  }

  .modal {
    background: #2a2a2a;
    color: white;
    width: 90%;
    max-width: 500px;
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
  }

  .header h2 {
    margin: 0;
    font-size: 1.5rem;
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
    padding: 1.5rem;
  }

  .settings-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid #444;
  }

  .setting-item:last-child {
    border-bottom: none;
  }

  .label {
    color: #ddd;
    font-size: 1rem;
  }

  .value {
    color: #4CAF50; /* Green highlight for values */
    font-weight: bold;
    font-family: monospace;
    font-size: 1.1rem;
  }
</style>

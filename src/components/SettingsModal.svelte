<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { settingsStore, SETTINGS_DESCRIPTIONS, type GameSettings } from '../lib/settingsStore';

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function updateSetting(key: keyof GameSettings, delta: number) {
      if (!$settingsStore) return;
      const current = $settingsStore[key];
      const newValue = current + delta;
      
      // Basic validation limits
      if (newValue < 0) return; 
      
      settingsStore.updateSetting(key, newValue);
  }

  function openCards() {
      dispatch('openCards');
  }
</script>

<div class="backdrop" onclick={close} transition:fade>
  <div class="modal" onclick={(e) => e.stopPropagation()} transition:scale role="dialog" aria-modal="true">
    <div class="header">
        <h2>Game Settings</h2>
        <button class="close-btn" onclick={close}>&times;</button>
    </div>
    
    <div class="content">
        <ul class="settings-list">
        {#each Object.entries($settingsStore) as [key, value]}
            <li class="setting-item">
                <div class="setting-info">
                    <span class="label">{SETTINGS_DESCRIPTIONS[key] || key}</span>
                </div>
                <div class="controls">
                    <button class="control-btn" onclick={() => updateSetting(key, -1)}>-</button>
                    <span class="value">{value}</span>
                    <button class="control-btn" onclick={() => updateSetting(key, 1)}>+</button>
                </div>
            </li>
        {/each}
        </ul>

        <div class="actions">
            <button class="action-btn" onclick={openCards}>Open Card Library...</button>
        </div>
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
    max-width: 600px;
    max-height: 80vh;
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
    overflow-y: auto;
  }

  .settings-list {
    list-style: none;
    padding: 0;
    margin: 0;
    margin-bottom: 2rem;
  }

  .setting-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
    border-bottom: 1px solid #444;
  }

  .setting-item:last-child {
    border-bottom: none;
  }

  .setting-info {
      flex: 1;
      padding-right: 1rem;
  }

  .label {
    color: #ddd;
    font-size: 1rem;
    display: block;
  }

  .controls {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: #222;
      padding: 0.25rem;
      border-radius: 8px;
  }

  .control-btn {
      background: #444;
      border: none;
      color: white;
      width: 30px;
      height: 30px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
  }

  .control-btn:hover {
      background: #555;
  }

  .control-btn:active {
      background: #666;
  }

  .value {
    color: #4CAF50;
    font-weight: bold;
    font-family: monospace;
    font-size: 1.2rem;
    min-width: 3ch;
    text-align: center;
  }

  .actions {
      display: flex;
      justify-content: center;
      padding-top: 1rem;
      border-top: 1px solid #444;
  }

  .action-btn {
      background: #333;
      color: white;
      border: 1px solid #555;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1rem;
      transition: all 0.2s;
  }

  .action-btn:hover {
      background: #444;
      border-color: #666;
  }
</style>

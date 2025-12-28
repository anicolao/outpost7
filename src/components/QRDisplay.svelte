<script lang="ts">
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';
  import { gameState } from '../lib/redux-svelte';

  export let hostPeerId: string;

  let canvasRed: HTMLCanvasElement;
  let canvasYellow: HTMLCanvasElement;

  $: redUrl = `${window.location.origin}/hand?host=${hostPeerId}&color=red`;
  $: yellowUrl = `${window.location.origin}/hand?host=${hostPeerId}&color=yellow`;

  $: if (hostPeerId && canvasRed) {
    QRCode.toCanvas(canvasRed, redUrl, { width: 100 }, (error: any) => {
      if (error) console.error(error);
    });
  }

  $: if (hostPeerId && canvasYellow) {
    QRCode.toCanvas(canvasYellow, yellowUrl, { width: 100 }, (error: any) => {
      if (error) console.error(error);
    });
  }

  function openHand(url: string) {
    window.open(url, '_blank', 'width=800,height=400');
  }
</script>

<div class="qr-container">
  <div class="qr-item red" on:click={() => openHand(redUrl)}>
    <canvas bind:this={canvasRed}></canvas>
    <span>Red Player</span>
  </div>
  
  <div class="qr-item yellow" on:click={() => openHand(yellowUrl)}>
    <canvas bind:this={canvasYellow}></canvas>
    <span>Yellow Player</span>
  </div>
</div>

<style>
  .qr-container {
    position: absolute;
    bottom: 20px;
    right: 20px;
    display: flex;
    gap: 20px;
    background: rgba(0, 0, 0, 0.7);
    padding: 10px;
    border-radius: 10px;
  }

  .qr-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: white;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .qr-item:hover {
    transform: scale(1.05);
  }

  span {
    margin-top: 5px;
    font-size: 12px;
    font-weight: bold;
  }

  .red span { color: #ff4d4d; }
  .yellow span { color: #ffea00; }
</style>

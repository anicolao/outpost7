<script lang="ts">
  import QRCode from 'qrcode';

  export let url: string;
  export let label: string;
  export let color: string;

  let qrSrc: string = '';
  let isReady = false;

  $: if (url) {
    try {
        isReady = false;
        // console.log('Generating QR code for:', url); 
        QRCode.toDataURL(url, { width: 100, margin: 1 }, (error: any, dataUrl: string) => {
            if (error) {
                console.error('QR Generation Error:', error);
            } else {
                qrSrc = dataUrl;
                isReady = true;
            }
        });
    } catch (e) {
        console.error('QR Synchronous Error:', e);
    }
  }

  function openHand() {
    window.open(url, '_blank', 'width=800,height=400');
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="qr-item" style:--color={color} on:click={openHand} data-status={isReady ? 'ready' : 'pending'}>
  {#if isReady}
      <img src={qrSrc} alt={label} />
  {/if}
  <span>{label}</span>
</div>

<style>
  .qr-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    background: white;
    padding: 8px;
    border-radius: 8px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    border: 3px solid var(--color);
    transition: transform 0.2s;
    min-width: 100px; /* Ensure layout stability */
    min-height: 100px;
  }

  .qr-item:hover {
    transform: scale(1.05);
  }

  span {
    margin-top: 4px;
    font-size: 12px;
    font-weight: bold;
    color: black;
  }
  
  img {
      display: block;
      width: 100px;
      height: 100px;
  }
</style>

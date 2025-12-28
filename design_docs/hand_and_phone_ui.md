# Outpost 7: Hand & Phone UI Design Doc

## Overview
This document outlines the design for implementing private player hands, an offer row, and a mobile phone interface for players to view and manage their cards using WebRTC (PeerJS).

## Goals
1.  **Hidden Hands**: Players view their cards on their own phones, keeping them private from the main board.
2.  **Offer Display**: A market of cards ("The Offer") displayed on the main board.
3.  **Discard Mechanics**: Logic to handle hand limits (max 7 cards) and point limits (max 12 points).
4.  **Seamless Connection**: QR code scanning to instantly pair a phone to the specific player slot.

## Architecture: Host-Client via WebRTC
We will use `peerjs` to establish a direct data connection between the "Host" (the main game board browser) and the "Client" (the player's phone).

### Host (Game Board)
- **Role**: The source of truth for game state.
- **Responsibility**:
    - Manages the Redux store.
    - Generates a unique Peer ID (shortened or mapped if possible, but raw ID for MVP).
    - Displays QR codes for Red and Yellow players containing: `URL?gameId=<PeerID>&player=<Color>`.
    - Listens for incoming connections.
    - Sends `HAND_UPDATE` messages to connected clients whenever their hand changes.
    - Receives `DISCARD_REQUEST` messages from clients.

### Client (Player Phone)
- **Role**: A dumb terminal for viewing state and sending intents.
- **Responsibility**:
    - Connects to the Host via the ID in the URL.
    - Displays the list of cards in the hand.
    - Calculates total count and points locally (or relies on Host data).
    - If over limits, enforces selection and discard.
    - Sends `DISCARD` actions to the Host.

## Data Structures (Extensions to `gameSlice.ts`)

### Card Definition
```typescript
export interface Card {
  id: string; // unique instance ID
  type: string; // e.g., 'scout', 'settler', or svg filename base
  cost: number; // For the 12-point limit
}
```

### State Updates
```typescript
interface GameState {
  // ... existing state
  deck: Card[];
  offer: Card[]; // The visible market
  discard: Card[];
  hands: Record<PlayerColor, Card[]>;
  hostPeerId: string | null;
}
```

## UI Layouts

### Main Board
- **Offer**: A row of cards displayed **beneath** the grid. Conceptually "beneath" means rotated 90 degrees and placed at the **left edge** of the table (as per user request "rotated 90 degrees at the left edge").
- **QR Codes**:
    - Placed along the edge of the table corresponding to the player's join position.
    - Color-coded (Red/Yellow).
    - Clickable (for testing) -> opens `window.open(url)`.

### Phone UI
- **Orientation**: Optimized for Landscape.
- **Components**:
    - **Hand View**: Horizontal scroll or flex wrap of card images.
    - **Status Bar**: "Count: X/7", "Points: Y/12".
    - **Discard Mode**:
        - Triggered automatically if limits exceeded.
        - Cards selectable (toggle).
        - Selected cards outlined in Red.
        - "Confirm Discard" button (enabled only if discard resolves the over-limit status).

## Logic Flow

1.  **Game Start**:
    - Deck shuffled.
    - 10 cards moved to Discard (burn).
    - Offer dealt (size TBD, assumed 5 for now?).
    - Initial hands dealt to active players.
2.  **Connection**:
    - Host initializes `Peer` on mount.
    - Generates QR codes.
    - Phone scans -> opens internal route `/hand?host=...&color=...`
    - Phone connects to Host.
    - Host sends current `hands[color]`.
3.  **Gameplay Loop (Hand Mgmt)**:
    - Player accumulates cards (mechanism TBD later).
    - Host checks limits.
    - Host sends updated hand.
    - If limits exceeded, Phone prompts discard.
    - Player selects and confirms.
    - Phone sends `DISCARD` payload to Host.
    - Host validates, moves cards to discard pile, updates hand, sends new state.

## Implementation Plan

### Phase 1: Core Logic & Store
- Update `gameSlice` with `deck`, `offer`, `hands`.
- Implement `deal` and `discard` reducers.

### Phase 2: Host UI (Board)
- Implement `Offer` component (left edge, rotated).
- Implement `QRDisplay` component.

### Phase 3: Networking (PeerJS)
- Add `peerjs` dependency.
- Create a `ConnectionManager` class or Svelte store to handle Peer lifecycle.
- Integrate into `App.svelte` or `Board.svelte`.

### Phase 4: Client UI (Phone)
- Create new route `/hand`.
- Implement `HandView` component.
- Implement Discard interaction.

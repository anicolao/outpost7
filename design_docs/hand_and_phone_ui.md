# Outpost 7: Hand & Phone UI Design Doc

## Overview
This document outlines the design for implementing private player hands, an offer row, and a mobile phone interface for players to view and manage their cards using anonymous Firebase Authentication and Cloud Firestore.

## Goals
1.  **Hidden Hands**: Players view their cards on their own phones, keeping them private from the main board.
2.  **Offer Display**: A market of cards ("The Offer") displayed on the main board.
3.  **Discard Mechanics**: Logic to handle hand limits (max 7 cards) and point limits (max 12 points).
4.  **Seamless Connection**: QR code scanning to instantly pair a phone to the specific player slot.

## Architecture: Firebase room events
The board and each phone sign in anonymously, then share an authenticated,
append-only Firestore event stream for the current game room. The board
publishes hand snapshots; phone controllers publish registration, selection,
and discard events.

### Host (Game Board)
- **Role**: The source of truth for game state.
- **Responsibility**:
    - Manages the Redux store.
    - Generates a unique game ID.
    - Displays QR codes for Red and Yellow players containing the game ID and color.
    - Publishes `host/hand-updated` events whenever a hand changes.
    - Applies authenticated controller selection and discard events.

### Client (Player Phone)
- **Role**: A dumb terminal for viewing state and sending intents.
- **Responsibility**:
    - Signs in anonymously and subscribes to the room in the URL.
    - Displays the list of cards in the hand.
    - Calculates total count and points locally (or relies on Host data).
    - If over limits, enforces selection and discard.
    - Publishes `player/registered`, `player/selection-updated`, and `player/discarded` events.

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
    - Board signs in anonymously and opens a Firestore room on mount.
    - Generates QR codes.
    - Phone scans -> opens internal route `/hand?game=...&color=...`.
    - Phone signs in anonymously and registers in the room.
    - Phone replays the latest hand event for its color.
3.  **Gameplay Loop (Hand Mgmt)**:
    - Player accumulates cards (mechanism TBD later).
    - Host checks limits.
    - Board publishes the updated hand.
    - If limits exceeded, Phone prompts discard.
    - Player selects and confirms.
    - Phone publishes a discard intent.
    - Board validates, moves cards to the discard pile, and publishes the new hand.

## Implementation Plan

### Phase 1: Core Logic & Store
- Update `gameSlice` with `deck`, `offer`, `hands`.
- Implement `deal` and `discard` reducers.

### Phase 2: Host UI (Board)
- Implement `Offer` component (left edge, rotated).
- Implement `QRDisplay` component.

### Phase 3: Networking (Firebase)
- Add Firebase anonymous Authentication and Cloud Firestore.
- Protect room events with authenticated, own-UID, append-only Security Rules.
- Add the shared Firestore action repository.
- Integrate into `App.svelte` or `Board.svelte`.

### Phase 4: Client UI (Phone)
- Create new route `/hand`.
- Implement `HandView` component.
- Implement Discard interaction.

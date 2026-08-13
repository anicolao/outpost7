# Gameplay Loop

Verify full gameplay cycle: Selection -> Visuals -> Placement -> Interactive Bonus

## Start Game with Red Player

![Start Game with Red Player](screenshots/000-001-setup-host.png)

**Specs:**
- Add Red Player and Start

## Connect Red Player via QR

![Connect Red Player via QR](screenshots/001-002-connect-red.png)

**Specs:**
- Open Red Client

## Red Player Discards if Over Limit

![Red Player Discards if Over Limit](screenshots/002-002-5-initial-discard.png)

**Specs:**
- Discard down to limit

## Red Player Selects Play and Pay Cards

![Red Player Selects Play and Pay Cards](screenshots/003-003-client-selection.png)

**Specs:**
- Select Valid Play/Pay pair

## Verify Face Down Card and Highlights

![Verify Face Down Card and Highlights](screenshots/004-004-host-feedback.png)

**Specs:**
- Face down card visible at bottom
- Every cell is a legal first placement with a static glow

## Click cell to place card

![Click cell to place card](screenshots/005-005-execute-move.png)

**Specs:**
- Click target cell (2,2)
- Wait for animation and placement
- Public deck, discard, and hand counts update after the repair

## Resolve Bonus Phase if Active

![Resolve Bonus Phase if Active](screenshots/006-006-resolve-bonus.png)

**Specs:**
- Check and Resolve Bonus
- Verify Final Turn State (Yellow)

## Red selects cards for the next repair

![Red selects cards for the next repair](screenshots/007-007-select-red-repair.png)

**Specs:**
- Select a legal play and payment pair
- Unavailable cards are dimmed without losing their colour

## Only spaces next to the station are legal

![Only spaces next to the station are legal](screenshots/008-008-adjacent-placements.png)

**Specs:**
- Only the four orthogonally adjacent cells have a static glow
- A distant or diagonal space rejects the card

## A card can be placed next to the station

![A card can be placed next to the station](screenshots/009-009-adjacent-placement-accepted.png)

**Specs:**
- An adjacent space accepts the card

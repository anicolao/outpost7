# Ownership Flip

Verify flipping ownership of Row 2 and Col 1 from Yellow to Red

## Start Game with Red and Yellow

![Start Game with Red and Yellow](screenshots/000-001-setup-host.png)

**Specs:**
- Add Players and Start

## Script Yellow to claim Row 2 and Column 1

![Script Yellow to claim Row 2 and Column 1](screenshots/001-002-yellow-claims.png)

**Specs:**
- Execute Yellow Moves

## Connect Red Player

![Connect Red Player](screenshots/002-003-connect-red.png)

**Specs:**
- Open Red Client

## Ensure Red has a play generating >= 2 cubes

![Ensure Red has a play generating >= 2 cubes](screenshots/003-004-fix-red-hand.png)

**Specs:**
- Cycle cards until strong pair found

## Red plays at (2, 1) intersection

![Red plays at (2, 1) intersection](screenshots/004-005-red-plays.png)

**Specs:**
- Select matching/overpay pair

## Execute move at (2, 1)

![Execute move at (2, 1)](screenshots/005-006-execute-flip.png)

**Specs:**
- Click cell (2, 1)

## Row 2 and Col 1 should be Red

![Row 2 and Col 1 should be Red](screenshots/006-007-verify-flip.png)

**Specs:**
- Headers are Red


# Hand and Phone UI

Verify Firebase controller connection and hand syncing

## Navigate to game and start 2-player match

![Navigate to game and start 2-player match](screenshots/000-001-start-game.png)

**Specs:**
- Open game page
- Configure and start game
- Verify board and QR codes visible

## Initiate connection

![Initiate connection](screenshots/001-002-connect-init.png)

**Specs:**
- Click Red QR code and wait for popup



## Verify Red player connected (Client View)

![Verify Red player connected (Client View)](screenshots/000-002-connect-client-verify.png)

**Specs:**
- Verify Red player connected

## Force hand limit and verify discard flow

![Force hand limit and verify discard flow](screenshots/001-003-discard-logic.png)

**Specs:**
- Force draw to exceed limit
- Select and discard cards

## Keep the connected private hand awake

![Keep the connected private hand awake](screenshots/002-004-keep-awake.png)

**Specs:**
- Wake lock is opt-in and reports when it is active
- Wake lock releases while hidden and returns when the hand is visible again

## Continue normally when wake lock is unavailable

![Continue normally when wake lock is unavailable](screenshots/003-005-wake-lock-unavailable.png)

**Specs:**
- Unsupported browsers show a disabled fallback without disrupting the hand


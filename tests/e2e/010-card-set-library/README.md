# Persistent Card Set Library

Upload a named TSV card set to Firebase, review it later, and choose it for the next game.

## Review the bundled card set

![Review the bundled card set](screenshots/000-bundled-card-set.png)

**Specs:**
- The bundled set is initially active and its cards are visible

## Paste a named TSV card set

![Paste a named TSV card set](screenshots/001-paste-card-set.png)

**Specs:**
- The importer accepts a name and pasted tab-separated card data

## Choose the uploaded set for play

![Choose the uploaded set for play](screenshots/002-activate-uploaded-set.png)

**Specs:**
- The uploaded set is stored with its name and complete card count

## Find the selected set after reloading

![Find the selected set after reloading](screenshots/003-persistent-card-set.png)

**Specs:**
- Firebase retains the uploaded set and the device remembers it as active

## Start a game with the selected card set

![Start a game with the selected card set](screenshots/004-play-selected-set.png)

**Specs:**
- The offer uses the uploaded v49 values instead of the bundled values

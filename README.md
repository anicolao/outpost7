# Outpost Seven

A digital implementation of the tabletop game **Outpost Seven**.

## Legal & License

**The game concept and design is (c) Stefan Alexander, 2025. All rights reserved.**

This codebase is an open-source **GPLv3** implementation of that game concept, but the game itself may **not be served or played without permission from Stefan Alexander**.

## Development

### Setup
```bash
npm install
```

### Run
```bash
npm run dev
```

Local multiplayer tests run against the Firebase Authentication and Firestore
emulators:

```bash
npm run test:e2e
```

### Card sets

From the lobby, open any corner gear and choose **Open Card Library…**. The
library can preview the bundled cards or any named card set stored in Firebase.
Choose **Add card set** to paste the tab-separated header and rows copied from a
spreadsheet. Uploaded sets are immutable and shared with authenticated players;
**Use this set** selects the cards used when the next game starts. The selection
is remembered by the browser, with the bundled cards retained as the fallback.

## Firebase

- Project: `outpost7-20260807`
- Authentication: anonymous sign-in
- Database: Cloud Firestore
- Controller transport: authenticated, append-only events at
  `games/{gameId}/events/{eventId}`
- Card-set library: authenticated reads and immutable uploads at
  `cardSets/{cardSetId}`

Firebase browser configuration is public configuration. Authentication and
Firestore Security Rules provide event attribution and immutable history; no
service-account credential, private key, Firebase CLI token, or production
data belongs in this repository.

## Documentation
- [VISION.md](./VISION.md) - High-level game vision
- [DESIGN_OVERVIEW.md](./DESIGN_OVERVIEW.md) - Technical and design overview
- [TECH_STACK.md](./TECH_STACK.md) - Technology stack details

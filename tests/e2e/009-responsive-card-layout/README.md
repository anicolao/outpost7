# Responsive Card Layout

Cards fill phone and tabletop displays without scrolling or resizing during movement.

## Seven-card hand fills a phone viewport

![Seven-card hand fills a phone viewport](screenshots/000-phone-hand-fills-viewport.png)

**Specs:**
- The phone page and card area have no horizontal or vertical scrolling
- Every card is fully visible and at least 100 CSS pixels wide

## Phone actions stay above iOS browser controls

![Phone actions stay above iOS browser controls](screenshots/001-phone-actions-clear-ios-safe-area.png)

**Specs:**
- Every action button is fully above the simulated iOS bottom inset
- Reserving the iOS safe area does not introduce page or card scrolling

## Seven-card hand fills a landscape phone viewport

![Seven-card hand fills a landscape phone viewport](screenshots/002-phone-landscape-fills-viewport.png)

**Specs:**
- The landscape phone page and card area have no scrolling
- All seven cards remain fully visible and at least 100 CSS pixels wide



## Tabletop, offer, and moving cards share one large size

![Tabletop, offer, and moving cards share one large size](screenshots/000-tabletop-cards-fill-viewport.png)

**Specs:**
- The placed card is at least 120 by 168 CSS pixels
- Offer cards exactly match placed board cards
- The tabletop remains contained within the display
- Deck, discard, and both hidden hand counts remain visible beside the offer

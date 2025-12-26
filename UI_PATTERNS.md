# UI Patterns & Constraints

This document defines the user interface patterns and constraints for our
tabletop game system.

## The Tabletop Constraint: "No Scrolling"

The most critical constraint is that **the game must fit entirely within the
viewport**.

- **Why?** Players are physically sitting around a touch screen or large
  monitor. Scrolling is disorienting and breaks the shared surface illusion.
- **Solution**: Use responsive scaling. As the game board grows, the view must
  zoom out or pan to keep relevant content visible.

## Multi-Directional Layout

The UI supports multiple players, each seated at one edge of the screen:

- **Bottom Edge**: Standard orientation (0°).
- **Top Edge**: Rotated 180°.
- **Left Edge**: Rotated 90° Clockwise.
- **Right Edge**: Rotated 90° Counter-Clockwise (270°).

A given player's edge is determined by what edge they joined from, and along
that edge players are added left to right.

### Rules for Edge UI

1. **Orientation**: Text and controls for a player MUST be rotated to face them.
2. **Touch Targets**: Buttons must be large enough for touch input (min 44px).
3. **Personal Zones**: Each edge has a reserved "zone" for that player's hand,
   stats, and controls. The central area is for the shared board.

## Visual Style

- **Animations**: All state changes (movement, appearing, disappearing) MUST be
  animated. Instant changes are confusing.
- **Transitions**: 200-400ms duration for most UI transitions.
- **Clarity**: Use high-contrast text and clear iconography. Tokens should be
  distinct at small scales.

## Implementation Details

- **CSS Transforms**: Use `transform: rotate(...)` for edge orientation.
- **SVG/Canvas**: Use SVG or Canvas for the central game board to allow easy
  scaling without layout thrashing.
- **Viewport Units**: Use `vh` and `vw` or percentages heavily. Avoid fixed
  pixel sizes for main layout containers.

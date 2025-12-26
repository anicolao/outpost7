# Agent Guidelines for Tabletop Game Development

This document provides essential guidelines for AI agents working on this tabletop game codebase.

## Core Principles

1.  **Immersive Tabletop Experience**: Always prioritize the "sitting around a table" feel. The UI should work for players seated at different edges of a screen (top, bottom, left, right).
2.  **No Scrolling**: The entire game interface MUST fit within the viewport. No scrolling is allowed during gameplay.
3.  **Zero-Pixel Tolerance Testing**: We use rigorous E2E testing with visual snapshots. Transitions and layouts must be deterministic.
4.  **Minimal Changes**: When fixing bugs or adding features, make the smallest possible change. Avoid refactoring unrelated code unless explicitly requested.

## Project Structure

*   `src/game/`: Pure game logic (immutable, well-tested, framework-agnostic).
*   `src/redux/`: State management (Redux Toolkit).
*   `src/components/`: Svelte components for UI.
    *   `src/components/game/`: Game board and entities.
    *   `src/components/ui/`: Reusable UI controls.
*   `tests/`: Unit and E2E tests.

## Development Workflow

### 1. Test-Driven Development (TDD)
Always write tests before implementation.
*   **Game Logic**: Write unit tests in `vitest`.
*   **UI Features**: Write E2E tests in `playwright`.

### 2. E2E Testing Guidelines
*   **Definitive Guide**: Follow `E2E_TESTING_GUIDELINES.md` strictly.
*   **Visual Regression**: Every UI change must be verified with visual snapshots.
*   **Documentation**: Tests must generate their own documentation using `TestDocumentationHelper`.

### 3. Documentation
*   Keep `docs/` up to date.
*   Update `AGENTS.md` if new standard procedures are established.

## Common Procedures

### Adding a New Game Entity
1.  Define the entity type in `src/game/types.ts`.
2.  Add logic in `src/game/` with unit tests.
3.  Add Redux slice/actions if needed.
4.  Create/Update Svelte component in `src/components/game/`.
5.  Add E2E test verifying its appearance and behavior.

### Modifying UI
1.  Run `npm run test:e2e` to establish baseline.
2.  Make changes.
3.  Run `npm run test:e2e -- --update-snapshots` to generate new snapshots.
4.  Manually inspect the diffs to ensure they are correct.

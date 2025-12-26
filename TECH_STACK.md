# Technology Stack

This project uses the following core technologies. This stack is chosen for performance, type safety, and ease of testing.

## Core
*   **Language**: [TypeScript](https://www.typescriptlang.org/) - Strict mode enabled.
*   **Framework**: [Svelte 5](https://svelte.dev/) - For reactive UI components.
*   **State Management**: [Redux Toolkit](https://redux-toolkit.js.org/) - For predictable state transitions and easy debugging (time travel).
*   **Build Tool**: [Vite](https://vitejs.dev/) - Fast builds and HMR.

## Testing
*   **Unit Testing**: [Vitest](https://vitest.dev/) - Fast unit tests, compatible with Vite.
*   **E2E Testing**: [Playwright](https://playwright.dev/) - Reliable browser verification with visual comparisons.

## Styling
*   **CSS**: Standard CSS (PostCSS supported via Vite).
*   **Approach**: Component-scoped styles in Svelte files + global utility classes where needed.

## Linting & Formatting
*   **ESLint**: Code quality.
*   **Prettier**: Code formatting.

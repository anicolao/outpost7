# E2E Testing Guidelines

This document serves as the **definitive guide** for writing End-to-End (E2E) tests for this tabletop game. It is designed to be followed by AI agents and developers alike to ensure robust, deterministic, and self-documenting tests.

## 1. The Philosophy: "Zero-Pixel Tolerance"

We enforce a strict **Zero-Pixel Tolerance** policy for visual regression.
*   **Why?** In a tabletop game, visual state is the *only* state that matters to the player. If a token is 1 pixel off, it might be on the wrong tile.
*   **Consequence**: Tests must be perfectly deterministic. Random seeds must be fixed. Animations must be completed (or effectively disabled) before ensuring snapshots.

## 2. Test Structure

All E2E tests live in `tests/e2e/`. Each test case gets its own directory.

### Directory Convention
Tests are organized by "User Story" or "Scenario" in numbered folders to define order/priority.

```
tests/e2e/
├── helpers/                   # Shared utilities (screenshot, doc helpers)
├── 001-game-start/            # Scenario Directory
│   ├── 001-game-start.spec.ts # Main test file
│   ├── README.md              # Auto-generated verification doc
│   └── screenshots/           # Committed baseline images
│       ├── 000-initial-load.png
│       └── 001-player-joined.png
```

## 3. The "Unified Step Pattern"

To prevent synchronization errors between documentation and screenshots, we use a **Unified Step API**. You must **NEVER** manually manage filenames or counters.

### The `TestStepHelper`

The helper combines documentation, verification, and capturing into a single atomic operation: `step()`.

```typescript
interface StepOptions {
  description: string;           // Human-readable title for the README
  verifications: Verification[]; // List of checks to run
}
```

### Step-by-Step Implementation

#### Step 1: Initialize
Initialize the `TestStepHelper` at the start of your test.

```typescript
import { test, expect } from '@playwright/test';
import { TestStepHelper } from '../helpers/test-step-helper';

test('Player can join the game', async ({ page }, testInfo) => {
  // 1. Initialize the Unified Helper
  const tester = new TestStepHelper(page, testInfo);

  // 2. Set User Story Metadata
  tester.setMetadata(
    'Player Join Flow',
    '**As a** new player, **I want** to join a table, **so that** I can play.'
  );

  // ... implementation ...
});
```

#### Step 2: Execute Atomic Steps
Use `tester.step()` for every logical action. This single function handles the action (optional), verification, documentation generation, and screenshot capturing automatically.

```typescript
  // ... inside test ...

  // 1. Perform Action
  await page.goto('/');

  // 2. Verify & Capture in one call
  // The filename '000-initial-load.png' is auto-generated from the step ID.
  await tester.step('initial-load', {
    description: 'Initial Game State',
    verifications: [
      {
        spec: 'Title screen is visible',
        check: async () => await expect(page.locator('#title')).toBeVisible()
      },
      {
        spec: 'Join button is disabled initially',
        check: async () => await expect(page.locator('#join-btn')).toBeDisabled()
      }
    ]
  });
```

**What happens inside `tester.step('initial-load', ...)`:**
1.  **Auto-Naming**: Generates filename `000-initial-load.png` (auto-incrementing prefix).
2.  **Verification**: Executes all `check` functions. Fails the test if any check fails.
3.  **Capture**: Takes the screenshot using the generated filename.
4.  **Documentation**: Adds the entry (Title, Spec list, Screenshot link) to the internal doc buffer.

#### Step 3: Conclude
Generate the README file at the end.

```typescript
  // ... end of test ...
  tester.generateDocs();
});
```

### Why this is impossible to break
*   **Single Source of Truth**: The string `'initial-load'` is passed once. It defines both the screenshot filename and the documentation key.
*   **Forced Verification**: You cannot take a screenshot without passing the `verifications` array.
*   **Automatic Ordering**: The `000`, `001` prefix is managed internally by the class, not by you.

## 4. Helper Implementation Reference

When creating the template, ensure `helpers/test-step-helper.ts` implements this interface:

```typescript
export class TestStepHelper {
  private stepCount = 0;
  private steps: DocStep[] = [];

  constructor(private page: Page, private testInfo: TestInfo) {}

  async step(id: string, options: StepOptions) {
    // 1. Run Verification
    for (const v of options.verifications) {
      await v.check();
    }

    // 2. Generate Name
    const paddedIndex = String(this.stepCount++).padStart(3, '0');
    const filename = `${paddedIndex}-${id}.png`;

    // 3. Capture
    await this.page.screenshot({ path: this.getPath(filename) });

    // 4. Record for Docs
    this.steps.push({
      title: options.description,
      image: filename,
      specs: options.verifications.map(v => v.spec)
    });
  }
  // ... generateDocs() implementation ...
}
```

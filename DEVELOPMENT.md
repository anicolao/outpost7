# Development Guide

## Environment Setup
This project uses **Nix** to manage development dependencies.
1.  Install Nix.
2.  Enable [direnv](https://direnv.net/).
3.  Run `direnv allow` in this directory to install dependencies (e.g., `pdftotext`, `prettier`).

## Workflow
We follow a feature-branch workflow:
1.  **Create a Branch**: For every new task or feature, create a new branch.
    ```bash
    git checkout -b feat/your-feature-name
    ```
2.  **Commit Changes**: Commit your work regularly.
3.  **Push and PR**: When the task is complete (or for feedback), push the branch and create a Pull Request.
    ```bash
    git push -u origin feat/your-feature-name
    gh pr create --fill
    ```
4.  **Merge**: After approval/review, merge the PR into `main`.

## Inputs
-   `inputs/`: Contains raw assets (PDFs, archives).
-   `inputs/extracted_assets/`: (Gitignored) Contains extracted images/resources.

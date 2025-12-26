# Outpost Seven: Design Overview

## Architecture
The project follows the standard Tabletop Game Template architecture, using a component-based design for game state and UI.

## Game Components
Based on initial inputs:
- **Cards**: Represent Modules and potentially events or starting conditions.
- **Modules**:
    - **Blue Modules**: Likely related to blue resources or specific utility.
    - **Green Modules**: Likely related to green resources or growth.
    - **Yellow Modules**: Likely related to purple resources or scoring.
- **Resources**: Represented by tokens or tracking on cards.
- **Cubes**: Used as markers or counters on modules.

## Data Structure
- **CSV Data**: `cards.csv` drives the definition of game components.
- **Assets**: PDFs for cards and tokens are stored in `inputs/`.

## Development Focus
1.  **Parsing**: Implement a parser for `cards.csv` to generate game objects.
2.  **State Management**: Define the `GameState` to track player resources, built modules, and active bonuses.
3.  **UI Implementation**: Create visual representations for Cards and Modules using the specified assets.

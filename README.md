# ROUNDABOUT RUSH

An endless circular arcade game where you control a delivery scooter navigating around a city roundabout.

## Features

- **One-Button Control**: Switch lanes with a single input (Spacebar or tap)
- **Progressive Difficulty**: Speed increases 1% per level, more hazards every 3 levels
- **Procedural Generation**: Unique roundabouts with varying sizes
- **Glowing Neon Graphics**: Clean minimalist visual style with glowing dots
- **High Score Tracking**: Stored locally in browser

## How to Play

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the game:
   ```bash
   npm start
   ```

3. Open your browser to `http://localhost:8080`

## Controls

- **Desktop**: Press SPACEBAR to switch lanes
- **Mobile**: Tap the on-screen button

## Gameplay

- Your scooter rotates automatically around the roundabout
- Switch between inner and outer lanes to avoid hazards
- Pass hazards to score points equal to your current level
- Complete a full orbit to level up and regenerate the environment
- Speed increases 1% per level
- Hazard count increases every 3 levels (max 12)

## Difficulty Progression

| Phase    | Levels | Description                     |
|----------|--------|---------------------------------|
| Tutorial | 1-10   | Basic timing, slow rotation     |
| Challenge| 11-25  | Moderate hazard count and speed |
| Expert   | 26-50  | Dense hazards, faster timing    |
| Endless  | 50+    | Fully random parameters         |

## Technical Details

- **Engine**: Phaser 3.70.0
- **Graphics**: Pure geometry with glowing effects (no external assets)
- **Physics**: Polar coordinate system
- **Responsive**: Scales to fit any screen size

## Project Structure

```
/mnt/d/game1/
├── index.html          # Main HTML file
├── package.json        # Dependencies
└── src/
    ├── config.js      # Phaser configuration
    ├── MainScene.js   # Main game logic
    └── game.js        # Game initialization
```

## Credits

Game designed and implemented using Phaser 3 framework.

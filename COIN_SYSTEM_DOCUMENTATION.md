# JTI Coin System Documentation for RoundaboutRush

## Overview
The game awards JTI coins based on game score with a daily limit of 10 coins per day.

## Coin Calculation Rules
- **Conversion Rate**: 10 game score points = 1 JTI coin (TEMPORARY RATE)
- **Daily Limit**: Maximum 10 JTI coins per day (UK timezone)
- **Daily Reset**: Resets at midnight UK time (Europe/London timezone)

## Example Scenarios (with temporary 10:1 rate)

### Scenario 1: Player plays 3 games in one day
1. **Game 1**: Score 22 → 2 coins earned (2/10 daily)
2. **Game 2**: Score 60 → 6 coins earned (8/10 daily)
3. **Game 3**: Score 350 → 2 coins earned (10/10 daily - limit reached)
   - Potential coins would be 35, but only 2 awarded due to daily limit

### Scenario 2: Daily limit already reached
- If a player has already earned 10 coins today, any additional games will award 0 coins
- The game still tracks the score and updates statistics

### Scenario 3: New day
- At midnight UK time, the daily coin counter resets to 0
- Total lifetime coins are preserved
- Player can earn another 10 coins

## Technical Implementation

### State Management
The game tracks the following in `jtiState`:
- `lastPlayDate`: Date string in UK format (DD/MM/YYYY)
- `dailyCoinsEarned`: Coins earned today (0-10)
- `totalCoins`: Total lifetime coins earned
- `gamesPlayed`: Total number of games played
- `lastGameScore`: Score from the last game

### SDK Integration
1. **Initialization**: Loads existing state or creates new state
2. **Daily Reset Check**: Compares current UK date with lastPlayDate
3. **Coin Calculation**:
   - Calculate potential coins: `Math.floor(gameScore / 10)` (TEMPORARY RATE)
   - Check remaining daily allowance: `10 - dailyCoinsEarned`
   - Award minimum of potential and remaining
4. **State Update**: Save new state with `setState()`
5. **Score Submission**: Submit normalized score (0-1) with `setScore()`
   - Normalized score = `coinsAwarded / 10`
   - Includes metadata for leaderboard

### Ranking Integration
- Attempts to get current total from `getRanking()` for accuracy
- Falls back to state-stored total if ranking unavailable
- Maintains consistency across sessions

## Debug Console Output
The system logs detailed information for each coin calculation:
```
=== JTI Coins Calculation ===
Game Score: 22
Potential Coins (score/10): 2
Daily Coins Before: 0/10
Coins Awarded: 2
Daily Coins After: 2/10
Total Coins All Time: 2
Daily Limit Hit: false
============================
```

## Error Handling
- If SDK is unavailable, returns 0 coins earned
- If state save fails, logs error but continues
- If ranking fetch fails, uses local state as fallback
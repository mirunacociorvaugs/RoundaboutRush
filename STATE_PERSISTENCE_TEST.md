# State Persistence Test Scenarios

## Critical Concept
**setState values are ONLY read at init() - not between games in the same session**

This means:
- The game must track `dailyCoinsEarned` in memory (jtiState variable) throughout the session
- We cannot rely on setState/init to update counts between games
- The daily limit must be enforced using the in-memory state

## Test Scenario: Single Session, Multiple Games

### Initial State (from server at init)
```javascript
jtiState = {
    lastPlayDate: "28/10/2025",
    dailyCoinsEarned: 0,
    totalCoins: 0,
    gamesPlayed: 0
}
```

### Game 1 (Score: 30)
- Potential coins: 30/10 = 3
- Daily coins before: 0
- Coins awarded: 3
- Daily coins after: 3
- **In-memory state updated**: dailyCoinsEarned = 3
- **setState called** (but won't be read until next init)

### Game 2 (Score: 50) - Same Session
- Potential coins: 50/10 = 5
- Daily coins before: 3 (from memory, NOT from server)
- Coins awarded: 5
- Daily coins after: 8
- **In-memory state updated**: dailyCoinsEarned = 8

### Game 3 (Score: 100) - Same Session
- Potential coins: 100/10 = 10
- Daily coins before: 8 (from memory)
- Remaining allowed: 10 - 8 = 2
- Coins awarded: 2 (limited by daily cap)
- Daily coins after: 10
- **In-memory state updated**: dailyCoinsEarned = 10

### Game 4 (Score: 200) - Same Session
- Potential coins: 200/10 = 20
- Daily coins before: 10 (from memory)
- **SAFEGUARD TRIGGERED**: Already at daily limit
- Coins awarded: 0
- Daily coins after: 10

## Safeguards Implemented

### 1. Primary Check
```javascript
const remainingDaily = Math.max(0, 10 - currentDailyCoins);
const coinsToAward = Math.min(potentialCoins, remainingDaily);
```

### 2. Hard Stop
```javascript
if (currentDailyCoins >= 10) {
    return { coinsEarned: 0, totalDaily: currentDailyCoins, hitLimit: true };
}
```

### 3. State Update Protection
```javascript
jtiState.dailyCoinsEarned = Math.min(newDailyTotal, 10); // Never exceed 10
```

## New Day Handling

When the UK date changes:
1. **At init**: Detects new day, resets dailyCoinsEarned to 0
2. **During gameplay**: Also checks for new day in calculateAndSubmitJTICoins
3. **Preserves**: totalCoins and gamesPlayed are never reset

## Important Notes

- The game will NEVER award more than 10 coins per day
- Daily coins are tracked in memory during the session
- setState is called to persist for next session, but not read until next init
- Multiple safeguards ensure the 10-coin limit is enforced
- UK timezone (Europe/London) is used for day boundaries
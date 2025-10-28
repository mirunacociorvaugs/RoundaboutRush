import config from './config.js';
import MainScene from './MainScene.js';
import Bowser from 'bowser';

config.scene = [MainScene];

// Initialize JTI SDK and create game
let game = null;
let jtiInitData = null;
let jtiState = null;

// Helper function to get UK date string
function getUKDateString() {
    // Create a date in UK timezone (Europe/London handles both GMT and BST)
    const ukDate = new Date().toLocaleDateString('en-GB', {
        timeZone: 'Europe/London',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    return ukDate; // Returns format: DD/MM/YYYY
}

async function initializeGame() {
    try {
        // Initialize SDK v3 if available
        if (window.jticonnexus && window.jticonnexus.init) {
            const initResponse = await window.jticonnexus.init();
            console.log('JTI SDK v3 initialized:', initResponse);

            if (initResponse.status === 'success') {
                jtiInitData = initResponse;

                // Load existing state or create new one
                jtiState = initResponse.state || {};

                // Check if it's a new day in UK time
                const ukToday = getUKDateString();
                const isNewDay = !jtiState.lastPlayDate || jtiState.lastPlayDate !== ukToday;

                if (isNewDay) {
                    // New day - reset ONLY daily coins, preserve everything else
                    console.log('New day detected at initialization');
                    jtiState.lastPlayDate = ukToday;
                    jtiState.dailyCoinsEarned = 0;
                }

                // Ensure all required properties exist (without overwriting)
                if (jtiState.totalCoins === undefined) jtiState.totalCoins = 0;
                if (jtiState.gamesPlayed === undefined) jtiState.gamesPlayed = 0;
                if (jtiState.dailyCoinsEarned === undefined) jtiState.dailyCoinsEarned = 0;
                if (!jtiState.lastPlayDate) jtiState.lastPlayDate = ukToday;

                // Save state if it's a new day or if state was empty
                if (isNewDay || !initResponse.state) {
                    await window.jticonnexus.setState(jtiState);
                    console.log('State updated on init');
                }

                console.log('Current state:', jtiState);
                console.log(`Daily coins: ${jtiState.dailyCoinsEarned}/10, Total coins: ${jtiState.totalCoins}`);
            }
        }
    } catch (error) {
        console.error('Failed to initialize JTI SDK:', error);
    }

    // Create game after SDK is ready
    game = new Phaser.Game(config);

    // Setup UI event handlers after game is created
    setupUIHandlers();

    // Setup mobile button visibility
    updateMobileButtons();
    window.addEventListener('resize', updateMobileButtons);
}

function setupUIHandlers() {
    // Start button
    const startButton = document.getElementById('start-button');
    if (startButton) {
        startButton.addEventListener('click', () => {
            const container = document.getElementById('game-container');
            container.classList.remove('ready');
            container.classList.add('playing');

            // Notify MainScene to start
            const scene = game.scene.getScene('MainScene');
            if (scene && scene.startGame) {
                scene.startGame();
            }
        });
    }

    // Restart button
    const restartButton = document.getElementById('restart-button');
    if (restartButton) {
        restartButton.addEventListener('click', () => {
            // Notify MainScene to restart
            const scene = game.scene.getScene('MainScene');
            if (scene && scene.restartGame) {
                scene.restartGame();
            }
        });
    }

    // How to Play buttons (both on start screen and game over screen)
    const howToPlayBtn = document.getElementById('how-to-play-btn');
    const howToPlayBtnGameover = document.getElementById('how-to-play-btn-gameover');
    const closeInstructions = document.getElementById('close-instructions');
    const instructionsScreen = document.getElementById('instructions-screen');

    // Hook up the How to Play button on start screen
    if (howToPlayBtn && instructionsScreen) {
        howToPlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            instructionsScreen.classList.remove('hidden');
            instructionsScreen.classList.add('active');
        });
    }

    // Hook up the How to Play button on game over screen
    if (howToPlayBtnGameover && instructionsScreen) {
        howToPlayBtnGameover.addEventListener('click', (e) => {
            e.stopPropagation();
            instructionsScreen.classList.remove('hidden');
            instructionsScreen.classList.add('active');
        });
    }

    if (closeInstructions && instructionsScreen) {
        closeInstructions.addEventListener('click', () => {
            instructionsScreen.classList.add('hidden');
            instructionsScreen.classList.remove('active');
        });
    }
}

// Mobile device detection using Bowser library
function isMobileDevice() {
    const parser = Bowser.getParser(window.navigator.userAgent);
    const platformType = parser.getPlatformType();

    // Show buttons on mobile phones and tablets, hide on desktop
    return platformType === 'mobile' || platformType === 'tablet';
}

// Update mobile button visibility based on device detection
function updateMobileButtons() {
    const container = document.getElementById('game-container');
    if (!container) return;

    if (isMobileDevice()) {
        container.classList.add('mobile-device');
    } else {
        container.classList.remove('mobile-device');
    }
}

// Calculate JTI coins with daily limit
async function calculateAndSubmitJTICoins(gameScore) {
    try {
        if (!window.jticonnexus || !jtiInitData) {
            console.log('JTI SDK not available');
            return { coinsEarned: 0, totalDaily: 0, hitLimit: false };
        }

        // IMPORTANT: Since setState is only read at init, we must track daily coins
        // in memory across multiple games in the same session

        // Check if it's a new day in UK time
        const ukToday = getUKDateString();
        if (!jtiState.lastPlayDate || jtiState.lastPlayDate !== ukToday) {
            // Only reset if it's actually a new day
            console.log('New day detected, resetting daily coins counter');
            jtiState.lastPlayDate = ukToday;
            jtiState.dailyCoinsEarned = 0;
        }

        // Calculate coins from score (10 score = 1 coin) - TEMPORARY RATE
        const potentialCoins = Math.floor(gameScore / 10);

        // Get current daily coins earned (from our in-memory state, not server)
        const currentDailyCoins = jtiState.dailyCoinsEarned || 0;

        // Calculate how many coins can actually be earned (max 10 per day)
        const remainingDaily = Math.max(0, 10 - currentDailyCoins);
        const coinsToAward = Math.min(potentialCoins, remainingDaily);

        // CRITICAL: Double-check we never exceed daily limit
        if (currentDailyCoins >= 10) {
            console.log('Daily limit already reached. No coins will be awarded.');
            return {
                coinsEarned: 0,
                totalDaily: currentDailyCoins,
                hitLimit: true
            };
        }

        if (coinsToAward > 0) {
            // Get current total coins from ranking
            let totalCoins = 0;
            try {
                const currentRanking = await window.jticonnexus.getRanking({ top: 1, page: 0 });
                totalCoins = currentRanking?.self?.meta?.totalCoins || 0;
            } catch (err) {
                console.log('Could not get ranking, using state total');
                totalCoins = jtiState.totalCoins || 0;
            }

            // Update state with new coins (with safeguard for daily limit)
            const newDailyTotal = currentDailyCoins + coinsToAward;
            jtiState.dailyCoinsEarned = Math.min(newDailyTotal, 10); // Never exceed 10
            jtiState.totalCoins = totalCoins + coinsToAward;
            jtiState.lastGameScore = gameScore;
            jtiState.gamesPlayed = (jtiState.gamesPlayed || 0) + 1;

            // Save state first
            await window.jticonnexus.setState(jtiState);

            // Submit score to JTI (normalized between 0-1)
            // We normalize based on the maximum possible daily coins (10)
            const normalizedScore = coinsToAward / 10; // 10 coins = 1.0 (max daily)

            const scoreResponse = await window.jticonnexus.setScore(
                normalizedScore,
                {
                    gameScore: gameScore,
                    coinsEarned: coinsToAward,
                    totalCoins: jtiState.totalCoins,
                    dailyCoins: jtiState.dailyCoinsEarned
                },
                { addToRanking: true }
            );

            console.log('Score submitted:', scoreResponse);
        } else {
            // Even if no coins awarded, update the state to track the game
            jtiState.lastGameScore = gameScore;
            jtiState.gamesPlayed = (jtiState.gamesPlayed || 0) + 1;
            await window.jticonnexus.setState(jtiState);
        }

        // Create detailed log for debugging
        console.log('=== JTI Coins Calculation ===');
        console.log(`Game Score: ${gameScore}`);
        console.log(`Potential Coins (score/10): ${potentialCoins}`);
        console.log(`Daily Coins Before: ${currentDailyCoins}/10`);
        console.log(`Coins Awarded: ${coinsToAward}`);
        console.log(`Daily Coins After: ${jtiState.dailyCoinsEarned}/10`);
        console.log(`Total Coins All Time: ${jtiState.totalCoins}`);
        console.log(`Daily Limit Hit: ${jtiState.dailyCoinsEarned >= 10}`);
        console.log('============================');

        return {
            coinsEarned: coinsToAward,
            totalDaily: jtiState.dailyCoinsEarned,
            hitLimit: jtiState.dailyCoinsEarned >= 10
        };

    } catch (error) {
        console.error('Error calculating JTI coins:', error);
        return { coinsEarned: 0, totalDaily: 0, hitLimit: false };
    }
}

// Export functions for use in MainScene
export { jtiInitData, jtiState, calculateAndSubmitJTICoins };

// Start the game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    initializeGame();
}

export default game;
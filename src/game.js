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
                jtiState = initResponse.state || {};

                // Check if it's a new day in UK time
                const ukToday = getUKDateString();
                if (jtiState.lastPlayDate !== ukToday) {
                    // New day - reset daily coins
                    jtiState = {
                        lastPlayDate: ukToday,
                        dailyCoinsEarned: 0
                    };

                    await window.jticonnexus.setState(jtiState);
                    console.log('New day - coins reset');
                }

                console.log('Current state:', jtiState);
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

        // Check if it's a new day in UK time
        const ukToday = getUKDateString();
        if (jtiState.lastPlayDate !== ukToday) {
            // Reset for new day
            jtiState = {
                lastPlayDate: ukToday,
                dailyCoinsEarned: 0
            };
        }

        // Calculate coins from score (100 score = 1 coin)
        const potentialCoins = Math.floor(gameScore / 100);

        // Calculate how many coins can actually be earned (max 10 per day)
        const remainingDaily = 10 - jtiState.dailyCoinsEarned;
        const coinsToAward = Math.min(potentialCoins, remainingDaily);

        // Update state
        jtiState.dailyCoinsEarned += coinsToAward;

        // Save state
        await window.jticonnexus.setState(jtiState);

        // Submit score to JTI (normalized between 0-1)
        // We use the actual coins earned as the score factor
        if (coinsToAward > 0) {
            const normalizedScore = coinsToAward / 10; // 10 coins = 1.0 (max daily)
            await window.jticonnexus.setScore(normalizedScore, { gameScore: gameScore, coins: coinsToAward }, { addToRanking: true });
        }

        console.log(`Score: ${gameScore}, Potential coins: ${potentialCoins}, Awarded: ${coinsToAward}, Daily total: ${jtiState.dailyCoinsEarned}/10`);

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
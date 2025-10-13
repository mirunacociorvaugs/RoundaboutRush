import config from './config.js';
import MainScene from './MainScene.js';
import JtiExtension from "@jti-extensions/client";

config.scene = [MainScene];

// Initialize JTI SDK and create game
let game = null;
let jtiInitData = null;

async function initializeGame() {
    try {
        // Auto-detect mock mode based on localhost
        const isLocalhost = window.location.hostname === 'localhost' ||
                           window.location.hostname === '127.0.0.1' ||
                           window.location.hostname === '0.0.0.0';

        // Initialize SDK before creating game
        const initResponse = await JtiExtension.init({
            extensionName: "roundabout-rush",
            mock: isLocalhost,
        });

        console.log('JTI SDK initialized:', initResponse);
        jtiInitData = initResponse.init;

    } catch (error) {
        console.error('Failed to initialize JTI SDK:', error);
    }

    // Create game after SDK is ready
    game = new Phaser.Game(config);

    // Setup UI event handlers after game is created
    setupUIHandlers();
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

    // Instructions button
    const instructionsBtn = document.getElementById('instructions-btn');
    const closeInstructions = document.getElementById('close-instructions');
    const instructionsScreen = document.getElementById('instructions-screen');

    if (instructionsBtn && instructionsScreen) {
        instructionsBtn.addEventListener('click', (e) => {
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

    // Leaderboard button
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    const closeLeaderboard = document.getElementById('close-leaderboard');
    const leaderboardScreen = document.getElementById('leaderboard-screen');

    if (leaderboardBtn && leaderboardScreen) {
        leaderboardBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            leaderboardScreen.classList.remove('hidden');
            leaderboardScreen.classList.add('active');
            loadLeaderboard();
        });
    }

    if (closeLeaderboard && leaderboardScreen) {
        closeLeaderboard.addEventListener('click', () => {
            leaderboardScreen.classList.add('hidden');
            leaderboardScreen.classList.remove('active');
        });
    }

    // Prizes button
    const prizesBtn = document.getElementById('prizes-btn');
    const closePrizes = document.getElementById('close-prizes');
    const prizesScreen = document.getElementById('prizes-screen');

    if (prizesBtn && prizesScreen) {
        prizesBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            prizesScreen.classList.remove('hidden');
            prizesScreen.classList.add('active');
        });
    }

    if (closePrizes && prizesScreen) {
        closePrizes.addEventListener('click', () => {
            prizesScreen.classList.add('hidden');
            prizesScreen.classList.remove('active');
        });
    }
}

// Load leaderboard data
function loadLeaderboard() {
    const listEl = document.getElementById('leaderboard-list');
    listEl.innerHTML = '<li>Loading...</li>';

    JtiExtension.getRanking({
        extensionName: "roundabout-rush",
        limit: 10,
        timeRange: "all-time"
    })
    .then(res => {
        listEl.innerHTML = '';

        const scoreboard = res.ranking?.scoreboard || [];
        const selfInfo = res.ranking?.self;

        // Display the top 10 entries
        for (let i = 0; i < 10; i++) {
            const entry = scoreboard[i];

            const rankVal = entry ? `${entry.position}.` : '-';
            const name = entry ? entry.name : '-';
            const score = entry ? entry.score : '-';

            const li = document.createElement('li');

            // Check if this is the current user's entry
            const isCurrentUser = selfInfo && entry && entry.position === selfInfo.position;

            li.innerHTML = `
                <div class="entry-bar ${isCurrentUser ? 'current-user' : ''}">
                    <div class="bar-content">
                        <span class="rank">${rankVal}</span>
                        <span class="name" title="${name}">${name}</span>
                        <span class="score">${score}</span>
                    </div>
                </div>
            `;
            listEl.appendChild(li);
        }

        // If user is not in top 10, add their entry at the bottom
        if (selfInfo && selfInfo.position > 10) {
            const separator = document.createElement('li');
            separator.innerHTML = '<div class="separator">...</div>';
            listEl.appendChild(separator);

            const userLi = document.createElement('li');
            userLi.innerHTML = `
                <div class="entry-bar current-user">
                    <div class="bar-content">
                        <span class="rank">${selfInfo.position}.</span>
                        <span class="name" title="${selfInfo.name}">${selfInfo.name}</span>
                        <span class="score">${selfInfo.score}</span>
                    </div>
                </div>
            `;
            listEl.appendChild(userLi);
        }
    })
    .catch(err => {
        console.error('Leaderboard error:', err);
        listEl.innerHTML = '<li style="color: white; padding: 20px; text-align: center;">Unable to load leaderboard. Please try again later.</li>';
    });
}

// Export functions for use in MainScene
export { JtiExtension, jtiInitData };

// Start the game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    initializeGame();
}

export default game;

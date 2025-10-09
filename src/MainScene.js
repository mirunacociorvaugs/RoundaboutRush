export default class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
    }

    preload() {
        // No assets to load - using pure graphics
    }

    create() {
        // Get actual canvas dimensions
        const canvasWidth = this.scale.width;
        const canvasHeight = this.scale.height;

        // Center is actual canvas center (dynamic)
        this.centerX = canvasWidth / 2;
        this.centerY = canvasHeight / 2;

        // Detect mobile vs desktop for sizing
        this.isMobile = window.matchMedia("(max-width: 768px)").matches ||
                        ('ontouchstart' in window);

        // Calculate roundabout size based on device and viewport
        const viewportSizePercent = this.isMobile ? 0.95 : 0.75;
        const baseSize = Math.min(canvasWidth, canvasHeight) * viewportSizePercent;

        // Set radii proportionally (maintaining 280:370 ratio)
        this.outerRadius = baseSize / 2;
        this.innerRadius = this.outerRadius * (280 / 370);

        // Collision safety margin scales with roundabout size (1/3 of lane spacing)
        this.collisionMargin = (this.outerRadius - this.innerRadius) / 3;

        // Game variables
        this.score = 0;
        this.level = 1;
        this.gameOver = false;
        this.highScore = parseInt(localStorage.getItem('roundaboutRushHighScore')) || 0;

        // Orbit tracking for continuous gameplay
        this.currentOrbitLevel = 1;  // Which orbit's hazards are currently active
        this.nextOrbitLevel = 2;     // Which orbit is pre-generated

        // Movement variables
        this.currentAngle = 0;
        this.baseRotationSpeed = 1; // degrees per frame
        this.rotationSpeed = this.baseRotationSpeed;
        this.isOuterLane = true;
        this.isTransitioning = false;
        this.transitionSpeed = 0.15;

        // Hazard colors
        this.hazardColors = [0xff6600, 0xff0066, 0xffcc00, 0xff3366, 0x9900ff];

        // Powerup system
        this.activePowerup = null;  // Currently spawned powerup in world
        this.powerupSpawnedAtLevel = null;  // Level when current powerup spawned
        this.isInvincible = false;  // Invisibility effect active
        this.activeEffect = null;  // 'speed' or 'invisibility'
        this.activeEffectIcon = null;  // Visual indicator sprite
        this.effectStartAngle = null;  // Angle when effect was activated
        this.effectFlashWarning = false;  // Whether flash warning has started

        // Create layers
        this.createBackground();
        this.generateRoundabout();
        this.createScooter();
        this.createUI();
        this.setupInput();

        // Listen for resize events
        this.scale.on('resize', this.handleResize, this);

        // Initialize hazards array
        this.hazards = [];

        // Generate and spawn orbit 1 hazards (current level)
        const orbit1Hazards = this.generateHazardData(this.currentOrbitLevel);
        orbit1Hazards.forEach(hazard => {
            this.hazards.push(hazard);
            this.spawnHazardSprite(hazard);
        });

        // Pre-generate orbit 2 hazards (next level) but don't spawn yet
        const orbit2Hazards = this.generateHazardData(this.nextOrbitLevel);
        orbit2Hazards.forEach(hazard => {
            this.hazards.push(hazard);
            // Don't spawn - will spawn when player passes that angle
        });
    }

    createBackground() {
        // Dark gradient background (dynamic size)
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x2d3561, 0x2d3561, 0x1a1a2e, 0x1a1a2e, 1);
        bg.fillRect(0, 0, this.scale.width, this.scale.height);

        // Add some ambient glowing particles (dynamic positioning)
        const margin = 50;
        for (let i = 0; i < 20; i++) {
            const x = Phaser.Math.Between(margin, this.scale.width - margin);
            const y = Phaser.Math.Between(margin, this.scale.height - margin);
            const size = Phaser.Math.Between(1, 3);
            const alpha = Phaser.Math.FloatBetween(0.2, 0.6);

            const particle = this.add.circle(x, y, size, 0xffffff, alpha);

            // Gentle twinkling animation
            this.tweens.add({
                targets: particle,
                alpha: alpha * 0.3,
                duration: Phaser.Math.Between(2000, 4000),
                yoyo: true,
                repeat: -1
            });
        }
    }

    generateRoundabout() {
        // Radii are calculated in create() or handleResize()
        // Initialize player position on first level
        if (this.level === 1) {
            this.currentRadius = this.outerRadius;
            this.targetRadius = this.outerRadius;
        }

        // Fixed transition speed
        this.transitionSpeed = 0.15;

        // Draw roundabout lanes
        this.roundaboutGraphics = this.add.graphics();

        // Center circle (darker center area)
        this.roundaboutGraphics.fillStyle(0x1a1a2e, 0.6);
        this.roundaboutGraphics.fillCircle(this.centerX, this.centerY, this.innerRadius - 60);

        // Inner lane circle (guideline) - thicker and brighter
        this.roundaboutGraphics.lineStyle(3, 0x4a90e2, 0.7);
        this.roundaboutGraphics.strokeCircle(this.centerX, this.centerY, this.innerRadius);

        // Outer lane circle (guideline) - thicker and brighter
        this.roundaboutGraphics.lineStyle(3, 0x4a90e2, 0.7);
        this.roundaboutGraphics.strokeCircle(this.centerX, this.centerY, this.outerRadius);

        // Center glow - bigger and more visible
        this.centerGlow = this.add.circle(this.centerX, this.centerY, 35, 0x00bcd4, 0.6);
        this.tweens.add({
            targets: this.centerGlow,
            scale: 1.4,
            alpha: 0.3,
            duration: 2000,
            yoyo: true,
            repeat: -1
        });
    }

    createScooter() {
        // Create player as a glowing cyan dot (bigger and more prominent)
        this.scooter = this.add.container(0, 0);
        this.scooter.setDepth(10);  // Always render above roundabout

        // Outer glow (expanded)
        const outerGlow = this.add.circle(0, 0, 28, 0x00bcd4, 0.3);
        // Middle glow
        const middleGlow = this.add.circle(0, 0, 18, 0x00e5ff, 0.6);
        // Inner bright ring
        const innerRing = this.add.circle(0, 0, 12, 0x4dffff, 0.8);
        // Core
        const core = this.add.circle(0, 0, 8, 0xffffff, 1);

        this.scooter.add([outerGlow, middleGlow, innerRing, core]);

        // Pulsing animation on outer glow
        this.tweens.add({
            targets: outerGlow,
            scale: 1.3,
            alpha: 0.1,
            duration: 700,
            yoyo: true,
            repeat: -1
        });

        // Subtle pulse on inner ring
        this.tweens.add({
            targets: innerRing,
            scale: 1.1,
            alpha: 0.5,
            duration: 900,
            yoyo: true,
            repeat: -1
        });

        this.updateScooterPosition();
    }

    createUI() {
        // Responsive HUD font size
        const hudSize = Math.floor(Math.min(this.scale.width, this.scale.height) * 0.04) + 'px';

        // Score display - top left (dynamic position)
        this.scoreText = this.add.text(20, 20, 'SCORE: 0', {
            fontSize: hudSize,
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 3
        });
        this.scoreText.setDepth(100);  // Always on top

        // Level display - top right (dynamic position)
        this.levelText = this.add.text(this.scale.width - 20, 20, 'LEVEL: 1', {
            fontSize: hudSize,
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000',
            strokeThickness: 3
        }).setOrigin(1, 0);
        this.levelText.setDepth(100);  // Always on top

        // Game over overlay (hidden initially)
        this.gameOverContainer = this.add.container(this.centerX, this.centerY);
        this.gameOverContainer.setAlpha(0);
        this.gameOverContainer.setDepth(1000);  // Always render above everything

        // Responsive font sizes based on screen size
        const screenSize = Math.min(this.scale.width, this.scale.height);
        const titleSize = Math.floor(screenSize * 0.12) + 'px';
        const scoreSize = Math.floor(screenSize * 0.06) + 'px';
        const textSize = Math.floor(screenSize * 0.045) + 'px';
        const smallSize = Math.floor(screenSize * 0.035) + 'px';

        // Responsive vertical spacing
        const spacing = screenSize * 0.08;

        const overlay = this.add.rectangle(0, 0, this.scale.width * 2, this.scale.height * 2, 0x000000, 0.8);
        const gameOverText = this.add.text(0, -spacing * 1.5, 'GAME OVER', {
            fontSize: titleSize,
            fill: '#fff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#ff0000',
            strokeThickness: 4
        }).setOrigin(0.5);

        this.finalScoreText = this.add.text(0, -spacing * 0.3, '', {
            fontSize: scoreSize,
            fill: '#ffcc00',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.highScoreText = this.add.text(0, spacing * 0.4, '', {
            fontSize: textSize,
            fill: '#fff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.newRecordText = this.add.text(0, spacing * 1.1, 'NEW RECORD!', {
            fontSize: textSize,
            fill: '#00ff00',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#004400',
            strokeThickness: 3
        }).setOrigin(0.5).setAlpha(0);

        const restartText = this.add.text(0, spacing * 2, 'Press SPACE or TAP to restart', {
            fontSize: smallSize,
            fill: '#aaa',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        this.gameOverContainer.add([overlay, gameOverText, this.finalScoreText,
                                     this.highScoreText, this.newRecordText, restartText]);
    }

    setupInput() {
        // Keyboard input - simple lane switch
        this.input.keyboard.on('keydown-SPACE', () => {
            if (this.gameOver) {
                this.restartGame();
            } else {
                this.switchLane();
            }
        });

        // Mobile button - simple lane switch
        const mobileButton = document.getElementById('mobile-button');
        if (mobileButton) {
            // Store handler reference for proper cleanup
            this.mobileInputHandler = (e) => {
                e.preventDefault();
                if (this.gameOver) {
                    this.restartGame();
                } else {
                    this.switchLane();
                }
            };

            // Remove any existing listeners before adding new ones
            mobileButton.replaceWith(mobileButton.cloneNode(true));
            const freshButton = document.getElementById('mobile-button');

            freshButton.addEventListener('touchstart', this.mobileInputHandler);
            freshButton.addEventListener('click', this.mobileInputHandler);
        }
    }

    switchLane() {
        if (this.gameOver) return;

        this.isOuterLane = !this.isOuterLane;
        this.targetRadius = this.isOuterLane ? this.outerRadius : this.innerRadius;
        this.isTransitioning = true;
    }

    generateHazardData(orbitLevel) {
        // Calculate hazard count based on orbit level
        const baseHazards = 4;
        const additionalHazards = Math.floor(orbitLevel / 3);
        const hazardCount = Math.min(baseHazards + additionalHazards, 12);

        // 16 discrete angular positions
        const positions = [];
        for (let i = 0; i < 16; i++) {
            positions.push(i * 22.5);
        }

        // Shuffle and select positions
        Phaser.Utils.Array.Shuffle(positions);
        const selectedPositions = positions.slice(0, hazardCount);

        // Sort by angle for sequential lane assignment
        selectedPositions.sort((a, b) => a - b);

        // Track lane assignment pattern
        let previousLane = null;
        let previousWasSameLane = false;
        const generatedHazards = [];

        selectedPositions.forEach((angle, index) => {
            let lane;

            if (orbitLevel === 1 && index === 0) {
                // First hazard in first orbit - opposite of player's starting lane (outer)
                lane = 'inner';
            } else if (index === 0) {
                // First hazard in other orbits - random 50/50
                lane = Math.random() < 0.5 ? 'inner' : 'outer';
            } else if (previousWasSameLane) {
                // Previous hazard was in same lane as the one before it - force opposite
                lane = previousLane === 'inner' ? 'outer' : 'inner';
            } else {
                // 50% chance same lane, 50% chance opposite lane
                if (Math.random() < 0.5) {
                    lane = previousLane; // Same
                } else {
                    lane = previousLane === 'inner' ? 'outer' : 'inner'; // Opposite
                }
            }

            // Update tracking for next iteration
            previousWasSameLane = (lane === previousLane);
            previousLane = lane;

            const hazardColor = Phaser.Utils.Array.GetRandom(this.hazardColors);
            const radius = lane === 'outer' ? this.outerRadius : this.innerRadius;

            const hazard = {
                angle: angle,
                lane: lane,
                color: hazardColor,
                radius: radius,
                orbitLevel: orbitLevel,  // Track which orbit this belongs to
                spawned: false,          // Has sprite been created?
                passed: false,
                sprite: null
            };

            generatedHazards.push(hazard);
        });

        return generatedHazards;
    }

    spawnHazardSprite(hazard) {
        if (hazard.spawned || hazard.sprite) return;  // Already spawned

        // Create glowing hazard dot
        const rad = Phaser.Math.DegToRad(hazard.angle);
        const x = this.centerX + Math.cos(rad) * hazard.radius;
        const y = this.centerY + Math.sin(rad) * hazard.radius;

        const hazardContainer = this.add.container(x, y);

        // Outer glow - bigger
        const outerGlow = this.add.circle(0, 0, 22, hazard.color, 0.3);
        // Middle layer
        const middleGlow = this.add.circle(0, 0, 14, hazard.color, 0.7);
        // Inner bright ring
        const innerRing = this.add.circle(0, 0, 9, hazard.color, 0.85);
        // Core
        const core = this.add.circle(0, 0, 6, 0xffffff, 0.9);

        hazardContainer.add([outerGlow, middleGlow, innerRing, core]);
        hazardContainer.setDepth(5);  // Render above roundabout but below player

        // Gentle pulsing
        this.tweens.add({
            targets: outerGlow,
            scale: 1.4,
            alpha: 0.1,
            duration: 1000,
            yoyo: true,
            repeat: -1
        });

        // Core twinkle
        this.tweens.add({
            targets: core,
            alpha: 0.5,
            duration: 1200,
            yoyo: true,
            repeat: -1
        });

        hazard.sprite = hazardContainer;
        hazard.spawned = true;
    }

    spawnPowerup() {
        // Don't spawn if one already exists
        if (this.activePowerup) return;

        // Choose random type (50/50)
        const type = Math.random() < 0.5 ? 'speed' : 'invisibility';

        // Find available angle not occupied by current orbit hazards
        const occupiedAngles = this.hazards
            .filter(h => h.orbitLevel === this.currentOrbitLevel && !h.passed)
            .map(h => h.angle);

        // Generate all possible angles (16 positions at 22.5° intervals)
        const allAngles = [];
        for (let i = 0; i < 16; i++) {
            allAngles.push(i * 22.5);
        }

        // Filter out occupied angles (with buffer zone)
        const availableAngles = allAngles.filter(angle => {
            return !occupiedAngles.some(occupied => {
                const diff = Math.abs(angle - occupied);
                return diff < 22.5; // Require at least one position spacing
            });
        });

        // If no available angles, skip spawning
        if (availableAngles.length === 0) return;

        // Pick random available angle
        const angle = Phaser.Utils.Array.GetRandom(availableAngles);

        // Choose lane (50/50)
        const lane = Math.random() < 0.5 ? 'inner' : 'outer';
        const radius = lane === 'outer' ? this.outerRadius : this.innerRadius;

        // Calculate position
        const rad = Phaser.Math.DegToRad(angle);
        const x = this.centerX + Math.cos(rad) * radius;
        const y = this.centerY + Math.sin(rad) * radius;

        // Create powerup sprite
        const powerupContainer = this.add.container(x, y);

        if (type === 'speed') {
            // SNAIL GRAPHIC
            const color = 0x00ffff; // Cyan

            // Outer glow
            const outerGlow = this.add.circle(0, 0, 30, color, 0.3);
            powerupContainer.add(outerGlow);

            // Draw snail using graphics
            const snail = this.add.graphics();

            // Shell (spiral)
            snail.fillStyle(color, 0.8);
            snail.fillCircle(3, -2, 12);
            snail.lineStyle(2, 0xffffff, 0.9);
            snail.beginPath();
            snail.arc(3, -2, 8, 0, Math.PI * 1.5, false);
            snail.strokePath();
            snail.beginPath();
            snail.arc(3, -2, 5, 0, Math.PI * 1.5, false);
            snail.strokePath();

            // Body
            snail.fillStyle(color, 0.9);
            snail.fillEllipse(-5, 5, 14, 6);

            // Antennae
            snail.lineStyle(2, color, 1);
            snail.beginPath();
            snail.moveTo(-8, 2);
            snail.lineTo(-12, -4);
            snail.strokePath();
            snail.beginPath();
            snail.moveTo(-5, 2);
            snail.lineTo(-7, -5);
            snail.strokePath();

            // Antenna tips
            snail.fillStyle(0xffffff, 1);
            snail.fillCircle(-12, -4, 2);
            snail.fillCircle(-7, -5, 2);

            powerupContainer.add(snail);

            // Pulsing animation
            this.tweens.add({
                targets: outerGlow,
                scale: 1.5,
                alpha: 0.1,
                duration: 600,
                yoyo: true,
                repeat: -1
            });

        } else {
            // SHIELD GRAPHIC
            const color = 0xff00ff; // Magenta

            // Outer glow
            const outerGlow = this.add.circle(0, 0, 30, color, 0.3);
            powerupContainer.add(outerGlow);

            // Draw shield using graphics
            const shield = this.add.graphics();

            // Shield outline
            shield.lineStyle(3, 0xffffff, 1);
            shield.fillStyle(color, 0.8);
            shield.beginPath();
            shield.moveTo(0, -15);
            shield.lineTo(12, -10);
            shield.lineTo(12, 5);
            shield.lineTo(0, 15);
            shield.lineTo(-12, 5);
            shield.lineTo(-12, -10);
            shield.closePath();
            shield.fillPath();
            shield.strokePath();

            // Shield cross detail
            shield.lineStyle(2, 0xffffff, 0.9);
            shield.beginPath();
            shield.moveTo(0, -12);
            shield.lineTo(0, 12);
            shield.strokePath();
            shield.beginPath();
            shield.moveTo(-9, -2);
            shield.lineTo(9, -2);
            shield.strokePath();

            powerupContainer.add(shield);

            // Pulsing animation
            this.tweens.add({
                targets: outerGlow,
                scale: 1.5,
                alpha: 0.1,
                duration: 600,
                yoyo: true,
                repeat: -1
            });
        }

        powerupContainer.setDepth(5); // Same depth as hazards

        // Store powerup data
        this.activePowerup = {
            type: type,
            angle: angle,
            lane: lane,
            radius: radius,
            sprite: powerupContainer,
            collected: false
        };

        this.powerupSpawnedAtLevel = this.level;
    }

    despawnPowerup() {
        if (!this.activePowerup) return;

        // Fade out and destroy sprite
        if (this.activePowerup.sprite) {
            this.tweens.add({
                targets: this.activePowerup.sprite,
                alpha: 0,
                scale: 0.5,
                duration: 400,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    if (this.activePowerup && this.activePowerup.sprite) {
                        this.activePowerup.sprite.destroy();
                    }
                }
            });
        }

        // Reset powerup tracking
        this.activePowerup = null;
        this.powerupSpawnedAtLevel = null;
    }

    activatePowerup(type) {
        // Don't activate if already have an active effect
        if (this.activeEffect) return;

        this.activeEffect = type;
        this.effectStartAngle = this.currentAngle;
        this.effectFlashWarning = false;

        if (type === 'speed') {
            // Speed reduction effect
            const originalSpeed = this.rotationSpeed;
            this.rotationSpeed = originalSpeed * 0.5; // 50% reduction

            // Create snail icon on player
            const color = 0x00ffff; // Cyan
            this.activeEffectIcon = this.add.container(0, -35); // Position above player

            // Background glow
            const glow = this.add.circle(0, 0, 25, color, 0.3);
            this.activeEffectIcon.add(glow);

            // Draw snail (scaled up)
            const snail = this.add.graphics();
            snail.fillStyle(color, 0.9);
            snail.fillCircle(4, -3, 15);
            snail.lineStyle(2, 0xffffff, 1);
            snail.beginPath();
            snail.arc(4, -3, 10, 0, Math.PI * 1.5, false);
            snail.strokePath();
            snail.beginPath();
            snail.arc(4, -3, 6, 0, Math.PI * 1.5, false);
            snail.strokePath();
            snail.fillStyle(color, 1);
            snail.fillEllipse(-6, 6, 18, 8);
            snail.lineStyle(2, color, 1);
            snail.beginPath();
            snail.moveTo(-10, 3);
            snail.lineTo(-15, -5);
            snail.strokePath();
            snail.beginPath();
            snail.moveTo(-6, 3);
            snail.lineTo(-9, -6);
            snail.strokePath();
            snail.fillStyle(0xffffff, 1);
            snail.fillCircle(-15, -5, 2.5);
            snail.fillCircle(-9, -6, 2.5);

            this.activeEffectIcon.add(snail);
            this.scooter.add(this.activeEffectIcon);

            // Gentle pulse
            this.tweens.add({
                targets: glow,
                scale: 1.2,
                alpha: 0.1,
                duration: 400,
                yoyo: true,
                repeat: -1
            });

        } else if (type === 'invisibility') {
            // Invisibility effect
            this.isInvincible = true;

            // Create shield icon on player
            const color = 0xff00ff; // Magenta
            this.activeEffectIcon = this.add.container(0, -35); // Position above player

            // Background glow
            const glow = this.add.circle(0, 0, 25, color, 0.3);
            this.activeEffectIcon.add(glow);

            // Draw shield (scaled up slightly)
            const shield = this.add.graphics();
            shield.lineStyle(3, 0xffffff, 1);
            shield.fillStyle(color, 0.9);
            shield.beginPath();
            shield.moveTo(0, -18);
            shield.lineTo(14, -12);
            shield.lineTo(14, 6);
            shield.lineTo(0, 18);
            shield.lineTo(-14, 6);
            shield.lineTo(-14, -12);
            shield.closePath();
            shield.fillPath();
            shield.strokePath();
            shield.lineStyle(2, 0xffffff, 1);
            shield.beginPath();
            shield.moveTo(0, -15);
            shield.lineTo(0, 15);
            shield.strokePath();
            shield.beginPath();
            shield.moveTo(-11, -2);
            shield.lineTo(11, -2);
            shield.strokePath();

            this.activeEffectIcon.add(shield);
            this.scooter.add(this.activeEffectIcon);

            // Gentle pulse
            this.tweens.add({
                targets: glow,
                scale: 1.2,
                alpha: 0.1,
                duration: 350,
                yoyo: true,
                repeat: -1
            });
        }
    }

    deactivatePowerup() {
        if (!this.activeEffect) return;

        const type = this.activeEffect;

        // Restore effects
        if (type === 'speed') {
            this.rotationSpeed = this.baseRotationSpeed * (1 + (this.level - 1) * 0.007);
        } else if (type === 'invisibility') {
            this.isInvincible = false;
        }

        // Remove visual indicator
        if (this.activeEffectIcon) {
            this.activeEffectIcon.destroy();
            this.activeEffectIcon = null;
        }

        // Reset tracking
        this.activeEffect = null;
        this.effectStartAngle = null;
        this.effectFlashWarning = false;
    }

    updateScooterPosition() {
        // Smooth radius transition
        if (this.isTransitioning) {
            const diff = this.targetRadius - this.currentRadius;
            this.currentRadius += diff * this.transitionSpeed;

            if (Math.abs(diff) < 1) {
                this.currentRadius = this.targetRadius;
                this.isTransitioning = false;
            }
        }

        // Update position using polar coordinates
        const rad = Phaser.Math.DegToRad(this.currentAngle);
        this.scooter.x = this.centerX + Math.cos(rad) * this.currentRadius;
        this.scooter.y = this.centerY + Math.sin(rad) * this.currentRadius;
    }

    checkCollisions() {
        // Scale collision window with speed to prevent tunneling at high levels
        const collisionWindow = Math.max(8, this.rotationSpeed * 2);

        // CHECK 1: Current orbit hazards (collision detection + despawn)
        this.hazards.forEach(hazard => {
            if (hazard.passed) return;
            if (hazard.orbitLevel !== this.currentOrbitLevel) return;

            // Check if scooter is at or past this hazard position
            const angleDiff = this.currentAngle - hazard.angle;
            const normalizedDiff = ((angleDiff + 180) % 360) - 180;

            // Collision window: scales with rotation speed to prevent hazard skipping
            if (normalizedDiff >= -1 && normalizedDiff < collisionWindow) {
                // Check physical position (handles mid-transition correctly)
                const hitboxRadius = this.currentRadius;
                const hazardRadius = hazard.radius;
                const radiusDiff = Math.abs(hitboxRadius - hazardRadius);

                // Use collision margin for safe passage between lanes
                if (radiusDiff < this.collisionMargin) {
                    // Collision! (unless invincible)
                    if (!this.isInvincible) {
                        this.endGame();
                    }
                } else {
                    // Passed safely - award points
                    hazard.passed = true;
                    this.score += this.level;
                    this.updateScore();

                    // Delay 300ms before fading out current hazard
                    this.time.delayedCall(300, () => {
                        if (hazard.sprite && !this.gameOver) {
                            this.tweens.add({
                                targets: hazard.sprite,
                                alpha: 0,
                                scale: 0.5,
                                duration: 300,
                                ease: 'Cubic.easeIn',
                                onComplete: () => {
                                    if (hazard.sprite) {
                                        hazard.sprite.destroy();
                                        hazard.sprite = null;
                                    }
                                }
                            });
                        }
                    });
                }
            }
        });

        // CHECK 2: Next orbit hazards (spawning) - INDEPENDENT of despawn
        this.hazards.forEach(hazard => {
            if (hazard.spawned) return;
            if (hazard.orbitLevel !== this.nextOrbitLevel) return;

            // Check if player has reached this hazard's angle
            const angleDiff = this.currentAngle - hazard.angle;
            const normalizedDiff = ((angleDiff + 180) % 360) - 180;

            // Spawn when player reaches this angle (with 300ms delay)
            if (normalizedDiff >= -1 && normalizedDiff < collisionWindow) {
                this.time.delayedCall(300, () => {
                    if (!this.gameOver) {
                        this.spawnHazardSprite(hazard);
                    }
                });
            }
        });

        // CHECK 3: Powerup pickup
        if (this.activePowerup && !this.activePowerup.collected) {
            const angleDiff = this.currentAngle - this.activePowerup.angle;
            const normalizedDiff = ((angleDiff + 180) % 360) - 180;

            // Use same collision window as hazards
            if (normalizedDiff >= -1 && normalizedDiff < collisionWindow) {
                // Check if player is in same lane
                const playerRadius = this.currentRadius;
                const powerupRadius = this.activePowerup.radius;
                const radiusDiff = Math.abs(playerRadius - powerupRadius);

                // Use collision margin for pickup
                if (radiusDiff < this.collisionMargin) {
                    // Collected!
                    this.activePowerup.collected = true;
                    this.activatePowerup(this.activePowerup.type);

                    // Remove sprite with collection animation
                    if (this.activePowerup.sprite) {
                        this.tweens.add({
                            targets: this.activePowerup.sprite,
                            alpha: 0,
                            scale: 2,
                            duration: 300,
                            ease: 'Cubic.easeOut',
                            onComplete: () => {
                                if (this.activePowerup && this.activePowerup.sprite) {
                                    this.activePowerup.sprite.destroy();
                                    this.activePowerup.sprite = null;
                                }
                            }
                        });
                    }
                }
            }
        }
    }

    updateScore() {
        this.scoreText.setText('SCORE: ' + this.score);

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('roundaboutRushHighScore', this.highScore);
        }
    }

    updateSpeed() {
        // Speed increases 0.7% per level
        this.rotationSpeed = this.baseRotationSpeed * (1 + (this.level - 1) * 0.007);
    }

    checkOrbitComplete() {
        if (this.currentAngle >= 360) {
            this.currentAngle -= 360;

            // Adjust effectStartAngle to account for angle wrapping
            if (this.effectStartAngle !== null) {
                this.effectStartAngle -= 360;
            }

            // Advance orbit levels
            this.currentOrbitLevel++;
            this.nextOrbitLevel++;

            // Level up (for display)
            this.level++;
            this.levelText.setText('LEVEL: ' + this.level);

            // Update speed
            this.updateSpeed();

            // Subtle level transition effect (optional - much less intrusive)
            const flash = this.add.circle(this.centerX, this.centerY, 80, 0xffffff, 0.3);
            this.tweens.add({
                targets: flash,
                alpha: 0,
                scale: 2,
                duration: 300,
                ease: 'Cubic.easeOut',
                onComplete: () => flash.destroy()
            });

            // Generate new roundabout (seamless)
            this.roundaboutGraphics.destroy();
            this.centerGlow.destroy();
            this.generateRoundabout();

            // Pre-generate next orbit hazards (no delay needed)
            const nextOrbitHazards = this.generateHazardData(this.nextOrbitLevel);
            nextOrbitHazards.forEach(hazard => {
                this.hazards.push(hazard);
                // Don't spawn - will spawn when player passes that angle
            });

            // Clean up old hazards from previous orbits
            this.cleanupOldHazards();

            // Powerup lifecycle management
            // Check if we should despawn current powerup (after 3 levels)
            if (this.activePowerup && this.powerupSpawnedAtLevel !== null) {
                const levelsSincePowerup = this.level - this.powerupSpawnedAtLevel;
                if (levelsSincePowerup >= 3) {
                    this.despawnPowerup();
                }
            }

            // Check if we should spawn a new powerup (every 3 levels)
            if (this.level % 3 === 0 && !this.activePowerup) {
                this.spawnPowerup();
            }
        }
    }

    cleanupOldHazards() {
        // Remove hazards from orbits that are no longer relevant
        // Keep current and next orbit, remove everything else
        this.hazards = this.hazards.filter(hazard => {
            // Keep if it's current or next orbit
            if (hazard.orbitLevel >= this.currentOrbitLevel) {
                return true;
            }

            // Old orbit - destroy sprite if it exists and remove
            if (hazard.sprite) {
                hazard.sprite.destroy();
                hazard.sprite = null;
            }
            return false;
        });
    }

    endGame() {
        if (this.gameOver) return;

        this.gameOver = true;

        // Show game over screen
        this.finalScoreText.setText('Final Score: ' + this.score);
        this.highScoreText.setText('High Score: ' + this.highScore);

        if (this.score >= this.highScore && this.score > 0) {
            this.newRecordText.setAlpha(1);
        }

        this.tweens.add({
            targets: this.gameOverContainer,
            alpha: 1,
            duration: 500
        });
    }

    restartGame() {
        this.scene.restart();
    }

    update() {
        if (this.gameOver) return;

        // Auto-rotate scooter
        this.currentAngle += this.rotationSpeed;

        // Update scooter position
        this.updateScooterPosition();

        // Check for collisions and scoring
        this.checkCollisions();

        // Check if orbit is complete
        this.checkOrbitComplete();

        // Check powerup effect duration (half orbit = 180 degrees)
        if (this.activeEffect && this.effectStartAngle !== null) {
            let angleProgress = this.currentAngle - this.effectStartAngle;

            // Handle angle wrapping (e.g., started at 350°, now at 10°)
            if (angleProgress < 0) {
                angleProgress += 360;
            }

            // Flash warning at 150 degrees (83% of 180)
            if (angleProgress >= 150 && !this.effectFlashWarning) {
                this.effectFlashWarning = true;

                // Stop gentle pulse and start rapid flash on the glow (first child)
                if (this.activeEffectIcon && this.activeEffectIcon.list.length > 0) {
                    const glow = this.activeEffectIcon.list[0];
                    this.tweens.killTweensOf(glow);
                    this.tweens.add({
                        targets: glow,
                        alpha: 0.05,
                        duration: 100,
                        yoyo: true,
                        repeat: -1
                    });
                }
            }

            // End effect after 180 degrees (half orbit)
            if (angleProgress >= 180) {
                this.deactivatePowerup();
            }
        }
    }

    handleResize(gameSize) {
        // Update center
        this.centerX = gameSize.width / 2;
        this.centerY = gameSize.height / 2;

        // Recalculate roundabout size
        const viewportSizePercent = this.isMobile ? 0.95 : 0.75;
        const baseSize = Math.min(gameSize.width, gameSize.height) * viewportSizePercent;

        this.outerRadius = baseSize / 2;
        this.innerRadius = this.outerRadius * (280 / 370);

        // Update collision margin (scales with roundabout)
        this.collisionMargin = (this.outerRadius - this.innerRadius) / 3;

        // Update player target radii
        this.targetRadius = this.isOuterLane ? this.outerRadius : this.innerRadius;

        // Update UI positions
        if (this.levelText) {
            this.levelText.x = gameSize.width - 20;
        }
        if (this.gameOverContainer) {
            this.gameOverContainer.x = this.centerX;
            this.gameOverContainer.y = this.centerY;
        }

        // Regenerate roundabout graphics
        if (this.roundaboutGraphics) {
            this.roundaboutGraphics.destroy();
        }
        if (this.centerGlow) {
            this.centerGlow.destroy();
        }
        this.generateRoundabout();

        // Update player position
        this.updateScooterPosition();

        // Update all hazard positions
        this.hazards.forEach(hazard => {
            if (hazard.spawned && hazard.sprite) {
                // Recalculate hazard radius based on new radii
                hazard.radius = hazard.lane === 'outer' ? this.outerRadius : this.innerRadius;

                const rad = Phaser.Math.DegToRad(hazard.angle);
                const x = this.centerX + Math.cos(rad) * hazard.radius;
                const y = this.centerY + Math.sin(rad) * hazard.radius;

                hazard.sprite.x = x;
                hazard.sprite.y = y;
            }
        });

        // Update powerup position if it exists
        if (this.activePowerup && this.activePowerup.sprite) {
            // Recalculate powerup radius based on new radii
            this.activePowerup.radius = this.activePowerup.lane === 'outer' ? this.outerRadius : this.innerRadius;

            const rad = Phaser.Math.DegToRad(this.activePowerup.angle);
            const x = this.centerX + Math.cos(rad) * this.activePowerup.radius;
            const y = this.centerY + Math.sin(rad) * this.activePowerup.radius;

            this.activePowerup.sprite.x = x;
            this.activePowerup.sprite.y = y;
        }
    }
}

// Get the canvas element and its 2D rendering context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Get control buttons for touch/mobile input
const leftButton = document.getElementById('leftButton');
const jumpButton = document.getElementById('jumpButton'); // Now "Up" button
const rightButton = document.getElementById('rightButton');
const downButton = document.getElementById('downButton'); // New "Down" button
const fullscreenButton = document.getElementById('fullscreenButton'); // Get fullscreen button

// Get message box elements
const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');
const messageButton = document.getElementById('messageButton');

// Get question box elements
const questionBox = document.getElementById('questionBox');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');

// Get battle screen elements
const battleScreen = document.getElementById('battleScreen');
const startBattleButton = document.getElementById('startBattleButton');

// Game constants and variables
const GRAVITY = 0.05; // Reduced gravity for underwater feel
const WATER_DRAG = 0.93; // How much velocity is retained each frame (0.93 = 7% drag)
const SWIM_THRUST = 0.8; // Force applied when swimming up/down
const PLAYER_SPEED = 5; // Horizontal movement speed of the player

const GROUND_HEIGHT = 50; // Height of the ocean floor
const PLAYER_SCREEN_X = 150; // Player's fixed X position on the screen (relative to canvas)
const QUESTIONS_PER_BATTLE = 3; // Number of questions to answer correctly in a row per battle

// Player object - now `x` is its screen position, `worldX` is its position in the game world
let player = {
    x: PLAYER_SCREEN_X,
    y: 0, // Will be set in resizeCanvas/resetGame
    width: 60, // Player width
    height: 60, // Player height
    velocityY: 0,
    isGrounded: true // Still useful for resting on floor/platforms
};

// Define enemy height and width based on new player size
const ENEMY_HEIGHT = player.height + 20; // Fish might be slightly taller than player
const ENEMY_WIDTH = 80; // Fish width
const ENEMY_WALK_SPEED = 1; // How fast enemies roam
const ENEMY_WALK_RANGE = 100; // How far enemies roam from their spawn point

// Platform dimensions (for underwater structures like coral/rocks)
const PLATFORM_HEIGHT = 30; // Platform height
const PLATFORM_WIDTH_BASE = 120; // Base platform width

// Tracks the horizontal scroll offset of the game world
let worldXOffset = 0;

// Background elements - now store `originalX` for world coordinates and `parallaxFactor`
let backgroundElements = [];

// Keyboard input state
let keys = {
    left: false,
    right: false,
    up: false,   // For swimming up
    down: false  // For swimming down
};

// Game state
let gameRunning = false; // New state to control game loop
let gameOver = false;
let goalReached = false;
let currentLevelIndex = 0; // Tracks the current level

// Battle state variables
let battleState = 'idle'; // 'idle', 'active', 'questioning'
let currentEnemy = null; // Reference to the enemy currently being battled
let currentBattleQuestions = []; // Questions for the current battle
let currentQuestionIndex = 0; // Index of the current question in the battle
let correctAnswersInRow = 0; // Counter for consecutive correct answers

// --- Question Data (Categorized by difficulty) ---
const phishingQuestions = [
    // Level 1: Easier questions
    {
        question: "Which of these is a common sign of a phishing email?",
        options: ["Grammatical errors and typos", "A personalized greeting with your name", "It comes from a well-known company", "It has a legitimate-looking sender address"],
        correctAnswer: "Grammatical errors and typos",
        explanation: "Phishing emails often contain spelling and grammar mistakes as they are not professionally written.",
        difficulty: 1
    },
    {
        question: "What should you do if you receive a suspicious email asking for personal information?",
        options: ["Reply immediately with the requested information", "Click on all links to see where they lead", "Verify the sender by contacting the organization directly through a known, legitimate channel (not the email itself)", "Forward it to all your contacts as a warning"],
        correctAnswer: "Verify the sender by contacting the organization directly through a known, legitimate channel (not the email itself)",
        explanation: "Always verify suspicious requests through official channels. Never use contact info from the suspicious email itself.",
        difficulty: 1
    },
    {
        question: "What is 'phishing'?",
        options: ["A type of online game", "A technique used to catch fish", "A cybercrime where attackers try to trick you into revealing sensitive information", "A method for securing your computer network"],
        correctAnswer: "A cybercrime where attackers try to trick you into revealing sensitive information",
        explanation: "Phishing is a social engineering attack designed to trick individuals into divulging sensitive data.",
        difficulty: 1
    },
    // Level 2: Medium difficulty questions
    {
        question: "Which of these links is most likely to be malicious?",
        options: ["https://www.example.com/login", "https://secure.bank.com/account", "https://login.examp1e.co/verify", "https://support.company.org/help"],
        correctAnswer: "https://login.examp1e.co/verify",
        explanation: "Look for subtle misspellings or unusual domains. 'examp1e.co' is a common trick to mimic 'example.com'.",
        difficulty: 2
    },
    {
        question: "You receive an email claiming your bank account has been locked and asks you to click a link to unlock it. What's the safest action?",
        options: ["Click the link immediately to prevent further issues", "Call your bank using the phone number from their official website or statement", "Reply to the email asking for more details", "Assume it's legitimate and enter your credentials"],
        correctAnswer: "Call your bank using the phone number from their official website or statement",
        explanation: "Never click links in suspicious emails. Always contact the organization directly using a verified phone number or website.",
        difficulty: 2
    },
    {
        question: "What is 'Smishing'?",
        options: ["Phishing via email", "Phishing via text message (SMS)", "Phishing via phone call", "Phishing via social media"],
        correctAnswer: "Phishing via text message (SMS)",
        explanation: "Smishing is phishing conducted over text messages, often containing malicious links or requests for information.",
        difficulty: 2
    },
    // Level 3: Harder questions
    {
        question: "What is 'Vishing'?",
        options: ["Phishing via email", "Phishing via text message", "Phishing via phone call (voice)", "Phishing via video conference"],
        correctAnswer: "Phishing via phone call (voice)",
        explanation: "Vishing involves attackers using phone calls to trick victims into revealing sensitive information or performing actions.",
        difficulty: 3
    },
    {
        question: "An email offers you a prize but asks for your banking details to 'deposit' it. What should you do?",
        options: ["Provide your banking details to claim the prize", "Click a link to learn more about the prize", "Delete the email and report it as spam/phishing", "Share it with friends so they can also claim a prize"],
        correctAnswer: "Delete the email and report it as spam/phishing",
        explanation: "Legitimate lotteries or prize offers do not ask for banking details upfront. This is a common scam.",
        difficulty: 3
    }
];

// --- Level Data ---
const levels = [
    {
        levelNumber: 1,
        levelLength: 2000, // Shorter for first level
        enemyPositions: [600, 1200, 1800],
        platformPositions: [
            { x: 300, yOffset: 60, width: PLATFORM_WIDTH_BASE },
            { x: 900, yOffset: 90, width: PLATFORM_WIDTH_BASE + 20 }
        ],
        minQuestionDifficulty: 1 // Only questions with difficulty 1
    },
    {
        levelNumber: 2,
        levelLength: 3500, // Medium length
        enemyPositions: [400, 1000, 1700, 2500, 3200],
        platformPositions: [
            { x: 200, yOffset: 70, width: PLATFORM_WIDTH_BASE - 20 },
            { x: 700, yOffset: 100, width: PLATFORM_WIDTH_BASE + 30 },
            { x: 1400, yOffset: 60, width: PLATFORM_WIDTH_BASE },
            { x: 2000, yOffset: 110, width: PLATFORM_WIDTH_BASE + 40 },
            { x: 2800, yOffset: 80, width: PLATFORM_WIDTH_BASE - 10 }
        ],
        minQuestionDifficulty: 2 // Questions with difficulty 2 or higher
    },
    {
        levelNumber: 3,
        levelLength: 5000, // Longer level
        enemyPositions: [500, 1100, 1700, 2300, 2900, 3500, 4100, 4700],
        platformPositions: [
            { x: 300, yOffset: 80, width: PLATFORM_WIDTH_BASE },
            { x: 800, yOffset: 120, width: PLATFORM_WIDTH_BASE + 50 },
            { x: 1400, yOffset: 70, width: PLATFORM_WIDTH_BASE - 10 },
            { x: 2000, yOffset: 100, width: PLATFORM_WIDTH_BASE + 20 },
            { x: 2600, yOffset: 90, width: PLATFORM_WIDTH_BASE },
            { x: 3200, yOffset: 130, width: PLATFORM_WIDTH_BASE + 60 },
            { x: 3900, yOffset: 70, width: PLATFORM_WIDTH_BASE - 30 },
            { x: 4500, yOffset: 110, width: PLATFORM_WIDTH_BASE + 10 }
        ],
        minQuestionDifficulty: 3 // Only questions with difficulty 3
    }
];

/**
 * Displays a message box to the user.
 * @param {string} message - The message to display.
 * @param {function} callback - Function to call when the OK button is clicked.
 */
function showMessageBox(message, callback) {
    gameRunning = false; // Pause game when message box is shown
    messageText.textContent = message;
    messageBox.style.display = 'block';
    messageButton.onclick = () => {
        messageBox.style.display = 'none';
        if (callback) {
            callback();
        }
        // Only resume game if it's not game over and not in an active battle
        if (!gameOver && battleState === 'idle') {
            gameRunning = true;
        }
    };
}

/**
 * Displays a question box to the user.
 * @param {object} questionData - Object containing question, options, and correct answer.
 * @param {function} onAnswerCallback - Function to call after an answer is selected.
 */
function showQuestionBox(questionData, onAnswerCallback) {
    gameRunning = false; // Pause game
    questionBox.style.display = 'block';
    questionText.textContent = questionData.question;
    optionsContainer.innerHTML = ''; // Clear previous options

    questionData.options.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option;
        button.classList.add('control-button'); // Reuse button styling
        button.classList.remove('jump', 'left', 'right', 'down'); // Ensure all specific colors are removed
        button.style.backgroundColor = '#007bff'; // Default button color
        button.style.boxShadow = '0 5px #0056b3';

        button.onclick = () => {
            questionBox.style.display = 'none'; // Hide question box
            onAnswerCallback(option === questionData.correctAnswer, questionData.explanation); // Pass correct status and explanation
        };
        optionsContainer.appendChild(button);
    });
}

/**
 * Displays the battle splash screen and prepares for the battle.
 * @param {object} enemy - The enemy object that triggered the battle.
 */
function showBattleScreen(enemy) {
    gameRunning = false; // Pause game
    battleState = 'active'; // Set battle state to active
    currentEnemy = enemy; // Store reference to the enemy
    battleScreen.style.display = 'block';

    // Reset keys state when battle screen appears
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false; // Reset down key too

    // Select 3 random questions for this battle based on current level's difficulty
    currentBattleQuestions = [];
    const currentLevel = levels[currentLevelIndex];
    const availableQuestions = phishingQuestions.filter(q => q.difficulty >= currentLevel.minQuestionDifficulty);
    
    // Shuffle available questions and pick 3
    const shuffledQuestions = [...availableQuestions].sort(() => 0.5 - Math.random());
    for (let i = 0; i < QUESTIONS_PER_BATTLE; i++) {
        // Ensure we don't pick more questions than available if the pool is small
        if (i < shuffledQuestions.length) {
            currentBattleQuestions.push(shuffledQuestions[i]);
        } else {
            // Fallback if not enough questions (shouldn't happen with current data)
            currentBattleQuestions.push(phishingQuestions[Math.floor(Math.random() * phishingQuestions.length)]);
        }
    }

    currentQuestionIndex = 0;
    correctAnswersInRow = 0;
}

/**
 * Presents the next question in the battle sequence.
 */
function presentNextQuestion() {
    // If there are still questions left in the current battle set
    if (currentQuestionIndex < currentBattleQuestions.length) {
        const questionData = currentBattleQuestions[currentQuestionIndex];
        showQuestionBox(questionData, (isCorrect, explanation) => {
            if (isCorrect) {
                correctAnswersInRow++;
                currentQuestionIndex++; // Move to the next question in the battle sequence

                if (correctAnswersInRow === QUESTIONS_PER_BATTLE) {
                    // All questions answered correctly for this battle
                    // Show success message, then trigger battleWon after message dismissed
                    showMessageBox("Correct! You've answered all questions. Enemy defeated!", battleWon);
                } else {
                    // Not yet 3 correct answers, present the next question
                    showMessageBox(`Correct! You have ${correctAnswersInRow}/${QUESTIONS_PER_BATTLE} correct in a row.`, presentNextQuestion);
                }
            } else {
                // Incorrect answer, battle lost
                gameOver = true;
                showMessageBox(`Incorrect! The enemy defeated you. \n\nExplanation: ${explanation}\n\nRemember to be careful with suspicious requests!`, resetGame);
            }
        });
    }
}

/**
 * Handles actions when the battle is won.
 */
function battleWon() {
    if (currentEnemy) {
        currentEnemy.active = false; // Deactivate the enemy
    }
    battleState = 'idle'; // Reset battle state
    currentEnemy = null; // Clear enemy reference
    gameRunning = true; // Resume game

    // Reset keys state after battle is won and game resumes
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false; // Reset down key too

    // Show the success message after the battle state is fully reset
    showMessageBox("You defeated the enemy!", null); // No specific callback needed for this final message
}

/**
 * Initializes the current level's background elements.
 */
function initializeBackground() {
    backgroundElements = [];
    const levelData = levels[currentLevelIndex];
    const currentLevelLength = levelData.levelLength;

    // Add ground segments (ocean floor)
    let currentX = 0;
    while (currentX < currentLevelLength + canvas.width) {
        backgroundElements.push({
            type: 'ground',
            originalX: currentX,
            y: canvas.height - GROUND_HEIGHT,
            width: 200,
            height: GROUND_HEIGHT,
            color: '#8B4513', // Sandy/brown seabed
            parallaxFactor: 1 // Scrolls at full speed
        });
        currentX += 200; // Move to the next segment
    }

    // Add some simple "bubbles/debris" (formerly clouds)
    // Their positions are relative to level length
    backgroundElements.push({ type: 'cloud', originalX: 100, y: canvas.height * 0.2, width: 30, height: 30, color: 'rgba(255,255,255,0.5)', parallaxFactor: 0.1 }); // Smaller, semi-transparent bubbles
    backgroundElements.push({ type: 'cloud', originalX: 300, y: canvas.height * 0.4, width: 40, height: 40, color: 'rgba(255,255,255,0.4)', parallaxFactor: 0.15 });
    backgroundElements.push({ type: 'cloud', originalX: 550, y: canvas.height * 0.1, width: 25, height: 25, color: 'rgba(255,255,255,0.6)', parallaxFactor: 0.08 });
    backgroundElements.push({ type: 'cloud', originalX: currentLevelLength * 0.4, y: canvas.height * 0.3, width: 35, height: 35, color: 'rgba(255,255,255,0.45)', parallaxFactor: 0.12 });
    backgroundElements.push({ type: 'cloud', originalX: currentLevelLength * 0.6, y: canvas.height * 0.5, width: 45, height: 45, color: 'rgba(255,255,255,0.3)', parallaxFactor: 0.18 });
    backgroundElements.push({ type: 'cloud', originalX: currentLevelLength * 0.8, y: canvas.height * 0.25, width: 30, height: 30, color: 'rgba(255,255,255,0.55)', parallaxFactor: 0.1 });


    // Define enemy Y position (fish will float above ground)
    const ENEMY_Y_POSITION = canvas.height - GROUND_HEIGHT - ENEMY_HEIGHT - 30; // 30px above ground

    // Add enemies (fish) based on current level data
    levelData.enemyPositions.forEach(pos => {
        backgroundElements.push({
            type: 'enemy',
            originalX: pos,
            y: ENEMY_Y_POSITION, // Position enemies (fish) above the ground
            width: ENEMY_WIDTH,
            height: ENEMY_HEIGHT,
            color: '#FF4500', // Orange-red for fish
            parallaxFactor: 1,
            active: true, // Enemies are active until defeated
            spawnX: pos, // Store original spawn X for roaming
            walkDirection: 1, // 1 for right, -1 for left
        });
    });

    // Add platforms (underwater structures like coral/rocks)
    const PLATFORM_Y_OFFSET_BASE = 80; // Base height above ground for platforms
    levelData.platformPositions.forEach(p => {
        backgroundElements.push({
            type: 'platform',
            originalX: p.x,
            y: canvas.height - GROUND_HEIGHT - (PLATFORM_Y_OFFSET_BASE + (p.yOffset - 60)), // Adjust for new base offset
            width: p.width,
            height: PLATFORM_HEIGHT,
            color: '#A0522D', // Brown for coral/rocks
            parallaxFactor: 1,
            active: true
        });
    });


    // Add a "goal" (treasure chest) at the end of the level
    backgroundElements.push({
        type: 'goal',
        originalX: currentLevelLength - 100, // Goal position relative to current level length
        y: canvas.height - GROUND_HEIGHT - 50, // On the seabed
        width: 50,
        height: 50,
        color: '#DAA520', // Golden for treasure chest
        parallaxFactor: 1,
        active: true // Goal is always active
    });
}

/**
 * Updates the game state.
 * This function is called repeatedly in the game loop.
 */
function update() {
    if (!gameRunning || gameOver) return; // Only update if game is running and not over

    // Apply gravity (buoyancy)
    player.velocityY += GRAVITY;

    // Apply swimming thrust
    if (keys.up) {
        player.velocityY -= SWIM_THRUST;
    }
    if (keys.down) {
        player.velocityY += SWIM_THRUST;
    }

    // Apply water drag to vertical velocity
    player.velocityY *= WATER_DRAG;

    player.y += player.velocityY;

    // Keep player within vertical bounds (ocean surface and floor)
    if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
    }
    // Player collision with ocean floor
    if (player.y + player.height > canvas.height - GROUND_HEIGHT) {
        player.y = canvas.height - GROUND_HEIGHT - player.height;
        player.velocityY = 0;
        player.isGrounded = true; // Player is resting on the floor
    } else {
        player.isGrounded = false; // Player is floating
    }


    // Handle horizontal movement and world scrolling
    // Only allow movement if not in an active battle
    if (battleState === 'idle') {
        if (keys.left) {
            worldXOffset = Math.max(0, worldXOffset - PLAYER_SPEED);
        } else if (keys.right) {
            const currentLevel = levels[currentLevelIndex];
            worldXOffset = Math.min(currentLevel.levelLength - canvas.width + PLAYER_SCREEN_X, worldXOffset + PLAYER_SPEED);
        }
    }

    // Update enemy movement
    if (battleState === 'idle') { // Enemies only move when not in battle
        backgroundElements.forEach(element => {
            if (element.type === 'enemy' && element.active) {
                // Move enemy
                element.originalX += element.walkDirection * ENEMY_WALK_SPEED;

                // Check boundaries and reverse direction
                const minX = element.spawnX - ENEMY_WALK_RANGE;
                const maxX = element.spawnX + ENEMY_WALK_RANGE;

                if (element.originalX <= minX) {
                    element.originalX = minX; // Snap to boundary
                    element.walkDirection = 1; // Change to move right
                } else if (element.originalX >= maxX) {
                    element.originalX = maxX; // Snap to boundary
                    element.walkDirection = -1; // Change to move left
                }
            }
        });
    }


    // Collision detection with background elements (enemy, platform, and goal)
    for (let i = 0; i < backgroundElements.length; i++) {
        const element = backgroundElements[i];

        // Calculate element's current screen position based on its world position and scroll offset
        const elementScreenX = element.originalX - worldXOffset * element.parallaxFactor;

        // Only check collisions with active elements and if not in battle for enemies
        if (!element.active) continue;

        // Player collision with enemy (only if not in battle)
        if (element.type === 'enemy' && battleState === 'idle') {
            if (player.x < elementScreenX + element.width &&
                player.x + player.width > elementScreenX &&
                player.y < element.y + element.height &&
                player.y + player.height > element.y) {

                // Collision with an enemy, initiate battle
                showBattleScreen(element);
                return; // Stop updating while battle screen is active
            }
        }
        // Player collision with platform (now solid from all sides)
        else if (element.type === 'platform') {
            // Check for general AABB collision
            if (player.x < elementScreenX + element.width &&
                player.x + player.width > elementScreenX &&
                player.y < element.y + element.height &&
                player.y + player.height > element.y) {

                // Determine collision side to resolve
                const overlapX = Math.min(player.x + player.width, elementScreenX + element.width) - Math.max(player.x, elementScreenX);
                const overlapY = Math.min(player.y + player.height, element.y + element.height) - Math.max(player.y, element.y);

                if (overlapX < overlapY) { // Horizontal collision is smaller, so it's a side collision
                    if (player.x < elementScreenX) { // Player hit from left
                        // Adjust player's X to be just outside the platform
                        player.x = elementScreenX - player.width;
                        // Stop horizontal movement relative to the world
                        // (This is implicitly handled by not changing worldXOffset if collision prevents it)
                    } else { // Player hit from right
                        player.x = elementScreenX + element.width;
                    }
                } else { // Vertical collision is smaller, so it's a top/bottom collision
                    if (player.y < element.y) { // Player hit from top (landing on platform)
                        player.y = element.y - player.height;
                        player.velocityY = 0;
                        player.isGrounded = true; // Player is resting on platform
                    } else { // Player hit from bottom (bumping head on platform)
                        player.y = element.y + element.height;
                        player.velocityY = 0; // Stop upward movement
                    }
                }
            }
        }
    }

    // Win condition for current level: Check if the player has scrolled past the goal
    const currentLevel = levels[currentLevelIndex];
    const playerWorldX = PLAYER_SCREEN_X + worldXOffset;
    const goalElement = backgroundElements.find(el => el.type === 'goal');

    if (goalElement && playerWorldX > goalElement.originalX + goalElement.width && !goalReached) {
        goalReached = true; // Mark goal reached for this frame to prevent re-trigger

        if (currentLevelIndex < levels.length - 1) {
            // Advance to next level
            currentLevelIndex++;
            showMessageBox(`Level ${currentLevel.levelNumber} Complete! Moving to Level ${levels[currentLevelIndex].levelNumber}!`, () => {
                resetLevel(); // Reset game state for the new level
            });
        } else {
            // All levels complete!
            gameOver = true;
            showMessageBox("Congratulations! You completed all levels and mastered cybersecurity!", resetGame);
        }
        return; // Stop updating if goal reached
    }
}

/**
 * Draws all game elements on the canvas.
 * This function is called repeatedly in the game loop.
 */
function draw() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background elements
    for (let i = 0; i < backgroundElements.length; i++) {
        const element = backgroundElements[i];

        // Only draw active elements (enemies, goals, platforms) or always draw ground/clouds
        if (!element.active && element.type !== 'ground' && element.type !== 'cloud' && element.type !== 'platform') continue;

        // Calculate element's current screen position based on its world position and scroll offset
        const elementScreenX = element.originalX - worldXOffset * element.parallaxFactor;

        // Only draw elements that are within the visible canvas area
        if (elementScreenX + element.width > 0 && elementScreenX < canvas.width) {
            // Use fillRect for all elements as sprites are removed
            ctx.fillStyle = element.color;
            ctx.fillRect(elementScreenX, element.y, element.width, element.height);
        }
    }

    // Draw the player (always on top)
    ctx.fillStyle = 'red'; // Color for the swimming guy
    ctx.fillRect(player.x, player.y, player.width, player.height);
}

/**
 * The main game loop.
 * Calls update and draw functions, then requests the next animation frame.
 */
function gameLoop() {
    update(); // Update game state
    draw();   // Redraw elements
    requestAnimationFrame(gameLoop); // Request next frame
}

/**
 * Resets the game to its initial state (Level 1).
 */
function resetGame() {
    currentLevelIndex = 0; // Reset to the first level
    resetLevel(); // Call resetLevel to initialize the first level
}

/**
 * Resets the current level's state (player position, world offset, re-initializes background).
 */
function resetLevel() {
    worldXOffset = 0; // Reset world scroll
    // Player starts floating slightly above the seabed
    player.y = canvas.height - GROUND_HEIGHT - player.height - 20; 
    player.velocityY = 0;
    player.isGrounded = false; // Player starts floating
    gameOver = false;
    goalReached = false; // Reset goalReached for the new level
    battleState = 'idle'; // Reset battle state
    currentEnemy = null;
    currentBattleQuestions = [];
    currentQuestionIndex = 0;
    correctAnswersInRow = 0;

    // Reset keys state
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false; // Reset down key

    initializeBackground(); // Re-initialize background elements for the current level
    gameRunning = true; // Ensure game is running
}


// --- Event Listeners ---

// Keyboard input for desktop
document.addEventListener('keydown', (e) => {
    if (!gameRunning) return; // Only allow input if game is running
    switch (e.key) {
        case 'ArrowLeft':
        case 'a': // 'A' key for left
            keys.left = true;
            break;
        case 'ArrowRight':
        case 'd': // 'D' key for right
            keys.right = true;
            break;
        case 'ArrowUp':
        case 'w': // 'W' key for swim up
            keys.up = true;
            break;
        case 'ArrowDown': // New: ArrowDown for swim down
        case 's': // New: 'S' key for swim down
            keys.down = true;
            break;
    }
});

document.addEventListener('keyup', (e) => {
    if (!gameRunning) return; // Only allow input if game is running
    switch (e.key) {
        case 'ArrowLeft':
        case 'a': // 'A' key for left
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'd': // 'D' for right
            keys.right = false;
            break;
        case 'ArrowUp':
        case 'w': // 'W' for swim up
            keys.up = false;
            break;
        case 'ArrowDown': // New: ArrowDown for swim down
        case 's': // New: 'S' for swim down
            keys.down = false;
            break;
    }
});

// Touch/Click input for mobile controls
leftButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.left = true; });
leftButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.left = false; });
leftButton.addEventListener('mousedown', () => { if(gameRunning) keys.left = true; });
leftButton.addEventListener('mouseup', () => { keys.left = false; });
leftButton.addEventListener('mouseleave', () => { keys.left = false; }); // For mouse leaving button area

rightButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.right = true; });
rightButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.right = false; });
rightButton.addEventListener('mousedown', () => { if(gameRunning) keys.right = true; });
rightButton.addEventListener('mouseup', () => { keys.right = false; });
rightButton.addEventListener('mouseleave', () => { keys.right = false; });

jumpButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.up = true; });
jumpButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.up = false; });
jumpButton.addEventListener('mousedown', () => { if(gameRunning) keys.up = true; });
jumpButton.addEventListener('mouseup', () => { keys.up = false; });
jumpButton.addEventListener('mouseleave', () => { keys.up = false; });

// New: Down button event listeners
downButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.down = true; });
downButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.down = false; });
downButton.addEventListener('mousedown', () => { if(gameRunning) keys.down = true; });
downButton.addEventListener('mouseup', () => { keys.down = false; });
downButton.addEventListener('mouseleave', () => { keys.down = false; });


// Event listener for the "Start Battle" button on the battle screen
startBattleButton.addEventListener('click', () => {
    battleScreen.style.display = 'none'; // Hide battle screen
    presentNextQuestion(); // Start presenting questions
});

// Fullscreen button event listener
fullscreenButton.addEventListener('click', () => {
    if (document.fullscreenElement) {
        // If already in fullscreen, exit fullscreen
        document.exitFullscreen().catch(err => {
            console.error(`Error attempting to exit fullscreen: ${err.message} (${err.name})`);
        });
    } else {
        // If not in fullscreen, request fullscreen for the body
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message} (${err.name})`);
            showMessageBox("Fullscreen failed. Your browser may require specific settings or a direct user gesture.", null);
        });
    }
});


// Handle canvas resizing to maintain responsiveness
function resizeCanvas() {
    // Set canvas display size based on CSS, then set internal drawing buffer size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Adjust player's initial Y position based on new canvas height
    player.y = canvas.height - GROUND_HEIGHT - player.height;

    // Re-initialize background elements with correct Y positions and new canvas width
    // This is important because level elements depend on canvas.height
    initializeBackground();
}

// Initial setup on window load
window.addEventListener('load', () => {
    resizeCanvas(); // Set initial canvas size and player Y
    gameRunning = true; // Game starts immediately
    resetGame(); // Ensure game state is reset and ready (starts Level 1)
    gameLoop(); // Start the main game loop
});
window.addEventListener('resize', resizeCanvas); // Listen for window resize events

// Get the canvas element and its 2D rendering context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Get control buttons for touch/mobile input
const leftButton = document.getElementById('leftButton');
const jumpButton = document.getElementById('jumpButton');
const rightButton = document.getElementById('rightButton');

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
const GRAVITY = 0.5; // Strength of gravity
const PLAYER_SPEED = 5; // Horizontal movement speed of the player
const JUMP_STRENGTH = -10; // How high the player jumps (negative because Y-axis is inverted)
const GROUND_HEIGHT = 50; // Height of the ground from the bottom of the canvas
const LEVEL_LENGTH = 5000; // Increased total length of the game world in world coordinates
const PLAYER_SCREEN_X = 150; // Player's fixed X position on the screen (relative to canvas)
const QUESTIONS_PER_BATTLE = 3; // Number of questions to answer correctly in a row per battle
const ENEMY_HEIGHT = 100; // Height of enemies, making them unjumpable
const ENEMY_WALK_SPEED = 1; // How fast enemies roam
const ENEMY_WALK_RANGE = 100; // How far enemies roam from their spawn point

// Player object - now `x` is its screen position, `worldX` is its position in the game world
let player = {
    x: PLAYER_SCREEN_X,
    y: 0, // Will be set in resizeCanvas/resetGame
    width: 30,
    height: 30,
    velocityY: 0,
    isGrounded: true
};

// Tracks the horizontal scroll offset of the game world
let worldXOffset = 0;

// Background elements - now store `originalX` for world coordinates and `parallaxFactor`
let backgroundElements = [];

// Keyboard input state
let keys = {
    left: false,
    right: false,
    up: false // For jump
};

// Game state
let gameRunning = false; // New state to control game loop
let gameOver = false;
let goalReached = false;

// Battle state variables
let battleState = 'idle'; // 'idle', 'active', 'questioning'
let currentEnemy = null; // Reference to the enemy currently being battled
let currentBattleQuestions = []; // Questions for the current battle
let currentQuestionIndex = 0; // Index of the current question in the battle
let correctAnswersInRow = 0; // Counter for consecutive correct answers

// --- Question Data ---
const phishingQuestions = [
    {
        question: "Which of these is a common sign of a phishing email?",
        options: [
            "Grammatical errors and typos",
            "A personalized greeting with your name",
            "It comes from a well-known company",
            "It has a legitimate-looking sender address"
        ],
        correctAnswer: "Grammatical errors and typos",
        explanation: "Phishing emails often contain spelling and grammar mistakes as they are not professionally written."
    },
    {
        question: "What should you do if you receive a suspicious email asking for personal information?",
        options: [
            "Reply immediately with the requested information",
            "Click on all links to see where they lead",
            "Verify the sender by contacting the organization directly through a known, legitimate channel (not the email itself)",
            "Forward it to all your contacts as a warning"
        ],
        correctAnswer: "Verify the sender by contacting the organization directly through a known, legitimate channel (not the email itself)",
        explanation: "Always verify suspicious requests through official channels. Never use contact info from the suspicious email itself."
    },
    {
        question: "Which of these links is most likely to be malicious?",
        options: [
            "https://www.example.com/login",
            "https://secure.bank.com/account",
            "https://login.examp1e.co/verify", // Note the '1' instead of 'l'
            "https://support.company.org/help"
        ],
        correctAnswer: "https://login.examp1e.co/verify",
        explanation: "Look for subtle misspellings or unusual domains. 'examp1e.co' is a common trick to mimic 'example.com'."
    },
    {
        question: "What is 'phishing'?",
        options: [
            "A type of online game",
            "A technique used to catch fish",
            "A cybercrime where attackers try to trick you into revealing sensitive information",
            "A method for securing your computer network"
        ],
        correctAnswer: "A cybercrime where attackers try to trick you into revealing sensitive information",
        explanation: "Phishing is a social engineering attack designed to trick individuals into divulging sensitive data."
    },
    {
        question: "You receive an email claiming your bank account has been locked and asks you to click a link to unlock it. What's the safest action?",
        options: [
            "Click the link immediately to prevent further issues",
            "Call your bank using the phone number from their official website or statement",
            "Reply to the email asking for more details",
            "Assume it's legitimate and enter your credentials"
        ],
        correctAnswer: "Call your bank using the phone number from their official website or statement",
        explanation: "Never click links in suspicious emails. Always contact the organization directly using a verified phone number or website."
    },
    {
        question: "What is 'Smishing'?",
        options: [
            "Phishing via email",
            "Phishing via text message (SMS)",
            "Phishing via phone call",
            "Phishing via social media"
        ],
        correctAnswer: "Phishing via text message (SMS)",
        explanation: "Smishing is phishing conducted over text messages, often containing malicious links or requests for information."
    },
    {
        question: "What is 'Vishing'?",
        options: [
            "Phishing via email",
            "Phishing via text message",
            "Phishing via phone call (voice)",
            "Phishing via video conference"
        ],
        correctAnswer: "Phishing via phone call (voice)",
        explanation: "Vishing involves attackers using phone calls to trick victims into revealing sensitive information or performing actions."
    },
    {
        question: "An email offers you a prize but asks for your banking details to 'deposit' it. What should you do?",
        options: [
            "Provide your banking details to claim the prize",
            "Click a link to learn more about the prize",
            "Delete the email and report it as spam/phishing",
            "Share it with friends so they can also claim a prize"
        ],
        correctAnswer: "Delete the email and report it as spam/phishing",
        explanation: "Legitimate lotteries or prize offers do not ask for banking details upfront. This is a common scam."
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
        button.classList.remove('jump', 'left', 'right'); // Remove specific colors if present
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

    // Select 3 random questions for this battle
    currentBattleQuestions = [];
    // Create a temporary copy and shuffle to pick unique questions for this battle
    const shuffledQuestions = [...phishingQuestions].sort(() => 0.5 - Math.random());
    for (let i = 0; i < QUESTIONS_PER_BATTLE; i++) {
        currentBattleQuestions.push(shuffledQuestions[i]);
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

    // Show the success message after the battle state is fully reset
    showMessageBox("You defeated the enemy!", null); // No specific callback needed for this final message
}

/**
 * Initializes the background elements, including ground, clouds, goal, and enemies.
 */
function initializeBackground() {
    backgroundElements = [];

    // Add ground segments
    let currentX = 0;
    while (currentX < LEVEL_LENGTH + canvas.width) {
        backgroundElements.push({
            type: 'ground',
            originalX: currentX,
            y: canvas.height - GROUND_HEIGHT,
            width: 200,
            height: GROUND_HEIGHT,
            color: '#4CAF50', // Green ground
            parallaxFactor: 1 // Scrolls at full speed
        });
        currentX += 200; // Move to the next segment
    }

    // Add some simple "clouds" for visual variety and parallax effect
    backgroundElements.push({ type: 'cloud', originalX: 100, y: canvas.height - GROUND_HEIGHT - 80, width: 60, height: 30, color: '#ADD8E6', parallaxFactor: 0.2 });
    backgroundElements.push({ type: 'cloud', originalX: 300, y: canvas.height - GROUND_HEIGHT - 120, width: 80, height: 40, color: '#ADD8E6', parallaxFactor: 0.3 });
    backgroundElements.push({ type: 'cloud', originalX: 550, y: canvas.height - GROUND_HEIGHT - 100, width: 70, height: 35, color: '#ADD8E6', parallaxFactor: 0.25 });
    backgroundElements.push({ type: 'cloud', originalX: 900, y: canvas.height - GROUND_HEIGHT - 90, width: 90, height: 45, color: '#ADD8E6', parallaxFactor: 0.35 });
    backgroundElements.push({ type: 'cloud', originalX: 1200, y: canvas.height - GROUND_HEIGHT - 110, width: 75, height: 38, color: '#ADD8E6', parallaxFactor: 0.28 });
    backgroundElements.push({ type: 'cloud', originalX: 1500, y: canvas.height - GROUND_HEIGHT - 100, width: 80, height: 40, color: '#ADD8E6', parallaxFactor: 0.32 });
    backgroundElements.push({ type: 'cloud', originalX: 1800, y: canvas.height - GROUND_HEIGHT - 85, width: 65, height: 33, color: '#ADD8E6', parallaxFactor: 0.23 });
    backgroundElements.push({ type: 'cloud', originalX: 2100, y: canvas.height - GROUND_HEIGHT - 115, width: 85, height: 42, color: '#ADD8E6', parallaxFactor: 0.3 });
    backgroundElements.push({ type: 'cloud', originalX: 2400, y: canvas.height - GROUND_HEIGHT - 95, width: 70, height: 36, color: '#ADD8E6', parallaxFactor: 0.27 });
    backgroundElements.push({ type: 'cloud', originalX: 2700, y: canvas.height - GROUND_HEIGHT - 105, width: 95, height: 48, color: '#ADD8E6', parallaxFactor: 0.38 });

    // Define enemy height to be 100 pixels
    const ENEMY_Y_POSITION = canvas.height - GROUND_HEIGHT - ENEMY_HEIGHT;

    // Add enemies with questions
    const enemyPositions = [600, 1200, 1800, 2400, 3000, 3600, 4200]; // More enemies for longer level
    enemyPositions.forEach(pos => {
        backgroundElements.push({
            type: 'enemy',
            originalX: pos,
            y: ENEMY_Y_POSITION, // Position enemies on the ground
            width: 40,
            height: ENEMY_HEIGHT, // Set the new height to 100px
            color: '#8B008B', // Dark magenta for enemies
            parallaxFactor: 1,
            active: true, // Enemies are active until defeated
            spawnX: pos, // Store original spawn X for roaming
            walkDirection: 1, // 1 for right, -1 for left
        });
    });

    // Add platforms/hills
    backgroundElements.push({
        type: 'platform',
        originalX: 300, y: canvas.height - GROUND_HEIGHT - 60, width: 80, height: 20, color: '#A0522D', parallaxFactor: 1, active: true
    });
    backgroundElements.push({
        type: 'platform',
        originalX: 700, y: canvas.height - GROUND_HEIGHT - 90, width: 100, height: 20, color: '#A0522D', parallaxFactor: 1, active: true
    });
    backgroundElements.push({
        type: 'platform',
        originalX: 1100, y: canvas.height - GROUND_HEIGHT - 60, width: 60, height: 20, color: '#A0522D', parallaxFactor: 1, active: true
    });
    backgroundElements.push({
        type: 'platform',
        originalX: 1500, y: canvas.height - GROUND_HEIGHT - 120, width: 120, height: 20, color: '#A0522D', parallaxFactor: 1, active: true
    });
    backgroundElements.push({
        type: 'platform',
        originalX: 2200, y: canvas.height - GROUND_HEIGHT - 70, width: 90, height: 20, color: '#A0522D', parallaxFactor: 1, active: true
    });
    backgroundElements.push({
        type: 'platform',
        originalX: 2800, y: canvas.height - GROUND_HEIGHT - 100, width: 110, height: 20, color: '#A0522D', parallaxFactor: 1, active: true
    });
    backgroundElements.push({
        type: 'platform',
        originalX: 3300, y: canvas.height - GROUND_HEIGHT - 60, width: 70, height: 20, color: '#A0522D', parallaxFactor: 1, active: true
    });
    backgroundElements.push({
        type: 'platform',
        originalX: 3800, y: canvas.height - GROUND_HEIGHT - 90, width: 100, height: 20, color: '#A0522D', parallaxFactor: 1, active: true
    });
    backgroundElements.push({
        type: 'platform',
        originalX: 4500, y: canvas.height - GROUND_HEIGHT - 130, width: 80, height: 20, color: '#A0522D', parallaxFactor: 1, active: true
    });


    // Add a "goal" at the end of the level
    backgroundElements.push({
        type: 'goal',
        originalX: LEVEL_LENGTH - 100, // World position of the goal, slightly before the end
        y: canvas.height - GROUND_HEIGHT - 50,
        width: 50,
        height: 50,
        color: '#0000FF', // Blue for goal
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

    // Apply gravity to player's vertical velocity
    player.velocityY += GRAVITY;
    player.y += player.velocityY;

    // Check if player hits the ground
    if (player.y + player.height > canvas.height - GROUND_HEIGHT) {
        player.y = canvas.height - GROUND_HEIGHT - player.height; // Snap to ground
        player.velocityY = 0; // Stop vertical movement
        player.isGrounded = true; // Player is grounded
    }

    // Handle horizontal movement and world scrolling
    // Only allow movement if not in an active battle
    if (battleState === 'idle') {
        if (keys.left) {
            worldXOffset = Math.max(0, worldXOffset - PLAYER_SPEED);
        } else if (keys.right) {
            worldXOffset = Math.min(LEVEL_LENGTH - canvas.width + PLAYER_SCREEN_X, worldXOffset + PLAYER_SPEED);
        }
    }

    // Handle jump input
    if (keys.up && player.isGrounded) {
        player.velocityY = JUMP_STRENGTH; // Apply jump force
        player.isGrounded = false; // Player is no longer grounded
        keys.up = false; // Consume jump input to prevent multiple jumps
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
        // Player collision with platform
        else if (element.type === 'platform') {
            // Check if player is falling and lands on top of the platform
            if (player.velocityY >= 0 && // Player is falling or stationary vertically
                player.x < elementScreenX + element.width &&
                player.x + player.width > elementScreenX &&
                player.y + player.height <= element.y + player.velocityY && // Player's bottom is above or just touching platform top
                player.y + player.height + player.velocityY > element.y) { // Player will intersect platform next frame
                
                player.y = element.y - player.height; // Snap to top of platform
                player.velocityY = 0; // Stop vertical movement
                player.isGrounded = true; // Player is grounded on platform
            }
        }
    }

    // Win condition: Check if the player has scrolled past the goal
    // The player's world position is `PLAYER_SCREEN_X + worldXOffset`
    const playerWorldX = PLAYER_SCREEN_X + worldXOffset;
    const goalElement = backgroundElements.find(el => el.type === 'goal');

    if (goalElement && playerWorldX > goalElement.originalX + goalElement.width && !goalReached) {
        goalReached = true;
        gameOver = true;
        showMessageBox("Congratulations! You successfully avoided the phishing trap! \n\nThis simulates identifying a safe link.", resetGame);
        return; // Stop updating if game over
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

        ctx.fillStyle = element.color;

        // Calculate element's current screen position based on its world position and scroll offset
        const elementScreenX = element.originalX - worldXOffset * element.parallaxFactor;

        // Only draw elements that are within the visible canvas area
        if (elementScreenX + element.width > 0 && elementScreenX < canvas.width) {
            ctx.fillRect(elementScreenX, element.y, element.width, element.height);
        }
    }

    // Draw the player
    ctx.fillStyle = 'red'; // Player color
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
 * Resets the game to its initial state.
 */
function resetGame() {
    worldXOffset = 0; // Reset world scroll
    player.y = canvas.height - GROUND_HEIGHT - player.height; // Reset player Y
    player.velocityY = 0;
    player.isGrounded = true;
    gameOver = false;
    goalReached = false;
    battleState = 'idle'; // Reset battle state
    currentEnemy = null;
    currentBattleQuestions = [];
    currentQuestionIndex = 0;
    correctAnswersInRow = 0;

    // Reset keys state on full game reset
    keys.left = false;
    keys.right = false;
    keys.up = false;

    initializeBackground(); // Re-initialize background elements with new positions
    gameRunning = true; // Start game again after reset
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
        case ' ': // Spacebar for jump
        case 'w': // 'W' key for jump
            keys.up = true;
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
        case ' ':
        case 'w': // 'W' for jump
            keys.up = false;
            break;
    }
});

// Touch/Click input for mobile controls
leftButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.left = true; });
leftButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.left = false; });
leftButton.addEventListener('mousedown', () => { if(gameRunning) keys.left = true; });
leftButton.mouseup = () => { keys.left = false; };
leftButton.addEventListener('mouseleave', () => { keys.left = false; }); // For mouse leaving button area

rightButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.right = true; });
rightButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.right = false; });
rightButton.addEventListener('mousedown', () => { if(gameRunning) keys.right = true; });
rightButton.mouseup = () => { keys.right = false; };
rightButton.addEventListener('mouseleave', () => { keys.right = false; });

jumpButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.up = true; });
jumpButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.up = false; });
jumpButton.addEventListener('mousedown', () => { if(gameRunning) keys.up = true; });
jumpButton.mouseup = () => { keys.up = false; };
jumpButton.addEventListener('mouseleave', () => { keys.up = false; });

// Event listener for the "Start Battle" button on the battle screen
startBattleButton.addEventListener('click', () => {
    battleScreen.style.display = 'none'; // Hide battle screen
    presentNextQuestion(); // Start presenting questions
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
    initializeBackground();
}

// Initial setup on window load
window.addEventListener('load', () => {
    resizeCanvas(); // Set initial canvas size and player Y
    gameRunning = true; // Game starts immediately
    resetGame(); // Ensure game state is reset and ready
    gameLoop(); // Start the main game loop
});
window.addEventListener('resize', resizeCanvas); // Listen for window resize events

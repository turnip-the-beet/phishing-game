// Removed Firebase modules import
// import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
// import { getAuth, signInAnonymously, signInWithCustomToken } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
// import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

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

// Get Username Input Box elements
const usernameInputBox = document.getElementById('usernameInputBox');
const usernameInput = document.getElementById('usernameInput');
const saveScoreButton = document.getElementById('saveScoreButton');
const finalScoreText = document.getElementById('finalScoreText');

// Get Leaderboard Box elements
const leaderboardBox = document.getElementById('leaderboardBox');
const leaderboardList = document.getElementById('leaderboardList');
const playAgainButton = document.getElementById('playAgainButton');


// Game constants and variables
const GRAVITY = 0.05; // Reduced gravity for underwater feel
const WATER_DRAG = 0.93; // How much velocity is retained each frame (0.93 = 7% drag)
const SWIM_THRUST = 1.5; // Increased Force applied when swimming up/down
const PLAYER_SPEED = 8; // Horizontal movement speed of the player

const GROUND_HEIGHT = 50; // Height of the ocean floor
const PLAYER_SCREEN_X_OFFSET = 150; // Player's target X position on screen (relative to camera)
const QUESTIONS_PER_BATTLE = 3; // Number of questions to answer correctly in a row per battle

// Player object - now `x` and `y` are WORLD coordinates
let player = {
    x: 0, // Player's world X position
    y: 0, // Player's world Y position
    screenX: 0, // Player's screen X position (derived)
    screenY: 0, // Player's screen Y position (derived)
    width: 60, // Player width
    height: 60, // Player height
    velocityY: 0,
    isGrounded: false // Player starts floating
};

// Enemy (Fish) properties
const MIN_FISH_SIZE = 50; // Minimum dimension for a fish (width/height)
const MAX_FISH_SIZE = 100; // Maximum dimension for a fish
const ENEMY_CHASE_SPEED = 3; // How fast enemies move towards player
const ENEMY_DETECTION_RADIUS = 500; // How close player needs to be for enemy to start chasing

// Platform dimensions (for underwater structures like coral/rocks)
const PLATFORM_HEIGHT = 30; // Platform height
const PLATFORM_WIDTH_BASE = 120; // Base platform width

// Camera variables
let worldXOffset = 0; // Horizontal scroll offset of the game world
let worldYOffset = 0; // Vertical scroll offset of the game world
const CAMERA_VERTICAL_CENTER_Y = 0.5; // Target vertical center of the camera (0.5 = middle of canvas)
const CAMERA_VERTICAL_DEADZONE = 50; // How far player can move vertically before camera adjusts

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
let score = 0; // Player's current score

// Battle state variables
let battleState = 'idle'; // 'idle', 'active', 'questioning'
let currentEnemy = null; // Reference to the enemy currently being battled
let currentBattleQuestions = []; // Questions for the current battle
let currentQuestionIndex = 0; // Index of the current question in the battle
let correctAnswersInRow = 0; // Counter for consecutive correct answers
let isBattling = false; // Flag to prevent multiple battle triggers

// --- AirTable Configuration ---
// IMPORTANT: Replace these placeholder values with your actual AirTable Personal Access Token and Base ID!
// 1. Generate a Personal Access Token (PAT): Go to airtable.com/create/tokens
//    - Name: Give it a descriptive name (e.g., "Game Leaderboard Token")
//    - Scopes: Add 'data.records:read', 'data.records:write', 'schema.bases:read'
//    - Access: Select the SPECIFIC Base (your "Leaderboard" base) that this token should access.
//    - Copy the token immediately after creation! AirTable will only show it once.
// 2. Get your Base ID: Go to airtable.com/api, select your base (e.g., "Scoreboard"), and the ID will be at the top of the page (starts with 'app...').
// 3. Make sure your AirTable table has columns named "Username", "Score", "Level", "Timestamp".
const AIRTABLE_PERSONAL_ACCESS_TOKEN = 'patMmXy0npBMQuSvY.8cc2f575a61b440805cdc714ff5bc99d70a080c03f892eed23e8b8bbfbac66e4'; // IMPORTANT: REPLACE THIS WITH YOUR ACTUAL AIRTABLE PERSONAL ACCESS TOKEN
const AIRTABLE_BASE_ID = 'tbl65sxtBtO5pFlS0'; // Your actual Base ID
const AIRTABLE_TABLE_NAME = 'Scoreboard'; // Your actual Table Name

// --- AirTable Field IDs (from your documentation) ---
const AIRTABLE_FIELD_USERNAME_ID = 'fldtgOwdNqcBVdK5A';
const AIRTABLE_FIELD_SCORE_ID = 'fldEUbxxZePBVnXxA';
const AIRTABLE_FIELD_LEVEL_ID = 'fldoRa2nsYP8gOCei';
const AIRTABLE_FIELD_TIMESTAMP_ID = 'fld3RsXd2M0uTK7sa';

// --- Score Saving and Loading Functions (AirTable Implementation) ---
async function saveScore(username, score, level) {
    if (AIRTABLE_PERSONAL_ACCESS_TOKEN === 'patMmXy0npBMQuSvY.8cc2f575a61b440805cdc714ff5bc99d70a080c03f892eed23e8b8bbfbac66e4' || AIRTABLE_BASE_ID === 'tbl65sxtBtO5pFlS0') {
        console.error("AirTable Personal Access Token or Base ID not configured. Score not saved.");
        showMessageBox("AirTable not configured. Score not saved. See console.", null);
        return;
    }
    try {
        const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_PERSONAL_ACCESS_TOKEN}`, // Correct interpolation
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                records: [{
                    fields: {
                        [AIRTABLE_FIELD_USERNAME_ID]: username, // Use Field ID
                        [AIRTABLE_FIELD_SCORE_ID]: score,       // Use Field ID
                        [AIRTABLE_FIELD_LEVEL_ID]: level,       // Use Field ID
                        [AIRTABLE_FIELD_TIMESTAMP_ID]: new Date().toISOString() // Use Field ID
                    }
                }]
            })
        });
        const data = await response.json();
        if (response.ok) {
            console.log("Score saved to AirTable successfully!", data);
        } else {
            console.error("Error saving score to AirTable:", data);
            showMessageBox("Failed to save score to leaderboard. Check console.", null);
        }
    } catch (e) {
        console.error("Network error saving score to AirTable:", e);
        showMessageBox("Network error saving score. Check console.", null);
    }
}

async function fetchLeaderboard() {
    if (AIRTABLE_PERSONAL_ACCESS_TOKEN === 'YOUR_AIRTABLE_PERSONAL_ACCESS_TOKEN' || AIRTABLE_BASE_ID === 'YOUR_AIRTABLE_BASE_ID') {
        console.warn("AirTable Personal Access Token or Base ID not configured. Cannot fetch leaderboard.");
        return [];
    }
    try {
        // Sort by Score (desc), then Level (desc), then Timestamp (asc for ties)
        // Use Field IDs for sorting
        const sortParams = `sort%5B0%5D%5Bfield%5D=${AIRTABLE_FIELD_SCORE_ID}&sort%5B0%5D%5Bdirection%5D=desc&sort%5B1%5D%5Bfield%5D=${AIRTABLE_FIELD_LEVEL_ID}&sort%5B1%5D%5Bdirection%5D=desc&sort%5B2%5D%5Bfield%5D=${AIRTABLE_FIELD_TIMESTAMP_ID}&sort%5B2%5D%5Bdirection%5D=asc`;
        
        // Request specific fields by ID
        const fieldsParams = `fields%5B%5D=${AIRTABLE_FIELD_USERNAME_ID}&fields%5B%5D=${AIRTABLE_FIELD_SCORE_ID}&fields%5B%5D=${AIRTABLE_FIELD_LEVEL_ID}`;

        const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME}?${sortParams}&${fieldsParams}&maxRecords=10`, { // Correct interpolation
            headers: {
                'Authorization': `Bearer ${AIRTABLE_PERSONAL_ACCESS_TOKEN}}` // Use PAT here
            }
        });
        const data = await response.json();
        if (response.ok) {
            let scores = data.records.map(record => ({
                username: record.fields[AIRTABLE_FIELD_USERNAME_ID], // Access by Field ID
                score: record.fields[AIRTABLE_FIELD_SCORE_ID],       // Access by Field ID
                level: record.fields[AIRTABLE_FIELD_LEVEL_ID]        // Access by Field ID
            }));
            return scores;
        } else {
            console.error("Error fetching leaderboard from AirTable:", data);
            showMessageBox("Failed to load leaderboard from AirTable. Check console.", null);
            return [];
        }
    } catch (e) {
        console.error("Network error fetching leaderboard from AirTable:", e);
        showMessageBox("Network error loading leaderboard. Check console.", null);
        return [];
    }
}

// --- Question Data (Categorized by difficulty) ---
const phishingQuestions = [
    // Level 1: Easier questions (difficulty: 1)
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
    // Level 2: Medium difficulty questions (difficulty: 2)
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
    // Level 3: Harder questions (difficulty: 3)
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
    },
    { // NEW QUESTION FOR DIFFICULTY 3
        question: "What is the primary goal of a 'spear phishing' attack?",
        options: [
            "To send a generic phishing email to millions of users",
            "To target a specific individual or organization with a personalized attack",
            "To flood an email server with malicious attachments",
            "To trick users into downloading a game"
        ],
        correctAnswer: "To target a specific individual or organization with a personalized attack",
        explanation: "Spear phishing is highly targeted, using personal information to make the attack more convincing.",
        difficulty: 3
    }
];

// --- Level Data ---
const levels = [
    {
        levelNumber: 1,
        levelLength: 6000, // Increased length
        enemySpawnPoints: [ // Array of objects for more control over enemy placement
            { x: 600, y: 150 }, { x: 900, y: 280 }, { x: 1300, y: 100 }, { x: 1700, y: 220 },
            { x: 2200, y: 180 }, { x: 2700, y: 80 }, { x: 3200, y: 200 }, { x: 3700, y: 140 },
            { x: 4200, y: 250 }, { x: 4700, y: 120 }, { x: 5200, y: 290 }, { x: 5700, y: 170 }
        ],
        platformPositions: [
            // Start area
            { x: 300, yOffset: 60, width: PLATFORM_WIDTH_BASE },
            // First chamber/hall
            { x: 700, yOffset: 150, width: PLATFORM_WIDTH_BASE + 80 }, // Ceiling
            { x: 700, yOffset: -50, width: PLATFORM_WIDTH_BASE + 80 }, // Floor (negative yOffset means it's above the default ground height)
            { x: 1000, yOffset: 100, width: 30, height: 150 }, // Vertical wall
            // Second chamber/hall
            { x: 1200, yOffset: 70, width: PLATFORM_WIDTH_BASE + 50 }, // Ceiling
            { x: 1200, yOffset: -30, width: PLATFORM_WIDTH_BASE + 50 }, // Floor
            { x: 1600, yOffset: 120, width: 30, height: 100 }, // Vertical wall
            // Open area with floating platforms
            { x: 1900, yOffset: 80, width: PLATFORM_WIDTH_BASE - 20 },
            { x: 2300, yOffset: 130, width: PLATFORM_WIDTH_BASE + 10 },
            // Third chamber/hall
            { x: 2700, yOffset: 100, width: PLATFORM_WIDTH_BASE + 100 }, // Ceiling
            { x: 2700, yOffset: -10, width: PLATFORM_WIDTH_BASE + 100 }, // Floor
            { x: 3150, yOffset: 50, width: 30, height: 180 }, // Vertical wall
            // More floating platforms
            { x: 3500, yOffset: 70, width: PLATFORM_WIDTH_BASE },
            { x: 3900, yOffset: 110, width: PLATFORM_WIDTH_BASE + 30 },
            // Fourth chamber/hall
            { x: 4300, yOffset: 140, width: PLATFORM_WIDTH_BASE + 80 }, // Ceiling
            { x: 4300, yOffset: -60, width: PLATFORM_WIDTH_BASE + 80 }, // Floor
            { x: 4700, yOffset: 90, width: 30, height: 170 }, // Vertical wall
            // Fifth chamber/hall
            { x: 5000, yOffset: 120, width: PLATFORM_WIDTH_BASE + 50 }, // Ceiling
            { x: 5000, yOffset: -20, width: PLATFORM_WIDTH_BASE + 50 }, // Floor
            { x: 5400, yOffset: 60, width: 30, height: 190 }, // Vertical wall
            // Final approach platforms
            { x: 5700, yOffset: 90, width: PLATFORM_WIDTH_BASE }
        ],
        minQuestionDifficulty: 1
    },
    {
        levelNumber: 2,
        levelLength: 8000, // Increased length
        enemySpawnPoints: [
            { x: 400, y: 100 }, { x: 750, y: 250 }, { x: 1200, y: 180 }, { x: 1600, y: 300 },
            { x: 2100, y: 120 }, { x: 2600, y: 270 }, { x: 3100, y: 150 }, { x: 3600, y: 320 },
            { x: 4100, y: 100 }, { x: 4600, y: 280 }, { x: 5100, y: 190 }, { x: 5600, y: 310 },
            { x: 6100, y: 140 }, { x: 6600, y: 260 }, { x: 7100, y: 110 }, { x: 7600, y: 230 }
        ],
        platformPositions: [
            // Start area
            { x: 200, yOffset: 70, width: PLATFORM_WIDTH_BASE - 20 },
            // Complex Chamber 1
            { x: 500, yOffset: 180, width: PLATFORM_WIDTH_BASE + 100 }, // Ceiling
            { x: 500, yOffset: -50, width: PLATFORM_WIDTH_BASE + 100 }, // Floor
            { x: 800, yOffset: 80, width: 30, height: 200 }, // Wall 1
            { x: 950, yOffset: 100, width: 30, height: 150 }, // Wall 2 (gap in between)
            // Hallway with floating platforms
            { x: 1200, yOffset: 90, width: PLATFORM_WIDTH_BASE },
            { x: 1500, yOffset: 140, width: PLATFORM_WIDTH_BASE + 20 },
            { x: 1800, yOffset: 80, width: PLATFORM_WIDTH_BASE - 30 },
            // Chamber 2
            { x: 2200, yOffset: 160, width: PLATFORM_WIDTH_BASE + 120 }, // Ceiling
            { x: 2200, yOffset: -80, width: PLATFORM_WIDTH_BASE + 120 }, // Floor
            { x: 2600, yOffset: 60, width: 30, height: 220 }, // Wall 1
            { x: 2800, yOffset: 100, width: 30, height: 180 }, // Wall 2
            // More open area
            { x: 3200, yOffset: 110, width: PLATFORM_WIDTH_BASE + 40 },
            { x: 3700, yOffset: 60, width: PLATFORM_WIDTH_BASE - 10 },
            // Complex Chamber 3
            { x: 4200, yOffset: 190, width: PLATFORM_WIDTH_BASE + 150 }, // Ceiling
            { x: 4200, yOffset: -70, width: PLATFORM_WIDTH_BASE + 150 }, // Floor
            { x: 4700, yOffset: 90, width: 30, height: 210 }, // Wall
            { x: 4900, yOffset: 130, width: 30, height: 170 }, // Wall
            // Long narrow passage
            { x: 5200, yOffset: 100, width: PLATFORM_WIDTH_BASE + 200 }, // Ceiling
            { x: 5200, yOffset: -10, width: PLATFORM_WIDTH_BASE + 200 }, // Floor
            { x: 5700, yOffset: 50, width: 30, height: 180 }, // Vertical wall
            { x: 6000, yOffset: 120, width: 30, height: 160 }, // Vertical wall
            // Final approach platforms
            { x: 6300, yOffset: 90, width: PLATFORM_WIDTH_BASE + 50 },
            { x: 6800, yOffset: 140, width: PLATFORM_WIDTH_BASE - 10 },
            { x: 7300, yOffset: 80, width: PLATFORM_WIDTH_BASE + 20 }
        ],
        minQuestionDifficulty: 2
    },
    {
        levelNumber: 3,
        levelLength: 10000, // Even longer and more complex
        enemySpawnPoints: [
            { x: 500, y: 100 }, { x: 800, y: 280 }, { x: 1200, y: 150 }, { x: 1600, y: 300 },
            { x: 2000, y: 120 }, { x: 2400, y: 270 }, { x: 2800, y: 180 }, { x: 3200, y: 320 },
            { x: 3600, y: 100 }, { x: 4000, y: 250 }, { x: 4400, y: 150 }, { x: 4800, y: 300 },
            { x: 5200, y: 120 }, { x: 5600, y: 270 }, { x: 6000, y: 180 }, { x: 6400, y: 320 },
            { x: 6800, y: 100 }, { x: 7200, y: 250 }, { x: 7600, y: 150 }, { x: 8000, y: 300 },
            { x: 8400, y: 120 }, { x: 8800, y: 270 }, { x: 9200, y: 180 }, { x: 9600, y: 320 }
        ],
        platformPositions: [
            // Start area
            { x: 300, yOffset: 80, width: PLATFORM_WIDTH_BASE },
            // Long winding path with varying heights
            { x: 600, yOffset: 150, width: PLATFORM_WIDTH_BASE + 50 },
            { x: 600, yOffset: -30, width: PLATFORM_WIDTH_BASE + 50 }, // Floor
            { x: 900, yOffset: 100, width: 30, height: 180 }, // Wall
            { x: 1100, yOffset: 180, width: PLATFORM_WIDTH_BASE + 80 }, // Ceiling
            { x: 1100, yOffset: -60, width: PLATFORM_WIDTH_BASE + 80 }, // Floor
            { x: 1500, yOffset: 120, width: 30, height: 200 }, // Wall
            { x: 1700, yOffset: 100, width: PLATFORM_WIDTH_BASE + 20 },
            { x: 2000, yOffset: 160, width: PLATFORM_WIDTH_BASE + 70 }, // Ceiling
            { x: 2000, yOffset: -40, width: PLATFORM_WIDTH_BASE + 70 }, // Floor
            { x: 2400, yOffset: 110, width: 30, height: 190 }, // Wall
            // More open section with scattered platforms
            { x: 2800, yOffset: 90, width: PLATFORM_WIDTH_BASE + 10 },
            { x: 3300, yOffset: 140, width: PLATFORM_WIDTH_BASE + 30 },
            { x: 3800, yOffset: 70, width: PLATFORM_WIDTH_BASE - 20 },
            { x: 4300, yOffset: 120, width: PLATFORM_WIDTH_BASE + 40 },
            // Long narrow passage
            { x: 4800, yOffset: 150, width: PLATFORM_WIDTH_BASE + 200 }, // Ceiling
            { x: 4800, yOffset: -50, width: PLATFORM_WIDTH_BASE + 200 }, // Floor
            { x: 5300, yOffset: 80, width: 30, height: 220 }, // Wall
            { x: 5600, yOffset: 100, width: 30, height: 200 }, // Wall
            // Final challenging chamber
            { x: 6000, yOffset: 180, width: PLATFORM_WIDTH_BASE + 150 }, // Ceiling
            { x: 6000, yOffset: -70, width: PLATFORM_WIDTH_BASE + 150 }, // Floor
            { x: 6500, yOffset: 60, width: 30, height: 250 }, // Wall
            { x: 6800, yOffset: 100, width: 30, height: 200 }, // Wall
            { x: 7100, yOffset: 70, width: 30, height: 230 }, // Wall
            // Even more complex path
            { x: 7500, yOffset: 120, width: PLATFORM_WIDTH_BASE + 100 },
            { x: 7800, yOffset: 60, width: PLATFORM_WIDTH_BASE - 10 },
            { x: 8200, yOffset: 150, width: PLATFORM_WIDTH_BASE + 50 },
            { x: 8500, yOffset: 90, width: PLATFORM_WIDTH_BASE + 20 },
            { x: 8900, yOffset: 180, width: PLATFORM_WIDTH_BASE + 80 },
            { x: 9200, yOffset: 70, width: PLATFORM_WIDTH_BASE - 30 },
            { x: 9500, yOffset: 130, width: PLATFORM_WIDTH_BASE + 40 }
        ],
        minQuestionDifficulty: 3
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
        // Always resume game unless it's a permanent game over
        if (!gameOver) {
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
    console.log("showBattleScreen called. Enemy:", enemy); // Re-added debug log
    gameRunning = false; // Pause game
    battleState = 'active'; // Set battle state to active
    isBattling = true; // Set battling flag to true
    currentEnemy = enemy; // Store reference to the enemy
    battleScreen.style.display = 'block';

    // IMMEDIATELY DEACTIVATE THE ENEMY HERE TO PREVENT RE-TRIGGERING
    if (currentEnemy) {
        currentEnemy.active = false;
        console.log(`Enemy at worldX ${currentEnemy.originalX} deactivated upon battle start.`); // Re-added debug log
    }

    // Reset keys state when battle screen appears
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false;

    // Select 3 random questions for this battle based on current level's difficulty
    currentBattleQuestions = [];
    const currentLevel = levels[currentLevelIndex];
    // Filter to get ONLY questions of the current level's minQuestionDifficulty
    const availableQuestions = phishingQuestions.filter(q => q.difficulty === currentLevel.minQuestionDifficulty);
    
    // Shuffle available questions and pick 3
    const shuffledQuestions = [...availableQuestions].sort(() => 0.5 - Math.random());
    for (let i = 0; i < QUESTIONS_PER_BATTLE; i++) {
        // Ensure we don't pick more questions than available if the pool is small
        if (i < shuffledQuestions.length) {
            currentBattleQuestions.push(shuffledQuestions[i]);
        } else {
            // Fallback if not enough questions (shouldn't happen with current data with new question)
            // This fallback will pick a random question from the entire pool if specific difficulty pool is exhausted
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
    console.log("presentNextQuestion called. Current Question Index:", currentQuestionIndex, "Correct in row:", correctAnswersInRow); // Re-added debug log
    // If there are still questions left in the current battle set
    if (currentQuestionIndex < currentBattleQuestions.length) {
        const questionData = currentBattleQuestions[currentQuestionIndex];
        showQuestionBox(questionData, (isCorrect, explanation) => {
            if (isCorrect) {
                score += 100; // Increment score for correct answer
                correctAnswersInRow++;
                currentQuestionIndex++; // Move to the next question in the battle sequence
                console.log("Answer correct. Correct in row:", correctAnswersInRow); // Re-added debug log

                if (correctAnswersInRow === QUESTIONS_PER_BATTLE) {
                    // All questions answered correctly for this battle
                    // Directly call battleWon without an intermediate message box
                    battleWon();
                } else {
                    // Not yet 3 correct answers, present the next question
                    showMessageBox(`Correct! You have ${correctAnswersInRow}/${QUESTIONS_PER_BATTLE} correct in a row.`, presentNextQuestion);
                }
            } else {
                // Incorrect answer, battle lost
                console.log("Answer incorrect. Game Over."); // Re-added debug log
                gameOver = true;
                showMessageBox(`Incorrect! The enemy defeated you. \n\nExplanation: ${explanation}\n\nYour final score: ${score}`, showUsernameInput); // Show username input on game over
            }
        });
    }
}

/**
 * Handles actions when the battle is won.
 */
function battleWon() {
    console.log("battleWon called."); // Re-added debug log
    // currentEnemy.active is now set to false in showBattleScreen
    battleState = 'idle'; // Reset battle state
    isBattling = false; // Reset battling flag
    currentEnemy = null; // Clear enemy reference
    gameRunning = true; // Resume game

    // Reset keys state after battle is won and game resumes
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false;

    // Removed the showMessageBox("You defeated the enemy!", null); call
    // The game should just resume seamlessly here.
}

/**
 * Displays the username input box and prepares to save the score.
 */
function showUsernameInput() {
    gameRunning = false; // Ensure game is paused
    usernameInputBox.style.display = 'block';
    finalScoreText.textContent = `Your Score: ${score}`;
    usernameInput.value = ''; // Clear previous input
    usernameInput.focus(); // Focus on the input field
    saveScoreButton.onclick = async () => {
        const username = usernameInput.value.trim();
        if (username.length > 0) {
            await saveScore(username, score, currentLevelIndex + 1); // Save score with username and current level
            usernameInputBox.style.display = 'none';
            showLeaderboard(); // Show leaderboard after saving
        } else {
            showMessageBox("Please enter a username to save your score.", null);
        }
    };
}

/**
 * Fetches and displays the leaderboard.
 */
async function showLeaderboard() {
    gameRunning = false; // Ensure game is paused
    leaderboardBox.style.display = 'block';
    leaderboardList.innerHTML = '<li>Loading scores...</li>'; // Loading message

    const topScores = await fetchLeaderboard();
    leaderboardList.innerHTML = ''; // Clear loading message

    if (topScores.length === 0) {
        leaderboardList.innerHTML = '<li>No scores yet! Be the first!</li>';
    } else {
        topScores.forEach((s, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>${s.username}</span> <span>Score: ${s.score} (Level ${s.level})</span>`; // Removed index + 1
            leaderboardList.appendChild(listItem);
        });
    }

    playAgainButton.onclick = () => {
        leaderboardBox.style.display = 'none';
        resetGame(); // Start a new game
    };
}


/**
 * Initializes the current level's background elements.
 */
function initializeBackground() {
    console.log("Initializing background for level:", currentLevelIndex + 1); // Re-added debug log
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


    // Add enemies (fish) based on current level data
    levelData.enemySpawnPoints.forEach(spawn => {
        const fishWidth = MIN_FISH_SIZE + Math.random() * (MAX_FISH_SIZE - MIN_FISH_SIZE);
        const fishHeight = MIN_FISH_SIZE + Math.random() * (MAX_FISH_SIZE - MIN_FISH_SIZE);
        // Ensure fish spawn within canvas height, not below ground
        const initialY = Math.max(0, Math.min(spawn.y, canvas.height - GROUND_HEIGHT - fishHeight));

        backgroundElements.push({
            type: 'enemy',
            originalX: spawn.x,
            y: initialY, // Initial Y position for fish
            width: fishWidth,
            height: fishHeight,
            color: '#FF4500', // Orange-red for fish (active)
            parallaxFactor: 1,
            active: true, // Enemies are active until defeated
            spawnX: spawn.x, // Store original spawn X for chasing (not roaming)
            spawnY: initialY, // Store original spawn Y for chasing (not roaming)
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
    // Apply water drag to horizontal movement (if player moves independently)
    // For now, player horizontal is based on key press, not velocity.
    // If you add player horizontal velocity later, apply drag there too.

    // Update player's worldY position based on velocity
    player.y += player.velocityY; // player.y is now worldY

    // Keep player within vertical world bounds (ocean surface and floor)
    const maxPlayerWorldY = canvas.height - GROUND_HEIGHT - player.height;
    if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
    }
    if (player.y > maxPlayerWorldY) {
        player.y = maxPlayerWorldY;
        player.velocityY = 0;
        player.isGrounded = true; // Player is resting on the floor
    } else {
        player.isGrounded = false; // Player is floating
    }

    // Camera vertical adjustment (keeps player centered vertically)
    const targetScreenY = canvas.height * CAMERA_VERTICAL_CENTER_Y;
    const currentScreenY = player.y - worldYOffset; // player.y is worldY

    if (currentScreenY < targetScreenY - CAMERA_VERTICAL_DEADZONE) {
        worldYOffset = player.y - (targetScreenY - CAMERA_VERTICAL_DEADZONE);
    } else if (currentScreenY > targetScreenY + CAMERA_VERTICAL_DEADZONE) {
        worldYOffset = player.y - (targetScreenY + CAMERA_VERTICAL_DEADZONE);
    }

    // Clamp worldYOffset to prevent camera from going beyond world boundaries
    // The maximum worldYOffset is when the bottom of the visible canvas aligns with the seabed.
    // The minimum worldYOffset is 0 (when the top of the world is at the top of the canvas).
    const maxWorldYOffset = canvas.height - (canvas.height - GROUND_HEIGHT); // This is GROUND_HEIGHT
    worldYOffset = Math.max(0, Math.min(maxWorldYOffset, worldYOffset));


    // Handle horizontal movement and world scrolling
    // Only allow movement if not in an active battle
    if (battleState === 'idle') {
        if (keys.left) {
            player.x = Math.max(0, player.x - PLAYER_SPEED); // Update player's worldX
        } else if (keys.right) {
            const currentLevel = levels[currentLevelIndex];
            const maxPlayerWorldX = currentLevel.levelLength - player.width; // Max world X player can reach
            player.x = Math.min(maxPlayerWorldX, player.x + PLAYER_SPEED); // Update player's worldX
        }
        // Adjust worldXOffset to keep player.x (world) at PLAYER_SCREEN_X_OFFSET (screen)
        worldXOffset = player.x - PLAYER_SCREEN_X_OFFSET;
        // Clamp worldXOffset to level boundaries
        const currentLevel = levels[currentLevelIndex];
        worldXOffset = Math.max(0, Math.min(currentLevel.levelLength - canvas.width, worldXOffset));
    }

    // Update enemy movement (chasing logic)
    if (battleState === 'idle') { // Enemies only move when not in battle
        backgroundElements.forEach(element => {
            if (element.type === 'enemy' && element.active) { // Only move active enemies
                // Get enemy's current world position
                const enemyWorldX = element.originalX;
                const enemyWorldY = element.y;

                // Calculate distance to player
                const dx = (player.x + player.width / 2) - (enemyWorldX + element.width / 2);
                const dy = (player.y + player.height / 2) - (enemyWorldY + element.height / 2);
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Only chase if player is within detection radius
                if (distance < ENEMY_DETECTION_RADIUS && distance > 0) {
                    // Normalize direction vector and apply speed
                    const moveX = (dx / distance) * ENEMY_CHASE_SPEED;
                    const moveY = (dy / distance) * ENEMY_CHASE_SPEED;

                    element.originalX += moveX;
                    element.y += moveY;

                    // Keep enemy within vertical bounds (ocean surface and seabed)
                    element.y = Math.max(0, Math.min(canvas.height - GROUND_HEIGHT - element.height, element.y));
                    // Keep enemy within horizontal bounds of the level (optional, but good practice)
                    element.originalX = Math.max(0, Math.min(levels[currentLevelIndex].levelLength - element.width, element.originalX));
                }
            }
        });
    }


    // Collision detection with background elements (enemy, platform, and goal)
    for (let i = 0; i < backgroundElements.length; i++) {
        const element = backgroundElements[i];

        // Get element's current world position
        const elementWorldX = element.originalX;
        const elementWorldY = element.y;

        // Player collision with enemy (only if not in battle AND enemy is active)
        if (element.type === 'enemy' && battleState === 'idle' && element.active && !isBattling) { // Added !isBattling check
            if (player.x < elementWorldX + element.width &&
                player.x + player.width > elementWorldX &&
                player.y < elementWorldY + element.height &&
                player.y + player.height > elementWorldY) {

                // Collision with an enemy, initiate battle
                console.log(`Collision with enemy detected at worldX: ${elementWorldX}. Initiating battle.`); // Debug log
                showBattleScreen(element);
                return; // Stop updating while battle screen is active
            }
        }
        // Player collision with platform (platforms are always active/solid)
        else if (element.type === 'platform') {
            // Check for general AABB collision
            if (player.x < elementWorldX + element.width &&
                player.x + player.width > elementWorldX &&
                player.y < elementWorldY + element.height &&
                player.y + player.height > elementWorldY) {

                // Determine collision side to resolve
                const overlapX = Math.min(player.x + player.width, elementWorldX + element.width) - Math.max(player.x, elementWorldX);
                const overlapY = Math.min(player.y + player.height, elementWorldY + element.height) - Math.max(player.y, elementWorldY);

                if (overlapX < overlapY) { // Horizontal collision is smaller, so it's a side collision
                    if (player.x < elementWorldX) { // Player hit from left
                        player.x = elementWorldX - player.width;
                    } else { // Player hit from right
                        player.x = elementWorldX + element.width;
                    }
                } else { // Vertical collision is smaller, so it's a top/bottom collision
                    if (player.y < elementWorldY) { // Player hit from top (landing on platform)
                        player.y = elementWorldY - player.height;
                        player.velocityY = 0;
                        player.isGrounded = true; // Player is resting on platform
                    } else { // Player.y > elementWorldY (player hit from bottom)
                        player.y = elementWorldY + element.height;
                        player.velocityY = 0; // Stop upward movement
                    }
                }
            }
        }
    }

    // Win condition for current level: Check if the player has scrolled past the goal
    const currentLevel = levels[currentLevelIndex];
    const playerWorldX = player.x; // Player's actual world X
    const goalElement = backgroundElements.find(el => el.type === 'goal');

    if (goalElement && playerWorldX > goalElement.originalX && !goalReached) { // Changed condition to player.x > goalElement.originalX
        console.log(`Goal passed! PlayerWorldX: ${playerWorldX}, GoalX: ${goalElement.originalX}`); // Updated log
        goalReached = true; // Mark goal reached for this frame to prevent re-trigger

        if (currentLevelIndex < levels.length - 1) {
            // Advance to next level
            console.log(`Advancing to Level ${currentLevelIndex + 2}`);
            currentLevelIndex++;
            showMessageBox(`Level ${currentLevel.levelNumber} Complete! Moving to Level ${levels[currentLevelIndex].levelNumber}!`, () => {
                console.log("Message box dismissed. Calling resetLevel for new level.");
                resetLevel(); // Reset game state for the new level
            });
        } else {
            // All levels complete!
            console.log("All levels completed!");
            gameOver = true;
            showMessageBox("Congratulations! You completed all levels and mastered cybersecurity!", showUsernameInput); // Show username input on game completion
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

        // Calculate element's current screen position based on its world position and camera offset
        const elementScreenX = element.originalX - worldXOffset * element.parallaxFactor;
        const elementScreenY = element.y - worldYOffset * element.parallaxFactor;

        // Only draw elements that are within the visible canvas area
        if (elementScreenX + element.width > 0 && elementScreenX < canvas.width &&
            elementScreenY + element.height > 0 && elementScreenY < canvas.height) {
            
            // Apply visual cue for defeated enemies
            if (element.type === 'enemy' && !element.active) {
                ctx.fillStyle = 'rgba(128, 128, 128, 0.5)'; // Grey and semi-transparent
            } else {
                ctx.fillStyle = element.color; // Use original color for active elements
            }
            ctx.fillRect(elementScreenX, elementScreenY, element.width, element.height);
        }
    }

    // Draw the player (always on top, at its fixed screen X and calculated screen Y)
    // Player's screen X and Y are now calculated from world position and camera offset
    player.screenX = player.x - worldXOffset;
    player.screenY = player.y - worldYOffset;
    ctx.fillStyle = 'red'; // Color for the swimming guy
    ctx.fillRect(player.screenX, player.screenY, player.width, player.height);

    // Draw current score
    ctx.fillStyle = 'white';
    ctx.font = "16px 'Press Start 2P'";
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 10, 20);
    ctx.fillText(`Level: ${currentLevelIndex + 1}`, 10, 40);
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
    console.log("resetGame called. Resetting to Level 1."); // Re-added debug log
    currentLevelIndex = 0; // Reset to the first level
    score = 0; // Reset score on full game reset
    resetLevel(); // Call resetLevel to initialize the first level
}

/**
 * Resets the current level's state (player position, world offset, re-initializes background).
 */
function resetLevel() {
    console.log("resetLevel called. Initializing level:", currentLevelIndex + 1); // Re-added debug log
    worldXOffset = 0; // Reset horizontal world scroll
    worldYOffset = 0; // Reset vertical world scroll
    
    // Player starts floating slightly above the seabed, relative to world coordinates
    player.x = PLAYER_SCREEN_X_OFFSET; // Player's initial world X
    player.y = canvas.height - GROUND_HEIGHT - player.height - 20; // Player's initial world Y
    player.velocityY = 0;
    player.isGrounded = false; // Player starts floating
    gameOver = false;
    goalReached = false; // Reset goalReached for the new level
    battleState = 'idle'; // Reset battle state
    isBattling = false; // Reset battling flag on level reset
    currentEnemy = null;
    currentBattleQuestions = [];
    currentQuestionIndex = 0;
    correctAnswersInRow = 0;

    // Reset keys state
    keys.left = false;
    keys.right = false;
    keys.up = false;
    keys.down = false;

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

// Touch/Click input for mobile controls (explicitly passive: false to avoid warnings)
leftButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.left = true; }, { passive: false });
leftButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.left = false; }, { passive: false });
leftButton.addEventListener('mousedown', () => { if(gameRunning) keys.left = true; });
leftButton.addEventListener('mouseup', () => { keys.left = false; });
leftButton.addEventListener('mouseleave', () => { keys.left = false; }); // For mouse leaving button area

rightButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.right = true; }, { passive: false });
rightButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.right = false; }, { passive: false });
rightButton.addEventListener('mousedown', () => { if(gameRunning) keys.right = true; });
rightButton.addEventListener('mouseup', () => { keys.right = false; });
rightButton.addEventListener('mouseleave', () => { keys.right = false; });

jumpButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.up = true; }, { passive: false });
jumpButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.up = false; }, { passive: false });
jumpButton.addEventListener('mousedown', () => { if(gameRunning) keys.up = true; });
jumpButton.addEventListener('mouseup', () => { keys.up = false; });
jumpButton.addEventListener('mouseleave', () => { keys.up = false; });

// New: Down button event listeners (explicitly passive: false)
downButton.addEventListener('touchstart', (e) => { e.preventDefault(); if(gameRunning) keys.down = true; }, { passive: false });
downButton.addEventListener('touchend', (e) => { e.preventDefault(); if(gameRunning) keys.down = false; }, { passive: false });
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

    // Re-initialize background elements with correct Y positions and new canvas width
    // This is important because level elements depend on canvas.height
    initializeBackground();
}

// Initial setup on window load
window.addEventListener('load', () => {
    // Removed Firebase authentication call
    // authenticateAnonymously().then(() => {
        resizeCanvas(); // Set initial canvas size and player Y
        gameRunning = true; // Game starts immediately
        resetGame(); // Ensure game state is reset and ready (starts Level 1)
        gameLoop(); // Start the main game loop
    // });
});
window.addEventListener('resize', resizeCanvas); // Listen for window resize events

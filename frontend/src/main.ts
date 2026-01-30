/**
 * Space Invaders - Main Entry Point
 * Arcade Edition with frictionless onboarding
 */

import "./styles.css";
import { SpaceInvadersGame, DifficultyLevel, DIFFICULTY_PRESETS } from "./game";
import {
    getOrCreateWallet,
    ensureWalletFunded,
    getLeaderboard,
    refreshLeaderboard,
    addOptimisticScore,
    registerPlayer,
    submitScore as contractSubmitScore,
    isPlayerRegistered,
} from "./contract";

// DOM Elements
const loadingOverlay = document.getElementById("loading-overlay") as HTMLElement;
const loadingText = document.getElementById("loading-text") as HTMLElement;
const usernameModal = document.getElementById("username-modal") as HTMLElement;
const usernameInput = document.getElementById("username-input") as HTMLInputElement;
const saveUsernameBtn = document.getElementById("btn-save-username") as HTMLButtonElement;
const difficultyModal = document.getElementById("difficulty-modal") as HTMLElement;
const difficultyBtns = document.querySelectorAll(".difficulty-btn") as NodeListOf<HTMLButtonElement>;
const difficultyBadge = document.getElementById("difficulty-badge") as HTMLElement;
const playerNameSpan = document.getElementById("player-name") as HTMLSpanElement;
const startBtn = document.getElementById("btn-start") as HTMLButtonElement;
const submitScoreBtn = document.getElementById("btn-submit-score") as HTMLButtonElement;
const fullscreenBtn = document.getElementById("btn-fullscreen") as HTMLButtonElement;
const scoreDisplay = document.getElementById("score") as HTMLElement;
const livesDisplay = document.getElementById("lives") as HTMLElement;

// LocalStorage keys
const USERNAME_KEY = "space_invaders_username";
const DIFFICULTY_KEY = "space_invaders_difficulty";

// Game instance
let game: SpaceInvadersGame | null = null;
let currentUsername: string | null = null;

// ===== LOADING =====
function showLoading(message: string) {
    if (loadingOverlay) {
        loadingOverlay.style.display = "flex";
        if (loadingText) loadingText.textContent = message;
    }
}

function hideLoading() {
    if (loadingOverlay) {
        loadingOverlay.style.display = "none";
    }
}

// ===== USERNAME MODAL =====
function showUsernameModal() {
    if (usernameModal) {
        usernameModal.classList.remove("hidden");
        usernameInput?.focus();
    }
}

function hideUsernameModal() {
    if (usernameModal) {
        usernameModal.classList.add("hidden");
    }
}

function getStoredUsername(): string | null {
    return localStorage.getItem(USERNAME_KEY);
}

function storeUsername(username: string) {
    localStorage.setItem(USERNAME_KEY, username);
}

// ===== DIFFICULTY MODAL =====
function showDifficultyModal() {
    if (difficultyModal) {
        difficultyModal.classList.remove("hidden");
    }
}

function hideDifficultyModal() {
    if (difficultyModal) {
        difficultyModal.classList.add("hidden");
    }
}

function getStoredDifficulty(): DifficultyLevel | null {
    return localStorage.getItem(DIFFICULTY_KEY) as DifficultyLevel | null;
}

function storeDifficulty(difficulty: DifficultyLevel) {
    localStorage.setItem(DIFFICULTY_KEY, difficulty);
}

function updateDifficultyBadge(difficulty: DifficultyLevel) {
    if (!difficultyBadge) return;

    const config = DIFFICULTY_PRESETS[difficulty];
    difficultyBadge.textContent = config.label;
    difficultyBadge.className = `difficulty-badge ${difficulty}`;
}

function initializeGame(difficulty: DifficultyLevel) {
    storeDifficulty(difficulty);
    updateDifficultyBadge(difficulty);

    // Create game with selected difficulty
    game = new SpaceInvadersGame("game-canvas", difficulty);

    game.onScoreChange = (score) => {
        if (scoreDisplay) {
            scoreDisplay.textContent = score.toString().padStart(5, "0");
        }
    };

    game.onLivesChange = (lives) => {
        if (livesDisplay) {
            livesDisplay.textContent = "🚀".repeat(Math.max(0, lives));
        }
    };

    game.onGameOver = (finalScore, won) => {
        console.log(`🎮 ${won ? "Victory!" : "Game Over"} Score: ${finalScore}`);
        if (submitScoreBtn) submitScoreBtn.disabled = false;

        if (startBtn) {
            startBtn.textContent = "PLAY AGAIN";
            startBtn.classList.add("pulse");
        }
    };

    // Update lives display for this difficulty
    const config = DIFFICULTY_PRESETS[difficulty];
    if (livesDisplay) {
        livesDisplay.textContent = "🚀".repeat(config.playerLives);
    }

    console.log(`🎮 Game initialized with ${config.label} difficulty`);
}

// ===== INITIALIZATION =====
async function init() {
    showLoading("INITIALIZING...");
    console.log("🎮 Space Invaders Arcade - Starting...");

    // Initialize wallet in background (frictionless)
    try {
        showLoading("CONNECTING...");
        await getOrCreateWallet();
        await ensureWalletFunded();
    } catch (error) {
        console.error("Wallet init error:", error);
    }

    // Check for existing username
    currentUsername = getStoredUsername();

    // Check for stored difficulty
    const storedDifficulty = getStoredDifficulty();

    hideLoading();

    if (!currentUsername) {
        // First time player - show username modal
        showUsernameModal();
    } else if (!storedDifficulty) {
        // Has username but no difficulty - show difficulty modal
        updatePlayerDisplay(currentUsername);
        showDifficultyModal();
    } else {
        // Returning player with all settings
        updatePlayerDisplay(currentUsername);
        initializeGame(storedDifficulty);
        enableGame();
    }

    console.log("✅ Ready to play!");
}

function updatePlayerDisplay(username: string) {
    if (playerNameSpan) {
        playerNameSpan.textContent = `PILOT: ${username.toUpperCase()}`;
    }
}

function enableGame() {
    if (startBtn) {
        startBtn.disabled = false;
    }
}

// ===== EVENT HANDLERS =====

// Save username (with on-chain registration)
if (saveUsernameBtn && usernameInput) {
    saveUsernameBtn.onclick = async () => {
        const username = usernameInput.value.trim();

        if (username.length < 2) {
            usernameInput.style.borderColor = "#ff0066";
            usernameInput.focus();
            return;
        }

        if (username.length > 16) {
            usernameInput.value = username.slice(0, 16);
            return;
        }

        // Register on-chain
        saveUsernameBtn.disabled = true;
        saveUsernameBtn.textContent = "REGISTERING...";

        try {
            await registerPlayer(username);
            console.log(`🔗 Player registered on-chain: ${username}`);
        } catch (error) {
            console.error("On-chain registration failed:", error);
        }

        currentUsername = username;
        storeUsername(username);
        updatePlayerDisplay(username);
        hideUsernameModal();

        // Show difficulty modal for new players
        showDifficultyModal();

        saveUsernameBtn.disabled = false;
        saveUsernameBtn.textContent = "START MISSION";

        console.log(`👤 Player ready: ${username}`);
    };

    // Enter key support
    usernameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            saveUsernameBtn.click();
        }
    });
}

// Difficulty buttons
difficultyBtns.forEach(btn => {
    btn.onclick = () => {
        const difficulty = btn.dataset.difficulty as DifficultyLevel;
        if (!difficulty) return;

        hideDifficultyModal();
        initializeGame(difficulty);
        enableGame();

        console.log(`🎯 Difficulty selected: ${difficulty.toUpperCase()}`);
    };
});

if (startBtn) {
    startBtn.onclick = () => {
        if (!game) {
            // Game not initialized, show difficulty modal
            if (!currentUsername) {
                showUsernameModal();
            } else {
                showDifficultyModal();
            }
            return;
        }
        if (!currentUsername) {
            showUsernameModal();
            return;
        }

        game.start();
        startBtn.textContent = "RESTART";
        startBtn.classList.remove("pulse");
        if (submitScoreBtn) submitScoreBtn.disabled = true;
    };
}

// Submit score to blockchain
if (submitScoreBtn) {
    submitScoreBtn.onclick = async () => {
        if (!game || !currentUsername) return;

        const score = game.getScore();
        const won = game.didWin();

        submitScoreBtn.disabled = true;
        submitScoreBtn.textContent = "📤 SUBMITTING...";

        try {
            // First, ensure player is registered on-chain
            const registered = await isPlayerRegistered();
            if (!registered) {
                console.log("🔄 Player not registered on-chain, registering now...");
                submitScoreBtn.textContent = "🔗 REGISTERING...";
                const regSuccess = await registerPlayer(currentUsername);
                if (!regSuccess) {
                    alert("Failed to register player on-chain. Please try again.");
                    submitScoreBtn.textContent = "📤 SUBMIT SCORE";
                    submitScoreBtn.disabled = false;
                    return;
                }
                console.log("✅ Player registered successfully!");
            }

            submitScoreBtn.textContent = "📤 SUBMITTING...";
            const success = await contractSubmitScore(score);

            if (success) {
                console.log(`🔗 Score submitted to blockchain: ${score}`);

                // Add optimistic score to cache for instant UI update
                addOptimisticScore(currentUsername, score);
                await loadLeaderboard(); // Show optimistic update immediately

                alert(`🏆 SCORE SUBMITTED TO BLOCKCHAIN!\n\nPilot: ${currentUsername}\nScore: ${score}\n${won ? "🎉 VICTORY!" : ""}\n\n⏳ Leaderboard will refresh momentarily...`);

                // Force refresh after blockchain confirmation
                setTimeout(async () => {
                    console.log("🔄 Force refreshing leaderboard after blockchain confirmation...");
                    await refreshLeaderboard();
                    await loadLeaderboard();
                }, 5000);
            } else {
                alert("Failed to submit score. Please try again.");
            }
        } catch (error) {
            console.error("Submit score error:", error);
            alert("Error submitting score. Check console for details.");
        }

        submitScoreBtn.textContent = "📤 SUBMIT SCORE";
    };
}

// Fullscreen button
if (fullscreenBtn) {
    fullscreenBtn.onclick = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    };
}

// ===== LEADERBOARD (from blockchain) =====
async function loadLeaderboard() {
    const list = document.getElementById("leaderboard-list") as HTMLOListElement;
    if (!list) return;

    // Show loading state
    list.innerHTML = '<li class="loading"><span>LOADING FROM BLOCKCHAIN...</span><span></span></li>';

    try {
        const entries = await getLeaderboard();

        if (entries.length === 0) {
            list.innerHTML = '<li class="loading"><span>NO SCORES YET - BE THE FIRST!</span><span></span></li>';
            return;
        }

        // Aggregate scores: SUM all scores per username
        const scoreByUsername = new Map<string, { username: string; totalScore: number }>();
        for (const entry of entries) {
            const normalizedUsername = entry.username.toUpperCase();
            const existing = scoreByUsername.get(normalizedUsername);
            if (existing) {
                // Add to existing total
                existing.totalScore += entry.score;
            } else {
                // First entry for this user
                scoreByUsername.set(normalizedUsername, {
                    username: entry.username,
                    totalScore: entry.score,
                });
            }
        }

        // Convert to array, sort by total score descending, take top 10
        const aggregatedEntries = Array.from(scoreByUsername.values())
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 10);

        list.innerHTML = aggregatedEntries
            .map((e) => `<li><span>${e.username.toUpperCase()}</span><span>${e.totalScore.toLocaleString()}</span></li>`)
            .join("");

        console.log(`📊 Loaded ${entries.length} entries, showing ${aggregatedEntries.length} unique players with cumulative scores`);
    } catch (error) {
        console.error("Error loading leaderboard:", error);
        list.innerHTML = '<li class="loading"><span>BLOCKCHAIN UNAVAILABLE</span><span></span></li>';
    }
}

// ===== STARTUP =====
init();
loadLeaderboard();

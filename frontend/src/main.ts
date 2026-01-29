/**
 * Space Invaders - Main Entry Point
 * Arcade Edition with frictionless onboarding
 */

import "./styles.css";
import { SpaceInvadersGame } from "./game";
import {
    getOrCreateWallet,
    ensureWalletFunded,
    getLeaderboard,
    registerPlayer,
    submitScore as contractSubmitScore,
    isPlayerRegistered,
    LeaderboardEntry,
} from "./contract";

// DOM Elements
const loadingOverlay = document.getElementById("loading-overlay") as HTMLElement;
const loadingText = document.getElementById("loading-text") as HTMLElement;
const usernameModal = document.getElementById("username-modal") as HTMLElement;
const usernameInput = document.getElementById("username-input") as HTMLInputElement;
const saveUsernameBtn = document.getElementById("btn-save-username") as HTMLButtonElement;
const playerNameSpan = document.getElementById("player-name") as HTMLSpanElement;
const startBtn = document.getElementById("btn-start") as HTMLButtonElement;
const submitScoreBtn = document.getElementById("btn-submit-score") as HTMLButtonElement;
const fullscreenBtn = document.getElementById("btn-fullscreen") as HTMLButtonElement;
const scoreDisplay = document.getElementById("score") as HTMLElement;
const livesDisplay = document.getElementById("lives") as HTMLElement;

// LocalStorage keys
const USERNAME_KEY = "space_invaders_username";

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

    // Initialize game
    game = new SpaceInvadersGame("game-canvas");

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

        // Update start button
        if (startBtn) {
            startBtn.textContent = "PLAY AGAIN";
            startBtn.classList.add("pulse");
        }
    };

    // Check for existing username
    currentUsername = getStoredUsername();

    hideLoading();

    if (!currentUsername) {
        // First time player - show username modal
        showUsernameModal();
    } else {
        // Returning player
        updatePlayerDisplay(currentUsername);
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
        enableGame();

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

// Start game
if (startBtn) {
    startBtn.onclick = () => {
        if (!game) return;
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
                alert(`🏆 SCORE SUBMITTED TO BLOCKCHAIN!\n\nPilot: ${currentUsername}\nScore: ${score}\n${won ? "🎉 VICTORY!" : ""}\n\n⏳ Leaderboard will update in a few seconds...`);

                // Wait for blockchain confirmation before refreshing leaderboard
                // This gives time for the transaction to be processed
                setTimeout(async () => {
                    console.log("🔄 Refreshing leaderboard after delay...");
                    await loadLeaderboard();
                }, 5000); // 5 second delay for blockchain confirmation
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

        list.innerHTML = entries
            .map((e: LeaderboardEntry) => `<li><span>${e.username.toUpperCase()}</span><span>${e.score.toLocaleString()}</span></li>`)
            .join("");

        console.log(`📊 Loaded ${entries.length} leaderboard entries from blockchain`);
    } catch (error) {
        console.error("Error loading leaderboard:", error);
        list.innerHTML = '<li class="loading"><span>BLOCKCHAIN UNAVAILABLE</span><span></span></li>';
    }
}

// ===== STARTUP =====
init();
loadLeaderboard();

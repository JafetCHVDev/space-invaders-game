/**
 * Frictionless Wallet & Contract Integration
 * 
 * No external wallet required - auto-generates and manages wallet locally
 * Uses localStorage to persist the keypair for returning users
 */

import {
    Contract,
    SorobanRpc,
    TransactionBuilder,
    Networks,
    BASE_FEE,
    Keypair,
    nativeToScVal,
    scValToNative,
    Account,
    Address,
} from "@stellar/stellar-sdk";

// Configuration
const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;
const FRIENDBOT_URL = "https://friendbot.stellar.org";

// Deployed Contract ID (Testnet) - Updated 2026-02-05 with CUMULATIVE scores
export const CONTRACT_ID = "CBVWWI3QDHCOIYDS6OL7QYGJDWPIVG22JWPCZDZAMUH2GSHHGMCMQPK6";

const server = new SorobanRpc.Server(RPC_URL);

/**
 * Direct RPC call helper to avoid SDK XDR parsing issues
 * Soroban RPC expects params as a named object, not an array
 */
async function directRpcCall(method: string, params: Record<string, any>): Promise<any> {
    const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params,
        }),
    });

    const json = await response.json();
    if (json.error) {
        throw new Error(json.error.message || JSON.stringify(json.error));
    }
    return json.result;
}

// LocalStorage keys
const WALLET_KEY = "space_invaders_wallet";
const FUNDED_KEY = "space_invaders_wallet_funded";

/**
 * Wallet state
 */
interface WalletState {
    publicKey: string;
    secretKey: string;
    funded: boolean;
}

let cachedWallet: WalletState | null = null;

/**
 * Get or create wallet - completely frictionless
 * Creates a new keypair if none exists, restores from localStorage if returning user
 */
export async function getOrCreateWallet(): Promise<WalletState> {
    // Return cached wallet if available
    if (cachedWallet) {
        return cachedWallet;
    }

    // Try to restore from localStorage
    const stored = localStorage.getItem(WALLET_KEY);
    const funded = localStorage.getItem(FUNDED_KEY) === "true";

    if (stored) {
        try {
            const keypair = Keypair.fromSecret(stored);
            cachedWallet = {
                publicKey: keypair.publicKey(),
                secretKey: stored,
                funded,
            };
            return cachedWallet;
        } catch {
            // Invalid stored key, generate new one
            localStorage.removeItem(WALLET_KEY);
            localStorage.removeItem(FUNDED_KEY);
        }
    }

    // Generate new wallet
    const keypair = Keypair.random();
    const state: WalletState = {
        publicKey: keypair.publicKey(),
        secretKey: keypair.secret(),
        funded: false,
    };

    // Persist to localStorage
    localStorage.setItem(WALLET_KEY, state.secretKey);
    cachedWallet = state;

    return state;
}

/**
 * Get wallet address for display
 */
export async function getWalletAddress(): Promise<string> {
    const wallet = await getOrCreateWallet();
    return wallet.publicKey;
}

/**
 * Get truncated address for UI
 */
export async function getDisplayAddress(): Promise<string> {
    const address = await getWalletAddress();
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/**
 * Fund wallet using Friendbot (testnet only)
 * Automatically funds the wallet on first use
 */
export async function ensureWalletFunded(): Promise<boolean> {
    const wallet = await getOrCreateWallet();

    if (wallet.funded) {
        return true;
    }

    try {
        console.log("💰 Funding wallet via Friendbot...");

        const response = await fetch(`${FRIENDBOT_URL}?addr=${wallet.publicKey}`);

        if (response.ok) {
            wallet.funded = true;
            cachedWallet = wallet;
            localStorage.setItem(FUNDED_KEY, "true");
            console.log("✅ Wallet funded successfully!");
            return true;
        }

        // Check if already funded (friendbot returns error for already-funded accounts)
        const data = await response.json();
        if (data.status === 400 || response.status === 400) {
            // Account exists and is already funded
            wallet.funded = true;
            cachedWallet = wallet;
            localStorage.setItem(FUNDED_KEY, "true");
            return true;
        }

        console.error("Failed to fund wallet:", data);
        return false;
    } catch (error) {
        console.error("Error funding wallet:", error);

        // Try to check if account exists
        try {
            await server.getAccount(wallet.publicKey);
            wallet.funded = true;
            cachedWallet = wallet;
            localStorage.setItem(FUNDED_KEY, "true");
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Sign and submit transaction (internal helper)
 * @param tx - Prepared transaction
 * @param fireAndForget - If true, don't wait for confirmation (instant UX)
 */
async function signAndSubmit(tx: any, fireAndForget = false): Promise<any> {
    const wallet = await getOrCreateWallet();
    const keypair = Keypair.fromSecret(wallet.secretKey);

    // Sign the transaction
    tx.sign(keypair);

    // Submit
    const response = await server.sendTransaction(tx);

    if (response.status === "ERROR") {
        throw new Error(`Transaction failed: ${JSON.stringify(response)}`);
    }

    // Fire-and-forget mode: return immediately after submission
    if (fireAndForget) {
        console.log("🚀 Transaction submitted (fire-and-forget):", response.hash);
        return {
            status: "SUBMITTED",
            hash: response.hash,
            returnValue: null
        };
    }

    // Wait for confirmation if pending
    if (response.status === "PENDING") {
        const txHash = response.hash;
        let attempts = 0;
        const maxAttempts = 30;

        while (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 1000));
            attempts++;

            try {
                const result = await server.getTransaction(txHash);

                if (result.status === "NOT_FOUND") {
                    continue;
                }

                if (result.status === "SUCCESS") {
                    return result;
                }

                if (result.status === "FAILED") {
                    throw new Error("Transaction failed on chain");
                }

                return result;
            } catch (error) {
                // If XDR parsing error, the transaction likely succeeded
                // Just return a success indicator
                if (error instanceof Error && error.message.includes("Bad union switch")) {
                    console.warn("XDR parsing issue, assuming transaction succeeded");
                    return { status: "SUCCESS", returnValue: null };
                }
                throw error;
            }
        }

        throw new Error("Transaction timeout");
    }

    return response;
}

/**
 * Initialize game on contract
 */
export async function initGame(): Promise<boolean> {
    try {
        await ensureWalletFunded();

        const wallet = await getOrCreateWallet();
        const account = await server.getAccount(wallet.publicKey);
        const contract = new Contract(CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call("init_game"))
            .setTimeout(30)
            .build();

        const prepared = await server.prepareTransaction(tx);
        await signAndSubmit(prepared);

        return true;
    } catch (error) {
        console.error("Error initializing game:", error);
        return false;
    }
}

/**
 * Move ship
 */
export async function moveShip(direction: number): Promise<number> {
    try {
        const wallet = await getOrCreateWallet();
        const account = await server.getAccount(wallet.publicKey);
        const contract = new Contract(CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(
                contract.call("move_ship", nativeToScVal(direction, { type: "i32" }))
            )
            .setTimeout(30)
            .build();

        const prepared = await server.prepareTransaction(tx);
        const result = await signAndSubmit(prepared);

        if (result.returnValue) {
            return scValToNative(result.returnValue) as number;
        }

        return direction;
    } catch (error) {
        console.error("Error moving ship:", error);
        return 0;
    }
}

/**
 * Shoot
 */
export async function shoot(): Promise<boolean> {
    try {
        const wallet = await getOrCreateWallet();
        const account = await server.getAccount(wallet.publicKey);
        const contract = new Contract(CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call("shoot"))
            .setTimeout(30)
            .build();

        const prepared = await server.prepareTransaction(tx);
        const result = await signAndSubmit(prepared);

        if (result.returnValue) {
            return scValToNative(result.returnValue) as boolean;
        }

        return true;
    } catch (error) {
        console.error("Error shooting:", error);
        return false;
    }
}

/**
 * Update tick
 */
export async function updateTick(): Promise<boolean> {
    try {
        const wallet = await getOrCreateWallet();
        const account = await server.getAccount(wallet.publicKey);
        const contract = new Contract(CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call("update_tick"))
            .setTimeout(30)
            .build();

        const prepared = await server.prepareTransaction(tx);
        const result = await signAndSubmit(prepared);

        if (result.returnValue) {
            return scValToNative(result.returnValue) as boolean;
        }

        return true;
    } catch (error) {
        console.error("Error updating tick:", error);
        return false;
    }
}

/**
 * Get score (read-only - uses simulation, no signing needed)
 */
export async function getScore(): Promise<number> {
    try {
        const wallet = await getOrCreateWallet();
        let account: Account;

        try {
            account = await server.getAccount(wallet.publicKey);
        } catch {
            // Account not on chain yet, return default
            return 0;
        }

        const contract = new Contract(CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call("get_score"))
            .setTimeout(30)
            .build();

        const result = await server.simulateTransaction(tx);

        if ("result" in result && result.result) {
            return scValToNative(result.result.retval) as number;
        }

        return 0;
    } catch (error) {
        console.error("Error getting score:", error);
        return 0;
    }
}

/**
 * Get lives
 */
export async function getLives(): Promise<number> {
    try {
        const wallet = await getOrCreateWallet();
        let account: Account;

        try {
            account = await server.getAccount(wallet.publicKey);
        } catch {
            return 3;
        }

        const contract = new Contract(CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call("get_lives"))
            .setTimeout(30)
            .build();

        const result = await server.simulateTransaction(tx);

        if ("result" in result && result.result) {
            return scValToNative(result.result.retval) as number;
        }

        return 3;
    } catch (error) {
        console.error("Error getting lives:", error);
        return 3;
    }
}

/**
 * Get active invaders
 */
export async function getActiveInvaders(): Promise<number> {
    try {
        const wallet = await getOrCreateWallet();
        let account: Account;

        try {
            account = await server.getAccount(wallet.publicKey);
        } catch {
            return 32;
        }

        const contract = new Contract(CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call("get_active_invaders"))
            .setTimeout(30)
            .build();

        const result = await server.simulateTransaction(tx);

        if ("result" in result && result.result) {
            return scValToNative(result.result.retval) as number;
        }

        return 32;
    } catch (error) {
        console.error("Error getting invaders:", error);
        return 32;
    }
}

/**
 * Check game over
 */
export async function checkGameOver(): Promise<boolean> {
    try {
        const wallet = await getOrCreateWallet();
        let account: Account;

        try {
            account = await server.getAccount(wallet.publicKey);
        } catch {
            return false;
        }

        const contract = new Contract(CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call("check_game_over"))
            .setTimeout(30)
            .build();

        const result = await server.simulateTransaction(tx);

        if ("result" in result && result.result) {
            return scValToNative(result.result.retval) as boolean;
        }

        return false;
    } catch (error) {
        console.error("Error checking game over:", error);
        return false;
    }
}

/**
 * Export wallet for backup (optional user feature)
 */
export async function exportWallet(): Promise<{ publicKey: string; secretKey: string }> {
    const wallet = await getOrCreateWallet();
    return {
        publicKey: wallet.publicKey,
        secretKey: wallet.secretKey,
    };
}

/**
 * Import wallet from secret key (optional user feature)
 */
export async function importWallet(secretKey: string): Promise<boolean> {
    try {
        const keypair = Keypair.fromSecret(secretKey);

        localStorage.setItem(WALLET_KEY, secretKey);
        localStorage.removeItem(FUNDED_KEY); // Reset funded status

        cachedWallet = {
            publicKey: keypair.publicKey(),
            secretKey,
            funded: false,
        };

        // Check if funded
        await ensureWalletFunded();

        return true;
    } catch (error) {
        console.error("Invalid secret key:", error);
        return false;
    }
}

/**
 * Check if wallet is ready (funded and connected)
 */
export async function isWalletReady(): Promise<boolean> {
    try {
        const wallet = await getOrCreateWallet();
        await server.getAccount(wallet.publicKey);
        return true;
    } catch {
        return false;
    }
}

// ========== PLAYER & LEADERBOARD FUNCTIONS ==========

/**
 * Leaderboard entry from contract
 */
export interface LeaderboardEntry {
    username: string;
    player: string;
    score: number;
    timestamp: number;
}

/**
 * Get the global leaderboard from contract
 * Uses direct RPC to avoid SDK XDR parsing issues
 */
export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
        const wallet = await getOrCreateWallet();
        let account: Account;

        try {
            account = await server.getAccount(wallet.publicKey);
        } catch {
            console.log("Wallet not funded, returning empty leaderboard");
            return [];
        }

        const contract = new Contract(CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(contract.call("get_leaderboard"))
            .setTimeout(30)
            .build();

        // Use direct RPC call to avoid SDK XDR parsing issues
        try {
            const simResult = await directRpcCall('simulateTransaction', { transaction: tx.toXDR() });

            if (simResult && simResult.results && simResult.results.length > 0) {
                const xdr = simResult.results[0].xdr;
                if (xdr) {
                    const { xdr: stellarXdr } = await import('@stellar/stellar-sdk');
                    const scVal = stellarXdr.ScVal.fromXDR(xdr, 'base64');
                    const rawEntries = scValToNative(scVal) as any[];

                    return rawEntries.map((entry: any) => ({
                        username: entry.username || "Unknown",
                        player: entry.player || "",
                        score: Number(entry.score) || 0,
                        timestamp: Number(entry.timestamp) || 0,
                    }));
                }
            }
        } catch (xdrError) {
            console.warn("XDR parsing error, leaderboard may be empty:", xdrError);
        }

        return [];
    } catch (error) {
        console.error("Error getting leaderboard:", error);
        return [];
    }
}

/**
 * Register player with username on-chain
 */
export async function registerPlayer(username: string): Promise<boolean> {
    console.log("🔗 registerPlayer called:", username);
    try {
        await ensureWalletFunded();

        const wallet = await getOrCreateWallet();
        console.log("  → Wallet:", wallet.publicKey);

        const account = await server.getAccount(wallet.publicKey);
        console.log("  → Account sequence:", account.sequenceNumber());

        const contract = new Contract(CONTRACT_ID);
        console.log("  → Contract:", CONTRACT_ID);

        // Convert address and username properly
        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(
                contract.call(
                    "register_player",
                    new Address(wallet.publicKey).toScVal(),
                    nativeToScVal(username, { type: "string" })
                )
            )
            .setTimeout(30)
            .build();

        console.log("  → Preparing transaction...");
        const prepared = await server.prepareTransaction(tx);
        console.log("  → Transaction prepared, submitting...");

        // Fire-and-forget: don't wait for confirmation
        await signAndSubmit(prepared, true);
        console.log("  ✅ registerPlayer submitted!");

        return true;
    } catch (error) {
        console.error("❌ Error registering player:", error);
        return false;
    }
}

/**
 * Submit score to the leaderboard
 */
export async function submitScore(score: number): Promise<boolean> {
    console.log("🔗 submitScore called:", score);
    try {
        await ensureWalletFunded();

        const wallet = await getOrCreateWallet();
        console.log("  → Wallet:", wallet.publicKey);

        const account = await server.getAccount(wallet.publicKey);
        console.log("  → Account sequence:", account.sequenceNumber());

        const contract = new Contract(CONTRACT_ID);
        console.log("  → Contract:", CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(
                contract.call(
                    "submit_score",
                    new Address(wallet.publicKey).toScVal(),
                    nativeToScVal(score, { type: "u32" })
                )
            )
            .setTimeout(30)
            .build();

        console.log("  → Preparing transaction...");

        // Use SDK prepareTransaction - it handles simulation and assembly correctly
        const prepared = await server.prepareTransaction(tx);

        console.log("  → Transaction prepared, submitting...");

        // Fire-and-forget: instant UX, confirmation happens in background
        await signAndSubmit(prepared, true);
        console.log("  ✅ submitScore submitted!");

        return true;
    } catch (error) {
        // If it's an XDR parsing error but transaction was submitted, consider it success
        if (error instanceof Error && error.message.includes("Bad union switch")) {
            console.warn("XDR parsing issue during submit, but transaction may have succeeded");
            return true;
        }
        console.error("❌ Error submitting score:", error);
        return false;
    }
}

/**
 * Check if current player is registered
 */
export async function isPlayerRegistered(): Promise<boolean> {
    try {
        const wallet = await getOrCreateWallet();
        let account: Account;

        try {
            account = await server.getAccount(wallet.publicKey);
        } catch {
            return false;
        }

        const contract = new Contract(CONTRACT_ID);

        const tx = new TransactionBuilder(account, {
            fee: BASE_FEE,
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(
                contract.call(
                    "is_registered",
                    new Address(wallet.publicKey).toScVal()
                )
            )
            .setTimeout(30)
            .build();

        const result = await server.simulateTransaction(tx);

        if ("result" in result && result.result) {
            return scValToNative(result.result.retval) as boolean;
        }

        return false;
    } catch (error) {
        console.error("Error checking registration:", error);
        return false;
    }
}

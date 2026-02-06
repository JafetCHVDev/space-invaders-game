# 🚀 Space Invaders Soroban

> A classic Space Invaders game with on-chain state powered by [Soroban](https://soroban.stellar.org/) smart contracts on the Stellar network.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](https://github.com/JafetCHVDev/space-invaders-game)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-blue)](https://stellar.org)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 🎮 Features

- **Play Space Invaders** - Classic arcade gameplay in your browser
- **Zero Friction** - No wallet installation or setup required
- **Embedded Wallet** - Auto-generated wallet stored locally (testnet auto-funded)
- **On-chain Game State** - Game logic runs on Stellar Soroban
- **ECS Architecture** - Uses `cougr-core` Entity-Component-System framework
- **Premium UX** - Modern dark theme with neon glow effects


## 📦 Tech Stack

| Component | Technology |
|-----------|------------|
| Smart Contract | Soroban (Rust) + cougr-core ECS |
| Frontend | Vite + TypeScript |
| Wallet | Embedded (auto-generated, localStorage) |
| Network | Stellar Testnet (auto-funded) |


## 🏗️ Project Structure

```
├── contracts/game/     # Soroban smart contract
│   └── src/
│       ├── lib.rs          # Contract entry points
│       ├── game_state.rs   # ECS components
│       └── test.rs         # Unit tests (13 tests)
├── frontend/           # Web game client
│   └── src/
│       ├── main.ts         # Entry point
│       ├── game.ts         # Game logic
│       ├── contract.ts     # Stellar SDK calls
│       └── styles.css      # Modern UI
├── scripts/            # Deployment & automation
│   ├── setup-repo.sh       # GitHub CLI setup
│   └── deploy-testnet.sh   # Testnet deployment
├── .github/workflows/  # CI/CD
│   └── ci.yml
└── docs/               # Documentation
```

## 🚀 Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup)
- [Node.js](https://nodejs.org/) v18+
- [Freighter Wallet](https://www.freighter.app/)

### Setup

```bash
# Clone the repository
git clone https://github.com/JafetCHVDev/space-invaders-game.git
cd space-invaders-game

# Add wasm32 target
rustup target add wasm32-unknown-unknown
```

### Run Contract Tests

```bash
cargo test
```

### Build Contract

```bash
cargo build --target wasm32-unknown-unknown --release
```

### Deploy to Testnet

```bash
# Setup identity (first time only)
stellar keys generate --global deployer --network testnet
stellar keys fund deployer --network testnet

# Deploy contract
./scripts/deploy-testnet.sh
```

### Run Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## 🎯 Contract API

### Game Functions

| Function | Parameters | Description |
|----------|------------|-------------|
| `init_game` | - | Initialize new game |
| `move_ship` | `direction: i32` | Move ship (-1=left, 1=right) |
| `shoot` | - | Fire bullet |
| `update_tick` | - | Advance game state |

### Query Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `get_score` | `u32` | Current score |
| `get_lives` | `u32` | Remaining lives |
| `get_ship_position` | `i32` | Ship X position |
| `get_active_invaders` | `u32` | Invader count |
| `check_game_over` | `bool` | Game over status |

## 🎮 Game Controls

| Key | Action |
|-----|--------|
| ← | Move left |
| → | Move right |
| Space | Shoot |

## ✅ MVP Checklist

- [x] Contract: Player ship movement
- [x] Contract: Shooting mechanics
- [x] Contract: Invader grid with types (Squid, Crab, Octopus)
- [x] Contract: Collision detection
- [x] Contract: Score tracking by invader type
- [x] Contract: Lives and game over
- [x] Contract: 13 unit tests
- [x] Frontend: Canvas game rendering
- [x] Frontend: Keyboard controls
- [ ] Frontend: Wallet integration (in progress)
- [ ] Frontend: Contract calls

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

### Setup GitHub Labels & Issues

```bash
# After configuring gh cli
./scripts/setup-repo.sh
```

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

Built with 💜 for the Stellar ecosystem

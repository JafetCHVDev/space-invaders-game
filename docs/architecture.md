# Architecture

## On-Chain vs Off-Chain

### On-Chain (Soroban Contract)
| Data | Reason |
|------|--------|
| Game state (score, lives, tick) | Verified game progression |
| Invader positions & status | Anti-cheat validation |
| Player ship position | State verification |
| Bullet positions | Collision validation |

### Off-Chain (Frontend)
| Data | Reason |
|------|--------|
| Visual rendering (60 FPS) | Performance |
| Sound effects | Not blockchain data |
| UI state | Local only |

## ECS Architecture (cougr-core)

The contract uses Entity-Component-System pattern from `cougr-core`:

- **Entities**: Ship, Invaders, Bullets
- **Components**: Position, Velocity, Health
- **Systems**: Movement, Collision, Shooting

See `contracts/game/src/game_state.rs` for component definitions.

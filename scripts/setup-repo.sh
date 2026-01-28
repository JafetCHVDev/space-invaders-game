#!/bin/bash
# Setup repository with GitHub CLI (gh)
# Run this script after creating the local project

set -e

REPO_NAME="space-invaders-game"
OWNER="JafetCHVDev"  # Tu usuario de GitHub

echo "🚀 Configurando repositorio remoto..."

# Si el repo ya existe, solo configura labels y milestones
# Si no existe, crear el repo (omitir si ya lo creaste manualmente)
# gh repo create "$OWNER/$REPO_NAME" --public --description "Space Invaders on Stellar Soroban - Drips Wave"

echo "🏷️ Creando labels..."
gh label create "bug" --color "d73a4a" --description "Something isn't working" --force 2>/dev/null || true
gh label create "feature" --color "a2eeef" --description "New feature or request" --force 2>/dev/null || true
gh label create "docs" --color "0075ca" --description "Documentation improvements" --force 2>/dev/null || true
gh label create "contract" --color "7057ff" --description "Smart contract related" --force 2>/dev/null || true
gh label create "frontend" --color "008672" --description "Frontend related" --force 2>/dev/null || true
gh label create "ci" --color "fbca04" --description "CI/CD related" --force 2>/dev/null || true
gh label create "good first issue" --color "7057ff" --description "Good for newcomers" --force 2>/dev/null || true
gh label create "priority:high" --color "b60205" --description "High priority" --force 2>/dev/null || true

echo "🎯 Creando milestone MVP..."
gh api repos/"$OWNER/$REPO_NAME"/milestones \
  -f title="Wave MVP" \
  -f description="Minimum Viable Product for Drips Wave submission" \
  -f state="open" 2>/dev/null || echo "Milestone may already exist"

echo "📝 Creando issues..."

# Contract issues
gh issue create \
  --title "Setup Soroban contract workspace" \
  --body "- [x] Crear estructura de carpetas
- [x] Configurar Cargo.toml workspace
- [x] Añadir dependencias soroban-sdk y cougr-core" \
  --label "contract" \
  --milestone "Wave MVP" 2>/dev/null || true

gh issue create \
  --title "Implement game mechanics (init, move, shoot, tick)" \
  --body "- [x] init_game con ECS World
- [x] move_ship con bounds checking
- [x] shoot con cooldown
- [x] update_tick con collision detection" \
  --label "contract,feature" \
  --milestone "Wave MVP" 2>/dev/null || true

gh issue create \
  --title "Add query functions (score, lives, leaderboard)" \
  --body "- [x] get_score
- [x] get_lives
- [x] get_ship_position
- [x] get_active_invaders
- [x] check_game_over" \
  --label "contract,feature" \
  --milestone "Wave MVP" 2>/dev/null || true

# Frontend issues
gh issue create \
  --title "Setup Vite + TypeScript frontend" \
  --body "- [ ] npm create vite
- [ ] Configurar TypeScript
- [ ] Instalar @stellar/stellar-sdk" \
  --label "frontend" \
  --milestone "Wave MVP" 2>/dev/null || true

gh issue create \
  --title "Implement Space Invaders canvas game" \
  --body "- [ ] Canvas setup y game loop
- [ ] Nave del jugador con controles
- [ ] Grid de aliens
- [ ] Sistema de balas y colisiones
- [ ] Score display" \
  --label "frontend,feature" \
  --milestone "Wave MVP" 2>/dev/null || true

gh issue create \
  --title "Integrate Freighter wallet" \
  --body "- [ ] Detectar wallet instalada
- [ ] Conectar wallet
- [ ] Mostrar address
- [ ] Firmar transacciones" \
  --label "frontend,feature" \
  --milestone "Wave MVP" 2>/dev/null || true

# CI issue
gh issue create \
  --title "Setup GitHub Actions CI" \
  --body "- [x] Workflow para Rust (fmt, test, build)
- [x] Workflow para frontend (build)
- [x] Clippy comentado para activar después
- [ ] Deploy automático a testnet" \
  --label "ci" \
  --milestone "Wave MVP" 2>/dev/null || true

# Docs issue
gh issue create \
  --title "Write comprehensive documentation" \
  --body "- [x] README con setup instructions
- [ ] Architecture docs
- [ ] Contribution guide
- [ ] API documentation" \
  --label "docs" \
  --milestone "Wave MVP" 2>/dev/null || true

echo "✅ Setup completo!"
echo "Repositorio: https://github.com/$OWNER/$REPO_NAME"

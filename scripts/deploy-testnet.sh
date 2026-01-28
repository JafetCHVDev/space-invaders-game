#!/bin/bash
# Deploy contract to Stellar Testnet

set -e

echo "🔧 Building contract..."
cargo build --target wasm32-unknown-unknown --release

WASM_PATH="target/wasm32-unknown-unknown/release/space_invaders.wasm"

if [ ! -f "$WASM_PATH" ]; then
    echo "❌ WASM file not found at $WASM_PATH"
    exit 1
fi

echo "📦 Optimizing WASM..."
stellar contract optimize --wasm "$WASM_PATH"

echo "🚀 Deploying to testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source deployer \
  --network testnet)

echo "✅ Contract deployed!"
echo "Contract ID: $CONTRACT_ID"
echo ""
echo "📋 Next steps:"
echo "1. Initialize game:"
echo "   stellar contract invoke --id $CONTRACT_ID --source deployer --network testnet -- init_game"
echo ""
echo "2. Play:"
echo "   stellar contract invoke --id $CONTRACT_ID --network testnet -- move_ship --direction 1"
echo "   stellar contract invoke --id $CONTRACT_ID --network testnet -- shoot"
echo "   stellar contract invoke --id $CONTRACT_ID --network testnet -- update_tick"
echo ""
echo "3. Check state:"
echo "   stellar contract invoke --id $CONTRACT_ID --network testnet -- get_score"
echo "   stellar contract invoke --id $CONTRACT_ID --network testnet -- get_lives"

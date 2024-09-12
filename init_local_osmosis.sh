#!/bin/bash
# This is a script to set up a local osmosis chain for testing purposes.

# Set the variables
CHAIN_ID="liq_test"
# This should be the same address as the owner of redbank. Use the same mnemonic as is in the redbank deplpoy scripts config
ADDRESS1="osmo1cyyzpxplxdzkeea7kwsydadg87357qnahakaks"
COIN_AMOUNT1="100000000000000000uosmo,10000000000000000000000uusd,100000000000000000uion,100000000000000000uatom,1000000000000000000umars"
ADDRESS2="osmo1h9twyldz0z0crzgqmafa9m30nll7xljzzge6fg"
COIN_AMOUNT2="100000000uusd,1000000000uosmo,1000000000uatom"
GENTX_AMOUNT="10000000uosmo"
GENESIS_JSON_PATH="$HOME/.osmosisd/config/genesis.json"
CONFIG_FILE="$HOME/.osmosisd/config/config.toml"

# Execute the commands
rm -rf "$HOME/.osmosisd"
osmosisd init liq_test --chain-id "$CHAIN_ID"
osmosisd add-genesis-account "$ADDRESS1" "$COIN_AMOUNT1"
osmosisd add-genesis-account "$ADDRESS2" "$COIN_AMOUNT2"
osmosisd gentx deploy "$GENTX_AMOUNT" --chain-id "$CHAIN_ID" --keyring-backend os
# After initiating a chain, the denom is set to stake in various places. We need to change it to uosmo
sed -i '' 's/stake/uosmo/g' "$GENESIS_JSON_PATH"

# Speed up local chain
sed -i '' 's/timeout_propose = "[^"]*"/timeout_propose = "200ms"/g' "$CONFIG_FILE"
sed -i '' 's/timeout_propose_delta = "[^"]*"/timeout_propose_delta = "200ms"/g' "$CONFIG_FILE"
sed -i '' 's/timeout_prevote = "[^"]*"/timeout_prevote = "200ms"/g' "$CONFIG_FILE"
sed -i '' 's/timeout_prevote_delta = "[^"]*"/timeout_prevote_delta = "200ms"/g' "$CONFIG_FILE"
sed -i '' 's/timeout_precommit = "[^"]*"/timeout_precommit = "200ms"/g' "$CONFIG_FILE"
sed -i '' 's/timeout_precommit_delta = "[^"]*"/timeout_precommit_delta = "200ms"/g' "$CONFIG_FILE"
sed -i '' 's/timeout_commit = "[^"]*"/timeout_commit = "200ms"/g' "$CONFIG_FILE"

osmosisd collect-gentxs

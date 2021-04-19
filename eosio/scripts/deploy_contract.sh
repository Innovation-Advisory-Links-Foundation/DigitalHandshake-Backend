#!/usr/bin/env bash
set -o errexit

# Set PATH.
PATH="$PATH:/opt/eosio/bin"

CONTRACTSPATH="$( pwd -P )/contracts"

# Make a new directory for compiled contract files
mkdir -p ./compiled
mkdir -p ./compiled/$1

COMPILEDCONTRACTSFOLDER="compiled"
COMPILEDCONTRACTSPATH="$( pwd -P )/$COMPILEDCONTRACTSFOLDER"

# Unlock the wallet, ignore error if already unlocked.
if [ ! -z $3 ]; then cleos wallet unlock -n $3 --password $4 || true; fi

# Compile smart contract to wasm and abi files using EOSIO.CDT (Contract Development Toolkit).
# https://github.com/EOSIO/eosio.cdt
(
  eosio-cpp -I "$CONTRACTSPATH/$5/" -o "$COMPILEDCONTRACTSPATH/$1/$1.wasm" --abigen --contract "$1" "$CONTRACTSPATH/$1/$1.cpp"
) &&

# If an ABI file is found in compiled contracts folder.
if [ -f "$COMPILEDCONTRACTSFOLDER/$1/$1.abi" ]; then
  # Set (deploy) compiled contract to blockchain.
  cleos set contract $2 "$COMPILEDCONTRACTSFOLDER/$1" --permission $2
else
  cleos set code $2 "$COMPILEDCONTRACTSFOLDER/$1/$1.wasm" --permission $2
fi

sleep 2s # wait 4 blocks to avoid duplicate txs

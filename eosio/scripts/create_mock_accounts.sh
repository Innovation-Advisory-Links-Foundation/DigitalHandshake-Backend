#!/bin/bash
set -o errexit

echo "***** ACCOUNTS CREATION *****"

PATH="$PATH:/opt/eosio/bin"

cd "$(dirname "$0")"

# Download JQ for JSON reader, we use JQ here for reading the JSON file ( accounts.json ).
mkdir -p ~/bin && curl -sSL -o ~/bin/jq https://github.com/stedolan/jq/releases/download/jq-1.5/jq-linux64 && chmod +x ~/bin/jq && export PATH=$PATH:~/bin

# Loop through the array in the json file, import keys and create accounts using the eosio default account.
# Each account name, public and private key are hardcoded in the JSON.
# NEVER store the private key in any source code in your real life developmemnt!!! 
# This is just for demo purposes.

jq -c '.[]' ../mocks/accounts.json | while read i; do
  name=$(jq -r '.name' <<< "$i")
  pubOwner=$(jq -r '.publicKeyOwner' <<< "$i")
  pubActive=$(jq -r '.publicKeyActive' <<< "$i")

  cleos create account eosio $name $pubOwner $pubActive
done

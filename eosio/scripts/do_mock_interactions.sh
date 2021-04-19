#!/usr/bin/env bash
source constants.sh
set -o errexit

PATH="$PATH:/opt/eosio/bin"

cd "$(dirname "$0")"

echo "***** DHS TOKEN CREATION AND ISSUE *****"
cleos push action dhstoken create '["dhstoken","'"$MAX_SUPPLY_QUANTITY $TOKEN_SYMBOL"'"]' -p dhstoken@active

echo "***** USER REGISTRATION *****"
# cleos push action dhsservice signup '["dhstoken", "1000000000.0000 DHS"]' -p dhstoken@active

# Download JQ for JSON reader, we use JQ here for reading the JSON file ( accounts.json ).
mkdir -p ~/bin && curl -sSL -o ~/bin/jq https://github.com/stedolan/jq/releases/download/jq-1.5/jq-linux64 && chmod +x ~/bin/jq && export PATH=$PATH:~/bin

# Loop through the array in the json file and interact with the contracts for each user.
# NB. Each account name, public and private key are hardcoded in the JSON.
# NEVER store the private key in any source code in your real life developmemnt!!! 
# This is just for demo purposes.

# We are going to import private keys of each user inside the wallet dhswallet for
# sending the txs for mock interactions. After that, we are going to remove the key from the wallet.

jq -c '.[]' ../mocks/accounts.json | while read i; do
  name=$(jq -r '.name' <<< "$i")
  pubOwner=$(jq -r '.publicKeyOwner' <<< "$i")
  privActive=$(jq -r '.privateKeyActive' <<< "$i")
  pubActive=$(jq -r '.publicKeyActive' <<< "$i")
  role=$(jq -r '.role' <<< "$i")
  externalDataHash=$(jq -r '.externalDataHash' <<< "$i")

  echo "Account: $name"
  cleos wallet import -n dhswal --private-key $privActive

  cleos push action dhsservice signup '["'"$name"'", "'"$role"'", "'"$externalDataHash"'"]' -p $name@active

  if [ "$role" == 0 ] # user (not juror).
  then 
        cleos push action dhstoken issue '["dhstoken", "'"$ISSUE_SUPPLY_QUANTITY_USER $TOKEN_SYMBOL"'", "Welcome Bonus"]' -p dhstoken@active
        cleos push action dhstoken transfer '["dhstoken", "'"$name"'",  "'"$ISSUE_SUPPLY_QUANTITY_USER $TOKEN_SYMBOL"'", "Welcome Bonus"]' -p dhstoken@active
  fi

  cleos wallet remove_key -n dhswal --password $(cat ../dhs_wallet_password.txt) $pubActive

  sleep 2s # wait 4 blocks to avoid duplicate txs
done

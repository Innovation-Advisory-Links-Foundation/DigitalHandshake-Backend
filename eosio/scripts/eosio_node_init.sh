#!/usr/bin/env bash
set -o errexit

# set PATH
PATH="$PATH:/opt/eosio/bin:/opt/eosio/bin/scripts"

set -m

if [ "$1" != "--test" ]
then
  # Start nodeos ( local node of blockchain ) as background job.
  nodeos -e -p eosio -d /mnt/dev/data \
    --config-dir /mnt/dev/config \
    --http-validate-host=false \
    --plugin eosio::producer_plugin \
    --plugin eosio::history_plugin \
    --plugin eosio::chain_api_plugin \
    --plugin eosio::history_api_plugin \
    --plugin eosio::http_plugin \
    --http-server-address=0.0.0.0:8888 \
    --access-control-allow-origin=* \
    --contracts-console \
    --verbose-http-errors &
  sleep 1s
  until curl localhost:8888/v1/chain/get_info # Sanity check.
  do
    sleep 1s
  done

  # Sleep for 2 seconds in order to have 4 empty blocks before sending transactions.
  sleep 2s

  # Setup wallet.

  # First key import is for eosio system account.
  echo "***** DEFAULT EOSIO WALLET SETUP *****"

  cleos wallet create -n eosio --to-console | tail -1 | sed -e 's/^"//' -e 's/"$//' > eosio_wallet_password.txt
  cleos wallet import -n eosio --private-key 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3

  echo "***** SMART CONTRACT DIGITAL HANDSHAKE (DHS) WALLET SETUP *****"

  # Key for eosio account and export the generated password to a file for unlocking wallet later.
  cleos wallet create -n dhswal --to-console | tail -1 | sed -e 's/^"//' -e 's/"$//' > dhs_wallet_password.txt
  # Owner key for dhs wallet.
  cleos wallet import -n dhswal --private-key 5JTr66jUdbrEkGKEcWNGYrhUU8QeumxSmY3oFjg2TkyaNq9GtjK
  # Active key for dhs wallet.
  cleos wallet import -n dhswal --private-key 5JDAD5g2jdKgtkMbmc6tKbQf71qYYYv5kcEHTiQWetuU1kiqDnn

  echo "***** DIGITAL HANDSHAKE (DHS) WALLET SUCCESSFULLY CREATED *****"

  echo "***** DIGITAL HANDSHAKE (DHS) ACCOUNT CREATION *****"

  # Create account with above wallet's public keys.
  cleos create account eosio dhstoken EOS88ei6fmjgCtktHo6wjMbYTBEknH3NaVPMUFRHJuwwzwAeUTupf EOS6CmoHAQYb4HpwnZE6Y5b1TsBdKAhCdKH2X257A4ZQjNCSiJNNP
  cleos create account eosio dhsservice EOS88ei6fmjgCtktHo6wjMbYTBEknH3NaVPMUFRHJuwwzwAeUTupf EOS6CmoHAQYb4HpwnZE6Y5b1TsBdKAhCdKH2X257A4ZQjNCSiJNNP
  cleos create account eosio dhsescrow EOS88ei6fmjgCtktHo6wjMbYTBEknH3NaVPMUFRHJuwwzwAeUTupf EOS6CmoHAQYb4HpwnZE6Y5b1TsBdKAhCdKH2X257A4ZQjNCSiJNNP

  # Create user accounts (mock).
  create_mock_accounts.sh

  echo "***** DIGITAL HANDSHAKE (DHS) ACCOUNT SUCCESSFULLY CREATED *****"

  echo "***** SMART CONTRACT DEPLOY *****"

  # Deploy smart contracts.
  # $1 smart contract name.
  # $2 account holder name of the smart contract.
  # $3 wallet for unlock the account.
  # $4 password for unlocking the wallet.
  # $5 include folder name.
  deploy_contract.sh dhstoken dhstoken dhswal $(cat dhs_wallet_password.txt) dhstoken
  deploy_contract.sh dhsservice dhsservice dhswal $(cat dhs_wallet_password.txt) dhstoken
  deploy_contract.sh dhsescrow dhsescrow dhswal $(cat dhs_wallet_password.txt)
  cleos set account permission dhstoken active --add-code
  cleos set account permission dhsservice active --add-code
  cleos set account permission dhsescrow active --add-code

  echo "***** SMART CONTRACT SUCCESSFULLY DEPLOYED *****"

  echo "***** SMART CONTRACT INTERACTIONS *****"

  do_mock_interactions.sh

  echo "***** SMART CONTRACT INTERACTIONS SUCCESSFULLY COMPLETED *****"

  # Create a file to indicate the blockchain has been initialized.
  touch "/mnt/dev/data/initialized"

  # Put the background nodeos job to foreground for Docker run command.
  fg %1

else
  # Start nodeos ( local node of blockchain ) as background job.
  nodeos -e -p eosio -d /mnt/dev/data_test \
    --config-dir /mnt/dev/config \
    --http-validate-host=false \
    --plugin eosio::producer_plugin \
    --plugin eosio::history_plugin \
    --plugin eosio::chain_api_plugin \
    --plugin eosio::history_api_plugin \
    --plugin eosio::http_plugin \
    --http-server-address=0.0.0.0:8889 \
    --access-control-allow-origin=* \
    --contracts-console \
    --verbose-http-errors &
  sleep 1s
  until curl localhost:8889/v1/chain/get_info # Sanity check.
  do
    sleep 1s
  done

  # Sleep for 2 seconds in order to have 4 empty blocks before sending transactions.
  sleep 2s

  # Setup wallet.

  # First key import is for eosio system account.
  echo "***** DEFAULT EOSIO WALLET SETUP *****"

  cleos wallet create -n eosio --to-console | tail -1 | sed -e 's/^"//' -e 's/"$//' > eosio_wallet_password.txt
  cleos wallet import -n eosio --private-key 5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3
  
  # Put the background nodeos job to foreground for Docker run command.
  fg %1

fi
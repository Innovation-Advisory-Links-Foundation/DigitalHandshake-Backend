#!/usr/bin/env bash
source constants.sh

# Change to script's directory.
cd "$(dirname "$0")"

if [ "$1" == "--dev" ]
then
  # Check if the blockchain has already been initialized.
  if [ -e "data/initialized" ]
  then
    echo "***** EOSIO DEV NODE RESTART *****"
    script="./scripts/eosio_node_restart.sh"
  else
    echo "***** EOSIO DEV NODE STARTUP *****"
    script="./scripts/eosio_node_init.sh"
  fi

  # Run Docker container for eosio-dh image.
  echo "***** Run Docker container from the $DOCKER_IMAGE_NAME:$DOCKER_IMAGE_TAG image *****"
  docker run --rm --name $DOCKER_CONTAINER_NAME -d \
  -p 8888:8888 -p 9876:9876 \
  --mount type=bind,src="$(pwd)"/contracts,dst=/opt/eosio/bin/contracts \
  --mount type=bind,src="$(pwd)"/scripts,dst=/opt/eosio/bin/scripts \
  --mount type=bind,src="$(pwd)"/mocks,dst=/opt/eosio/bin/mocks \
  --mount type=bind,src="$(pwd)"/data,dst=/mnt/dev/data \
  -w "/opt/eosio/bin/" $DOCKER_IMAGE_NAME:$DOCKER_IMAGE_TAG /bin/bash -c "$script"

  echo "***** EOSIO DEV NODE RUNNING *****"

  # Display logs.
  if [ "$2" != "--nolog" ]
  then
    echo "***** LOGS *****"
    docker logs $DOCKER_CONTAINER_NAME --follow
  fi
fi

if [ "$1" == "--test" ]
then
  echo "***** EOSIO TEST NODE STARTUP *****"
  
  # Run Docker container for eosio-dh image.
  echo "***** Run Docker container from the $DOCKER_IMAGE_NAME:$DOCKER_IMAGE_TAG image *****"
  docker run --rm --name $DOCKER_TEST_CONTAINER_NAME -d \
  -p 8889:8889 -p 9877:9877 \
  --mount type=bind,src="$(pwd)"/contracts,dst=/opt/eosio/bin/contracts \
  --mount type=bind,src="$(pwd)"/scripts,dst=/opt/eosio/bin/scripts \
  --mount type=bind,src="$(pwd)"/mocks,dst=/opt/eosio/bin/mocks \
  --mount type=bind,src="$(pwd)"/data_test,dst=/mnt/dev/data_test \
  -w "/opt/eosio/bin/" $DOCKER_IMAGE_NAME:$DOCKER_IMAGE_TAG /bin/bash -c "./scripts/eosio_node_init.sh --test"

  echo "***** WAITING FOR BLOCKS (~30s) *****"
  sleep 30s
  echo "***** EOSIO TEST NODE RUNNING *****"

fi
#!/usr/bin/env bash
source constants.sh

echo "***** EOSIO NODE SETUP *****"

# Change to script's directory.
cd "$(dirname "$0")"
SCRIPTPATH="$( pwd -P)"

# Looking for Node.js and Docker.
if command -v npm > /dev/null 2>&1; then
  echo "Node.js correctly installed on the system!"
else
  echo -e "\033[0;31m[Error with Exception]\033[0m"
  echo "Please make sure Node.js is installed!!!"
  echo "Install Node.js: https://nodejs.org/en/"
fi

if command -v docker > /dev/null 2>&1; then
  echo "Docker correctly installed on the system!"
else
  echo -e "\033[0;31m[Error with Exception]\033[0m"
  echo "Please make sure Docker is installed!!!"
  echo "Install Docker: https://docs.docker.com/engine/install/"
fi


# Builds EOSIO image, if necessary.
if [[ "$(docker images -q $DOCKER_IMAGE_NAME:$DOCKER_IMAGE_TAG)" == "" ]]; then
  echo "***** Build Docker image $DOCKER_IMAGE_NAME version $DOCKER_IMAGE_TAG *****"
  docker build -t $DOCKER_IMAGE_NAME:$DOCKER_IMAGE_TAG .
else
  echo "***** Docker image already exists. No building process is needed *****"
fi

if [ "$1" == "--dev" ]
then
  # Remove previous container, if any.
  echo "***** Cleaning blockchain EOSIO block data folder *****"

  docker rm --force $DOCKER_CONTAINER_NAME
  rm -rf "./data"
  mkdir -p "./data"
fi

if [ "$1" == "--test" ]
then
  # Remove previous container, if any.
  echo "***** Cleaning blockchain EOSIO block data folder *****"

  docker rm --force $DOCKER_TEST_CONTAINER_NAME
  rm -rf "./data_test"
  mkdir -p "./data_test"
fi

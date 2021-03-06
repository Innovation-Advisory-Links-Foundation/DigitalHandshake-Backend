# <img src="logo.svg" alt="DHSLogo" width="400px">

**A blockchain-based solution for making digital handshakes guaranteeing transparency on identity, code and payments.**

- Building a new form of trust in the digital handshake process (from platform to code) through an EOSIO blockchain-based solution.
- Fair and decentralized dispute resolution with a pseudo-random selection of jurors for reducing the cost-benefit ratio.
- Automatic token payments through a decentralized and bulletproof escrow service.

You can learn more about the main challenges of building trust for digital handshakes on the article on our [OverTheBlock Medium](https://medium.com/overtheblock/) page.

## Table of Contents

- [Workflow](#workflow)
- [Backend](#backend)
- [Getting Started](#getting-started)
  - [Prerequisities](#prerequisities)
  - [Configuration](#configuration)
  - [EOSIO with Docker](#eosio-with-docker)
  - [MongoDB-Express Server with Docker](#mongodb-express-server-with-docker)
  - [Testing](#testing)
- [Development Rules](#development-rules)
  - [Commit](#commit)
  - [Branch](#branch)
- [License](#license)

## Workflow

<div align="center">
    <img 
        align="center" 
        src="./workflow.svg" 
        alt="Workflow"
    />
    </div>
<p align="center"> <i>Figure 1.</i> The high-level overview of Digital Handshake workflow. </p>

- **Users**. An individual or entity registered on the platform and uniquely recognized in the blockchain through a human-readable address. The user can have the Dealer's role when it posts a request for a particular service (e.g., I need a website!) or Bidder's role when it proposes itself for satisfying a specific demand. A user can play both roles, one for each handshake.

- **Jurors**. Professionals or legal experts recorded on the platform. They assist the parties in the judgment of a dispute. They do not have a concrete motivation to participate in the handshake but are interested in receiving new dispute assignments to increase earnings.

The on-chain business logic is broken down into three smart contracts, where each solves a particular function:

- **Token**. A standard ERC20 token (DHS) offers price stability when making any form of contactless payment.

- **Service**. All features for making digital handshakes.

- **Escrow**. A service that locks amounts of DHS tokens for automating payments.

## Backend

<div align="center">
    <img 
        align="center" 
        src="./architecture.svg" 
        alt="Architecture"
    />
    </div>
<p align="center"> <i>Figure 2.</i> The high-level overview of Digital Handshake architecture. </p>

The backend is entirely [Dockerized](https://www.docker.com/): containers for [EOSIO](https://eos.io/) blockchain nodes, a server and an off-chain database instance. The blockchain nodes can be started, populated as needs, stopped and restarted using provided scripts, both for development and testing nodes. The server contains a running instance of a rest API which provides communication with the [MongoDB](https://www.mongodb.com/) instance. The off-chain database is necessary to store personal user data (encrypted with the user's private key) and a repository for long contractual terms and other textual information related to the handshake process. The data integrity is continuously verified through a double timestamping mechanism (storing hashes on and off-chain). The backend contains the Token, Service and Escrow smart contracts in C++ with the related test files for each feature and use cases.

## Getting Started

### Prerequisities

You need to have the following installed:

- [git](https://git-scm.com/downloads) >= _2.21.0_
- [node](https://nodejs.org/en/download/) >= _10.16.0_
- [npm](https://www.npmjs.com/get-npm) >= _6.14.4_
- [docker](https://docs.docker.com/engine/install/) >= _20.10.3 (build 48d30b5)_
- [eosio.cdt](https://github.com/EOSIO/eosio.cdt) >= _1.7.0_

### Configuration

Clone the repository and install the packages:

```bash
git clone https://github.com/Innovation-Advisory-Links-Foundation/DigitalHandshake-Backend.git
cd DigitalHandshake-Backend
npm install
```

Make a copy of the `.env.default` file and rename it `.env`. The new file will contain the following data:

```bash
# Application identifier.
APP_ID=digital-handshake-backend

# Express Node server
SERVER_ENDPOINT="0.0.0.0"
SERVER_PORT=8080
SERVER_TEST_URL="http://localhost:8080"
LOG_LEVEL=debug
REQUEST_LIMIT=100kb

# EOSIO
EOSIO_TEST_URL="http://localhost:8889"
EOSIO_TEST_CHAIN_ID="8a34ec7df1b8cd06ff4a8abbaa7cc50300823350cadc59ab296cb00d104d2b8f"

# MongoDB
MONGO_DB_ENDPOINT=mongodb://mongodb:27017
MONGO_DB_URL=mongodb://127.0.0.1:27017
# Use 'test' for testing purposes, use 'dhs' for development only. Testing on 'dhs' db works but will put in some dummy data.
MONGO_DB_DATABASE=dhs
DB_USER=
DB_PASS=
```

- The `SERVER_ENDPOINT` and `SERVER_PORT` are the connection endpoint (URL) and port for the [Express](https://expressjs.com/) Rest API server to talk with the MongoDB instance (`SERVER_TEST_URL` for testing purposes only).
- The `EOSIO_TEST_URL` and `EOSIO_TEST_CHAIN_ID` are the configuration for the local EOSIO node used for running tests (you can find the configuration of the development node on `eosio/eosio_node_start.sh` script).
- The `MONGO_DB_ENDPOINT` and `MONGO_DB_DATABASE` defines the configuration endpoint for the MongoDB instance (`MONGO_DB_TEST_URL` and `MONGO_DB_TEST_DATABASE` for testing purposes only).

To compile the smart contract C++ code, you will need the [EOSIO CDT](https://github.com/EOSIO/eosio.cdt) installed on your machine (you can follow this [guide](https://developers.eos.io/welcome/latest/getting-started-guide/index)). This creates a new root folder `compiled/` containing the `.abi` and `.wasm` smart contract compilation files.

To run the smart contracts compilation:

```bash
npm run compile:contracts
```

### EOSIO with Docker

?????? **Any private keys you see in this repository are for demo purposes only. For a real DApp, NEVER expose the private keys** ??????

#### Dev Node

EOSIO will occupy the ports **8888** and **9876**. Make sure nothing else is already running on these ports.

The `eosio/` folder contains the smart contracts and the necessary scripts to run the nodes.

To start EOSIO with Docker in development mode:

```bash
npm run start:eosio-dev
```

To restart EOSIO with Docker in development mode:

```bash
npm run restart:eosio-dev
```

#### Test Node

You can run an EOSIO node for testing to run smart contract tests in a production-like environment. You need to change the `--dev` above with `--test`. The dev and test nodes can run in parallel.

EOSIO test node will occupy the ports **8889** and **9877**. Make sure nothing else is already running on these ports.

To start the EOSIO node with Docker for testing:

```bash
npm run start:eosio-test
```

### MongoDB-Express Server with Docker

MongoDB and Express server will occupy the ports **8080** and **27017**. Make sure nothing else is already running on these ports.

We have created a Docker compose file (`docker-compose.yml`) to facilitate the configuration and necessary onboarding for running a MongoDB and a NodeJS Express server, both communicating in separated Docker containers.

Run to start the server:

```bash
npm run docker:compose
```

### Testing

Run to test the EOSIO smart contracts (nb. this command will start the EOSIO node for testing):

```bash
npm run test:eosio
```

Run to test the NodeJS server API for MongoDB:

```bash
npm run test:server
```

## Development Rules

### Commit

See how a minor change to your commit message style can make you a better programmer.
Boilerplate
Format: `<type>(<scope>): <subject>`

`<scope>` is optional

#### Example

```
[feat]: add hat wobble
^----^  ^------------^
|     |
|     +-> Summary in present tense.
|
+-------> Type: chore, docs, feat, fix, refactor, style, or test.
```

More Examples:

- `feat`: (new feature for the user, not a new feature for build script)
- `fix`: (bug fix for the user, not a fix to a build script)
- `docs`: (changes to the documentation)
- `style`: (formatting, missing semicolons, etc.; no production code change)
- `refactor`: (refactoring production code, e.g., renaming a variable)
- `test`: (adding missing tests, refactoring tests; no production code change)
- `chore`: (updating grunt tasks etc.; no production code change)

**References**:

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Commit Messages](https://seesparkbox.com/foundry/semantic_commit_messages)
- [Git Commit Msg](http://karma-runner.github.io/1.0/dev/git-commit-msg.html)

### Branch

- The _master_ branch must be used for releases only.
- There is a dev branch used to merge all sub dev branch.
- Avoid long descriptive names for long-lived branches.
- No CamelCase.
- Use grouping tokens (words) at the beginning of your branch names (in a similar way to the `type` of commit).
- Define and use small lead tokens to differentiate branches in a meaningful way to your workflow.
- Use slashes to separate parts of your branch names.
- Remove branch after merge if it is not essential.

Examples:

    git branch -b docs/README
    git branch -b test/one-function
    git branch -b feat/side-bar
    git branch -b style/header

## License

This repository is released under the [GNU-GPL3](https://github.com/Innovation-Advisory-Links-Foundation/DigitalHandshake-Backend/blob/master/LICENSE) License.

**References**:
The code baseline was inspired by:

- [Elemental Battles](https://github.com/EOSIO/eosio-card-game-repo)
- [Eosio Project Boilerplate Simple](https://github.com/EOSIO/eosio-project-boilerplate-simple)
- [Express Mongoose Template](https://github.com/RainEggplant/express-mongoose-template)

---

Digital Handshake Backend ?? 2021+, [LINKS Foundation](https://linksfoundation.com/)

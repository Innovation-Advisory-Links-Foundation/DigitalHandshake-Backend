import "../../server/common/env";
import { assert } from "chai";
import eoslime from "eoslime";
import { Account } from "eoslime/types/account";
import { Contract } from "eoslime/types/contract";
import { FromQuery } from "eoslime/types/table-reader";
import { SHA256 } from "crypto-js";

// Path to .wasm and .abi smart contract compilation output files.
const DHS_TOKEN_WASM_PATH = "./compiled/dhstoken.wasm";
const DHS_TOKEN_ABI_PATH = "./compiled/dhstoken.abi";
const DHS_SERVICE_WASM_PATH = "./compiled/dhsservice.wasm";
const DHS_SERVICE_ABI_PATH = "./compiled/dhsservice.abi";
const DHS_ESCROW_WASM_PATH = "./compiled/dhsescrow.wasm";
const DHS_ESCROW_ABI_PATH = "./compiled/dhsescrow.abi";

// Init eoslime for a local node.
const eoslimeInstance = eoslime.init({
  url: process.env.EOSIO_TEST_URL,
  chainId: process.env.EOSIO_TEST_CHAIN_ID,
});
console.log("===== Start testing =====");

// Testing Digital Handshake smart contracts.
describe("Digital Handshake dApp Smart Contracts", () => {
  // Eosio smart contracts accounts.
  let dhsTokenAccount: Account;
  let dhsTokenContract: Contract;
  let dhsServiceAccount: Account;
  let dhsServiceContract: Contract;
  let dhsEscrowAccount: Account;
  let dhsEscrowContract: Contract;

  // Users account.
  let dealer1: Account;
  let dealer2: Account;
  let bidder1: Account;
  let bidder2: Account;
  let juror1: Account;
  let juror2: Account;
  let juror3: Account;
  let juror4: Account;
  let juror5: Account;
  let juror6: Account;

  // Accounts for testing.
  let testAccount1: Account;
  let unregisteredUser: Account;
  let smallBalanceDealer: Account;
  let smallBalanceBidder: Account;

  // Tables.
  let usersTable: FromQuery;
  let jurorsTable: FromQuery;
  let requestsTable: FromQuery;
  let handshakesTable: FromQuery;
  let negotiationsTable: FromQuery;
  let disputesTable: FromQuery;
  let lockedBalanceTable: FromQuery;

  // Costants.
  const MAX_SUPPLY = "1000000000.0000 DHS";
  const FIRST_ISSUE = "1000000.0000 DHS";
  const WELCOME_BONUS_USER = "1000.0000 DHS";

  // Eosio default account (nb. THE PRIVATE KEY IS KNOWN AND SHOULD NOT BE USED IN PRODUCTION).
  const eosioDefaultAccount = eoslimeInstance.Account.load(
    "eosio",
    "5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3",
    "active"
  );

  describe("# Initialization", () => {
    // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
    beforeEach((done) => setTimeout(done, 1000));

    before(async () => {
      // Create smart contracts accounts from a specific name.
      dhsTokenAccount = await eoslimeInstance.Account.createFromName(
        "dhstoken",
        eosioDefaultAccount
      );

      dhsServiceAccount = await eoslimeInstance.Account.createFromName(
        "dhsservice",
        eosioDefaultAccount
      );

      dhsEscrowAccount = await eoslimeInstance.Account.createFromName(
        "dhsescrow",
        eosioDefaultAccount
      );
    });

    it("Should deploy the eosio.token contract on dhstoken account", async () => {
      dhsTokenContract = await eoslimeInstance.Contract.deployOnAccount(
        DHS_TOKEN_WASM_PATH,
        DHS_TOKEN_ABI_PATH,
        dhsTokenAccount
      );

      assert.isBoolean(
        (await dhsTokenContract.getRawWASM()).length > 0,
        "Contract not deployed correctly"
      );
    }).timeout(3000);

    it("Should deploy the main handshaking service contract on dhsservice account", async () => {
      dhsServiceContract = await eoslimeInstance.Contract.deployOnAccount(
        DHS_SERVICE_WASM_PATH,
        DHS_SERVICE_ABI_PATH,
        dhsServiceAccount
      );

      assert.isBoolean(
        (await dhsServiceContract.getRawWASM()).length > 0,
        "Contract not deployed correctly"
      );
    }).timeout(3000);

    it("Should deploy the escrow service contract on dhsescrow account", async () => {
      dhsEscrowContract = await eoslimeInstance.Contract.deployOnAccount(
        DHS_ESCROW_WASM_PATH,
        DHS_ESCROW_ABI_PATH,
        dhsEscrowAccount
      );

      assert.isBoolean(
        (await dhsEscrowContract.getRawWASM()).length > 0,
        "Contract not deployed correctly"
      );
    }).timeout(3000);

    it("Should create the DHS token with a max supply of 1000000000", async () => {
      // Call smart contract action.
      await dhsTokenContract.actions.create(
        [dhsTokenAccount.name, MAX_SUPPLY],
        { from: dhsTokenAccount }
      );

      // Get stats for DHS token.
      const tokenStats = await dhsTokenContract.provider.eos.getCurrencyStats(
        dhsTokenContract.name,
        "DHS"
      );

      assert.equal(
        tokenStats.DHS.max_supply,
        MAX_SUPPLY,
        "Incorrect max supply"
      );
      assert.equal(
        tokenStats.DHS.issuer,
        dhsTokenAccount.name,
        "Incorrect issuer"
      );
    }).timeout(3000);

    it("Should issue 1000000 tokens", async () => {
      // Call smart contract action.
      await dhsTokenContract.actions.issue(
        [dhsTokenAccount.name, FIRST_ISSUE, "Token issuing"],
        { from: dhsTokenAccount }
      );

      // Check balance.
      const issuerBalance = await dhsTokenAccount.getBalance(
        "DHS",
        dhsTokenContract.name
      );

      assert.equal(issuerBalance[0], FIRST_ISSUE, "Incorrect balance");
    }).timeout(3000);
  }).timeout(5000);

  describe("# User Registration (Dealers / Bidders)", async () => {
    // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
    beforeEach((done) => setTimeout(done, 1000));

    before(async () => {
      // Add permissions for sending inline actions from the contracts.
      await dhsTokenAccount.addPermission("eosio.code");
      await dhsServiceAccount.addPermission("eosio.code");
      await dhsEscrowAccount.addPermission("eosio.code");

      // Create three random accounts for testing
      const randomAccounts = await eoslimeInstance.Account.createRandoms(
        1,
        eosioDefaultAccount
      );
      testAccount1 = randomAccounts[0];

      // Set tables.
      usersTable = dhsServiceContract.tables.users;
      jurorsTable = dhsServiceContract.tables.jurors;
      requestsTable = dhsServiceContract.tables.requests;
      handshakesTable = dhsServiceContract.tables.handshakes;
      negotiationsTable = dhsServiceContract.tables.negotiations;
      disputesTable = dhsServiceContract.tables.disputes;
      lockedBalanceTable = dhsEscrowContract.tables.locked;
    });

    it("It should not be possible to register a user given an invalid role", async () => {
      // Call smart contract action.
      try {
        await dhsServiceContract.actions.signup(
          [testAccount1.name, 2, "wrong sha256"],
          { from: testAccount1 }
        );
      } catch (e) {
        assert.isTrue(
          e.includes("assertion failure with message: signup: INVALID ROLE"),
          "Expected an exception but none was received"
        );
      }
    }).timeout(3000);

    it("It should not be possible to register a user given an invalid external data hash", async () => {
      // Call smart contract action.
      try {
        await dhsServiceContract.actions.signup(
          [testAccount1.name, 0, "wrong sha256"],
          { from: testAccount1 }
        );
      } catch (e) {
        assert.isTrue(
          e.includes(
            "assertion failure with message: signup: INVALID EXTERNAL DATA HASH"
          ),
          "Expected an exception but none was received"
        );
      }
    }).timeout(3000);

    describe("## Users", () => {
      before(async () => {
        // Create random accounts for the users.
        const randomAccounts = await eoslimeInstance.Account.createRandoms(
          4,
          eosioDefaultAccount
        );

        dealer1 = randomAccounts[0];
        dealer2 = randomAccounts[1];
        bidder1 = randomAccounts[2];
        bidder2 = randomAccounts[3];
      });

      it("It should not be possible to register a user without the authority", async () => {
        // Call smart contract action.
        try {
          await dhsServiceContract.actions.signup(
            [dealer1.name, 0, SHA256(dealer1.name)],
            { from: dealer2 }
          );
        } catch (e) {
          assert.isTrue(
            e.includes("missing_auth_exception"),
            "Expected an exception but none was received"
          );
        }
      }).timeout(3000);

      it("Should it be possible to register a user", async () => {
        // Call smart contract action.
        await dhsServiceContract.actions.signup(
          [dealer1.name, 0, SHA256(dealer1.name)],
          { from: dealer1 }
        );

        // Get table information.
        const user = await usersTable.equal(dealer1.name).find();

        assert.equal(
          user[0].info.username,
          dealer1.name,
          "Incorrect account name"
        );
        assert.equal(user[0].rating, 0, "Incorrect rating");
        assert.equal(
          user[0].info.external_data_hash,
          SHA256(dealer1.name),
          "Incorrect external data hash"
        );
      }).timeout(3000);

      it("Should it be possible to emit the welcome bonus for the new user", async () => {
        // Call smart contract action.
        await dhsTokenContract.actions.transfer(
          [
            dhsTokenAccount.name,
            dealer1.name,
            WELCOME_BONUS_USER,
            "Welcome Bonus",
          ],
          { from: dhsTokenAccount }
        );

        // Check balance.
        const dealerBalance = await dealer1.getBalance(
          "DHS",
          dhsTokenContract.name
        );

        assert.equal(dealerBalance[0], WELCOME_BONUS_USER, "Incorrect balance");
      }).timeout(3000);

      it("It should not be possible to register a user twice", async () => {
        // Call smart contract action.
        try {
          await dhsServiceContract.actions.signup(
            [dealer1.name, 0, SHA256(dealer1.name)],
            { from: dealer1 }
          );
        } catch (e) {
          assert.isTrue(
            e.includes(
              "assertion failure with message: signup: USER ALREADY REGISTERED AS USER"
            ),
            "Expected an exception but none was received"
          );
        }
      }).timeout(3000);
    }).timeout(5000);

    describe("## Juror", () => {
      before(async () => {
        // Create random accounts for the jurors.
        const randomAccounts = await eoslimeInstance.Account.createRandoms(
          6,
          eosioDefaultAccount
        );
        juror1 = randomAccounts[0];
        juror2 = randomAccounts[1];
        juror3 = randomAccounts[2];
        juror4 = randomAccounts[3];
        juror5 = randomAccounts[4];
        juror6 = randomAccounts[5];
      });

      it("It should not be possible to register a juror without the authority", async () => {
        // Call smart contract action.
        try {
          await dhsServiceContract.actions.signup(
            [juror1.name, 1, SHA256(juror1.name)],
            { from: juror2 }
          );
        } catch (e) {
          assert.isTrue(
            e.includes("missing_auth_exception"),
            "Expected an exception but none was received"
          );
        }
      }).timeout(3000);

      it("Should it be possible to register a juror", async () => {
        // Call smart contract action.
        await dhsServiceContract.actions.signup(
          [juror1.name, 1, SHA256(juror1.name)],
          { from: juror1 }
        );

        // Get table information.
        const juror = await jurorsTable.equal(juror1.name).find();

        assert.equal(
          juror[0].info.username,
          juror1.name,
          "Incorrect account name"
        );
        assert.equal(
          juror[0].info.external_data_hash,
          SHA256(juror1.name),
          "Incorrect external data hash"
        );
      }).timeout(3000);

      it("It should not be possible to register a juror twice", async () => {
        // Call smart contract action.
        try {
          await dhsServiceContract.actions.signup(
            [juror1.name, 1, SHA256(juror1.name)],
            { from: juror1 }
          );
        } catch (e) {
          assert.isTrue(
            e.includes(
              "assertion failure with message: signup: USER ALREADY REGISTERED AS JUROR"
            ),
            "Expected an exception but none was received"
          );
        }
      }).timeout(3000);
    }).timeout(5000);
  }).timeout(5000);

  describe("# Handshake", () => {
    before(async () => {
      // Create random accounts.
      const randomAccounts = await eoslimeInstance.Account.createRandoms(
        3,
        eosioDefaultAccount
      );

      unregisteredUser = randomAccounts[0];
      smallBalanceDealer = randomAccounts[1];
      smallBalanceBidder = randomAccounts[2];

      // Record users.
      await dhsServiceContract.actions.signup(
        [smallBalanceDealer.name, 0, SHA256(smallBalanceDealer.name)],
        { from: smallBalanceDealer }
      );

      await dhsServiceContract.actions.signup(
        [smallBalanceBidder.name, 0, SHA256(smallBalanceBidder.name)],
        { from: smallBalanceBidder }
      );

      // Transfer some tokens
      await dhsTokenContract.actions.transfer(
        [
          dhsTokenAccount.name,
          smallBalanceDealer.name,
          "1.0000 DHS",
          "Testing",
        ],
        { from: dhsTokenAccount }
      );

      await dhsTokenContract.actions.transfer(
        [
          dhsTokenAccount.name,
          smallBalanceBidder.name,
          "1.0000 DHS",
          "Testing",
        ],
        { from: dhsTokenAccount }
      );
    });

    describe("# Negotiation", () => {
      const summary = "Short summary of the request.";
      const contractualTermsHash = SHA256("Contractual Terms hash");
      const price = "10.0000 DHS";
      const deadline = 1624312800; // 2021 June 22.

      before(async () => {
        // Users registration.
        await dhsServiceContract.actions.signup(
          [dealer2.name, 0, SHA256(dealer2.name)],
          { from: dealer2 }
        );

        await dhsServiceContract.actions.signup(
          [bidder1.name, 0, SHA256(bidder1.name)],
          { from: bidder1 }
        );

        await dhsServiceContract.actions.signup(
          [bidder2.name, 0, SHA256(bidder2.name)],
          { from: bidder2 }
        );

        // Transfer some tokens.
        await dhsTokenContract.actions.transfer(
          [
            dhsTokenAccount.name,
            dealer2.name,
            WELCOME_BONUS_USER,
            "Welcome Bonus",
          ],
          { from: dhsTokenAccount }
        );

        await dhsTokenContract.actions.transfer(
          [
            dhsTokenAccount.name,
            bidder1.name,
            WELCOME_BONUS_USER,
            "Welcome Bonus",
          ],
          { from: dhsTokenAccount }
        );

        await dhsTokenContract.actions.transfer(
          [
            dhsTokenAccount.name,
            bidder2.name,
            WELCOME_BONUS_USER,
            "Welcome Bonus",
          ],
          { from: dhsTokenAccount }
        );
      });

      describe("# Post Request", () => {
        // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
        beforeEach((done) => setTimeout(done, 1000));

        it("It should not be possible to post a request without the authority", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.postrequest(
              [dealer1.name, summary, contractualTermsHash, price, deadline],
              { from: bidder1 }
            );
          } catch (e) {
            assert.isTrue(
              e.includes("missing_auth_exception"),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to post a request if the sender is not registered", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.postrequest(
              [
                unregisteredUser.name,
                summary,
                contractualTermsHash,
                price,
                deadline,
              ],
              { from: unregisteredUser }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: postrequest: USER NOT REGISTERED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to post a request if the price is lower or equal to zero", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.postrequest(
              [
                dealer1.name,
                summary,
                contractualTermsHash,
                "0.0000 DHS",
                deadline,
              ],
              { from: dealer1 }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: postrequest: ZERO OR NEGATIVE PRICE"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to post a request if the price is not expressed in DHS tokens", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.postrequest(
              [
                dealer1.name,
                summary,
                contractualTermsHash,
                "1.0000 DHH",
                deadline,
              ],
              { from: dealer1 }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: postrequest: NOT DHS TOKEN"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to post a request if the user gives an empty summary", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.postrequest(
              [dealer1.name, "", contractualTermsHash, price, deadline],
              { from: dealer1 }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: postrequest: EMPTY SUMMARY"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to post a request if the user gives an invalid contractual terms hash", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.postrequest(
              [dealer1.name, summary, "", price, deadline],
              { from: dealer1 }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: postrequest: INVALID CONTRACTUAL TERMS HASH"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to post a request if the user set a deadline before the current date", async () => {
          // Call smart contract action.
          try {
            const currentDate = Math.floor(Date.now() * 0.001) - 10000000;

            await dhsServiceContract.actions.postrequest(
              [dealer1.name, summary, contractualTermsHash, price, currentDate],
              { from: dealer1 }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: postrequest: WRONG DEADLINE"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("Should it be possible to post a request", async () => {
          // Call smart contract action.
          await dhsServiceContract.actions.postrequest(
            [dealer1.name, summary, contractualTermsHash, price, deadline],
            { from: dealer1 }
          );

          // Get table information (Should it be the request with id equal to 1).
          const request = await requestsTable.equal(1).find();

          assert.equal(request[0].id, 1, "Incorrect id");
          assert.equal(request[0].dealer, dealer1.name, "Incorrect dealer");
          assert.equal(request[0].bidder, "", "Incorrect bidder");
          assert.equal(request[0].summary, summary, "Incorrect summary");
          assert.equal(
            request[0].contractual_terms_hash,
            contractualTermsHash,
            "Incorrect contractual terms hash"
          );
          assert.equal(request[0].price, price, "Incorrect price");
          assert.equal(request[0].deadline, deadline, "Incorrect deadline");
          assert.equal(request[0].status, 0, "Incorrect status");
          assert.equal(request[0].bidders.length, 0, "Incorrect bidder array");
        }).timeout(3000);
      }).timeout(5000);

      describe("# Propose", () => {
        const requestId = 1;

        // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
        beforeEach((done) => setTimeout(done, 1000));

        it("It should not be possible to propose for a request without the authority", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.propose([dealer1.name, 1], {
              from: bidder1,
            });
          } catch (e) {
            assert.isTrue(
              e.includes("missing_auth_exception"),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to propose for a request if the sender is not registered", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.propose(
              [unregisteredUser.name, requestId],
              { from: unregisteredUser }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: propose: USER NOT REGISTERED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to propose for a request if the user gives a wrong request id", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.propose([bidder1.name, 2], {
              from: bidder1,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: propose: REQUEST NOT POSTED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to propose for a request if the user is the requesting dealer", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.propose([dealer1.name, 1], {
              from: dealer1,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: propose: REQUEST DEALER CANNOT PROPOSE"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("Should it be possible to propose for a request", async () => {
          // Call smart contract action.
          await dhsServiceContract.actions.propose([bidder1.name, requestId], {
            from: bidder1,
          });

          // Get table information (Should it be the first request).
          const request = await requestsTable.equal(requestId).find();

          assert.equal(request[0].id, requestId, "Incorrect id");
          assert.equal(request[0].bidders.length, 1, "Incorrect bidders array");
          assert.equal(
            request[0].bidders[0],
            bidder1.name,
            "Incorrect bidders array"
          );
        }).timeout(3000);

        it("It should not be possible to propose for a request twice", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.propose(
              [bidder1.name, requestId],
              {
                from: bidder1,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: propose: USER ALREADY PROPOSED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);
      });

      describe("# Select Bidder", () => {
        const requestId = 1;

        // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
        beforeEach((done) => setTimeout(done, 1000));

        it("It should not be possible to select a bidder without the authority", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.selectbidder(
              [dealer1.name, bidder1.name, requestId],
              {
                from: bidder2,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes("missing_auth_exception"),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to select a bidder if the sender is not registered", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.selectbidder(
              [unregisteredUser.name, bidder1.name, requestId],
              {
                from: unregisteredUser,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: selectbidder: USER NOT REGISTERED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to select a bidder if the user gives a wrong request id", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.selectbidder(
              [dealer1.name, bidder1.name, 2],
              {
                from: dealer1,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: selectbidder: REQUEST NOT POSTED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to select a bidder if the sender is not the dealer of the request", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.selectbidder(
              [dealer2.name, bidder2.name, requestId],
              {
                from: dealer2,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: selectbidder: NOT REQUEST DEALER"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to select a bidder if the bidder has not proposed for the request", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.selectbidder(
              [dealer1.name, bidder2.name, requestId],
              {
                from: dealer1,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: selectbidder: NOT BIDDER FOR THE REQUEST"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("Should it be possible to select a bidder ", async () => {
          // Call smart contract action.
          await dhsServiceContract.actions.selectbidder(
            [dealer1.name, bidder1.name, requestId],
            {
              from: dealer1,
            }
          );

          // Get tables information.
          const request = await requestsTable.equal(requestId).find();
          const handshake = await handshakesTable.equal(requestId).find();
          const negotiation = await negotiationsTable.equal(requestId).find();

          assert.equal(request[0].id, requestId, "Incorrect id");
          assert.equal(request[0].bidder, bidder1.name, "Incorrect bidder");

          assert.equal(handshake[0].request_id, requestId, "Incorrect id");
          assert.equal(handshake[0].dealer, dealer1.name, "Incorrect dealer");
          assert.equal(handshake[0].bidder, bidder1.name, "Incorrect bidder");
          assert.equal(handshake[0].status, 0, "Incorrect status");

          assert.equal(negotiation[0].dhs_id, requestId, "Incorrect id");
          assert.equal(
            negotiation[0].proposed_contractual_terms_hashes[0],
            request[0].contractual_terms_hash,
            "Incorrect contractual terms hash"
          );
          assert.equal(
            negotiation[0].proposed_prices,
            request[0].price,
            "Incorrect price"
          );
          assert.equal(
            negotiation[0].proposed_deadlines,
            request[0].deadline,
            "Incorrect deadline"
          );
        }).timeout(3000);

        it("It should not be possible to select a bidder for a request with status equal to close", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.selectbidder(
              [dealer1.name, bidder1.name, requestId],
              {
                from: dealer1,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: selectbidder: REQUEST NOT OPEN"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);
      });

      describe("# Negotiate", () => {
        const id = 1;
        const proposedContractualTerms = "New Contractual Terms 2";
        const proposedContractualTermsHash = SHA256(
          proposedContractualTerms
        ).toString();
        const price = "11.0000 DHS";
        const deadline = 1627643245; // 2021 July 20

        // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
        beforeEach((done) => setTimeout(done, 1000));

        it("It should not be possible to negotiate without the authority", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.negotiate(
              [bidder1.name, id, proposedContractualTermsHash, price, deadline],
              {
                from: bidder2,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes("missing_auth_exception"),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to negotiate if the sender is not registered", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.negotiate(
              [
                unregisteredUser.name,
                id,
                proposedContractualTermsHash,
                price,
                deadline,
              ],
              {
                from: unregisteredUser,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: negotiate: USER NOT REGISTERED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to negotiate if the user gives a wrong handshake id", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.negotiate(
              [bidder1.name, 10, proposedContractualTermsHash, price, deadline],
              {
                from: bidder1,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: negotiate: HANDSHAKE NOT EXIST"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to negotiate if the user is not an handshake participant (bidder/dealer)", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.negotiate(
              [bidder2.name, id, proposedContractualTermsHash, price, deadline],
              {
                from: bidder2,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: negotiate: USER NOT HANDSHAKE PARTICIPANT"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to negotiate if the user gives an invalid contractual terms hash", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.negotiate(
              [bidder1.name, id, "", price, deadline],
              { from: bidder1 }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: negotiate: INVALID CONTRACTUAL TERMS HASH"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to negotiate if the user gives a price equal or lower than zero", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.negotiate(
              [
                bidder1.name,
                id,
                proposedContractualTermsHash,
                "0.0000 DHS",
                deadline,
              ],
              { from: bidder1 }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: negotiate: ZERO OR NEGATIVE PRICE"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to negotiate if the user gives a price not in DHS tokens", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.negotiate(
              [
                bidder1.name,
                id,
                proposedContractualTermsHash,
                "1.0000 DHH",
                deadline,
              ],
              { from: bidder1 }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: negotiate: NOT DHS TOKEN"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to negotiate if the user set a deadline before the current date", async () => {
          // Call smart contract action.
          try {
            const currentDate = Math.floor(Date.now() * 0.001) - 10000000;

            await dhsServiceContract.actions.negotiate(
              [
                bidder1.name,
                id,
                proposedContractualTermsHash,
                price,
                currentDate,
              ],
              { from: bidder1 }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: negotiate: WRONG DEADLINE"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        describe("# Bidder", () => {
          // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
          beforeEach((done) => setTimeout(done, 1000));

          it("It should not be possible to negotiate if is not the dealer turn", async () => {
            // Call smart contract action.
            try {
              await dhsServiceContract.actions.negotiate(
                [
                  dealer1.name,
                  id,
                  proposedContractualTermsHash,
                  price,
                  deadline,
                ],
                {
                  from: dealer1,
                }
              );
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: negotiate: NOT DEALER TURN"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);

          it("Should it be possible to negotiate for the bidder", async () => {
            // Call smart contract action.
            await dhsServiceContract.actions.negotiate(
              [bidder1.name, id, proposedContractualTermsHash, price, deadline],
              {
                from: bidder1,
              }
            );

            // Get tables information.
            const negotiation = await negotiationsTable.equal(id).find();

            assert.equal(negotiation[0].dhs_id, id, "Incorrect id");
            assert.equal(
              negotiation[0].proposed_contractual_terms_hashes[1],
              proposedContractualTermsHash,
              "Incorrect contractual terms hash"
            );
            assert.equal(
              negotiation[0].proposed_prices[1],
              price,
              "Incorrect price"
            );
            assert.equal(
              negotiation[0].proposed_deadlines[1],
              deadline,
              "Incorrect deadline"
            );
          }).timeout(3000);
        });

        describe("# Dealer", () => {
          const proposedContractualTerms = "Terms 3";
          const proposedContractualTermsHash = SHA256(
            proposedContractualTerms
          ).toString();
          const price = "12.0000 DHS";
          const deadline = 1626347245; // 15 July 2021

          // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
          beforeEach((done) => setTimeout(done, 1000));

          it("It should not be possible to negotiate if is not the bidder turn", async () => {
            // Call smart contract action.
            try {
              await dhsServiceContract.actions.negotiate(
                [
                  bidder1.name,
                  id,
                  proposedContractualTermsHash,
                  price,
                  deadline,
                ],
                {
                  from: bidder1,
                }
              );
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: negotiate: NOT BIDDER TURN"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);

          it("Should it be possible to negotiate for the dealer", async () => {
            // Call smart contract action.
            await dhsServiceContract.actions.negotiate(
              [dealer1.name, id, proposedContractualTermsHash, price, deadline],
              {
                from: dealer1,
              }
            );

            // Get tables information.
            const negotiation = await negotiationsTable.equal(id).find();

            assert.equal(negotiation[0].dhs_id, id, "Incorrect id");
            assert.equal(
              negotiation[0].proposed_contractual_terms_hashes[2],
              proposedContractualTermsHash,
              "Incorrect contractual terms hash"
            );
            assert.equal(
              negotiation[0].proposed_prices[2],
              price,
              "Incorrect price"
            );
            assert.equal(
              negotiation[0].proposed_deadlines[2],
              deadline,
              "Incorrect deadline"
            );
          }).timeout(3000);
        });
      });

      describe("# Accept Terms", () => {
        const id = 1;

        // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
        beforeEach((done) => setTimeout(done, 1000));

        it("It should not be possible to accept terms without the authority", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.acceptterms([bidder1.name, id], {
              from: bidder2,
            });
          } catch (e) {
            assert.isTrue(
              e.includes("missing_auth_exception"),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to accept terms if the sender is not registered", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.acceptterms(
              [unregisteredUser.name, id],
              {
                from: unregisteredUser,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: acceptterms: USER NOT REGISTERED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to accept terms if the user gives a wrong handshake id", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.acceptterms([bidder1.name, 10], {
              from: bidder1,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: acceptterms: HANDSHAKE NOT EXIST"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to negotiate if the user is not an handshake participant (bidder/dealer)", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.acceptterms([bidder2.name, id], {
              from: bidder2,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: acceptterms: USER NOT HANDSHAKE PARTICIPANT"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        describe("# Bidder", () => {
          // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
          beforeEach((done) => setTimeout(done, 1000));

          it("It should not be possible to accept terms if is not the user turn (dealer)", async () => {
            // Call smart contract action.
            try {
              await dhsServiceContract.actions.acceptterms([dealer1.name, id], {
                from: dealer1,
              });
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: acceptterms: NOT DEALER TURN"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);

          it("Should it be possible to accept terms for the bidder", async () => {
            // Call smart contract action.
            await dhsServiceContract.actions.acceptterms([bidder1.name, id], {
              from: bidder1,
            });

            // Get tables information.
            const negotiation = await negotiationsTable.equal(id).find();
            const handshake = await handshakesTable.equal(id).find();

            assert.equal(negotiation[0].dhs_id, id, "Incorrect id");
            assert.equal(
              negotiation[0].accepted_by_bidder,
              true,
              "Incorrect bidder boolean"
            );
            assert.equal(handshake[0].status, 0, "Incorrect handshake status");
          }).timeout(3000);

          it("It should not be possible to accept terms for the bidder if it has already accepted", async () => {
            // Call smart contract action.
            try {
              await dhsServiceContract.actions.acceptterms([bidder1.name, id], {
                from: bidder1,
              });
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: acceptterms: BIDDER ALREADY ACCEPTED TERMS"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);
        });

        describe("# Dealer", () => {
          // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
          beforeEach((done) => setTimeout(done, 1000));

          it("Should it be possible to accept terms for the dealer", async () => {
            // Call smart contract action.
            await dhsServiceContract.actions.acceptterms([dealer1.name, id], {
              from: dealer1,
            });

            // Get tables information.
            const negotiation = await negotiationsTable.equal(id).find();
            const handshake = await handshakesTable.equal(id).find();

            assert.equal(negotiation[0].dhs_id, id, "Incorrect id");
            assert.equal(
              negotiation[0].accepted_by_dealer,
              true,
              "Incorrect dealer boolean"
            );
            assert.equal(
              handshake[0].contractual_terms_hash,
              negotiation[0].proposed_contractual_terms_hashes[2],
              "Incorrect handshake contractual terms hash"
            );
            assert.equal(
              handshake[0].price,
              negotiation[0].proposed_prices[2],
              "Incorrect handshake price"
            );
            assert.equal(
              handshake[0].deadline,
              negotiation[0].proposed_deadlines[2],
              "Incorrect handshake deadline"
            );
            assert.equal(handshake[0].status, 1, "Incorrect handshake status");
          }).timeout(3000);

          it("It should not be possible to accept terms if the handshake is not in negotiation status", async () => {
            // Call smart contract action.
            try {
              await dhsServiceContract.actions.acceptterms([dealer1.name, id], {
                from: dealer1,
              });
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: acceptterms: HANDSHAKE NOT NEGOTIATION STATUS"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);
        });

        describe("# Lock Tokens", () => {
          const id = 1;

          // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
          beforeEach((done) => setTimeout(done, 1000));

          it("It should not be possible to lock tokens without the authority", async () => {
            // Call smart contract action.
            try {
              await dhsTokenContract.actions.transfer(
                [dealer1.name, dhsServiceAccount.name, "1.0000 DHS", "30"],
                {
                  from: dealer2,
                }
              );
            } catch (e) {
              assert.isTrue(
                e.includes("missing_auth_exception"),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);

          it("It should not be possible to lock tokens if the handshake does not exist", async () => {
            // Call smart contract action.
            try {
              await dhsTokenContract.actions.transfer(
                [dealer1.name, dhsServiceAccount.name, "1.0000 DHS", "30"],
                {
                  from: dealer1,
                }
              );
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: notifylock: HANDSHAKE NOT EXIST"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);

          it("It should not be possible to lock tokens if the user does not participate to the handshake", async () => {
            // Call smart contract action.
            try {
              await dhsTokenContract.actions.transfer(
                [
                  dealer2.name,
                  dhsServiceAccount.name,
                  "1.0000 DHS",
                  id.toString(),
                ],
                {
                  from: dealer2,
                }
              );
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: notifylock: USER NOT HANDSHAKE PARTICIPANT"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);

          describe("# Dealer", () => {
            const dealerLockAmount = "42.0000 DHS";

            // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
            beforeEach((done) => setTimeout(done, 1000));

            it("It should not be possible to lock tokens if the dealer sends an incorrect quantity of tokens", async () => {
              // Call smart contract action.
              try {
                await dhsTokenContract.actions.transfer(
                  [
                    dealer1.name,
                    dhsServiceAccount.name,
                    "1.0000 DHS",
                    id.toString(),
                  ],
                  {
                    from: dealer1,
                  }
                );
              } catch (e) {
                assert.isTrue(
                  e.includes(
                    "assertion failure with message: notifylock: NOT CORRECT QUANTITY LOCKED BY DEALER"
                  ),
                  "Expected an exception but none was received"
                );
              }
            }).timeout(3000);

            it("Should it be possible for the dealer to lock tokens", async () => {
              // Call smart contract action.
              await dhsTokenContract.actions.transfer(
                [
                  dealer1.name,
                  dhsServiceAccount.name,
                  dealerLockAmount,
                  id.toString(),
                ],
                {
                  from: dealer1,
                }
              );

              // Get tables information.
              const negotiation = await negotiationsTable.equal(id).find();
              const lockedBalance = await lockedBalanceTable
                .equal(dealer1.name)
                .find();

              assert.equal(negotiation[0].dhs_id, id, "Incorrect id");
              assert.equal(
                negotiation[0].accepted_by_dealer,
                true,
                "Incorrect dealer boolean"
              );
              assert.equal(
                negotiation[0].accepted_by_bidder,
                true,
                "Incorrect bidder boolean"
              );
              assert.equal(
                negotiation[0].lock_by_dealer,
                true,
                "Incorrect dealer lock boolean"
              );

              assert.equal(
                lockedBalance[0].user,
                dealer1.name,
                "Incorrect escrow locked balance user"
              );
              assert.equal(
                lockedBalance[0].funds,
                dealerLockAmount,
                "Incorrect escrow locked balance funds"
              );
            }).timeout(3000);

            it("It should not be possible to lock tokens if the dealer has already locked the tokens for the handshake", async () => {
              // Call smart contract action.
              try {
                await dhsTokenContract.actions.transfer(
                  [
                    dealer1.name,
                    dhsServiceAccount.name,
                    dealerLockAmount,
                    id.toString(),
                  ],
                  {
                    from: dealer1,
                  }
                );
              } catch (e) {
                assert.isTrue(
                  e.includes(
                    "assertion failure with message: notifylock: DEALER ALREADY LOCKED TOKENS"
                  ),
                  "Expected an exception but none was received"
                );
              }
            }).timeout(3000);
          });
          describe("# Bidder", () => {
            const bidderLockAmount = "30.0000 DHS";

            // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
            beforeEach((done) => setTimeout(done, 1000));

            it("It should not be possible to lock tokens if the bidder sends an incorrect quantity of tokens", async () => {
              // Call smart contract action.
              try {
                await dhsTokenContract.actions.transfer(
                  [
                    bidder1.name,
                    dhsServiceAccount.name,
                    "1.0000 DHS",
                    id.toString(),
                  ],
                  {
                    from: bidder1,
                  }
                );
              } catch (e) {
                assert.isTrue(
                  e.includes(
                    "assertion failure with message: notifylock: NOT CORRECT QUANTITY LOCKED BY BIDDER"
                  ),
                  "Expected an exception but none was received"
                );
              }
            }).timeout(3000);

            it("Should it be possible for the bidder to lock tokens", async () => {
              // Call smart contract action.
              await dhsTokenContract.actions.transfer(
                [
                  bidder1.name,
                  dhsServiceAccount.name,
                  bidderLockAmount,
                  id.toString(),
                ],
                {
                  from: bidder1,
                }
              );

              // Get tables information.
              const negotiation = await negotiationsTable.equal(id).find();
              const handshake = await handshakesTable.equal(id).find();
              const lockedBalance = await lockedBalanceTable
                .equal(bidder1.name)
                .find();

              assert.equal(negotiation[0].dhs_id, id, "Incorrect id");
              assert.equal(
                negotiation[0].accepted_by_dealer,
                true,
                "Incorrect dealer boolean"
              );
              assert.equal(
                negotiation[0].accepted_by_bidder,
                true,
                "Incorrect bidder boolean"
              );
              assert.equal(
                negotiation[0].lock_by_bidder,
                true,
                "Incorrect bidder lock boolean"
              );
              assert.equal(
                handshake[0].status,
                2,
                "Incorrect handshake status"
              );

              assert.equal(
                lockedBalance[0].user,
                bidder1.name,
                "Incorrect escrow locked balance user"
              );
              assert.equal(
                lockedBalance[0].funds,
                bidderLockAmount,
                "Incorrect escrow locked balance funds"
              );
            }).timeout(3000);

            it("It should not be possible to accept terms if the handshake is not in lock status", async () => {
              // Call smart contract action.
              try {
                await dhsTokenContract.actions.transfer(
                  [
                    bidder1.name,
                    dhsServiceAccount.name,
                    bidderLockAmount,
                    id.toString(),
                  ],
                  {
                    from: bidder1,
                  }
                );
              } catch (e) {
                assert.isTrue(
                  e.includes(
                    "assertion failure with message: notifylock: HANDSHAKE NOT LOCK STATUS"
                  ),
                  "Expected an exception but none was received"
                );
              }
            }).timeout(3000);
          });
        });
      });
    }).timeout(5000);

    describe("# Execution", () => {
      // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
      beforeEach((done) => setTimeout(done, 1000));

      before(async () => {
        // Create another handshake.
        await dhsServiceContract.actions.postrequest(
          [
            dealer1.name,
            "Summary 2",
            SHA256("Terms 2").toString(),
            "10.0000 DHS",
            1618831011,
          ],
          { from: dealer1 }
        );

        await dhsServiceContract.actions.propose([bidder1.name, 2], {
          from: bidder1,
        });

        await dhsServiceContract.actions.selectbidder(
          [dealer1.name, bidder1.name, 2],
          {
            from: dealer1,
          }
        );

        await dhsServiceContract.actions.acceptterms([bidder1.name, 2], {
          from: bidder1,
        });

        await dhsServiceContract.actions.acceptterms([dealer1.name, 2], {
          from: dealer1,
        });

        await dhsTokenContract.actions.transfer(
          [dealer1.name, dhsServiceAccount.name, "40.0000 DHS", "2"],
          {
            from: dealer1,
          }
        );

        await dhsTokenContract.actions.transfer(
          [bidder1.name, dhsServiceAccount.name, "30.0000 DHS", "2"],
          {
            from: bidder1,
          }
        );
      });

      describe("# End Job", () => {
        const id = 1;

        // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
        beforeEach((done) => setTimeout(done, 1000));

        it("It should not be possible to end the job without the authority", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.endjob([bidder1.name, id], {
              from: bidder2,
            });
          } catch (e) {
            assert.isTrue(
              e.includes("missing_auth_exception"),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to end the job if the sender is not registered", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.endjob(
              [unregisteredUser.name, id],
              {
                from: unregisteredUser,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: endjob: USER NOT REGISTERED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to end the job if the user gives a wrong handshake id", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.endjob([bidder1.name, 10], {
              from: bidder1,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: endjob: HANDSHAKE NOT EXIST"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to end the job if the user is not the handshake bidder", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.endjob([bidder2.name, id], {
              from: bidder2,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: endjob: USER NOT HANDSHAKE BIDDER"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("Should it be possible to notify the end of the job", async () => {
          // Call smart contract action.
          await dhsServiceContract.actions.endjob([bidder1.name, id], {
            from: bidder1,
          });

          // Get tables information.
          const handshake = await handshakesTable.equal(id).find();

          assert.equal(handshake[0].status, 3, "Incorrect handshake status");
        }).timeout(3000);

        it("It should not be possible to end the job if the handshake is not in execution status", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.endjob([bidder1.name, id], {
              from: bidder1,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: endjob: HANDSHAKE NOT EXECUTION STATUS"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);
      }).timeout(5000);

      describe("# Expired", () => {
        // TODO.
      }).timeout(5000);

      describe("# Accept Job", () => {
        const id = 1;

        // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
        beforeEach((done) => setTimeout(done, 1000));

        it("It should not be possible to accept the job without the authority", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.acceptjob([dealer1.name, id], {
              from: dealer2,
            });
          } catch (e) {
            assert.isTrue(
              e.includes("missing_auth_exception"),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to accept the job if the sender is not registered", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.acceptjob(
              [unregisteredUser.name, id],
              {
                from: unregisteredUser,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: acceptjob: USER NOT REGISTERED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to accept the job if the handshake does not exist", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.acceptjob([dealer1.name, 10], {
              from: dealer1,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: acceptjob: HANDSHAKE NOT EXIST"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to accept the job if the user is not the dealer of the handshake", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.acceptjob([dealer2.name, 1], {
              from: dealer2,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: acceptjob: USER NOT HANDSHAKE DEALER"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("Should it be possible to accept the job", async () => {
          // Call smart contract action.
          await dhsServiceContract.actions.acceptjob([dealer1.name, id], {
            from: dealer1,
          });

          // Get tables information.
          const handshake = await handshakesTable.equal(id).find();

          const lockedBalanceDealer = await lockedBalanceTable
            .equal(dealer1.name)
            .find();
          const lockedBalanceBidder = await lockedBalanceTable
            .equal(bidder1.name)
            .find();

          const dealerBalance = await dealer1.getBalance(
            "DHS",
            dhsTokenContract.name
          );
          const bidderBalance = await bidder1.getBalance(
            "DHS",
            dhsTokenContract.name
          );

          const dealer = await usersTable.equal(dealer1.name).find();
          const bidder = await usersTable.equal(bidder1.name).find();

          assert.equal(handshake[0].status, 6, "Incorrect handshake status");
          assert.equal(
            lockedBalanceDealer[0].user,
            dealer1.name,
            "Incorrect escrow locked balance for dealer"
          );
          assert.equal(
            lockedBalanceDealer[0].funds,
            "40.0000 DHS",
            "Incorrect escrow locked balance funds for dealer"
          );
          assert.equal(
            lockedBalanceBidder[0].user,
            bidder1.name,
            "Incorrect escrow locked balance for dealer"
          );
          assert.equal(
            lockedBalanceBidder[0].funds,
            "30.0000 DHS",
            "Incorrect escrow locked balance funds for dealer"
          );
          assert.equal(
            dealerBalance[0],
            "948.0000 DHS",
            "Incorrect balance for dealer"
          );
          assert.equal(
            bidderBalance[0],
            "982.0000 DHS",
            "Incorrect balance for bidder"
          );
          assert.equal(dealer[0].rating, 1, "Incorrect rating");
          assert.equal(bidder[0].rating, 1, "Incorrect rating");
        }).timeout(3000);

        it("It should not be possible to accept the job if the handshake is not in confirmation status", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.acceptjob([dealer1.name, 1], {
              from: dealer1,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: acceptjob: HANDSHAKE NOT CONFIRMATION STATUS"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);
      }).timeout(5000);

      describe("# Open Dispute", () => {
        const id = 2;

        // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
        beforeEach((done) => setTimeout(done, 1000));

        before(async () => {
          // Notify the end of the job for the second handshake.
          await dhsServiceContract.actions.endjob([bidder1.name, id], {
            from: bidder1,
          });

          // Register the jurors.
          await dhsServiceContract.actions.signup(
            [juror2.name, 1, SHA256(juror2.name)],
            { from: juror2 }
          );
          await dhsServiceContract.actions.signup(
            [juror3.name, 1, SHA256(juror3.name)],
            { from: juror3 }
          );
          await dhsServiceContract.actions.signup(
            [juror4.name, 1, SHA256(juror4.name)],
            { from: juror4 }
          );
          await dhsServiceContract.actions.signup(
            [juror5.name, 1, SHA256(juror5.name)],
            { from: juror5 }
          );
          await dhsServiceContract.actions.signup(
            [juror6.name, 1, SHA256(juror6.name)],
            { from: juror6 }
          );
        });

        it("It should not be possible to open a dispute without the authority", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.opendispute([dealer1.name, id], {
              from: dealer2,
            });
          } catch (e) {
            assert.isTrue(
              e.includes("missing_auth_exception"),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to open a dispute if the sender is not registered", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.opendispute(
              [unregisteredUser.name, id],
              {
                from: unregisteredUser,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: opendispute: USER NOT REGISTERED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to open a dispute if the handshake does not exist", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.opendispute([dealer1.name, 10], {
              from: dealer1,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: opendispute: HANDSHAKE NOT EXIST"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to open a dispute if the user is not the dealer of the handshake", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.opendispute([dealer2.name, id], {
              from: dealer2,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: opendispute: USER NOT HANDSHAKE DEALER"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("Should it be possible to open a dispute", async () => {
          // Call smart contract action.
          await dhsServiceContract.actions.opendispute([dealer1.name, id], {
            from: dealer1,
          });

          // Get tables information.
          const handshake = await handshakesTable.equal(id).find();
          const dispute = await disputesTable.equal(id).find();

          assert.equal(handshake[0].status, 4, "Incorrect handshake status");
          assert.equal(dispute[0].dhs_id, id, "Incorrect dispute handshake id");
          assert.equal(dispute[0].juror1.length > 0, true, "Incorrect juror1");
          assert.equal(dispute[0].juror2.length > 0, true, "Incorrect juror2");
          assert.equal(dispute[0].juror3.length > 0, true, "Incorrect juror3");
        }).timeout(10000);

        it("It should not be possible to open a dispute if the handshake is not in confirmation status", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.opendispute([dealer1.name, 1], {
              from: dealer1,
            });
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: opendispute: HANDSHAKE NOT CONFIRMATION STATUS"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);
      }).timeout(5000);

      describe("# Motivate", () => {
        const id = 2;
        const dealerMotivationHash = SHA256(
          "Dealer Motivation for Handshake with id 2"
        );
        const bidderMotivationHash = SHA256(
          "Bidder Motivation for Handshake with id 2"
        );

        // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
        beforeEach((done) => setTimeout(done, 1000));

        it("It should not be possible to motivate a dispute without the authority", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.motivate(
              [dealer1.name, id, dealerMotivationHash],
              {
                from: dealer2,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes("missing_auth_exception"),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to motivate a dispute if the sender is not registered", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.motivate(
              [unregisteredUser.name, id, dealerMotivationHash],
              {
                from: unregisteredUser,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: motivate: USER NOT REGISTERED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to motivate a dispute if the handshake does not exist", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.motivate(
              [dealer1.name, 10, dealerMotivationHash],
              {
                from: dealer1,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: motivate: HANDSHAKE NOT EXIST"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to motivate a dispute if the user is not an handshake participant", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.motivate(
              [dealer2.name, id, dealerMotivationHash],
              {
                from: dealer2,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: motivate: USER NOT HANDSHAKE PARTICIPANT"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to motivate a dispute if the motivation hash is not a valid sha256", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.motivate(
              [dealer1.name, id, "wrong sha"],
              {
                from: dealer1,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: motivate: INVALID MOTIVATION HASH"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        describe("# Dealer", () => {
          it("Should it be possible to motivate a dispute for the dealer", async () => {
            // Call smart contract action.
            await dhsServiceContract.actions.motivate(
              [dealer1.name, id, dealerMotivationHash],
              {
                from: dealer1,
              }
            );

            // Get tables information.
            const dispute = await disputesTable.equal(id).find();

            assert.equal(
              dispute[0].dhs_id,
              id,
              "Incorrect dispute handshake id"
            );
            assert.equal(
              dispute[0].dealer_motivation_hash,
              dealerMotivationHash,
              "Incorrect dealer motivation hash"
            );
          }).timeout(3000);

          it("It should not be possible to motivate a dispute if the dealer has already motivated the request", async () => {
            // Call smart contract action.
            try {
              await dhsServiceContract.actions.motivate(
                [dealer1.name, id, dealerMotivationHash],
                {
                  from: dealer1,
                }
              );
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: motivate: DEALER ALREADY MOTIVATE"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);
        });

        describe("# Bidder", () => {
          it("Should it be possible to motivate a dispute for the bidder", async () => {
            // Call smart contract action.
            await dhsServiceContract.actions.motivate(
              [bidder1.name, id, bidderMotivationHash],
              {
                from: bidder1,
              }
            );

            // Get tables information.
            const dispute = await disputesTable.equal(id).find();
            const handshake = await handshakesTable.equal(id).find();

            assert.equal(
              dispute[0].dhs_id,
              id,
              "Incorrect dispute handshake id"
            );
            assert.equal(
              dispute[0].bidder_motivation_hash,
              bidderMotivationHash,
              "Incorrect bidder motivation hash"
            );
            assert.equal(handshake[0].status, 5, "Incorrect handshake status");
          }).timeout(3000);

          it("It should not be possible to motivate a dispute if the handshake has not the dispute status", async () => {
            // Call smart contract action.
            try {
              await dhsServiceContract.actions.motivate(
                [bidder1.name, id, bidderMotivationHash],
                {
                  from: bidder1,
                }
              );
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: motivate: HANDSHAKE NOT DISPUTE STATUS"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);
        });
      }).timeout(5000);

      describe("# Vote", () => {
        const id = 2;
        let selectedJuror1: Account;
        let selectedJuror2: Account;
        let selectedJuror3: Account;

        // Some delay for waiting 2 blocks before each test (in order to have the previous state update reflected on the chain).
        beforeEach((done) => setTimeout(done, 1000));

        before(async () => {
          // Read dispute table.
          const dispute = await disputesTable.equal(id).find();
          const jurors = [juror1, juror2, juror3, juror4, juror5, juror6];
          const selectedJurorsNames = [
            dispute[0].juror1,
            dispute[0].juror2,
            dispute[0].juror3,
          ];

          jurors.forEach((juror: Account) => {
            if (juror.name.toString() === selectedJurorsNames[0])
              selectedJuror1 = juror;

            if (juror.name.toString() === selectedJurorsNames[1])
              selectedJuror2 = juror;

            if (juror.name.toString() === selectedJurorsNames[2])
              selectedJuror3 = juror;
          });
        });

        it("It should not be possible to vote without the authority", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.vote(
              [juror1.name, id, dealer1.name],
              {
                from: dealer2,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes("missing_auth_exception"),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to vote if the sender is not registered", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.vote(
              [unregisteredUser.name, id, dealer1.name],
              {
                from: unregisteredUser,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: vote: JUROR NOT REGISTERED"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to vote if the handshake does not exist", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.vote(
              [selectedJuror1.name, 10, dealer1.name],
              {
                from: selectedJuror1,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: vote: HANDSHAKE NOT EXIST"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to vote if the user is not a juror selected for the handshake dispute", async () => {
          // Call smart contract action.
          try {
            if (
              selectedJuror1.name !== juror1.name &&
              selectedJuror2.name !== juror1.name &&
              selectedJuror3.name !== juror1.name
            ) {
              await dhsServiceContract.actions.vote(
                [juror1.name, id, dealer1.name],
                {
                  from: juror1,
                }
              );
            }
            if (
              selectedJuror1.name !== juror2.name &&
              selectedJuror2.name !== juror2.name &&
              selectedJuror3.name !== juror2.name
            ) {
              await dhsServiceContract.actions.vote(
                [juror2.name, id, dealer1.name],
                {
                  from: juror2,
                }
              );
            }
            if (
              selectedJuror1.name !== juror3.name &&
              selectedJuror2.name !== juror3.name &&
              selectedJuror3.name !== juror3.name
            ) {
              await dhsServiceContract.actions.vote(
                [juror3.name, id, dealer1.name],
                {
                  from: juror3,
                }
              );
            }
            if (
              selectedJuror1.name !== juror4.name &&
              selectedJuror2.name !== juror4.name &&
              selectedJuror3.name !== juror4.name
            ) {
              await dhsServiceContract.actions.vote(
                [juror4.name, id, dealer1.name],
                {
                  from: juror4,
                }
              );
            }
            if (
              selectedJuror1.name !== juror5.name &&
              selectedJuror2.name !== juror5.name &&
              selectedJuror3.name !== juror5.name
            ) {
              await dhsServiceContract.actions.vote(
                [juror5.name, id, dealer1.name],
                {
                  from: juror5,
                }
              );
            }
            if (
              selectedJuror1.name !== juror6.name &&
              selectedJuror2.name !== juror6.name &&
              selectedJuror3.name !== juror6.name
            ) {
              await dhsServiceContract.actions.vote(
                [juror6.name, id, dealer1.name],
                {
                  from: juror6,
                }
              );
            }
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: vote: NOT HANDSHAKE JUROR"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        it("It should not be possible to vote if the preference does not correspond to the handshake dealer or bidder", async () => {
          // Call smart contract action.
          try {
            await dhsServiceContract.actions.vote(
              [selectedJuror1.name, id, dealer2.name],
              {
                from: selectedJuror1,
              }
            );
          } catch (e) {
            assert.isTrue(
              e.includes(
                "assertion failure with message: vote: NOT PREFERENCE FOR DEALER OR BIDDER"
              ),
              "Expected an exception but none was received"
            );
          }
        }).timeout(3000);

        describe("# Juror1", () => {
          it("It should be possible to vote for the first selected juror", async () => {
            // Call smart contract action.
            await dhsServiceContract.actions.vote(
              [selectedJuror1.name, id, dealer1.name],
              {
                from: selectedJuror1,
              }
            );

            // Get tables information.
            const dispute = await disputesTable.equal(id).find();

            assert.equal(
              dispute[0].vote1,
              dealer1.name,
              "Incorrect dispute vote for juror1"
            );
          }).timeout(3000);

          it("It should not be possible to vote if the first juror has already voted", async () => {
            // Call smart contract action.
            try {
              await dhsServiceContract.actions.vote(
                [selectedJuror1.name, id, dealer1.name],
                {
                  from: selectedJuror1,
                }
              );
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: vote: ALREADY VOTED"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);
        }).timeout(5000);

        describe("# Juror2", () => {
          it("It should be possible to vote for the second selected juror", async () => {
            // Call smart contract action.
            await dhsServiceContract.actions.vote(
              [selectedJuror2.name, id, bidder1.name],
              {
                from: selectedJuror2,
              }
            );

            // Get tables information.
            const dispute = await disputesTable.equal(id).find();

            assert.equal(
              dispute[0].vote2,
              bidder1.name,
              "Incorrect dispute vote for juror2"
            );
          }).timeout(3000);

          it("It should not be possible to vote if the second juror has already voted", async () => {
            // Call smart contract action.
            try {
              await dhsServiceContract.actions.vote(
                [selectedJuror2.name, id, dealer1.name],
                {
                  from: selectedJuror2,
                }
              );
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: vote: ALREADY VOTED"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);
        }).timeout(5000);

        describe("# Juror3", () => {
          it("It should be possible to vote for the third selected juror", async () => {
            // Call smart contract action.
            await dhsServiceContract.actions.vote(
              [selectedJuror3.name, id, dealer1.name],
              {
                from: selectedJuror3,
              }
            );

            // Get tables information.
            const dispute = await disputesTable.equal(id).find();
            const handshake = await handshakesTable.equal(id).find();
            const lockedBalanceDealer = await lockedBalanceTable
              .equal(dealer1.name)
              .find();
            const lockedBalanceBidder = await lockedBalanceTable
              .equal(bidder1.name)
              .find();
            const dealerBalance = await dealer1.getBalance(
              "DHS",
              dhsTokenContract.name
            );
            const bidderBalance = await bidder1.getBalance(
              "DHS",
              dhsTokenContract.name
            );
            const firstJurorBalance = await selectedJuror1.getBalance(
              "DHS",
              dhsTokenContract.name
            );
            const secondJurorBalance = await selectedJuror2.getBalance(
              "DHS",
              dhsTokenContract.name
            );
            const thirdJurorBalance = await selectedJuror3.getBalance(
              "DHS",
              dhsTokenContract.name
            );
            const dealer = await usersTable.equal(dealer1.name).find();
            const bidder = await usersTable.equal(bidder1.name).find();

            assert.equal(
              dispute[0].vote3,
              dealer1.name,
              "Incorrect dispute vote for juror3"
            );

            assert.equal(
              handshake[0].status,
              7,
              "Incorrect status for handshake"
            );
            assert.equal(
              lockedBalanceDealer[0].user,
              dealer1.name,
              "Incorrect escrow locked balance for dealer"
            );
            assert.equal(
              lockedBalanceDealer[0].funds,
              "0.0000 DHS",
              "Incorrect escrow locked balance funds for dealer"
            );
            assert.equal(
              lockedBalanceBidder[0].user,
              bidder1.name,
              "Incorrect escrow locked balance for dealer"
            );
            assert.equal(
              lockedBalanceBidder[0].funds,
              "0.0000 DHS",
              "Incorrect escrow locked balance funds for dealer"
            );
            assert.equal(dealer[0].rating, 2, "Incorrect rating");
            assert.equal(bidder[0].rating, 0, "Incorrect rating");
            assert.equal(
              dealerBalance[0],
              "988.0000 DHS",
              "Incorrect balance for dealer"
            );
            assert.equal(
              bidderBalance[0],
              "982.0000 DHS",
              "Incorrect balance for bidder"
            );
            assert.equal(
              firstJurorBalance[0],
              "10.0000 DHS",
              "Incorrect balance for first juror"
            );
            assert.equal(
              secondJurorBalance[0],
              "10.0000 DHS",
              "Incorrect balance for second juror"
            );

            assert.equal(
              thirdJurorBalance[0],
              "10.0000 DHS",
              "Incorrect balance for third juror"
            );
          }).timeout(3000);

          it("It should not be possible to vote if the handshake has not a voting status", async () => {
            // Call smart contract action.
            try {
              await dhsServiceContract.actions.vote(
                [selectedJuror2.name, id, dealer1.name],
                {
                  from: selectedJuror2,
                }
              );
            } catch (e) {
              assert.isTrue(
                e.includes(
                  "assertion failure with message: vote: HANDSHAKE NOT VOTING STATUS"
                ),
                "Expected an exception but none was received"
              );
            }
          }).timeout(3000);
        }).timeout(5000);
      }).timeout(5000);
    });
  }).timeout(5000);
});

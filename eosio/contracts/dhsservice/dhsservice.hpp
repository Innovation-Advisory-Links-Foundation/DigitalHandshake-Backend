#include <eosio/eosio.hpp>
#include <eosio/print.hpp>
#include <eosio/asset.hpp>
#include <eosio/system.hpp>
#include <eosio/symbol.hpp>
#include "dhstoken.hpp"
using namespace std;
using namespace eosio;

/**
* dhsservice contract
*
* @details dhsservice contract defines the structures and actions that allow users to digitally agree on 
* handshake agreements by automating the processes of notarization, bargaining, acceptance, 
* or any dispute and payment of the service offered.
* @{
*/
class [[eosio::contract]] dhsservice : public eosio::contract
{
private:
    const symbol dhs_symbol;        // The DHS token symbol.
    const eosio::asset fixed_stake; // The fixed price for the amount of stake necessary for every digital handshake.

    // List of values for the different possible roles for the user.
    enum user_role : uint8_t
    {
        USER = 0,
        JUROR = 1
    };

    // List of values for the different possible status for the request.
    enum request_status : uint8_t
    {
        OPEN = 0,
        CLOSED = 1
    };

    // List of values for the different possible status for the digital handshake.
    enum dhs_status : uint8_t
    {
        NEGOTIATION = 0,
        LOCK = 1,
        EXECUTION = 2,
        CONFIRMATION = 3,
        DISPUTE = 4,
        VOTING = 5,
        ACCEPTED = 6,
        RESOLVED = 7,
        EXPIRED = 8,
    };

    // Shared users information.
    struct shared_info
    {
        eosio::name username;           // Eosio account name.
        std::string external_data_hash; // SHA256 of external personal data (e.g., name, surname, ...).
    };

    struct [[eosio::table]] user
    {
        shared_info info;
        uint64_t rating; // Evaluation of the work goodness.

        auto primary_key() const { return info.username.value; }
    };

    struct [[eosio::table]] juror
    {
        shared_info info;

        auto primary_key() const { return info.username.value; }
    };

    struct [[eosio::table]] request
    {
        int32_t id;                         // Unique identifiers.
        eosio::name dealer;                 // The dealer username (who makes the request).
        std::string summary;                // The short summary of the request.
        std::string contractual_terms_hash; // SHA256 of the contractual terms proposal (e.g., file urls, contract object, ...).
        eosio::asset price;                 // The ideal amount to pay.
        uint32_t deadline;                  // The ideal deadline to satisfy the request.
        uint8_t status;                     // The status of the request.
        vector<eosio::name> bidders;        // The list of users who propose for the request.
        eosio::name bidder;                 // The user selected from the bidders list by the dealer.

        auto primary_key() const { return id; }
    };

    struct [[eosio::table]] digital_handshake
    {
        int32_t request_id;                   // Unique identifier of the related request.
        eosio::name dealer;                   // The dealer username.
        eosio::name bidder;                   // The bidder username.
        eosio::asset price;                   // The amount to pay.
        uint32_t deadline;                    // The deadline.
        std::string contractual_terms_hash;   // SHA256 of the contractual terms proposal (e.g., file urls, contract object, ...).
        uint8_t status;                       // The current status of the digital handshake.
        bool unlock_for_expiration_by_dealer; // True when the dealer has unlocked the tokens after deadline expiration.
        bool unlock_for_expiration_by_bidder; // True when the bidder has unlocked the tokens after deadline expiration.

        auto primary_key() const { return request_id; }
    };

    struct [[eosio::table]] contractual_terms_proposal
    {
        int32_t dhs_id;                                        // Unique identifier of the related digital handshake.
        vector<std::string> proposed_contractual_terms_hashes; // SHA256 of the contractual terms proposals (e.g., file urls, contract object, ...).
        vector<eosio::asset> proposed_prices;                  // The ideal amounts to pay.
        vector<uint32_t> proposed_deadlines;                   // The ideal deadlines to satisfy the request.
        bool accepted_by_dealer;                               // True when the dealer accepts the last proposed contractual terms.
        bool accepted_by_bidder;                               // True when the bidder accepts the last proposed contractual terms.
        bool lock_by_dealer;                                   // True when the dealer has locked the tokens.
        bool lock_by_bidder;                                   // True when the bidder has locked the tokens.

        auto primary_key() const { return dhs_id; }
    };

    struct [[eosio::table]] dispute
    {
        int32_t dhs_id;                     // Unique identifier of the related digital handshake.
        eosio::name dealer;                 // The dealer username.
        eosio::name bidder;                 // The bidder username.
        eosio::name juror1;                 // The account name of the first random picked juror for the dispute.
        eosio::name juror2;                 // The account name of the second random picked juror for the dispute.
        eosio::name juror3;                 // The account name of the third random picked juror for the dispute.
        eosio::name vote1;                  // The hash of the vote of the first juror.
        eosio::name vote2;                  // The hash of the vote of the second juror.
        eosio::name vote3;                  // The hash of the vote of the third juror.
        std::string dealer_motivation_hash; // The hash of the explanation for the dispute for the dealer.
        std::string bidder_motivation_hash; // The hash of the explanation for the dispute for the bidder.

        auto primary_key() const { return dhs_id; }
        uint64_t juror1_secondary() const { return juror1.value; }
        uint64_t juror2_secondary() const { return juror2.value; }
        uint64_t juror3_secondary() const { return juror3.value; }
    };

    struct [[eosio::table]] seed
    {
        uint64_t key = 1;
        uint32_t value = 1;

        auto primary_key() const { return key; }
    };

    typedef eosio::multi_index<"users"_n, user>
        users_table;
    typedef eosio::multi_index<"jurors"_n, juror>
        jurors_table;
    typedef eosio::multi_index<"requests"_n, request> requests_table;
    typedef eosio::multi_index<"negotiations"_n, contractual_terms_proposal> negotiations_table;
    typedef eosio::multi_index<"handshakes"_n, digital_handshake> digital_handshakes_table;
    typedef eosio::multi_index<"disputes"_n, dispute,
                               eosio::indexed_by<"j1secid"_n, eosio::const_mem_fun<dispute, uint64_t, &dispute::juror1_secondary>>,
                               eosio::indexed_by<"j2secid"_n, eosio::const_mem_fun<dispute, uint64_t, &dispute::juror2_secondary>>,
                               eosio::indexed_by<"j3secid"_n, eosio::const_mem_fun<dispute, uint64_t, &dispute::juror3_secondary>>>
        disputes_table;
    typedef eosio::multi_index<"seed"_n, seed> seed_table;

    users_table _users;
    jurors_table _jurors;
    requests_table _requests;
    negotiations_table _negotiations;
    digital_handshakes_table _handshakes;
    disputes_table _disputes;
    seed_table _seed;

    /***** Helpers Methods *****/

    // Helper to get the last value for the primary key of the requests table.
    int32_t get_last_request_id();

    // Helper to get current UTC time.
    uint32_t now();

    // Helper to get the DHS token balance from 'dhstoken' contract for a 'user'.
    asset get_user_balance(name user);

    // Helper to get the a pseudo-random integer number from 0 to range-1.
    int random(const int range);

    // Helper to get a vector of the usernames of each juror registered on the service.
    vector<eosio::name> get_jurors();

    // This is just to help the account lookup from 'dhstoken' smart contract and is not exposed in any manner.
    struct [[eosio::table]] account
    {
        asset balance;

        uint64_t primary_key() const { return balance.symbol.code().raw(); }
    };
    typedef eosio::multi_index<"accounts"_n, account> accounts;

public:
    using contract::contract;

    dhsservice(name receiver, name code, datastream<const char *> ds) : contract(receiver, code, ds),
                                                                        _users(receiver, receiver.value),        // Init users table with a global scope.
                                                                        _jurors(receiver, receiver.value),       // Init jurors table with a global scope.
                                                                        _requests(receiver, receiver.value),     // Init requests table with a global scope.
                                                                        _negotiations(receiver, receiver.value), // Init negotiation table with a global scope.
                                                                        _handshakes(receiver, receiver.value),   // Init digital handshakes table with a global scope.
                                                                        _disputes(receiver, receiver.value),     // Init disputes table with a global scope.
                                                                        _seed(receiver, receiver.value),
                                                                        dhs_symbol("DHS", 4), // Init DHS token symbol and decimals.
                                                                        fixed_stake(30.0000, symbol("DHS", 4))
    {
    }

    /**
     * Signup action.
     *
     * @details Allows `username` account to register on the service has a user or juror.
     * @param username - the account that must be registered,
     * @param role - the value which indicates if the user must be registered as a user or juror.
     * @param external_data_hash - the sha256 of the personal data of the user.
     *
     * @pre Invalid role provided,
     * @pre External data hash must be a valid SHA256 value,
     * @pre Username already registered as user,
     * @pre Username already registered as juror.
     *
     * If validation is successful, a new entry in the users' table for global contract scope gets created.
     */
    [[eosio::action]] void signup(eosio::name username,
                                  uint8_t role,
                                  std::string external_data_hash);

    /**
     * Post a new request action.
     *
     * @details Allows `dealer` user account to post a new request for a particular service on the platform.
     * @param dealer - the user who posts the request,
     * @param summary - the short summary of the object of the request.
     * @param contractual_terms_hash - SHA256 of the contractual terms proposal (e.g., file urls, contract object, ...).
     * @param price - the ideal price to pay for the service to the bidder.
     * @param deadline - the delivery deadline.
     *
     * @pre Dealer not already registered as user,
     * @pre Price is lower or equal to zero,
     * @pre Price refers not to a DHS token price,
     * @pre Summary must be not empty,
     * @pre Contractual Terms hash must be a valid SHA256 hash,
     * @pre Deadline must be greater than now,
     *
     * If validation is successful, a new entry in the requests table for global contract scope gets created.
     */
    [[eosio::action]] void postrequest(eosio::name dealer,
                                       std::string summary,
                                       std::string contractual_terms_hash,
                                       eosio::asset price,
                                       uint32_t deadline);

    /**
     * Propose for a requested action.
     *
     * @details Allows `bidder` user account to propose a new request for a particular service on the platform.
     * @param bidder - the bidder who proposes for the request,
     * @param request_id - the identifier of the request.
     *
     * @pre Bidder not already registered as user,
     * @pre Request identifier not valid,
     * @pre Request has a closed status,
     * @pre Bidder is the dealer who has posted the request,
     * @pre Bidder already proposed for the request,
     * 
     * If validation is successful, the request's entry will be modified, pushing the bidder to the proponent's vector.
     */
    [[eosio::action]] void propose(eosio::name bidder, int32_t request_id);

    /**
     * Select a bidder for the request.
     *
     * @details Allows `dealer` user account to select a bidder to provide what is required for a particular service request on the platform.
     * @param dealer - the dealer who select the bidder for its request,
     * @param bidder - the bidder selected by the dealer,
     * @param request_id - the identifier of the request,
     *
     * @pre Dealer not already registered as user,
     * @pre Request identifier not valid,
     * @pre Request identifier refers to a request with a closed status,
     * @pre Dealer is not the request dealer.
     * @pre Bidder not proposed for the request,
     *
     * If validation is successful, the entry for the request will be modified, storing a reference for the selected bidder and setting the request's status to close.
     * Finally, a new entry for the digital handshake (handshakes) table will be stored with a negotiation status to define contractual terms, price and deadline.
     */
    [[eosio::action]] void selectbidder(eosio::name dealer, eosio::name bidder, int32_t request_id);

    /**
     * Negotiate new contractual terms for a digital handshake.
     *
     * @details Allows `dealer` or `bidder` user account to negotiate the contractual terms for a particular digital handshake where they are negotiating.
     * @param user - the dealer/bidder who wants to accept the terms,
     * @param dhs_id - the identifier of the digital handshake.
     * @param contractual_terms_hash - SHA256 of the contractual terms proposal (e.g., file urls, contract object, ...).
     * @param price - the price to pay for the service to the bidder.
     * @param deadline - the delivery deadline.
     *
     * @pre User is not recorded as user in the platform,
     * @pre Digital handshake identifier not valid
     * @pre Digital handshake identifier refers to an handshake with a non negotiation status,
     * @pre User is not the dealer/bidder of the digital handshake,
     * @pre Someone (dealer/bidder) has already accepted the terms,
     * @pre User is the last user who proposed new terms,
     * @pre Contractual Terms hash must be a valid SHA256 hash,
     * @pre Price is lower or equal to zero,
     * @pre Price is not in DHS tokens,
     * @pre Deadline must be greater than now, 
     * 
     * If validation is successful the entry for the negotiation will be modified pushing the new proposal.
     */
    [[eosio::action]] void negotiate(eosio::name user, int32_t dhs_id, std::string contractual_terms_hash, eosio::asset price, uint32_t deadline);

    /**
     * Accept negotiation contractual terms for a digital handshake.
     *
     * @details Allows `dealer` or `bidder` user account to accept the last proposed contractual terms for a particular digital handshake where they are negotiating.
     * @param user - the dealer/bidder who wants to accept the terms,
     * @param dhs_id - the identifier of the digital handshake.
     *
     * @pre User is not recorded as user in the platform,
     * @pre Digital handshake identifier not valid
     * @pre Digital handshake identifier refers to an handshake with a non negotiation status,
     * @pre User is not the dealer/bidder of the digital handshake,
     * @pre User has not enough balance,
     * @pre User is the last user who proposed new terms,
     * @pre User has already accepted the terms,
     * 
     * If validation is successful, the entry for the negotiation will be modified, setting to true the relative boolean (dealer/bidder). 
     * When both dealer and bidder have accepted terms, the handshake status will be set to execution.
     */
    [[eosio::action]] void acceptterms(eosio::name user, int32_t dhs_id);

    /**
     * Listen for lock tokens action.
     *
     * @details Listen on `dhstoken::transfer` action calls where the `to` parameter refers to the `dhsservice` contract. The contract will then atomically resend the tokens on behalf
     * of the user to the dhsescrow smart contract.
     * Whenever the `dealer` and `bidder` have both accepted the contractual terms and sent the tokens to the escrow, this action will set the related handshake status to execution.
     * @param from - the dealer/bidder who wants to send tokens for an handshake,
     * @param to - the name of the dhsescrow smart contract,
     * @param quantity - the amount of DHS tokens transfered,
     * @param memo - a short string reporting the digital handshake identifier,
     *
     * @pre To is the dhsservice contract name,
     * @pre From is not recorded as user in the platform,
     * @pre Digital handshake identifier not valid (must be provided in the memo, e.g. "1"),
     * @pre Digital handshake identifier refers to an handshake with a non lock status,
     * @pre From is not the dealer/bidder of the digital handshake,
     * @pre From is dealer and quantity is not equal to fixed stake amount plus handshake price,
     * @pre From is bidder and quantity is not equal to fixed stake amount,
     * @pre From has already sent the tokens for this handshake,
     * 
     * If validation is successful, it will be recorded on the negotiation table row related to the handshake that the `from` user has locked the tokens and 
     * store the locked tokens in the dhsescrow contract table. If both dealer and bidder have locked the tokens, the handshake will pass to LOCK status.
     */
    [[eosio::on_notify("dhstoken::transfer")]] void notifylock(eosio::name from, eosio::name to, eosio::asset quantity, std::string memo);

    /**
     * Notify the end of the job for a given digital handshake.
     *
     * @details Allows `bidder` to notify the correct termination of the job.
     * @param bidder - the bidder who wants to notify the termination,
     * @param dhs_id - the identifier of the digital handshake.
     *
     * @pre Bidder is not recorded as user in the platform,
     * @pre Digital handshake identifier not valid
     * @pre Digital handshake identifier refers to an handshake with a non execution status,
     * @pre User is not the bidder of the digital handshake,
     * @pre Deadline is already expired.
     * 
     * If validation is successful the entry for the handshake will be modified setting the status to confirmation.
     */
    [[eosio::action]] void endjob(eosio::name bidder, int32_t dhs_id);

    /**
     * Expired action.
     *
     * @details Allows `dealer` and `bidder` to unlock tokens for a handshake having an expired deadline.
     * If the user is the bidder, the rating will be decreased by one.
     * @param user - the dealer/bidder who wants to unlock the tokens,
     * @param dhs_id - the identifier of the digital handshake.
     *
     * @pre User is not recorded as user in the platform,
     * @pre Digital handshake identifier not valid
     * @pre Digital handshake identifier refers to an handshake with a non execution status,
     * @pre User is not the dealer/bidder of the digital handshake,
     * @pre Deadline is not expired,
     * @pre User has already unlocked the tokens for the handshake.
     * 
     * If validation is successful, it will be recorded on the handshake table row that the `user` user has unlocked the tokens for deadline expiration and 
     * the dhsescrow contract will send those tokens back to the user. When both dealer and bidder have unlocked the tokens, the handshake will pass to EXPIRED status. 
     * If the user is the bidder, it will lose a unit of rating.
     */
    [[eosio::action]] void expired(eosio::name user, int32_t dhs_id);

    /**
     * Accept job action.
     * @details Allows `dealer` to accept the job for a handshake. The service will automatically unlock and execute the payments with DHS tokens to corresponding users. 
     * Also, the users will be remunerated with a positive increment in rating by one unit. 
     * @param dealer - the dealer who want to accept the job for an handshake,
     * @param dhs_id - the identifier of the digital handshake.
     *
     * @pre User is not recorded as user in the platform,
     * @pre Digital handshake identifier not valid
     * @pre Digital handshake identifier refers to an handshake with a non confirmation status,
     * @pre User is not the dealer of the digital handshake,
     * 
     * If validation is successful it will be recorded on the handshake table row changing the status to accepted. The dealer and bidder can withdraw the tokens locked for the stake.
     * The bidder can withdrawal the payment for the service. Both users will be remunerated for the execution of the handshake with a positive rating increment.
    */
    [[eosio::action]] void acceptjob(eosio::name dealer, int32_t dhs_id);

    /**
     * Open dispute action.
     * @details Allows `dealer` to open a dispute after a job notification from the bidder. 
     * The action involves a pseudo-random choice of three jurors who are designated to vote in favour of the dealer or bidder to declare the winner of the dispute.
     * @param dealer - the dealer who starts the dispute for an handshake,
     * @param dhs_id - the identifier of the digital handshake.
     *
     * @pre User is not recorded as user in the platform,
     * @pre Digital handshake identifier not valid
     * @pre Digital handshake identifier refers to an handshake with a non confirmation status,
     * @pre User is not the dealer of the digital handshake,
     * 
     * If validation is successful it will be recorded on the handshake table row changing the status to dispute. It will be recorded on the disputes table row related to the handshake that 
     * reports the three selected jurors.
    */
    [[eosio::action]] void opendispute(eosio::name dealer, int32_t dhs_id);

    /**
     * Motivate action.
     * @details Allows `dealer` and `bidder` to express their motivation regarding the dispute. 
     * @param user - the user who express its motivation,
     * @param dhs_id - the identifier of the digital handshake.
     * @param motivation_hash - SHA256 of the motivation (e.g., file urls, ...).
     *
     * @pre User is not recorded as user in the platform,
     * @pre Digital handshake identifier not valid
     * @pre Digital handshake identifier refers to an handshake with a non dispute status,
     * @pre User is not the dealer/bidder of the digital handshake,
     * @pre Motivation hash must be a valid SHA256 hash,
     * 
     * If validation is successful, it will be recorded on the handshake table row the motivation hash for the user. Also, when both dealer
     * and bidder have recorded the motivation, the status of the handshake will change to voting.
    */
    [[eosio::action]] void motivate(eosio::name user, int32_t dhs_id, std::string motivation_hash);

    /**
     * Vote action.
     * @details Allows a `juror` to express their preference (vote) either for dealer or bidder for an handshake dispute. 
     * @param juror - the juror who express the vote,
     * @param dhs_id - the identifier of the digital handshake.
     * @param preference - the name of the dealer/bidder of the handshake.
     *
     * @pre User is not recorded as juror in the platform,
     * @pre Digital handshake identifier not valid
     * @pre Digital handshake identifier refers to an handshake with a non voting status,
     * @pre Juror is not an handshake juror,
     * @pre Juror expresses a preference for a user which is not the dealer or bidder of the handshake,
     * @pre Juror has already voted,
     * 
     * If validation is successful, it will be recorded on the dispute table row the vote preference of the juror. Also, when every juror has 
     * expressed a vote, the dhsescrow will redistribute tokens between jurors, dealer, bidder and, it will set the handshake status to resolved.
    */
    [[eosio::action]] void vote(eosio::name juror, int32_t dhs_id, eosio::name preference);
};
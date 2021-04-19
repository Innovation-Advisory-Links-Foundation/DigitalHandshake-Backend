#include <eosio/eosio.hpp>
#include <eosio/print.hpp>
#include <eosio/asset.hpp>
#include <eosio/system.hpp>

using namespace std;
using namespace eosio;

/**
* dhsescrow contract
*
* @details dhsescrow contract act as a medium for decentralized payments holding users DHS tokens exchanged for handshakes. 
* Keep track of the amount of locked/unlocked tokens for each user involved in a handshake and distribute these tokens 
* accordingly to handshake status and events. No one owns the contract because the key pair is dropped after the deploy.
* @{
*/
class [[eosio::contract]] dhsescrow : public eosio::contract
{
private:
    const symbol dhs_symbol;        // The DHS token symbol.
    const eosio::asset fixed_stake; // The fixed price for the amount of stake necessary for every digital handshake.

    // List of values for the different possible role for a dispute winner.
    enum winner_role : uint8_t
    {
        DEALER = 0,
        BIDDER = 1
    };

    // Keep track of the amounts of DHS tokens deposited by users for handshakes.
    struct [[eosio::table]] balance
    {
        eosio::name user;
        eosio::asset funds;

        uint64_t primary_key() const { return user.value; }
    };

    typedef eosio::multi_index<"locked"_n, balance> locked_balance;

    locked_balance _locked;

public:
    using contract::contract;

    dhsescrow(eosio::name receiver, eosio::name code, datastream<const char *> ds) : contract(receiver, code, ds),
                                                                                     _locked(receiver, receiver.value), // Init locked table with a global scope.
                                                                                     dhs_symbol("DHS", 4),
                                                                                     fixed_stake(30.0000, symbol("DHS", 4))
    {
    }

    /**
     * Lock tokens action.
     * 
     * @details Lock a certain `amount` of tokens on the behalf of the `user` from the `dhsservice` contract.
     * @param dhsservice - the sender dhsservice contract account,
     * @param user - the user who needs to lock tokens,
     * @param quantity - the amount of token to lock,
     * 
     * If validation is successful, the `quantity` of tokens to be locked will be summed in the row corresponding to the `from` account.
     */
    [[eosio::action]] void locktokens(eosio::name dhsservice, eosio::name user, eosio::asset quantity);

    /**
     * Unlock tokens action.
     * 
     * @details Unlock a certain `amount` of tokens on the behalf of the `user` and sends them back.
     * @param dhsservice - the dhsservice contract account,
     * @param user - the user who needs to unlock tokens,
     * @param quantity - the amount of token to unlock,
     * 
     * @pre User has not any DHS token locked,
     * @pre User has not a locked balance equal or greater than quantity,
     * 
     * If validation is successful, the `quantity` of tokens to be unlocked will be transferred back to the user.
     */
    [[eosio::action]] void unlocktokens(eosio::name dhsservice, eosio::name user, eosio::asset quantity);

    /**
     * Accepted action.
     * 
     * @details Unlock the total amount of tokens that must be redistributed by `dhsservice` when the `dealer` has accepted and finalized the handshake.
     * @param dhsservice - the sender dhsservice contract account,
     * @param dealer - the dealer who accepts the handshake,
     * @param bidder - the bidder who participate in the handshake,
     * @param price - the price of the handshake,
     * 
     * @pre Dealer has not any DHS token locked,
     * @pre Dealer has not a locked balance equal or greater than quantity,
     * @pre Bidder has not any DHS token locked,
     * @pre Bidder has not a locked balance equal or greater than quantity,
     * 
     * If validation is successful the right amounts of tokens will be subtracted from the locked balances of dealer and bidder.
     */
    [[eosio::action]] void accepted(eosio::name dhsservice, eosio::name dealer, eosio::name bidder, eosio::asset price);

    /**
     * Resolved action.
     * 
     * @details Unlock the amount of tokens that must be redistributed by `dhsservice` when all the jurors has expressed their vote preference
     * for a disputing handshake. 
     * @param dhsservice - the sender dhsservice contract account,
     * @param dealer - the dealer who accepts the handshake,
     * @param bidder - the bidder who participate in the handshake,
     * @param price - the price of the handshake,
     * @param jurors - the vector containing the names of the jurors to be remunerated,
     * @param winner - a value that indicates who the winner is (dealer/bidder).
     * 
     * @pre Dealer has not any DHS token locked,
     * @pre Dealer has not a locked balance equal or greater than quantity,
     * @pre Bidder has not any DHS token locked,
     * @pre Bidder has not a locked balance equal or greater than quantity,
     * @pre Winner must be dealer or bidder.
     * 
     * If validation is successful the right amounts of tokens will be subtracted from the locked balances of dealer and bidder. The loser stake
     * will be redistributed to the jurors that have voted for the winner. The winner can retrieve the tokens without any loss.
     */
    [[eosio::action]] void resolved(eosio::name dhsservice, eosio::name dealer, eosio::name bidder, eosio::asset price, vector<eosio::name> jurors, uint8_t winner);
};
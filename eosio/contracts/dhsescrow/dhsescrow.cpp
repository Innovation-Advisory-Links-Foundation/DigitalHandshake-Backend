#include "dhsescrow.hpp"

void dhsescrow::locktokens(eosio::name dhsservice, eosio::name user, eosio::asset quantity)
{
    // Ensure the dhsservice contract authorizes this action.
    // nb. no other checks are required because they are in the dhsservice contract.
    require_auth(dhsservice);

    // Track the amount of locked DHS tokens for from account.
    auto existing_balance = _locked.find(user.value);

    if (existing_balance != _locked.end())
        _locked.modify(existing_balance, get_self(), [&](auto &row) {
            row.funds += quantity;
        });
    else
        _locked.emplace(get_self(), [&](auto &row) {
            row.user = user;
            row.funds = quantity;
        });
}

void dhsescrow::unlocktokens(eosio::name dhsservice, eosio::name user, eosio::asset quantity)
{
    // Ensure the dhsservice contract authorizes this action.
    // nb. no other checks are required because they are in the dhsservice contract.
    require_auth(dhsservice);

    // Track the amount of locked DHS tokens for user account.
    auto existing_balance = _locked.find(user.value);

    // Verify user lock balance.
    check(existing_balance != _locked.end(), "unlocktokens: NOT LOCKED TOKENS FOR USER");
    check(existing_balance->funds.amount / 10000 >= quantity.amount / 10000, "unlocktokens: OVERDRAWN LOCK AMOUNT");

    // Send tokens to dhsservice.
    action{
        permission_level{get_self(), "active"_n},
        "dhstoken"_n,
        "transfer"_n,
        std::make_tuple(get_self(), user, quantity, std::string("Unlocked tokens"))}
        .send();

    // Update existing lock balance.
    _locked.modify(existing_balance, get_self(), [&](auto &row) {
        row.funds -= quantity;
    });
}

void dhsescrow::accepted(eosio::name dhsservice, eosio::name dealer, eosio::name bidder, eosio::asset price)
{
    // Ensure the dhsservice contract authorizes this action.
    // nb. no other checks are required because they are in the dhsservice contract.
    require_auth(dhsservice);

    // Track the amount of locked DHS tokens for dealer.
    auto dealer_balance = _locked.find(dealer.value);

    // Verify dealer lock balance.
    check(dealer_balance != _locked.end(), "accepted: NOT LOCKED TOKENS FOR DEALER");
    check(dealer_balance->funds.amount / 10000 >= price.amount / 10000 + fixed_stake.amount, "accepted: OVERDRAWN LOCK AMOUNT FOR DEALER");

    // Track the amount of locked DHS tokens for bidder.
    auto bidder_balance = _locked.find(bidder.value);

    // Verify bidder lock balance.
    check(bidder_balance != _locked.end(), "accepted: NOT LOCKED TOKENS FOR BIDDER");
    check(bidder_balance->funds.amount / 10000 >= fixed_stake.amount, "accepted: OVERDRAWN LOCK AMOUNT FOR BIDDER");

    // Update existing lock dealer balance.
    _locked.modify(dealer_balance, get_self(), [&](auto &row) {
        row.funds -= price + (fixed_stake * 10000);
    });

    // Update existing lock bidder balance.
    _locked.modify(bidder_balance, get_self(), [&](auto &row) {
        row.funds -= (fixed_stake * 10000);
    });

    // Inline transfer to dealer.
    action{
        permission_level{get_self(), "active"_n},
        "dhstoken"_n,
        "transfer"_n,
        std::make_tuple(get_self(), dealer, (fixed_stake * 10000), std::string("Handshake accepted"))}
        .send();

    // Inline transfer to bidder.
    action{
        permission_level{get_self(), "active"_n},
        "dhstoken"_n,
        "transfer"_n,
        std::make_tuple(get_self(), bidder, (fixed_stake * 10000) + price, std::string("Handshake accepted"))}
        .send();
}

void dhsescrow::resolved(eosio::name dhsservice, eosio::name dealer, eosio::name bidder, eosio::asset price, vector<eosio::name> jurors, uint8_t winner)
{
    // Ensure the dhsservice contract authorizes this action.
    // nb. no other checks are required because they are in the dhsservice contract.
    require_auth(dhsservice);

    // Track the amount of locked DHS tokens for dealer and bidder.
    auto dealer_balance = _locked.find(dealer.value);
    auto bidder_balance = _locked.find(bidder.value);

    // Verify dealer lock balance.
    check(dealer_balance != _locked.end(), "resolved: NOT LOCKED TOKENS FOR DEALER");
    check(dealer_balance->funds.amount / 10000 >= fixed_stake.amount, "resolved: OVERDRAWN LOCK AMOUNT FOR DEALER");

    // Verify bidder lock balance.
    check(bidder_balance != _locked.end(), "resolved: NOT LOCKED TOKENS FOR BIDDER");
    check(bidder_balance->funds.amount / 10000 >= fixed_stake.amount, "resolved: OVERDRAWN LOCK AMOUNT FOR BIDDER");

    // Verify other input data.
    check(winner == DEALER || winner == BIDDER, "resolved: INVALID WINNER");

    if (winner == DEALER)
    {
        // Inline transfer dealer.
        action{
            permission_level{get_self(), "active"_n},
            "dhstoken"_n,
            "transfer"_n,
            std::make_tuple(get_self(), dealer, price + (fixed_stake * 10000), std::string("Resolved"))}
            .send();
    }

    if (winner == BIDDER)
    {
        // Inline transfer bidder.
        action{
            permission_level{get_self(), "active"_n},
            "dhstoken"_n,
            "transfer"_n,
            std::make_tuple(get_self(), bidder, (fixed_stake * 10000), std::string("Resolved"))}
            .send();

        // Inline transfer dealer.
        action{
            permission_level{get_self(), "active"_n},
            "dhstoken"_n,
            "transfer"_n,
            std::make_tuple(get_self(), dealer, price, std::string("Resolved"))}
            .send();
    }

    eosio::name juror1 = jurors.at(0);
    eosio::name juror2 = jurors.at(1);
    eosio::name juror3 = jurors.at(2);

    // Inline transfer juror1.
    action{
        permission_level{get_self(), "active"_n},
        "dhstoken"_n,
        "transfer"_n,
        std::make_tuple(get_self(), juror1, ((fixed_stake / 3) * 10000), std::string("Resolved"))}
        .send();

    // Inline transfer juror2.
    action{
        permission_level{get_self(), "active"_n},
        "dhstoken"_n,
        "transfer"_n,
        std::make_tuple(get_self(), juror2, ((fixed_stake / 3) * 10000), std::string("Resolved"))}
        .send();

    // Inline transfer juror3.
    action{
        permission_level{get_self(), "active"_n},
        "dhstoken"_n,
        "transfer"_n,
        std::make_tuple(get_self(), juror3, ((fixed_stake / 3) * 10000), std::string("Resolved"))}
        .send();

    // Update existing lock dealer balance.
    _locked.modify(dealer_balance, get_self(), [&](auto &row) {
        row.funds -= price + (fixed_stake * 10000);
    });

    // Update existing lock bidder balance.
    _locked.modify(bidder_balance, get_self(), [&](auto &row) {
        row.funds -= (fixed_stake * 10000);
    });
}

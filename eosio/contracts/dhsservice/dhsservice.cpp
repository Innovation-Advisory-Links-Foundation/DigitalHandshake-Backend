#include "dhsservice.hpp"

void dhsservice::signup(eosio::name username, uint8_t role, std::string external_data_hash)
{
    // Ensure the user authorizes this action.
    require_auth(username);

    // Verify input data.
    check(role == USER || role == JUROR, "signup: INVALID ROLE");
    check(external_data_hash.length() == 64, "signup: INVALID EXTERNAL DATA HASH");

    // Verify if the user is already registered as user.
    auto existing_user = _users.find(username.value);
    check(existing_user == _users.end(), "signup: USER ALREADY REGISTERED AS USER");

    // Verify if the user is already registered as juror.
    auto existing_juror = _jurors.find(username.value);
    check(existing_juror == _jurors.end(), "signup: USER ALREADY REGISTERED AS JUROR");

    if (role == USER)
    {
        // Register the user.
        _users.emplace(get_self(), [&](auto &new_user) {
            new_user.info.username = username;
            new_user.rating = 0;
            new_user.info.external_data_hash = external_data_hash;
        });
    }
    if (role == JUROR)
    {
        // Register the juror.
        _jurors.emplace(get_self(), [&](auto &new_juror) {
            new_juror.info.username = username;
            new_juror.info.external_data_hash = external_data_hash;
        });
    }
}

void dhsservice::postrequest(
    eosio::name dealer,
    std::string summary,
    std::string contractual_terms_hash,
    eosio::asset price,
    uint32_t deadline)
{
    // Ensure the dealer authorizes this action.
    require_auth(dealer);

    // Verify if the dealer is already registered as user.
    auto existing_dealer = _users.find(dealer.value);
    check(existing_dealer != _users.end(), "postrequest: USER NOT REGISTERED");

    // Verify price.
    check(price.amount > 0, "postrequest: ZERO OR NEGATIVE PRICE");
    check(price.symbol == dhs_symbol, "postrequest: NOT DHS TOKEN");

    // Verify other input data.
    check(summary.length() > 0, "postrequest: EMPTY SUMMARY");
    check(contractual_terms_hash.length() == 64, "postrequest: INVALID CONTRACTUAL TERMS HASH");
    check(deadline > now(), "postrequest: WRONG DEADLINE");

    // Post the new request.
    _requests.emplace(dealer, [&](auto &new_request) {
        new_request.id = get_last_request_id() + 1;
        new_request.dealer = dealer;
        new_request.summary = summary;
        new_request.contractual_terms_hash = contractual_terms_hash;
        new_request.price = price;
        new_request.deadline = deadline;
        new_request.status = OPEN;
    });
}

void dhsservice::propose(eosio::name bidder, int32_t request_id)
{
    // Ensure the bidder authorizes this action.
    require_auth(bidder);

    // Verify if the bidder is already registered as user.
    auto existing_bidder = _users.find(bidder.value);
    check(existing_bidder != _users.end(), "propose: USER NOT REGISTERED");

    // Verify request.
    auto existing_request = _requests.find(request_id);

    check(existing_request != _requests.end(), "propose: REQUEST NOT POSTED");
    check(existing_request->status == OPEN, "propose: REQUEST NOT OPEN");
    check(existing_request->dealer != bidder, "propose: REQUEST DEALER CANNOT PROPOSE");

    auto bidders = existing_request->bidders;
    check(std::find(bidders.begin(), bidders.end(), bidder) == bidders.end(), "propose: USER ALREADY PROPOSED");

    // Update the request.
    bidders.insert(bidders.begin(), bidder);

    _requests.modify(existing_request, bidder, [&](auto &request) {
        request.bidders = bidders;
    });
}

void dhsservice::selectbidder(eosio::name dealer, eosio::name bidder, int32_t request_id)
{
    // Ensure the dealer authorizes this action.
    require_auth(dealer);

    // Verify if the dealer is already registered as user.
    auto existing_dealer = _users.find(dealer.value);
    check(existing_dealer != _users.end(), "selectbidder: USER NOT REGISTERED");

    // Verify request.
    auto existing_request = _requests.find(request_id);

    check(existing_request != _requests.end(), "selectbidder: REQUEST NOT POSTED");
    check(existing_request->status == 0, "selectbidder: REQUEST NOT OPEN");

    // Verify users.
    check(existing_request->dealer == dealer, "selectbidder: NOT REQUEST DEALER");

    auto bidders = existing_request->bidders;
    check(std::find(bidders.begin(), bidders.end(), bidder) != bidders.end(), "selectbidder: NOT BIDDER FOR THE REQUEST");

    // Update the request with the selected bidder.
    _requests.modify(existing_request, dealer, [&](auto &request) {
        request.bidder = bidder;
        request.status = CLOSED;
    });

    // Store a new digital handshake for the request.
    _handshakes.emplace(dealer, [&](auto &new_digital_handshake) {
        new_digital_handshake.request_id = existing_request->id;
        new_digital_handshake.dealer = dealer;
        new_digital_handshake.bidder = bidder;
        new_digital_handshake.status = NEGOTIATION;
    });

    // Store the first negotiation copying the request information.
    _negotiations.emplace(dealer, [&](auto &new_negotiation) {
        new_negotiation.dhs_id = existing_request->id;
        new_negotiation.proposed_contractual_terms_hashes = {existing_request->contractual_terms_hash};
        new_negotiation.proposed_prices = {existing_request->price};
        new_negotiation.proposed_deadlines = {existing_request->deadline};
    });
}

void dhsservice::negotiate(eosio::name user, int32_t dhs_id, std::string contractual_terms_hash, eosio::asset price, uint32_t deadline)
{
    // Ensure the user authorizes this action.
    require_auth(user);

    // Verify if the user is already registered as user.
    auto existing_user = _users.find(user.value);
    check(existing_user != _users.end(), "negotiate: USER NOT REGISTERED");

    // Verify handshake.
    auto existing_handshake = _handshakes.find(dhs_id);

    check(existing_handshake != _handshakes.end(), "negotiate: HANDSHAKE NOT EXIST");
    check(existing_handshake->status == NEGOTIATION, "negotiate: HANDSHAKE NOT NEGOTIATION STATUS");

    // Verify if the user is the dealer/bidder of the handshake.
    check(existing_handshake->dealer == user || existing_handshake->bidder == user, "negotiate: USER NOT HANDSHAKE PARTICIPANT");

    // Verify negotiation.
    auto existing_negotiation = _negotiations.find(dhs_id);

    // Check if the terms have been already accepted.
    check(existing_negotiation->accepted_by_dealer == false && existing_negotiation->accepted_by_bidder == false, "negotiate: ALREADY ACCEPTED TERMS");

    // Verify other input data.
    check(contractual_terms_hash.length() == 64, "negotiate: INVALID CONTRACTUAL TERMS HASH");
    check(price.amount > 0, "negotiate: ZERO OR NEGATIVE PRICE");
    check(price.symbol == dhs_symbol, "negotiate: NOT DHS TOKEN");
    check(deadline > now(), "negotiate: WRONG DEADLINE");

    if (existing_handshake->dealer == user)
    { // Dealer.

        // Check if it is the dealer turns to negotiate.
        check(existing_negotiation->proposed_prices.size() % 2 == 0, "negotiate: NOT DEALER TURN");
    }
    else
    { // Bidder.
        // Check if it is the bidder turns to negotiate.
        check(existing_negotiation->proposed_prices.size() % 2 == 1, "negotiate: NOT BIDDER TURN");
    }

    // Update the negotiation row vectors.
    auto proposed_contractual_terms_hashes = existing_negotiation->proposed_contractual_terms_hashes;
    proposed_contractual_terms_hashes.insert(proposed_contractual_terms_hashes.end(), contractual_terms_hash);

    auto proposed_prices = existing_negotiation->proposed_prices;
    proposed_prices.insert(proposed_prices.end(), price);

    auto proposed_deadlines = existing_negotiation->proposed_deadlines;
    proposed_deadlines.insert(proposed_deadlines.end(), deadline);

    // Update the negotiation with the new proposal.
    _negotiations.modify(existing_negotiation, user, [&](auto &negotiation) {
        negotiation.proposed_contractual_terms_hashes = proposed_contractual_terms_hashes;
        negotiation.proposed_prices = proposed_prices;
        negotiation.proposed_deadlines = proposed_deadlines;
    });
}

void dhsservice::acceptterms(eosio::name user, int32_t dhs_id)
{
    // Ensure the user authorizes this action.
    require_auth(user);

    // Verify if the user is already registered as user.
    auto existing_user = _users.find(user.value);
    check(existing_user != _users.end(), "acceptterms: USER NOT REGISTERED");

    // Verify handshake.
    auto existing_handshake = _handshakes.find(dhs_id);

    check(existing_handshake != _handshakes.end(), "acceptterms: HANDSHAKE NOT EXIST");
    check(existing_handshake->status == NEGOTIATION, "acceptterms: HANDSHAKE NOT NEGOTIATION STATUS");

    // Verify if the user is the dealer/bidder of the handshake.
    check(existing_handshake->dealer == user || existing_handshake->bidder == user, "acceptterms: USER NOT HANDSHAKE PARTICIPANT");

    auto existing_negotiation = _negotiations.find(dhs_id);
    asset user_balance = get_user_balance(user);

    if (existing_handshake->dealer == user)
    { // Dealer.
        // Verify dealer balance.
        check(user_balance.amount / 10000 - fixed_stake.amount >= existing_negotiation->proposed_prices.back().amount / 10000, "acceptterms: NOT ENOUGH BALANCE FOR DEALER");

        // Check if the bidder has already accepted or if it is the turn of the dealer for accepting terms.
        check(existing_negotiation->accepted_by_bidder == true || existing_negotiation->proposed_prices.size() % 2 == 0, "acceptterms: NOT DEALER TURN");

        // Check if the dealer has already accepted.
        check(existing_negotiation->accepted_by_dealer == false, "acceptterms: DEALER ALREADY ACCEPTED TERMS");

        // Update the negotiation.
        _negotiations.modify(existing_negotiation, user, [&](auto &negotiation) {
            negotiation.accepted_by_dealer = true;
        });
    }
    else
    { // Bidder.
        // Verify bidder balance.
        check(user_balance.amount / 10000 >= fixed_stake.amount, "acceptterms: NOT ENOUGH BALANCE FOR BIDDER");

        // Check if the dealer has already accepted or if it is the turn of the bidder for accepting terms.
        check(existing_negotiation->accepted_by_dealer == true || existing_negotiation->proposed_prices.size() % 2 == 1, "acceptterms: NOT BIDDER TURN");

        // Check if the bidder has already accepted.
        check(existing_negotiation->accepted_by_bidder == false, "acceptterms: BIDDER ALREADY ACCEPTED TERMS");

        // Update the negotiation.
        _negotiations.modify(existing_negotiation, user, [&](auto &negotiation) {
            negotiation.accepted_by_bidder = true;
        });
    }

    if (existing_negotiation->accepted_by_dealer == true && existing_negotiation->accepted_by_bidder == true)
    {
        // Update handshake terms and status when both dealer and bidder have accepted the terms.
        _handshakes.modify(existing_handshake, user, [&](auto &handshake) {
            handshake.contractual_terms_hash = existing_negotiation->proposed_contractual_terms_hashes.back();
            handshake.price = existing_negotiation->proposed_prices.back();
            handshake.deadline = existing_negotiation->proposed_deadlines.back();
            handshake.status = LOCK;
        });
    }
}

void dhsservice::notifylock(eosio::name from, eosio::name to, eosio::asset quantity, std::string memo)
{
    // Ensure the from authorizes this action.
    require_auth(from);

    if (to != get_self())
    {
        return;
    }

    // Verify if the user is recorded as a user.
    auto existing_user = _users.find(from.value);
    check(existing_user != _users.end(), "notifylock: USER NOT REGISTERED");

    // Verify handshake (the memo must contain an handshake identifier related to an handshake with a LOCK status).
    auto identifier = std::stoi(memo);
    auto existing_handshake = _handshakes.find(identifier);

    check(existing_handshake != _handshakes.end(), "notifylock: HANDSHAKE NOT EXIST");
    check(existing_handshake->status == LOCK, "notifylock: HANDSHAKE NOT LOCK STATUS");

    // Verify if the user is the dealer/bidder of the handshake.
    check(existing_handshake->dealer == from || existing_handshake->bidder == from, "notifylock: USER NOT HANDSHAKE PARTICIPANT");

    auto existing_negotiation = _negotiations.find(identifier);

    if (existing_handshake->dealer == from)
    {
        // Verify the amount paid.
        check(quantity.amount / 10000 - fixed_stake.amount == existing_handshake->price.amount / 10000, "notifylock: NOT CORRECT QUANTITY LOCKED BY DEALER");

        // Verify that the dealer has not already paid for the handshake.
        check(existing_negotiation->lock_by_dealer == false, "notifylock: DEALER ALREADY LOCKED TOKENS");

        // Inline transfer.
        action{
            permission_level{get_self(), "active"_n},
            "dhstoken"_n,
            "transfer"_n,
            std::make_tuple(get_self(), "dhsescrow"_n, quantity, memo)}
            .send();

        // Inline lock.
        action{
            permission_level{get_self(), "active"_n},
            "dhsescrow"_n,
            "locktokens"_n,
            std::make_tuple(get_self(), from, quantity)}
            .send();

        // Update the negotiation with dealer payment lock.
        _negotiations.modify(existing_negotiation, get_self(), [&](auto &negotiation) {
            negotiation.lock_by_dealer = true;
        });
    }

    if (existing_handshake->bidder == from)
    {
        // Verify the amount paid.
        check(quantity.amount / 10000 == fixed_stake.amount, "notifylock: NOT CORRECT QUANTITY LOCKED BY BIDDER");

        // Verify that the bidder has not already paid for the handshake.
        check(existing_negotiation->lock_by_bidder == false, "notifylock: BIDDER ALREADY LOCKED TOKENS");

        // Inline transfer.
        action{
            permission_level{get_self(), "active"_n},
            "dhstoken"_n,
            "transfer"_n,
            std::make_tuple(get_self(), "dhsescrow"_n, quantity, memo)}
            .send();

        // Inline lock.
        action{
            permission_level{get_self(), "active"_n},
            "dhsescrow"_n,
            "locktokens"_n,
            std::make_tuple(get_self(), from, quantity)}
            .send();

        // Update the negotiation with bidder payment lock.
        _negotiations.modify(existing_negotiation, get_self(), [&](auto &negotiation) {
            negotiation.lock_by_bidder = true;
        });
    }

    if (existing_negotiation->lock_by_dealer == true && existing_negotiation->lock_by_bidder == true)
    {
        // Update handshake status.
        _handshakes.modify(existing_handshake, get_self(), [&](auto &handshake) {
            handshake.status = EXECUTION;
        });
    }
}

void dhsservice::endjob(eosio::name bidder, int32_t dhs_id)
{
    // Ensure the bidder authorized this action.
    require_auth(bidder);

    // Verify if the bidder is recorded as a user.
    auto existing_user = _users.find(bidder.value);
    check(existing_user != _users.end(), "endjob: USER NOT REGISTERED");

    // Verify handshake.
    auto existing_handshake = _handshakes.find(dhs_id);

    check(existing_handshake != _handshakes.end(), "endjob: HANDSHAKE NOT EXIST");
    check(existing_handshake->status == EXECUTION, "endjob: HANDSHAKE NOT EXECUTION STATUS");

    // Verify if the user is the bidder of the handshake.
    check(existing_handshake->bidder == bidder, "endjob: USER NOT HANDSHAKE BIDDER");

    // Verify if the deadline is already expired.
    check(existing_handshake->deadline > now(), "endjob: EXPIRED DEADLINE");

    // Update handshake status.
    _handshakes.modify(existing_handshake, get_self(), [&](auto &handshake) {
        handshake.status = CONFIRMATION;
    });
}

void dhsservice::expired(eosio::name user, int32_t dhs_id)
{
    // Ensure the user authorized this action.
    require_auth(user);

    // Verify if the user is recorded as a user.
    auto existing_user = _users.find(user.value);
    check(existing_user != _users.end(), "expired: USER NOT REGISTERED");

    // Verify handshake.
    auto existing_handshake = _handshakes.find(dhs_id);

    check(existing_handshake != _handshakes.end(), "expired: HANDSHAKE NOT EXIST");
    check(existing_handshake->status == EXECUTION, "expired: HANDSHAKE NOT EXECUTION STATUS");

    // Verify if the user is the dealer/bidder of the handshake.
    check(existing_handshake->dealer == user || existing_handshake->bidder == user, "notifylock: USER NOT HANDSHAKE PARTICIPANT");

    // Verify if the deadline is already expired.
    check(existing_handshake->deadline <= now(), "expired: NOT EXPIRED DEADLINE");

    if (existing_handshake->dealer == user)
    {
        // Verify if the dealer has already unlocked the tokens for the handshake.
        check(existing_handshake->unlock_for_expiration_by_dealer == false, "expired: DEALER ALREADY UNLOCKED TOKENS");

        // Inline unlock.
        action{
            permission_level{get_self(), "active"_n},
            "dhsescrow"_n,
            "unlocktokens"_n,
            std::make_tuple(get_self(), user, existing_handshake->price + (fixed_stake * 10000))}
            .send();

        // Update handshake boolean for dealer.
        _handshakes.modify(existing_handshake, get_self(), [&](auto &handshake) {
            handshake.unlock_for_expiration_by_dealer = true;
        });
    }

    if (existing_handshake->bidder == user)
    {
        // Verify if the bidder has already unlocked the tokens for the handshake.
        check(existing_handshake->unlock_for_expiration_by_bidder == false, "expired: BIDDER ALREADY UNLOCKED TOKENS");

        // Inline unlock.
        action{
            permission_level{get_self(), "active"_n},
            "dhsescrow"_n,
            "unlocktokens"_n,
            std::make_tuple(get_self(), user, (fixed_stake * 10000))}
            .send();

        // Update handshake boolean for dealer.
        _handshakes.modify(existing_handshake, get_self(), [&](auto &handshake) {
            handshake.unlock_for_expiration_by_bidder = true;
        });
    }

    if (existing_handshake->unlock_for_expiration_by_dealer == true && existing_handshake->unlock_for_expiration_by_bidder == true)
    {
        // Update handshake status.
        _handshakes.modify(existing_handshake, get_self(), [&](auto &handshake) {
            handshake.status = EXPIRED;
        });
    }
}

void dhsservice::acceptjob(eosio::name dealer, int32_t dhs_id)
{
    // Ensure the dealer authorized this action.
    require_auth(dealer);

    // Verify if the dealer is recorded as a user.
    auto existing_dealer = _users.find(dealer.value);
    check(existing_dealer != _users.end(), "acceptjob: USER NOT REGISTERED");

    // Verify handshake.
    auto existing_handshake = _handshakes.find(dhs_id);

    check(existing_handshake != _handshakes.end(), "acceptjob: HANDSHAKE NOT EXIST");
    check(existing_handshake->status == CONFIRMATION, "acceptjob: HANDSHAKE NOT CONFIRMATION STATUS");

    // Verify if the user is the dealer of the handshake.
    check(existing_handshake->dealer == dealer, "acceptjob: USER NOT HANDSHAKE DEALER");

    // Inline unlock.
    action{
        permission_level{get_self(), "active"_n},
        "dhsescrow"_n,
        "accepted"_n,
        std::make_tuple(get_self(), dealer, existing_handshake->bidder, existing_handshake->price)}
        .send();

    // Update handshake status.
    _handshakes.modify(existing_handshake, get_self(), [&](auto &handshake) {
        handshake.status = ACCEPTED;
    });

    // Update dealer rating.
    _users.modify(existing_dealer, get_self(), [&](auto &dealer) {
        dealer.rating += 1;
    });

    // Update bidder rating.
    auto bidder = existing_handshake->bidder;
    auto existing_bidder = _users.find(bidder.value);

    _users.modify(existing_bidder, get_self(), [&](auto &bidder) {
        bidder.rating += 1;
    });
}

void dhsservice::opendispute(eosio::name dealer, int32_t dhs_id)
{
    // Ensure this action is authorized by the dealer.
    require_auth(dealer);

    // Verify if the dealer is recorded as a user.
    auto existing_dealer = _users.find(dealer.value);
    check(existing_dealer != _users.end(), "opendispute: USER NOT REGISTERED");

    // Verify handshake.
    auto existing_handshake = _handshakes.find(dhs_id);

    check(existing_handshake != _handshakes.end(), "opendispute: HANDSHAKE NOT EXIST");
    check(existing_handshake->status == CONFIRMATION, "opendispute: HANDSHAKE NOT CONFIRMATION STATUS");

    // Verify if the user is the dealer of the handshake.
    check(existing_handshake->dealer == dealer, "opendispute: USER NOT HANDSHAKE DEALER");

    // Random jurors selection.
    vector<eosio::name> jurors = get_jurors();
    int random_juror1_index = random(jurors.size());
    int random_juror2_index = random(jurors.size());
    while (random_juror1_index == random_juror2_index)
    {
        int random_juror2_index = random(jurors.size());
    }
    int random_juror3_index = random(jurors.size());
    while (random_juror3_index == random_juror1_index || random_juror3_index == random_juror2_index)
    {
        int random_juror2_index = random(jurors.size());
    }

    // Verify if the user has opened a dispute for the handshake.
    auto existing_dispute = _disputes.find(dhs_id);

    // Store a new dispute for the handshake.
    _disputes.emplace(dealer, [&](auto &new_dispute) {
        new_dispute.dhs_id = dhs_id;
        new_dispute.dealer = existing_handshake->dealer;
        new_dispute.bidder = existing_handshake->bidder;
        new_dispute.juror1 = jurors.at(random_juror1_index);
        new_dispute.juror2 = jurors.at(random_juror2_index);
        new_dispute.juror3 = jurors.at(random_juror3_index);
    });

    // Update handshake status.
    _handshakes.modify(existing_handshake, get_self(), [&](auto &handshake) {
        handshake.status = DISPUTE;
    });
}

void dhsservice::motivate(eosio::name user, int32_t dhs_id, std::string motivation_hash)
{
    // Ensure this action is authorized by the user.
    require_auth(user);

    // Verify if the user is recorded as a user.
    auto existing_user = _users.find(user.value);
    check(existing_user != _users.end(), "motivate: USER NOT REGISTERED");

    // Verify handshake.
    auto existing_handshake = _handshakes.find(dhs_id);

    check(existing_handshake != _handshakes.end(), "motivate: HANDSHAKE NOT EXIST");
    check(existing_handshake->status == DISPUTE, "motivate: HANDSHAKE NOT DISPUTE STATUS");

    // Verify if the user is the dealer/bidder of the handshake.
    check(existing_handshake->dealer == user || existing_handshake->bidder == user, "motivate: USER NOT HANDSHAKE PARTICIPANT");

    // Verify other input data.
    check(motivation_hash.length() == 64, "motivate: INVALID MOTIVATION HASH");

    // Verify dispute.
    auto existing_dispute = _disputes.find(dhs_id);

    if (existing_handshake->dealer == user)
    {
        check(existing_dispute->dealer_motivation_hash.length() == 0, "motivate: DEALER ALREADY MOTIVATE");

        // Update dispute.
        _disputes.modify(existing_dispute, get_self(), [&](auto &dispute) {
            dispute.dealer_motivation_hash = motivation_hash;
        });
    }
    else
    {
        check(existing_dispute->bidder_motivation_hash.length() == 0, "motivate: BIDDER ALREADY MOTIVATE");

        // Update dispute.
        _disputes.modify(existing_dispute, get_self(), [&](auto &dispute) {
            dispute.bidder_motivation_hash = motivation_hash;
        });
    }

    if (existing_dispute->dealer_motivation_hash.length() == 64 && existing_dispute->bidder_motivation_hash.length() == 64)
    {
        // Update handshake status.
        _handshakes.modify(existing_handshake, get_self(), [&](auto &handshake) {
            handshake.status = VOTING;
        });
    }
}

void dhsservice::vote(eosio::name juror, int32_t dhs_id, eosio::name preference)
{
    // Ensure this action is authorized by the juror.
    require_auth(juror);

    // Verify if the user is recorded as a juror.
    auto existing_juror = _jurors.find(juror.value);
    check(existing_juror != _jurors.end(), "vote: JUROR NOT REGISTERED");

    // Verify handshake.
    auto existing_handshake = _handshakes.find(dhs_id);

    check(existing_handshake != _handshakes.end(), "vote: HANDSHAKE NOT EXIST");
    check(existing_handshake->status == VOTING, "vote: HANDSHAKE NOT VOTING STATUS");

    // Verify dispute.
    auto existing_dispute = _disputes.find(dhs_id);

    // Check if the juror has been designated for the handshake.
    check(existing_dispute->juror1 == juror || existing_dispute->juror2 == juror || existing_dispute->juror3 == juror, "vote: NOT HANDSHAKE JUROR");

    // Check if the preference corresponds to the dealer or bidder of the handshake.
    check(existing_handshake->dealer == preference || existing_handshake->bidder == preference, "vote: NOT PREFERENCE FOR DEALER OR BIDDER");

    if (existing_dispute->juror1 == juror)
    {
        check(existing_dispute->vote1.to_string().length() == 0, "vote: ALREADY VOTED");

        // Update dispute.
        _disputes.modify(existing_dispute, get_self(), [&](auto &dispute) {
            dispute.vote1 = preference;
        });
    }

    if (existing_dispute->juror2 == juror)
    {
        check(existing_dispute->vote2.to_string().length() == 0, "vote: ALREADY VOTED");

        // Update dispute.
        _disputes.modify(existing_dispute, get_self(), [&](auto &dispute) {
            dispute.vote2 = preference;
        });
    }

    if (existing_dispute->juror3 == juror)
    {
        check(existing_dispute->vote3.to_string().length() == 0, "vote: ALREADY VOTED");

        // Update dispute.
        _disputes.modify(existing_dispute, get_self(), [&](auto &dispute) {
            dispute.vote3 = preference;
        });
    }

    // Token redistribution.
    if (existing_dispute->vote1.to_string().length() > 0 && existing_dispute->vote2.to_string().length() > 0 && existing_dispute->vote3.to_string().length() > 0)
    {
        auto dealer = existing_handshake->dealer;
        auto bidder = existing_handshake->bidder;

        auto existing_dealer = _users.find(dealer.value);
        auto existing_bidder = _users.find(bidder.value);

        // Vector containing all jurors.
        vector<eosio::name> jurors = {};
        jurors.insert(jurors.begin(), existing_dispute->juror1);
        jurors.insert(jurors.begin(), existing_dispute->juror2);
        jurors.insert(jurors.begin(), existing_dispute->juror3);

        if (existing_dispute->vote1 == existing_dispute->vote2 && existing_dispute->vote2 == existing_dispute->vote3)
        {

            // Winner: Dealer - Redistribute 10 DHS tokens to every juror from bidder stake.
            if (existing_dispute->vote1 == existing_handshake->dealer)
            {
                if (existing_bidder->rating != 0)
                {
                    // Update bidder rating
                    _users.modify(existing_bidder, get_self(), [&](auto &bidder) {
                        bidder.rating -= 1;
                    });
                }

                // Update dealer rating
                _users.modify(existing_dealer, get_self(), [&](auto &dealer) {
                    dealer.rating += 1;
                });

                // Inline unlock.
                action{
                    permission_level{get_self(), "active"_n},
                    "dhsescrow"_n,
                    "resolved"_n,
                    std::make_tuple(get_self(), dealer, bidder, existing_handshake->price, jurors, 0)}
                    .send();
            }
            else
            {
                // Update bidder rating
                _users.modify(existing_bidder, get_self(), [&](auto &bidder) {
                    bidder.rating += 1;
                });

                if (existing_dealer->rating != 0)
                {
                    // Update dealer rating
                    _users.modify(existing_dealer, get_self(), [&](auto &dealer) {
                        dealer.rating -= 1;
                    });
                }

                // Winner: Bidder - Redistribute 10 DHS tokens to every juror from dealer stake.
                // Inline unlock.
                action{
                    permission_level{get_self(), "active"_n},
                    "dhsescrow"_n,
                    "resolved"_n,
                    std::make_tuple(get_self(), dealer, bidder, existing_handshake->price, jurors, 1)}
                    .send();
            }
        }
        else
        {
            if (
                (existing_dispute->vote1 == existing_dispute->vote2 && existing_dispute->vote1 == existing_handshake->dealer) ||
                (existing_dispute->vote2 == existing_dispute->vote3 && existing_dispute->vote2 == existing_handshake->dealer) ||
                (existing_dispute->vote3 == existing_dispute->vote1 && existing_dispute->vote3 == existing_handshake->dealer))
            {
                // Winner: Dealer - Redistribute 10 DHS tokens to every juror from bidder stake.

                if (existing_bidder->rating != 0)
                {
                    // Update bidder rating
                    _users.modify(existing_bidder, get_self(), [&](auto &bidder) {
                        bidder.rating -= 1;
                    });
                }

                // Update dealer rating
                _users.modify(existing_dealer, get_self(), [&](auto &dealer) {
                    dealer.rating += 1;
                });

                // Inline unlock.
                action{
                    permission_level{get_self(), "active"_n},
                    "dhsescrow"_n,
                    "resolved"_n,
                    std::make_tuple(get_self(), dealer, bidder, existing_handshake->price, jurors, 0)}
                    .send();
            }
            else
            {
                // Update bidder rating
                _users.modify(existing_bidder, get_self(), [&](auto &bidder) {
                    bidder.rating += 1;
                });

                if (existing_dealer->rating != 0)
                {
                    // Update dealer rating
                    _users.modify(existing_dealer, get_self(), [&](auto &dealer) {
                        dealer.rating -= 1;
                    });
                }
                
                // Winner: Bidder - Redistribute 10 DHS tokens to every juror from dealer stake.
                // Inline unlock.
                action{
                    permission_level{get_self(), "active"_n},
                    "dhsescrow"_n,
                    "resolved"_n,
                    std::make_tuple(get_self(), dealer, bidder, existing_handshake->price, jurors, 1)}
                    .send();
            }
        }

        // Update handshake status.
        _handshakes.modify(existing_handshake, get_self(), [&](auto &handshake) {
            handshake.status = RESOLVED;
        });
    }
}

/** HELPERS **/

int32_t dhsservice::get_last_request_id()
{
    int32_t last_id = 0;

    for (auto itr = _requests.begin(); itr != _requests.end(); itr++)
    {
        last_id = itr->id;
    }

    return last_id;
}

uint32_t dhsservice::now()
{
    return current_time_point().sec_since_epoch();
}

asset dhsservice::get_user_balance(name user)
{
    accounts from_acnts("dhstoken"_n, user.value);

    const auto &from = from_acnts.get(dhs_symbol.code().raw(), "get_user_balance: NO DHS TOKEN BALANCE FOUND");

    return from.balance;
}

vector<eosio::name> dhsservice::get_jurors()
{
    vector<eosio::name> jurors = {};

    for (auto itr = _jurors.begin(); itr != _jurors.end(); itr++)
    {
        jurors.insert(jurors.begin(), itr->info.username);
    }

    return jurors;
}

// Simple Pseudo Random Number Algorithm, randomly pick a number within 0 to n-1
int dhsservice::random(const int range)
{
    // Find the existing seed
    auto seed_iterator = _seed.begin();

    // Initialize the seed with default value if it is not found
    if (seed_iterator == _seed.end())
    {
        seed_iterator = _seed.emplace(_self, [&](auto &seed) {});
    }

    // Generate new seed value using the existing seed value
    int prime = 65537;
    auto new_seed_value = (seed_iterator->value + current_time_point().elapsed.count()) % prime;

    // Store the updated seed value in the table
    _seed.modify(seed_iterator, _self, [&](auto &s) {
        s.value = new_seed_value;
    });

    // Get the random result in desired range
    int random_result = new_seed_value % range;

    return random_result;
}

#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Address, BytesN, Env,
};

use crate::{RemitCreditContract, RemitCreditContractClient};

const ONE_USDC: i128 = 10_000_000; // 7 decimals (stroops)
const DAY_SECS: u64 = 86_400;

fn setup_protocol<'a>(
    env: &'a Env,
) -> (
    RemitCreditContractClient<'a>,
    Address,
    Address,
    Address,
    Address,
    Address,
    TokenClient<'a>,
    StellarAssetClient<'a>,
) {
    env.mock_all_auths();

    let admin = Address::generate(env);
    let anchor = Address::generate(env);
    let lp = Address::generate(env);
    let sender = Address::generate(env);
    let borrower = Address::generate(env);

    let token_admin = Address::generate(env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_id = token_contract.address();
    let token_client = TokenClient::new(env, &token_id);
    let token_sac = StellarAssetClient::new(env, &token_id);

    let contract_id = env.register(RemitCreditContract, ());
    let client = RemitCreditContractClient::new(env, &contract_id);

    // 3 min cycles, 60s interval, 60s post-repay cooldown, 2% remit fee capped at 15 USDC,
    // 40% waterfall, 2.5% loan fee, 20% backstop cut, $50/$100/$200/$400 caps, 180s (3 min) test loan period
    client.initialize(
        &admin,
        &token_id,
        &3,
        &60,
        &60,
        &200,
        &(15 * ONE_USDC),
        &4_000,
        &250,
        &2_000,
        &(50 * ONE_USDC),
        &(100 * ONE_USDC),
        &(200 * ONE_USDC),
        &(400 * ONE_USDC),
        &180,
    );

    client.set_anchor(&anchor, &true);

    token_sac.mint(&lp, &(10_000 * ONE_USDC));
    token_sac.mint(&sender, &(10_000 * ONE_USDC));

    client.provide_liquidity(&lp, &(5_000 * ONE_USDC));

    (client, admin, anchor, lp, sender, borrower, token_client, token_sac)
}

#[test]
fn test_atomic_remit_fee_cap_cooldown_and_6_strike_ban() {
    let env = Env::default();
    let (client, _admin, anchor, _lp, sender, borrower, token_client, _token_sac) =
        setup_protocol(&env);

    // 1. Send 1,000 USDC remittance -> 2% would be 20 USDC, capped at 15 USDC to Backstop!
    env.ledger().set_timestamp(1_000);
    let net_1 = client.send_remittance(&sender, &borrower, &(1_000 * ONE_USDC));
    assert_eq!(net_1, 985 * ONE_USDC);
    assert_eq!(token_client.balance(&borrower), 985 * ONE_USDC);
    assert_eq!(client.get_pool_state().backstop_reserve, 15 * ONE_USDC);

    // 2. Send 2 more 500 USDC remittances (2% = 10 USDC fee each -> 490 USDC net each)
    env.ledger().set_timestamp(1_100);
    client.send_remittance(&sender, &borrower, &(500 * ONE_USDC));
    env.ledger().set_timestamp(1_200);
    client.send_remittance(&sender, &borrower, &(500 * ONE_USDC));

    // Backstop now holds 15 + 10 + 10 = 35 USDC purely from remittance fees!
    assert_eq!(client.get_pool_state().backstop_reserve, 35 * ONE_USDC);

    // Register SEP-12 KYC
    let kyc_id = BytesN::from_array(&env, &[9u8; 32]);
    client.register_kyc(&anchor, &borrower, &kyc_id);
    assert_eq!(client.get_borrower_limit(&borrower), 50 * ONE_USDC);

    // 3. Draw 50 USDC loan (3 min duration -> due at 1_200 + 180 = 1_380)
    let loan = client.borrow(&borrower, &(50 * ONE_USDC));
    assert_eq!(loan.due_at, 1_380);

    // Repay on time at t = 1_300
    env.ledger().set_timestamp(1_300);
    client.repay_loan(&borrower, &(51_250_000_0));

    // Immediate re-borrow within 60s cooldown must be rejected
    assert!(client.try_borrow(&borrower, &(25 * ONE_USDC)).is_err());

    // After 60s cooldown passes (t = 1_361), borrowing succeeds
    env.ledger().set_timestamp(1_361);
    let loan_2 = client.borrow(&borrower, &(50 * ONE_USDC));
    assert_eq!(loan_2.due_at, 1_541);

    // 4. Advance past 6 overdue periods (6 * 180s = 1_080s -> t = 2_622) and trigger 6-strike ban
    env.ledger().set_timestamp(2_622);
    client.slash_default(&borrower);

    let profile = client.get_borrower_profile(&borrower);
    assert!(profile.has_defaulted);
    assert_eq!(profile.credit_tier, 0);
    assert!(client.try_borrow(&borrower, &(10 * ONE_USDC)).is_err());
}
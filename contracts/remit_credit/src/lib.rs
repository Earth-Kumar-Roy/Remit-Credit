#![no_std]

mod errors;
mod events;
mod scoring;
mod storage;
mod types;
mod waterfall;

#[cfg(test)]
mod test;

use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, Vec};

pub use crate::errors::RemitError;
use crate::events::{
    AccountRehabilitated, DirectRepaid, KycVerified, LiquidityUpdated, LoanDefaulted,
    LoanDisbursed, OverdueStrikeAdded, RemitFeeCollected, RemittanceLogged, WaterfallRepaid,
};
use crate::scoring::{
    calculate_credit_limit, evaluate_credit_tier, record_verified_inflow, BPS_DENOMINATOR,
};
use crate::storage::{
    bump_instance_ttl, bump_persistent_ttl, get_config, get_kyc_owner, get_loan, get_lp_principal,
    get_lp_shares, get_pool, get_profile, has_config, is_verified_anchor, set_anchor_status,
    set_config, set_kyc_owner, set_loan, set_lp_principal, set_lp_shares, set_pool, set_profile,
};
pub use crate::types::{
    BorrowerProfile, DataKey, LoanRecord, LpPosition, PoolState, ProtocolConfig,
};
use crate::waterfall::{apply_overdue_penalties, apply_waterfall_split, settle_loan_payment};

/// 50% rehabilitation penalty fee (5,000 bps) required on top of defaulted debt to lift a 6-strike ban.
const REHABILITATION_PENALTY_BPS: i128 = 5_000;

/// Minimum and maximum borrower-selectable loan term bounds (2 minutes to 30 days).
const MIN_LOAN_DURATION_SECS: u64 = 120;
const MAX_LOAN_DURATION_SECS: u64 = 2_592_000;

#[contract]
pub struct RemitCreditContract;

/// Internal shared remittance settlement pipeline used by both atomic `send_remittance`
/// and Anchor-relayed `deposit_remittance`.
fn process_remittance_settlement(
    env: &Env,
    sender: Address,
    beneficiary: Address,
    gross_amount: i128,
    config: &ProtocolConfig,
) -> Result<i128, RemitError> {
    let contract_addr = env.current_contract_address();
    let token_client = token::Client::new(env, &config.token);

    // 1. Calculate 2% remittance fee capped at 15.00 USDC (150_000_000 stroops) -> Backstop Reserve
    let raw_fee = gross_amount
        .checked_mul(config.remit_fee_bps as i128)
        .ok_or(RemitError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(RemitError::MathOverflow)?;
    let remit_fee = if raw_fee > config.remit_fee_cap {
        config.remit_fee_cap
    } else {
        raw_fee
    };
    let net_amount = gross_amount
        .checked_sub(remit_fee)
        .ok_or(RemitError::MathOverflow)?;

    let mut pool = get_pool(env)?;
    if remit_fee > 0 {
        token_client.transfer(&sender, &contract_addr, &remit_fee);
        pool.backstop_reserve = pool
            .backstop_reserve
            .checked_add(remit_fee)
            .ok_or(RemitError::MathOverflow)?;
        set_pool(env, &pool);

        RemitFeeCollected {
            beneficiary: beneficiary.clone(),
            fee_amount: remit_fee,
            new_backstop_reserve: pool.backstop_reserve,
        }
        .publish(env);
    }

    // 2. Record net verified inflow & update rolling 8-remittance average + cycle count
    let mut profile = get_profile(env, &beneficiary);
    let now = env.ledger().timestamp();
    record_verified_inflow(&mut profile, net_amount, now, config)?;

    // 3. Route 100% of net_amount to beneficiary if no active loan;
    //    otherwise run waterfall: 40% of loan's total_owed if on-time, or 100% of remaining debt if overdue
    let mut forwarded_to_user = net_amount;
    if let Some(mut loan) = get_loan(env, &beneficiary) {
        if loan.is_active && loan.remaining_balance > 0 {
            let _ = apply_overdue_penalties(&mut loan, now, config)?;
            let outcome = apply_waterfall_split(
                net_amount,
                now,
                &mut loan,
                &mut pool,
                &mut profile,
                config,
            )?;
            forwarded_to_user = outcome.forwarded_to_user;

            if outcome.repaid_to_pool > 0 {
                token_client.transfer(&sender, &contract_addr, &outcome.repaid_to_pool);
            }

            set_loan(env, &beneficiary, &loan);
            set_pool(env, &pool);

            WaterfallRepaid {
                beneficiary: beneficiary.clone(),
                repaid_to_pool: outcome.repaid_to_pool,
                forwarded_to_user: outcome.forwarded_to_user,
                remaining_debt: loan.remaining_balance,
                loan_closed: outcome.loan_closed,
            }
            .publish(env);
        }
    }

    set_profile(env, &beneficiary, &profile);

    // 4. Forward net payout directly from sender -> beneficiary (skip redundant self-transfer)
    if forwarded_to_user > 0 && sender != beneficiary {
        token_client.transfer(&sender, &beneficiary, &forwarded_to_user);
    }

    RemittanceLogged {
        beneficiary,
        sender,
        gross_amount,
        remit_fee,
        net_amount,
        new_ema_inflow: profile.ema_inflow,
        verified_cycles: profile.verified_cycles,
        credit_tier: profile.credit_tier,
    }
    .publish(env);

    Ok(forwarded_to_user)
}

#[contractimpl]
impl RemitCreditContract {
    /// Initializes the RemitCredit v3 protocol with 4-tier caps ($50/$100/$200/$400),
    /// 2% capped remittance fee (max 15 USDC), post-repayment cooldown, and default loan duration.
    #[allow(clippy::too_many_arguments)]
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        min_cycles_required: u32,
        min_cycle_interval_secs: u64,
        post_repay_cooldown_secs: u64,
        remit_fee_bps: u32,
        remit_fee_cap: i128,
        waterfall_split_bps: u32,
        loan_fee_bps: u32,
        backstop_fee_bps: u32,
        tier_1_cap: i128,
        tier_2_cap: i128,
        tier_3_cap: i128,
        tier_4_cap: i128,
        loan_duration_secs: u64,
    ) -> Result<(), RemitError> {
        if has_config(&env) {
            return Err(RemitError::AlreadyInitialized);
        }
        if min_cycles_required == 0
            || remit_fee_bps > 2_000
            || remit_fee_cap < 0
            || waterfall_split_bps == 0
            || waterfall_split_bps > 9_000
            || loan_fee_bps > 5_000
            || backstop_fee_bps > 10_000
            || tier_1_cap <= 0
            || tier_2_cap < tier_1_cap
            || tier_3_cap < tier_2_cap
            || tier_4_cap < tier_3_cap
            || loan_duration_secs == 0
        {
            return Err(RemitError::InvalidParameter);
        }

        let config = ProtocolConfig {
            admin,
            token,
            min_cycles_required,
            min_cycle_interval_secs,
            post_repay_cooldown_secs,
            remit_fee_bps,
            remit_fee_cap,
            waterfall_split_bps,
            loan_fee_bps,
            backstop_fee_bps,
            tier_1_cap,
            tier_2_cap,
            tier_3_cap,
            tier_4_cap,
            loan_duration_secs,
            is_paused: false,
        };

        let pool = PoolState {
            total_assets: 0,
            total_shares: 0,
            total_principal_lent: 0,
            total_yield_earned: 0,
            backstop_reserve: 0,
            uncovered_lp_loss: 0,
        };

        set_config(&env, &config);
        set_pool(&env, &pool);
        Ok(())
    }

    /// Admin function to whitelist or revoke a verified remittance anchor / distributor address.
    pub fn set_anchor(env: Env, anchor: Address, is_verified: bool) -> Result<(), RemitError> {
        let config = get_config(&env)?;
        config.admin.require_auth();
        set_anchor_status(&env, &anchor, is_verified);
        Ok(())
    }

    /// Admin function to update default loan period duration.
    pub fn set_loan_duration(env: Env, loan_duration_secs: u64) -> Result<(), RemitError> {
        if loan_duration_secs == 0 {
            return Err(RemitError::InvalidParameter);
        }
        let mut config = get_config(&env)?;
        config.admin.require_auth();
        config.loan_duration_secs = loan_duration_secs;
        set_config(&env, &config);
        Ok(())
    }

    /// Admin function to update cycle interval and post-repayment cooldown timers.
    pub fn set_timing_params(
        env: Env,
        min_cycle_interval_secs: u64,
        post_repay_cooldown_secs: u64,
    ) -> Result<(), RemitError> {
        let mut config = get_config(&env)?;
        config.admin.require_auth();
        config.min_cycle_interval_secs = min_cycle_interval_secs;
        config.post_repay_cooldown_secs = post_repay_cooldown_secs;
        set_config(&env, &config);
        Ok(())
    }

    /// Admin emergency circuit breaker to pause or unpause borrowing and deposits.
    pub fn set_paused(env: Env, is_paused: bool) -> Result<(), RemitError> {
        let mut config = get_config(&env)?;
        config.admin.require_auth();
        config.is_paused = is_paused;
        set_config(&env, &config);
        Ok(())
    }

    /// SEP-12 Identity Attestation: Whitelisted Anchor binds a salted human ID nullifier to one wallet.
    pub fn register_kyc(
        env: Env,
        anchor: Address,
        beneficiary: Address,
        kyc_nullifier: BytesN<32>,
    ) -> Result<(), RemitError> {
        anchor.require_auth();
        let config = get_config(&env)?;
        if config.is_paused {
            return Err(RemitError::ProtocolPaused);
        }
        if !is_verified_anchor(&env, &anchor) {
            return Err(RemitError::UnverifiedAnchor);
        }

        if let Some(existing_owner) = get_kyc_owner(&env, &kyc_nullifier) {
            if existing_owner != beneficiary {
                return Err(RemitError::DuplicateIdentity);
            }
        }

        let mut profile = get_profile(&env, &beneficiary);
        profile.is_kyc_verified = true;
        profile.kyc_nullifier = kyc_nullifier.clone();
        profile.credit_tier = evaluate_credit_tier(&profile, &config);

        set_kyc_owner(&env, &kyc_nullifier, &beneficiary);
        set_profile(&env, &beneficiary, &profile);

        KycVerified {
            beneficiary,
            anchor,
            kyc_nullifier,
        }
        .publish(&env);

        Ok(())
    }

    /// Liquidity Providers deposit settlement stablecoins (USDC) into the pool to earn pro-rata yield.
    pub fn provide_liquidity(env: Env, provider: Address, amount: i128) -> Result<i128, RemitError> {
        provider.require_auth();
        if amount <= 0 {
            return Err(RemitError::InvalidAmount);
        }

        let config = get_config(&env)?;
        if config.is_paused {
            return Err(RemitError::ProtocolPaused);
        }

        let mut pool = get_pool(&env)?;
        let shares_to_mint = if pool.total_shares == 0 || pool.total_assets == 0 {
            amount
        } else {
            amount
                .checked_mul(pool.total_shares)
                .ok_or(RemitError::MathOverflow)?
                .checked_div(pool.total_assets)
                .ok_or(RemitError::MathOverflow)?
        };

        if shares_to_mint <= 0 {
            return Err(RemitError::InvalidAmount);
        }

        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&provider, &env.current_contract_address(), &amount);

        pool.total_assets = pool
            .total_assets
            .checked_add(amount)
            .ok_or(RemitError::MathOverflow)?;
        pool.total_shares = pool
            .total_shares
            .checked_add(shares_to_mint)
            .ok_or(RemitError::MathOverflow)?;

        let current_shares = get_lp_shares(&env, &provider);
        let new_shares = current_shares
            .checked_add(shares_to_mint)
            .ok_or(RemitError::MathOverflow)?;

        let current_principal = get_lp_principal(&env, &provider);
        let new_principal = current_principal
            .checked_add(amount)
            .ok_or(RemitError::MathOverflow)?;

        set_pool(&env, &pool);
        set_lp_shares(&env, &provider, new_shares);
        set_lp_principal(&env, &provider, new_principal);

        LiquidityUpdated {
            provider,
            is_deposit: true,
            asset_amount: amount,
            shares_delta: shares_to_mint,
        }
        .publish(&env);

        Ok(shares_to_mint)
    }

    /// Liquidity Providers burn shares to withdraw up to their pro-rata share of idle pool liquidity
    /// (`(user_shares * idle_liquidity) / total_shares`), ensuring active loan exposure is shared fairly.
    pub fn withdraw_liquidity(
        env: Env,
        provider: Address,
        shares_to_burn: i128,
    ) -> Result<i128, RemitError> {
        provider.require_auth();
        if shares_to_burn <= 0 {
            return Err(RemitError::InvalidAmount);
        }

        let config = get_config(&env)?;
        let mut pool = get_pool(&env)?;
        let current_shares = get_lp_shares(&env, &provider);

        if shares_to_burn > current_shares || pool.total_shares <= 0 {
            return Err(RemitError::InvalidAmount);
        }

        let asset_amount = shares_to_burn
            .checked_mul(pool.total_assets)
            .ok_or(RemitError::MathOverflow)?
            .checked_div(pool.total_shares)
            .ok_or(RemitError::MathOverflow)?;

        let idle_liquidity = pool
            .total_assets
            .checked_sub(pool.total_principal_lent)
            .ok_or(RemitError::MathOverflow)?;

        // Pro-rata idle cash cap for this LP's total share of the pool
        let provider_max_withdrawable = current_shares
            .checked_mul(idle_liquidity)
            .ok_or(RemitError::MathOverflow)?
            .checked_div(pool.total_shares)
            .ok_or(RemitError::MathOverflow)?;

        if asset_amount > provider_max_withdrawable || asset_amount > idle_liquidity {
            return Err(RemitError::InsufficientPoolLiquidity);
        }

        // Reduce tracked net principal proportionally to shares burned
        let current_principal = get_lp_principal(&env, &provider);
        let principal_burned = if shares_to_burn >= current_shares {
            current_principal
        } else {
            current_principal
                .checked_mul(shares_to_burn)
                .ok_or(RemitError::MathOverflow)?
                .checked_div(current_shares)
                .ok_or(RemitError::MathOverflow)?
        };
        let remaining_principal = current_principal.saturating_sub(principal_burned);

        pool.total_assets = pool
            .total_assets
            .checked_sub(asset_amount)
            .ok_or(RemitError::MathOverflow)?;
        pool.total_shares = pool
            .total_shares
            .checked_sub(shares_to_burn)
            .ok_or(RemitError::MathOverflow)?;

        let remaining_shares = current_shares
            .checked_sub(shares_to_burn)
            .ok_or(RemitError::MathOverflow)?;

        set_pool(&env, &pool);
        set_lp_shares(&env, &provider, remaining_shares);
        set_lp_principal(&env, &provider, if remaining_shares == 0 { 0 } else { remaining_principal });

        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&env.current_contract_address(), &provider, &asset_amount);

        LiquidityUpdated {
            provider,
            is_deposit: false,
            asset_amount,
            shares_delta: shares_to_burn,
        }
        .publish(&env);

        Ok(asset_amount)
    }

    /// Atomic Single-Transaction Remittance Router:
    /// Sender signs 1 tx -> deducts 2% fee (capped at 15 USDC) into Backstop Reserve,
    /// records verified cycle & rolling 8-remittance average, and routes 100% net to beneficiary
    /// (or 40% of loan's total_owed if on-time / 100% of remaining debt if overdue).
    pub fn send_remittance(
        env: Env,
        sender: Address,
        beneficiary: Address,
        amount: i128,
    ) -> Result<i128, RemitError> {
        sender.require_auth();
        if amount <= 0 {
            return Err(RemitError::InvalidAmount);
        }

        let config = get_config(&env)?;
        if config.is_paused {
            return Err(RemitError::ProtocolPaused);
        }

        process_remittance_settlement(&env, sender, beneficiary, amount, &config)
    }

    /// SEP-31 Anchor Entry Point: Whitelisted Anchor settles an externally funded wire on-chain
    /// using the exact same 2% capped backstop fee + waterfall settlement pipeline.
    pub fn deposit_remittance(
        env: Env,
        anchor: Address,
        beneficiary: Address,
        amount: i128,
    ) -> Result<i128, RemitError> {
        anchor.require_auth();
        if amount <= 0 {
            return Err(RemitError::InvalidAmount);
        }

        let config = get_config(&env)?;
        if config.is_paused {
            return Err(RemitError::ProtocolPaused);
        }
        if !is_verified_anchor(&env, &anchor) {
            return Err(RemitError::UnverifiedAnchor);
        }

        process_remittance_settlement(&env, anchor, beneficiary, amount, &config)
    }

    /// Eligible SEP-12 KYC-verified borrower draws an undercollateralized loan up to `min(rolling_8_avg * 60%, tier_cap)`
    /// with a borrower-chosen period duration between 120s (2 mins) and 2_592_000s (30 days).
    /// Blocked if the borrower currently holds active LP liquidity in the vault (must withdraw LP funds instead).
    pub fn borrow(
        env: Env,
        beneficiary: Address,
        principal: i128,
        duration_secs: u64,
    ) -> Result<LoanRecord, RemitError> {
        beneficiary.require_auth();
        if principal <= 0 {
            return Err(RemitError::InvalidAmount);
        }
        if !(MIN_LOAN_DURATION_SECS..=MAX_LOAN_DURATION_SECS).contains(&duration_secs) {
            return Err(RemitError::InvalidLoanDuration);
        }

        let config = get_config(&env)?;
        if config.is_paused {
            return Err(RemitError::ProtocolPaused);
        }

        // Prevent self-borrowing while holding LP shares in the Liquidity Pool
        if get_lp_shares(&env, &beneficiary) > 0 {
            return Err(RemitError::ActiveLpPositionExists);
        }

        if let Some(existing_loan) = get_loan(&env, &beneficiary) {
            if existing_loan.is_active {
                return Err(RemitError::ActiveLoanExists);
            }
        }

        let profile = get_profile(&env, &beneficiary);
        if !profile.is_kyc_verified {
            return Err(RemitError::KycNotVerified);
        }
        if profile.has_defaulted {
            return Err(RemitError::BorrowerDefaulted);
        }
        if profile.needs_clean_cycle {
            return Err(RemitError::CleanCycleRequired);
        }
        if profile.verified_cycles < config.min_cycles_required {
            return Err(RemitError::InsufficientCreditHistory);
        }

        let now = env.ledger().timestamp();
        if profile.last_repaid_ts > 0 {
            let since_repaid = now.saturating_sub(profile.last_repaid_ts);
            if since_repaid < config.post_repay_cooldown_secs {
                return Err(RemitError::CooldownActive);
            }
        }

        let credit_limit = calculate_credit_limit(&profile, &config)?;
        if principal > credit_limit {
            return Err(RemitError::ExceedsCreditLimit);
        }

        let mut pool = get_pool(&env)?;
        let available_liquidity = pool
            .total_assets
            .checked_sub(pool.total_principal_lent)
            .ok_or(RemitError::MathOverflow)?;
        if principal > available_liquidity {
            return Err(RemitError::InsufficientPoolLiquidity);
        }

        let fee = principal
            .checked_mul(config.loan_fee_bps as i128)
            .ok_or(RemitError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(RemitError::MathOverflow)?;

        let total_owed = principal
            .checked_add(fee)
            .ok_or(RemitError::MathOverflow)?;

        let due_at = now
            .checked_add(duration_secs)
            .ok_or(RemitError::MathOverflow)?;

        let loan = LoanRecord {
            principal,
            total_owed,
            remaining_balance: total_owed,
            disbursed_at: now,
            due_at,
            period_duration_secs: duration_secs,
            late_periods: 0,
            is_active: true,
            is_defaulted: false,
        };

        pool.total_principal_lent = pool
            .total_principal_lent
            .checked_add(principal)
            .ok_or(RemitError::MathOverflow)?;

        set_loan(&env, &beneficiary, &loan);
        set_pool(&env, &pool);

        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&env.current_contract_address(), &beneficiary, &principal);

        LoanDisbursed {
            beneficiary,
            principal,
            total_owed,
            due_at,
            period_duration_secs: duration_secs,
            credit_tier: profile.credit_tier,
        }
        .publish(&env);

        Ok(loan)
    }

    /// Direct Wallet Repayment: Allows a borrower to repay part or all of their active loan directly.
    /// Automatically accrues any overdue period fees if called past `due_at`.
    pub fn repay_loan(env: Env, beneficiary: Address, amount: i128) -> Result<LoanRecord, RemitError> {
        beneficiary.require_auth();
        if amount <= 0 {
            return Err(RemitError::InvalidAmount);
        }

        let config = get_config(&env)?;
        if config.is_paused {
            return Err(RemitError::ProtocolPaused);
        }

        let mut loan = get_loan(&env, &beneficiary).ok_or(RemitError::NoActiveLoan)?;
        if !loan.is_active || loan.remaining_balance <= 0 {
            return Err(RemitError::NoActiveLoan);
        }

        let now = env.ledger().timestamp();
        let _ = apply_overdue_penalties(&mut loan, now, &config)?;

        let pay_amount = if amount >= loan.remaining_balance {
            loan.remaining_balance
        } else {
            amount
        };

        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&beneficiary, &env.current_contract_address(), &pay_amount);

        let mut pool = get_pool(&env)?;
        let mut profile = get_profile(&env, &beneficiary);

        let (repaid_amount, loan_closed) =
            settle_loan_payment(pay_amount, now, &mut loan, &mut pool, &mut profile, &config)?;

        set_loan(&env, &beneficiary, &loan);
        set_profile(&env, &beneficiary, &profile);
        set_pool(&env, &pool);

        DirectRepaid {
            beneficiary,
            repaid_amount,
            remaining_debt: loan.remaining_balance,
            loan_closed,
        }
        .publish(&env);

        Ok(loan)
    }

    /// Overdue Strike & Default Enforcement:
    /// Each elapsed `period_duration_secs` period past `due_at` adds +2.5% penalty fee up to 6 strikes.
    /// At 6 strikes (`late_periods >= 6`), suspends the borrower & SEP-12 ID, records `defaulted_debt_owed`,
    /// covers unpaid principal from Backstop Reserve, and tracks any `uncovered_lp_loss` for LP reimbursement.
    pub fn slash_default(env: Env, borrower: Address) -> Result<(), RemitError> {
        let config = get_config(&env)?;
        let mut loan = get_loan(&env, &borrower).ok_or(RemitError::NoActiveLoan)?;
        if !loan.is_active || loan.remaining_balance <= 0 {
            return Err(RemitError::NoActiveLoan);
        }

        let now = env.ledger().timestamp();
        if now <= loan.due_at {
            return Err(RemitError::LoanNotOverdue);
        }

        let reached_ban = apply_overdue_penalties(&mut loan, now, &config)?;

        if !reached_ban {
            set_loan(&env, &borrower, &loan);
            OverdueStrikeAdded {
                beneficiary: borrower,
                late_periods: loan.late_periods,
                new_total_owed: loan.total_owed,
                new_remaining_balance: loan.remaining_balance,
                next_due_at: loan.due_at,
            }
            .publish(&env);
            return Ok(());
        }

        // 6 strikes reached -> Account & SEP-12 Nullifier Suspension + Backstop Coverage
        let prior_repaid = loan
            .total_owed
            .checked_sub(loan.remaining_balance)
            .ok_or(RemitError::MathOverflow)?;
        let unpaid_principal = if prior_repaid >= loan.principal {
            0
        } else {
            loan.principal
                .checked_sub(prior_repaid)
                .ok_or(RemitError::MathOverflow)?
        };

        let defaulted_debt_owed = loan.remaining_balance;

        let mut pool = get_pool(&env)?;
        let backstop_covered = if pool.backstop_reserve >= unpaid_principal {
            unpaid_principal
        } else {
            pool.backstop_reserve
        };
        let uncovered_loss = unpaid_principal
            .checked_sub(backstop_covered)
            .ok_or(RemitError::MathOverflow)?;

        pool.backstop_reserve = pool
            .backstop_reserve
            .checked_sub(backstop_covered)
            .ok_or(RemitError::MathOverflow)?;
        pool.total_principal_lent = pool
            .total_principal_lent
            .checked_sub(unpaid_principal)
            .ok_or(RemitError::MathOverflow)?;
        pool.total_assets = pool
            .total_assets
            .checked_sub(uncovered_loss)
            .ok_or(RemitError::MathOverflow)?;
        pool.uncovered_lp_loss = pool
            .uncovered_lp_loss
            .checked_add(uncovered_loss)
            .ok_or(RemitError::MathOverflow)?;

        loan.is_active = false;
        loan.is_defaulted = true;

        let mut profile = get_profile(&env, &borrower);
        profile.has_defaulted = true;
        profile.defaulted_debt_owed = defaulted_debt_owed;
        profile.credit_tier = 0;

        set_loan(&env, &borrower, &loan);
        set_profile(&env, &borrower, &profile);
        set_pool(&env, &pool);

        LoanDefaulted {
            beneficiary: borrower,
            unpaid_principal,
            backstop_covered,
            defaulted_debt_owed,
        }
        .publish(&env);

        Ok(())
    }

    /// Ban Removal & Account Rehabilitation:
    /// A borrower banned after 6 overdue strikes pays `defaulted_debt_owed + 50% penalty`:
    /// 1. Reimburses `pool.total_assets` first for any `uncovered_lp_loss` absorbed by LPs during default,
    ///    PLUS routes all 6-strike accrued loan fees to `pool.total_assets` & `pool.total_yield_earned` as LP profit.
    /// 2. Routes the Backstop-covered principal + 50% rehabilitation penalty to `pool.backstop_reserve`.
    /// 3. Resets `verified_cycles`, `loans_repaid_count`, `ema_inflow`, `recent_inflows`, and `credit_tier` to 0.
    pub fn rehabilitate_account(env: Env, borrower: Address) -> Result<i128, RemitError> {
        borrower.require_auth();
        let config = get_config(&env)?;
        if config.is_paused {
            return Err(RemitError::ProtocolPaused);
        }

        let mut profile = get_profile(&env, &borrower);
        if !profile.has_defaulted || profile.defaulted_debt_owed <= 0 {
            return Err(RemitError::NoActiveLoan);
        }

        let debt_cleared = profile.defaulted_debt_owed;
        let penalty_paid = debt_cleared
            .checked_mul(REHABILITATION_PENALTY_BPS)
            .ok_or(RemitError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(RemitError::MathOverflow)?;
        let total_cure_amount = debt_cleared
            .checked_add(penalty_paid)
            .ok_or(RemitError::MathOverflow)?;

        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&borrower, &env.current_contract_address(), &total_cure_amount);

        // Determine unpaid principal vs. accrued 6-strike late fees from the defaulted loan record
        let accrued_default_fees = if let Some(loan) = get_loan(&env, &borrower) {
            let prior_repaid = loan.total_owed.saturating_sub(loan.remaining_balance);
            let unpaid_principal = loan.principal.saturating_sub(prior_repaid);
            debt_cleared.saturating_sub(unpaid_principal)
        } else {
            0
        };

        let mut pool = get_pool(&env)?;

        // Priority 1: Restore uncovered LP principal loss + award 100% of 6-strike accrued fees to LPs
        let uncovered_recovered = if pool.uncovered_lp_loss >= debt_cleared {
            debt_cleared
        } else {
            pool.uncovered_lp_loss
        };
        let remaining_after_loss = debt_cleared
            .checked_sub(uncovered_recovered)
            .ok_or(RemitError::MathOverflow)?;
        let lp_fee_profit = if accrued_default_fees >= remaining_after_loss {
            remaining_after_loss
        } else {
            accrued_default_fees
        };

        let lp_reimbursed = uncovered_recovered
            .checked_add(lp_fee_profit)
            .ok_or(RemitError::MathOverflow)?;
        let to_backstop = total_cure_amount
            .checked_sub(lp_reimbursed)
            .ok_or(RemitError::MathOverflow)?;

        pool.uncovered_lp_loss = pool
            .uncovered_lp_loss
            .checked_sub(uncovered_recovered)
            .ok_or(RemitError::MathOverflow)?;
        pool.total_assets = pool
            .total_assets
            .checked_add(lp_reimbursed)
            .ok_or(RemitError::MathOverflow)?;
        pool.total_yield_earned = pool
            .total_yield_earned
            .checked_add(lp_fee_profit)
            .ok_or(RemitError::MathOverflow)?;
        pool.backstop_reserve = pool
            .backstop_reserve
            .checked_add(to_backstop)
            .ok_or(RemitError::MathOverflow)?;
        set_pool(&env, &pool);

        // Full credit history reset to Tier 0 (0 cycles) while keeping SEP-12 KYC bound
        profile.has_defaulted = false;
        profile.defaulted_debt_owed = 0;
        profile.needs_clean_cycle = false;
        profile.verified_cycles = 0;
        profile.ema_inflow = 0;
        profile.recent_inflows = Vec::new(&env);
        profile.loans_repaid_count = 0;
        profile.credit_tier = 0;
        profile.last_repaid_ts = env.ledger().timestamp();

        set_profile(&env, &borrower, &profile);

        AccountRehabilitated {
            beneficiary: borrower,
            debt_cleared,
            penalty_paid,
            lp_reimbursed,
            total_to_backstop: to_backstop,
        }
        .publish(&env);

        Ok(total_cure_amount)
    }

    /// Keeper / maintenance method to extend ledger TTL for active borrower profiles and loans.
    pub fn extend_account_ttl(env: Env, borrower: Address) -> Result<(), RemitError> {
        let _ = get_config(&env)?;
        bump_instance_ttl(&env);
        bump_persistent_ttl(&env, &DataKey::Profile(borrower.clone()));
        bump_persistent_ttl(&env, &DataKey::Loan(borrower));
        Ok(())
    }

    // --- Read-Only View Methods for Frontend & Keeper ---

    pub fn get_protocol_config(env: Env) -> Result<ProtocolConfig, RemitError> {
        get_config(&env)
    }

    pub fn get_pool_state(env: Env) -> Result<PoolState, RemitError> {
        get_pool(&env)
    }

    pub fn get_borrower_profile(env: Env, borrower: Address) -> BorrowerProfile {
        get_profile(&env, &borrower)
    }

    pub fn get_borrower_limit(env: Env, borrower: Address) -> Result<i128, RemitError> {
        let config = get_config(&env)?;
        let profile = get_profile(&env, &borrower);
        calculate_credit_limit(&profile, &config)
    }

    pub fn get_active_loan(env: Env, borrower: Address) -> Option<LoanRecord> {
        get_loan(&env, &borrower)
    }

    pub fn get_provider_shares(env: Env, provider: Address) -> i128 {
        get_lp_shares(&env, &provider)
    }

    pub fn get_lp_position(env: Env, provider: Address) -> LpPosition {
        LpPosition {
            shares: get_lp_shares(&env, &provider),
            net_deposited: get_lp_principal(&env, &provider),
        }
    }

    pub fn check_anchor(env: Env, anchor: Address) -> bool {
        is_verified_anchor(&env, &anchor)
    }
}
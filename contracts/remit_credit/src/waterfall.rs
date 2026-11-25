use crate::errors::RemitError;
use crate::scoring::{evaluate_credit_tier, BPS_DENOMINATOR};
use crate::types::{BorrowerProfile, LoanRecord, PoolState, ProtocolConfig};

/// Maximum overdue strike periods before a borrower's account and SEP-12 ID are suspended.
pub const MAX_OVERDUE_STRIKES: u32 = 6;

/// Outcome of an atomic waterfall split on an incoming remittance.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WaterfallOutcome {
    /// Portion retained by the protocol liquidity pool to repay debt
    pub repaid_to_pool: i128,
    /// Portion forwarded immediately to the beneficiary's wallet
    pub forwarded_to_user: i128,
    /// True if this repayment cleared the remaining loan balance to zero
    pub loan_closed: bool,
}

/// Accrues overdue period penalty fees (`loan_fee_bps` per elapsed `period_duration_secs` past `due_at`)
/// up to `MAX_OVERDUE_STRIKES` (6 periods). Returns `true` if the loan has hit 6 strikes and must be banned.
pub fn apply_overdue_penalties(
    loan: &mut LoanRecord,
    current_ts: u64,
    config: &ProtocolConfig,
) -> Result<bool, RemitError> {
    if !loan.is_active || loan.remaining_balance <= 0 {
        return Ok(false);
    }

    let step_secs = if loan.period_duration_secs > 0 {
        loan.period_duration_secs
    } else {
        config.loan_duration_secs
    };

    while current_ts > loan.due_at && loan.late_periods < MAX_OVERDUE_STRIKES {
        let penalty = loan
            .remaining_balance
            .checked_mul(config.loan_fee_bps as i128)
            .ok_or(RemitError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(RemitError::MathOverflow)?;

        loan.total_owed = loan
            .total_owed
            .checked_add(penalty)
            .ok_or(RemitError::MathOverflow)?;
        loan.remaining_balance = loan
            .remaining_balance
            .checked_add(penalty)
            .ok_or(RemitError::MathOverflow)?;
        loan.late_periods = loan
            .late_periods
            .checked_add(1)
            .ok_or(RemitError::MathOverflow)?;
        loan.due_at = loan
            .due_at
            .checked_add(step_secs)
            .ok_or(RemitError::MathOverflow)?;
    }

    Ok(loan.late_periods >= MAX_OVERDUE_STRIKES && current_ts > loan.due_at)
}

/// Applies a validated debt payment (from either a remittance waterfall or direct wallet repayment),
/// recovering principal first and splitting realized fee yield between the LP pool and Backstop Reserve.
pub fn settle_loan_payment(
    payment_amount: i128,
    current_ts: u64,
    loan: &mut LoanRecord,
    pool: &mut PoolState,
    profile: &mut BorrowerProfile,
    config: &ProtocolConfig,
) -> Result<(i128, bool), RemitError> {
    let was_late = current_ts > loan.due_at || loan.late_periods > 0;

    let applied_payment = if payment_amount >= loan.remaining_balance {
        loan.remaining_balance
    } else {
        payment_amount
    };

    // Track how much of the repayment recovers original principal vs. protocol fee yield
    let prior_repaid = loan
        .total_owed
        .checked_sub(loan.remaining_balance)
        .ok_or(RemitError::MathOverflow)?;
    let unrecovered_principal = if prior_repaid >= loan.principal {
        0
    } else {
        loan.principal
            .checked_sub(prior_repaid)
            .ok_or(RemitError::MathOverflow)?
    };

    let principal_recovered = if applied_payment >= unrecovered_principal {
        unrecovered_principal
    } else {
        applied_payment
    };
    let yield_realized = applied_payment
        .checked_sub(principal_recovered)
        .ok_or(RemitError::MathOverflow)?;

    // Split realized fee yield between First-Loss Backstop Reserve and Liquidity Providers
    let backstop_cut = yield_realized
        .checked_mul(config.backstop_fee_bps as i128)
        .ok_or(RemitError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(RemitError::MathOverflow)?;
    let lp_yield_cut = yield_realized
        .checked_sub(backstop_cut)
        .ok_or(RemitError::MathOverflow)?;

    pool.total_principal_lent = pool
        .total_principal_lent
        .checked_sub(principal_recovered)
        .ok_or(RemitError::MathOverflow)?;
    pool.total_assets = pool
        .total_assets
        .checked_add(lp_yield_cut)
        .ok_or(RemitError::MathOverflow)?;
    pool.total_yield_earned = pool
        .total_yield_earned
        .checked_add(lp_yield_cut)
        .ok_or(RemitError::MathOverflow)?;
    pool.backstop_reserve = pool
        .backstop_reserve
        .checked_add(backstop_cut)
        .ok_or(RemitError::MathOverflow)?;

    loan.remaining_balance = loan
        .remaining_balance
        .checked_sub(applied_payment)
        .ok_or(RemitError::MathOverflow)?;

    let loan_closed = loan.remaining_balance == 0;
    if loan_closed {
        loan.is_active = false;
        loan.is_defaulted = false;
        profile.has_defaulted = false;
        profile.last_repaid_ts = current_ts;
        if was_late {
            profile.needs_clean_cycle = true;
        }
        profile.loans_repaid_count = profile
            .loans_repaid_count
            .checked_add(1)
            .ok_or(RemitError::MathOverflow)?;
        profile.credit_tier = evaluate_credit_tier(profile, config);
    }

    Ok((applied_payment, loan_closed))
}

/// Computes and applies the waterfall repayment split against an active loan:
/// - **On-Time (`current_ts <= due_at` and `late_periods == 0`):** Deducts `waterfall_split_bps` (40%)
///   of the loan's `total_owed` (capped at `net_incoming_amount` and `remaining_balance`).
/// - **Overdue (`current_ts > due_at` or `late_periods > 0`):** Deducts 100% of `loan.remaining_balance`
///   (up to `net_incoming_amount`) to settle the overdue loan immediately.
pub fn apply_waterfall_split(
    net_incoming_amount: i128,
    current_ts: u64,
    loan: &mut LoanRecord,
    pool: &mut PoolState,
    profile: &mut BorrowerProfile,
    config: &ProtocolConfig,
) -> Result<WaterfallOutcome, RemitError> {
    if !loan.is_active || loan.remaining_balance <= 0 {
        return Ok(WaterfallOutcome {
            repaid_to_pool: 0,
            forwarded_to_user: net_incoming_amount,
            loan_closed: false,
        });
    }

    let is_overdue = current_ts > loan.due_at || loan.late_periods > 0;

    let target_deduction = if is_overdue {
        loan.remaining_balance
    } else {
        loan.total_owed
            .checked_mul(config.waterfall_split_bps as i128)
            .ok_or(RemitError::MathOverflow)?
            .checked_div(BPS_DENOMINATOR)
            .ok_or(RemitError::MathOverflow)?
    };

    let max_deduction = if target_deduction > net_incoming_amount {
        net_incoming_amount
    } else {
        target_deduction
    };

    let (repaid_to_pool, loan_closed) =
        settle_loan_payment(max_deduction, current_ts, loan, pool, profile, config)?;

    let forwarded_to_user = net_incoming_amount
        .checked_sub(repaid_to_pool)
        .ok_or(RemitError::MathOverflow)?;

    Ok(WaterfallOutcome {
        repaid_to_pool,
        forwarded_to_user,
        loan_closed,
    })
}
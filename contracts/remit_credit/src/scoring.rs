use soroban_sdk::Vec;

use crate::errors::RemitError;
use crate::types::{BorrowerProfile, ProtocolConfig};

pub const BPS_DENOMINATOR: i128 = 10_000;

/// Rolling window size: average of up to the last 8 verified net remittances.
const ROLLING_WINDOW_SIZE: u32 = 8;

/// Maximum LTV percentage (in basis points) applied to the rolling 8-remittance average: 50%.
const ROLLING_AVG_LTV_BPS: i128 = 5_000;

/// Updates a borrower's on-chain cash-flow profile upon receiving a verified net remittance inflow.
/// Maintains a sliding window of up to the last 8 remittances and stores their arithmetic average in `ema_inflow`.
pub fn record_verified_inflow(
    profile: &mut BorrowerProfile,
    net_amount: i128,
    current_ts: u64,
    config: &ProtocolConfig,
) -> Result<(), RemitError> {
    profile.total_received = profile
        .total_received
        .checked_add(net_amount)
        .ok_or(RemitError::MathOverflow)?;

    // Push newest net inflow and evict oldest if window exceeds 8 entries
    if profile.recent_inflows.len() >= ROLLING_WINDOW_SIZE {
        let mut trimmed = Vec::new(profile.recent_inflows.env());
        let start_idx = profile
            .recent_inflows
            .len()
            .saturating_sub(ROLLING_WINDOW_SIZE - 1);
        for i in start_idx..profile.recent_inflows.len() {
            if let Some(val) = profile.recent_inflows.get(i) {
                trimmed.push_back(val);
            }
        }
        trimmed.push_back(net_amount);
        profile.recent_inflows = trimmed;
    } else {
        profile.recent_inflows.push_back(net_amount);
    }

    // Compute arithmetic average across the last <= 8 remittances
    let count = profile.recent_inflows.len() as i128;
    let mut sum: i128 = 0;
    for val in profile.recent_inflows.iter() {
        sum = sum.checked_add(val).ok_or(RemitError::MathOverflow)?;
    }
    profile.ema_inflow = if count > 0 {
        sum.checked_div(count).ok_or(RemitError::MathOverflow)?
    } else {
        net_amount
    };

    if profile.verified_cycles == 0 {
        profile.verified_cycles = 1;
        profile.last_remittance_ts = current_ts;
        profile.needs_clean_cycle = false;
    } else {
        // Only increment cycle streak if minimum interval has elapsed (blocks rapid split-deposit gaming)
        let elapsed = current_ts.saturating_sub(profile.last_remittance_ts);
        if elapsed >= config.min_cycle_interval_secs {
            profile.verified_cycles = profile
                .verified_cycles
                .checked_add(1)
                .ok_or(RemitError::MathOverflow)?;
            profile.last_remittance_ts = current_ts;
            // Completing a valid post-late remittance cycle clears the late-repay restriction
            profile.needs_clean_cycle = false;
        }
    }

    profile.credit_tier = evaluate_credit_tier(profile, config);
    Ok(())
}

/// Evaluates the borrower's eligible 4-tier credit standing ($50 -> $100 -> $200 -> $400 Max).
pub fn evaluate_credit_tier(profile: &BorrowerProfile, config: &ProtocolConfig) -> u32 {
    if !profile.is_kyc_verified || profile.has_defaulted {
        return 0;
    }
    if profile.verified_cycles < config.min_cycles_required {
        return 0;
    }
    if profile.loans_repaid_count >= 4
        && profile.verified_cycles >= 15
        && profile.ema_inflow >= config.tier_4_cap
    {
        return 4;
    }
    if profile.loans_repaid_count >= 2
        && profile.verified_cycles >= 10
        && profile.ema_inflow >= config.tier_3_cap
    {
        return 3;
    }
    if profile.loans_repaid_count >= 1
        && profile.verified_cycles >= 6
        && profile.ema_inflow >= config.tier_2_cap
    {
        return 2;
    }
    1
}

/// Calculates the maximum stablecoin principal (in stroops) the borrower can currently draw:
/// `min(rolling_8_avg * 50%, tier_hard_cap)`.
pub fn calculate_credit_limit(
    profile: &BorrowerProfile,
    config: &ProtocolConfig,
) -> Result<i128, RemitError> {
    let tier = evaluate_credit_tier(profile, config);
    let hard_cap = match tier {
        0 => 0,
        1 => config.tier_1_cap,
        2 => config.tier_2_cap,
        3 => config.tier_3_cap,
        _ => config.tier_4_cap,
    };

    if hard_cap <= 0 || profile.ema_inflow <= 0 {
        return Ok(0);
    }

    let ltv_allowance = profile
        .ema_inflow
        .checked_mul(ROLLING_AVG_LTV_BPS)
        .ok_or(RemitError::MathOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(RemitError::MathOverflow)?;

    Ok(if ltv_allowance < hard_cap {
        ltv_allowance
    } else {
        hard_cap
    })
}
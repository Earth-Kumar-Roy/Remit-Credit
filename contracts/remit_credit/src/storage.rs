use soroban_sdk::{Address, BytesN, Env, Vec};

use crate::errors::RemitError;
use crate::types::{BorrowerProfile, DataKey, LoanRecord, PoolState, ProtocolConfig};

/// ~17,280 ledgers per day at ~5 seconds per ledger close.
/// Threshold: ~30 days remaining; Extend-to: ~60 days from current ledger.
const INSTANCE_TTL_THRESHOLD: u32 = 518_400;
const INSTANCE_TTL_EXTEND_TO: u32 = 1_036_800;

const PERSISTENT_TTL_THRESHOLD: u32 = 518_400;
const PERSISTENT_TTL_EXTEND_TO: u32 = 1_036_800;

pub fn bump_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

pub fn bump_persistent_ttl(env: &Env, key: &DataKey) {
    if env.storage().persistent().has(key) {
        env.storage()
            .persistent()
            .extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
    }
}

pub fn has_config(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Config)
}

pub fn set_config(env: &Env, config: &ProtocolConfig) {
    env.storage().instance().set(&DataKey::Config, config);
    bump_instance_ttl(env);
}

pub fn get_config(env: &Env) -> Result<ProtocolConfig, RemitError> {
    let config = env
        .storage()
        .instance()
        .get(&DataKey::Config)
        .ok_or(RemitError::NotInitialized)?;
    bump_instance_ttl(env);
    Ok(config)
}

pub fn set_pool(env: &Env, pool: &PoolState) {
    env.storage().instance().set(&DataKey::Pool, pool);
    bump_instance_ttl(env);
}

pub fn get_pool(env: &Env) -> Result<PoolState, RemitError> {
    let pool = env
        .storage()
        .instance()
        .get(&DataKey::Pool)
        .ok_or(RemitError::NotInitialized)?;
    bump_instance_ttl(env);
    Ok(pool)
}

pub fn set_anchor_status(env: &Env, anchor: &Address, is_verified: bool) {
    let key = DataKey::Anchor(anchor.clone());
    if is_verified {
        env.storage().persistent().set(&key, &true);
        bump_persistent_ttl(env, &key);
    } else {
        env.storage().persistent().remove(&key);
    }
}

pub fn is_verified_anchor(env: &Env, anchor: &Address) -> bool {
    let key = DataKey::Anchor(anchor.clone());
    let verified = env.storage().persistent().get(&key).unwrap_or(false);
    if verified {
        bump_persistent_ttl(env, &key);
    }
    verified
}

pub fn get_kyc_owner(env: &Env, nullifier: &BytesN<32>) -> Option<Address> {
    let key = DataKey::KycNullifier(nullifier.clone());
    let owner = env.storage().persistent().get(&key);
    if owner.is_some() {
        bump_persistent_ttl(env, &key);
    }
    owner
}

pub fn set_kyc_owner(env: &Env, nullifier: &BytesN<32>, owner: &Address) {
    let key = DataKey::KycNullifier(nullifier.clone());
    env.storage().persistent().set(&key, owner);
    bump_persistent_ttl(env, &key);
}

pub fn get_profile(env: &Env, borrower: &Address) -> BorrowerProfile {
    let key = DataKey::Profile(borrower.clone());
    if let Some(profile) = env.storage().persistent().get(&key) {
        bump_persistent_ttl(env, &key);
        profile
    } else {
        BorrowerProfile {
            is_kyc_verified: false,
            kyc_nullifier: BytesN::from_array(env, &[0u8; 32]),
            verified_cycles: 0,
            ema_inflow: 0,
            recent_inflows: Vec::new(env),
            total_received: 0,
            last_remittance_ts: 0,
            last_repaid_ts: 0,
            needs_clean_cycle: false,
            loans_repaid_count: 0,
            credit_tier: 0,
            has_defaulted: false,
            defaulted_debt_owed: 0,
        }
    }
}

pub fn set_profile(env: &Env, borrower: &Address, profile: &BorrowerProfile) {
    let key = DataKey::Profile(borrower.clone());
    env.storage().persistent().set(&key, profile);
    bump_persistent_ttl(env, &key);
}

pub fn get_loan(env: &Env, borrower: &Address) -> Option<LoanRecord> {
    let key = DataKey::Loan(borrower.clone());
    let loan = env.storage().persistent().get(&key);
    if loan.is_some() {
        bump_persistent_ttl(env, &key);
    }
    loan
}

pub fn set_loan(env: &Env, borrower: &Address, loan: &LoanRecord) {
    let key = DataKey::Loan(borrower.clone());
    env.storage().persistent().set(&key, loan);
    bump_persistent_ttl(env, &key);
}

pub fn get_lp_shares(env: &Env, provider: &Address) -> i128 {
    let key = DataKey::LpShares(provider.clone());
    let shares = env.storage().persistent().get(&key).unwrap_or(0);
    if shares > 0 {
        bump_persistent_ttl(env, &key);
    }
    shares
}

pub fn set_lp_shares(env: &Env, provider: &Address, shares: i128) {
    let key = DataKey::LpShares(provider.clone());
    if shares > 0 {
        env.storage().persistent().set(&key, &shares);
        bump_persistent_ttl(env, &key);
    } else {
        env.storage().persistent().remove(&key);
    }
}

pub fn get_lp_principal(env: &Env, provider: &Address) -> i128 {
    let key = DataKey::LpPrincipal(provider.clone());
    let principal = env.storage().persistent().get(&key).unwrap_or(0);
    if principal > 0 {
        bump_persistent_ttl(env, &key);
    }
    principal
}

pub fn set_lp_principal(env: &Env, provider: &Address, principal: i128) {
    let key = DataKey::LpPrincipal(provider.clone());
    if principal > 0 {
        env.storage().persistent().set(&key, &principal);
        bump_persistent_ttl(env, &key);
    } else {
        env.storage().persistent().remove(&key);
    }
}
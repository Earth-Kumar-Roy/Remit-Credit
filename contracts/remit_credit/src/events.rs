use soroban_sdk::{contractevent, Address, BytesN};

/// Emitted when a whitelisted SEP-12 Anchor binds a verified human identity nullifier to a wallet.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KycVerified {
    #[topic]
    pub beneficiary: Address,
    #[topic]
    pub anchor: Address,
    pub kyc_nullifier: BytesN<32>,
}

/// Emitted whenever a remittance routes through the protocol (either atomic `send_remittance` or `deposit_remittance`).
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RemittanceLogged {
    #[topic]
    pub beneficiary: Address,
    #[topic]
    pub sender: Address,
    pub gross_amount: i128,
    pub remit_fee: i128,
    pub net_amount: i128,
    pub new_ema_inflow: i128,
    pub verified_cycles: u32,
    pub credit_tier: u32,
}

/// Emitted when the 2% capped remittance fee is routed directly into the First-Loss Backstop Reserve.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RemitFeeCollected {
    #[topic]
    pub beneficiary: Address,
    pub fee_amount: i128,
    pub new_backstop_reserve: i128,
}

/// Emitted when an active loan triggers an atomic waterfall repayment split on a net incoming remittance.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct WaterfallRepaid {
    #[topic]
    pub beneficiary: Address,
    pub repaid_to_pool: i128,
    pub forwarded_to_user: i128,
    pub remaining_debt: i128,
    pub loan_closed: bool,
}

/// Emitted when a borrower directly repays part or all of their active loan from their wallet.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DirectRepaid {
    #[topic]
    pub beneficiary: Address,
    pub repaid_amount: i128,
    pub remaining_debt: i128,
    pub loan_closed: bool,
}

/// Emitted when an eligible borrower draws an uncollateralized stablecoin loan.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanDisbursed {
    #[topic]
    pub beneficiary: Address,
    pub principal: i128,
    pub total_owed: i128,
    pub due_at: u64,
    pub period_duration_secs: u64,
    pub credit_tier: u32,
}

/// Emitted when an overdue loan accrues a late period strike (1..=5) without yet reaching ban.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OverdueStrikeAdded {
    #[topic]
    pub beneficiary: Address,
    pub late_periods: u32,
    pub new_total_owed: i128,
    pub new_remaining_balance: i128,
    pub next_due_at: u64,
}

/// Emitted when an overdue loan hits 6 overdue strikes and suspends the borrower & SEP-12 ID.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanDefaulted {
    #[topic]
    pub beneficiary: Address,
    pub unpaid_principal: i128,
    pub backstop_covered: i128,
    pub defaulted_debt_owed: i128,
}

/// Emitted when a banned borrower pays their defaulted debt + 50% penalty to lift the ban and reset to Tier 0.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct AccountRehabilitated {
    #[topic]
    pub beneficiary: Address,
    pub debt_cleared: i128,
    pub penalty_paid: i128,
    pub lp_reimbursed: i128,
    pub total_to_backstop: i128,
}

/// Emitted when a Liquidity Provider deposits or withdraws USDC from the pool.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LiquidityUpdated {
    #[topic]
    pub provider: Address,
    pub is_deposit: bool,
    pub asset_amount: i128,
    pub shares_delta: i128,
}
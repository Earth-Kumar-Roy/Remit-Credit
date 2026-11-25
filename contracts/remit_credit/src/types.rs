use soroban_sdk::{contracttype, Address, BytesN, Vec};

/// Global protocol configuration and risk parameters stored in Instance storage.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProtocolConfig {
    /// Protocol administrator address (manages anchor whitelist, duration, & emergency pause)
    pub admin: Address,
    /// Stellar Asset Contract (SAC) address for the settlement stablecoin (e.g., USDC)
    pub token: Address,
    /// Minimum number of verified remittance cycles before Tier-1 borrowing unlocks (e.g., 3)
    pub min_cycles_required: u32,
    /// Minimum time gap (in seconds) between counted remittance cycles to block rapid wash-trading
    pub min_cycle_interval_secs: u64,
    /// Cooldown in seconds required after closing a loan before opening a new one (prevents flash-cycling)
    pub post_repay_cooldown_secs: u64,
    /// Remittance protocol fee in basis points (200 = 2.0%) routed to the Backstop Reserve
    pub remit_fee_bps: u32,
    /// Maximum remittance protocol fee in stroops (150_000_000 = 15.00 USDC)
    pub remit_fee_cap: i128,
    /// Percentage of loan's total_owed deducted on on-time remittance waterfall (4000 = 40%)
    pub waterfall_split_bps: u32,
    /// Base origination/interest fee per loan period, in basis points (250 = 2.5%)
    pub loan_fee_bps: u32,
    /// Share of realized loan fee yield routed to the First-Loss Backstop Reserve (2000 = 20%)
    pub backstop_fee_bps: u32,
    /// Hard maximum principal ceiling (in stroops) for Tier 1 borrowers (50 USDC = 500_000_000)
    pub tier_1_cap: i128,
    /// Hard maximum principal ceiling (in stroops) for Tier 2 borrowers (100 USDC = 1_000_000_000)
    pub tier_2_cap: i128,
    /// Hard maximum principal ceiling (in stroops) for Tier 3 borrowers (200 USDC = 2_000_000_000)
    pub tier_3_cap: i128,
    /// Hard maximum principal ceiling (in stroops) for Tier 4 Max borrowers (400 USDC = 4_000_000_000)
    pub tier_4_cap: i128,
    /// Default loan period duration in seconds (e.g., 180s = 3 mins for testing, 2_592_000s = 30 days for mainnet)
    pub loan_duration_secs: u64,
    /// Emergency circuit breaker flag
    pub is_paused: bool,
}

/// Global Liquidity Pool state tracking total LP deposits, outstanding debt, shares, uncovered LP losses, and backstop reserve.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolState {
    /// Total LP USDC liquidity available + currently lent out (in stroops, 10^7 = 1 USDC)
    pub total_assets: i128,
    /// Total LP shares issued across all liquidity providers
    pub total_shares: i128,
    /// Total principal currently lent out to borrowers
    pub total_principal_lent: i128,
    /// Cumulative yield earned by LPs from loan fees
    pub total_yield_earned: i128,
    /// First-Loss Backstop Reserve balance (in stroops) funded by 2% remit fees + 20% loan fee cut + default cures
    pub backstop_reserve: i128,
    /// Uncovered principal loss absorbed by LPs when backstop_reserve was insufficient during a default;
    /// reimbursed to `total_assets` first when a defaulted borrower rehabilitates their account.
    pub uncovered_lp_loss: i128,
}

/// Individual Liquidity Provider position tracking shares and net principal supplied.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LpPosition {
    /// LP pool shares held by the provider
    pub shares: i128,
    /// Net principal USDC supplied by the provider (deposits minus principal portion withdrawn)
    pub net_deposited: i128,
}

/// On-chain cash-flow credit and SEP-12 identity profile for an individual remittance recipient.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BorrowerProfile {
    /// True once a whitelisted SEP-12 Anchor registers the user's salted identity nullifier
    pub is_kyc_verified: bool,
    /// Salted 32-byte identity nullifier binding 1 human identity to 1 Stellar wallet
    pub kyc_nullifier: BytesN<32>,
    /// Total number of verified remittance cycles completed
    pub verified_cycles: u32,
    /// Rolling average (in stroops) of up to the last 8 verified net remittances
    pub ema_inflow: i128,
    /// Sliding window of up to the last 8 verified net remittance inflows (in stroops)
    pub recent_inflows: Vec<i128>,
    /// Cumulative verified remittance volume received all-time (in stroops)
    pub total_received: i128,
    /// Ledger timestamp (seconds) of the last counted remittance cycle
    pub last_remittance_ts: u64,
    /// Ledger timestamp (seconds) when the borrower last closed a loan (0 if none)
    pub last_repaid_ts: u64,
    /// True if the borrower repaid their previous loan late and must complete 1 clean remittance cycle before borrowing again
    pub needs_clean_cycle: bool,
    /// Number of loans repaid in full
    pub loans_repaid_count: u32,
    /// Current credit tier (0 = Locked, 1 = $50, 2 = $100, 3 = $200, 4 = $400 Max)
    pub credit_tier: u32,
    /// True if borrower is currently banned after reaching 6 overdue strike periods
    pub has_defaulted: bool,
    /// Unpaid loan balance (in stroops) recorded at default; borrower must pay this + 50% penalty to lift ban
    pub defaulted_debt_owed: i128,
}

/// Active undercollateralized loan record for a borrower.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct LoanRecord {
    /// Original principal disbursed to the borrower (in stroops)
    pub principal: i128,
    /// Total amount owed including initial fee + any accrued overdue period penalties (in stroops)
    pub total_owed: i128,
    /// Remaining unpaid balance (in stroops)
    pub remaining_balance: i128,
    /// Ledger timestamp when the loan was disbursed
    pub disbursed_at: u64,
    /// Strict ledger timestamp deadline for the current period
    pub due_at: u64,
    /// Borrower-selected period duration in seconds (120s..=2_592_000s) used for due_at and overdue intervals
    pub period_duration_secs: u64,
    /// Number of overdue periods elapsed past initial maturity (0..=6; 6 strikes = ban)
    pub late_periods: u32,
    /// Whether this loan is currently active
    pub is_active: bool,
    /// Whether this loan reached 6 overdue strikes and triggered default ban
    pub is_defaulted: bool,
}

/// Storage keys separating global Instance data from per-user Persistent ledger entries.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Global ProtocolConfig (Instance storage)
    Config,
    /// Global PoolState (Instance storage)
    Pool,
    /// Whitelisted Anchor Distributor address -> bool (Persistent storage)
    Anchor(Address),
    /// Salted SEP-12 KYC Nullifier -> bound Address (Persistent storage)
    KycNullifier(BytesN<32>),
    /// Borrower wallet address -> BorrowerProfile (Persistent storage)
    Profile(Address),
    /// Borrower wallet address -> LoanRecord (Persistent storage)
    Loan(Address),
    /// Liquidity Provider wallet address -> LP share balance i128 (Persistent storage)
    LpShares(Address),
    /// Liquidity Provider wallet address -> net principal supplied i128 (Persistent storage)
    LpPrincipal(Address),
}
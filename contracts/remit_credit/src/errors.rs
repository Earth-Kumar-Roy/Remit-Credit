use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RemitError {
    /// Contract has already been initialized
    AlreadyInitialized = 1,
    /// Contract has not been initialized yet
    NotInitialized = 2,
    /// Protocol operations are currently paused by admin circuit breaker
    ProtocolPaused = 3,
    /// Caller is not authorized for this administrative or role-gated action
    Unauthorized = 4,
    /// Sender is not a whitelisted remittance anchor or verified distributor
    UnverifiedAnchor = 5,
    /// Deposit, borrow, or liquidity amount must be strictly greater than zero
    InvalidAmount = 6,
    /// Configuration parameter (basis points, split ratio, or tier cap) is out of bounds
    InvalidParameter = 7,
    /// Borrower has not completed the minimum verified remittance cycles required to borrow
    InsufficientCreditHistory = 8,
    /// Borrower already has an active unpaid loan (single active loan per cycle enforced)
    ActiveLoanExists = 9,
    /// Requested loan exceeds the borrower's calculated cash-flow credit ceiling or tier hard cap
    ExceedsCreditLimit = 10,
    /// Liquidity pool does not have enough available USDC to fund the loan or pro-rata LP withdrawal
    InsufficientPoolLiquidity = 11,
    /// Borrower has no active loan or defaulted balance to repay
    NoActiveLoan = 12,
    /// Integer arithmetic overflow or underflow occurred
    MathOverflow = 13,
    /// Borrower has not completed SEP-12 KYC identity verification
    KycNotVerified = 14,
    /// This SEP-12 identity nullifier is already bound to another wallet (Sybil prevention)
    DuplicateIdentity = 15,
    /// Active loan has not yet passed its current period due deadline
    LoanNotOverdue = 16,
    /// Borrower is suspended due to hitting 6 overdue strike periods
    BorrowerDefaulted = 17,
    /// Post-repayment cooldown is still active before opening a new loan
    CooldownActive = 18,
    /// Borrower repaid their previous loan late and must complete 1 clean remittance cycle first
    CleanCycleRequired = 19,
    /// Caller holds active liquidity in the LP vault and must withdraw it before drawing a loan
    ActiveLpPositionExists = 20,
    /// Requested loan term duration must be between 120s (2 mins) and 2_592_000s (30 days)
    InvalidLoanDuration = 21,
}
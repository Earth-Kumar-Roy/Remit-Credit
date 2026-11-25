import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CCYM5NCI5BJM7KDMJD6XQDZCMIMG4SUA5POIA4U2LOEU2RXQPJTEGJ7Y",
  }
} as const


/**
 * Global Liquidity Pool state tracking total LP deposits, outstanding debt, and LP shares.
 */
export interface PoolState {
  /**
 * Total USDC liquidity available + currently lent out (in stroops, 10^7 = 1 USDC)
 */
total_assets: i128;
  /**
 * Total principal currently lent out to borrowers
 */
total_principal_lent: i128;
  /**
 * Total LP shares issued across all liquidity providers
 */
total_shares: i128;
  /**
 * Cumulative yield earned from loan fees
 */
total_yield_earned: i128;
}


/**
 * Active undercollateralized loan record for a borrower.
 */
export interface LoanRecord {
  /**
 * Ledger timestamp when the loan was disbursed
 */
disbursed_at: u64;
  /**
 * Whether this loan is currently active
 */
is_active: boolean;
  /**
 * Original principal disbursed to the borrower (in stroops)
 */
principal: i128;
  /**
 * Remaining unpaid balance (in stroops)
 */
remaining_balance: i128;
  /**
 * Total amount owed including flat fee (principal + fee, in stroops)
 */
total_owed: i128;
}


/**
 * Global protocol configuration and risk parameters stored in Instance storage.
 */
export interface ProtocolConfig {
  /**
 * Protocol administrator address (manages anchor whitelist & emergency pause)
 */
admin: string;
  /**
 * Emergency circuit breaker flag
 */
is_paused: boolean;
  /**
 * Flat origination/interest fee applied to loans, in basis points (e.g., 250 = 2.5%)
 */
loan_fee_bps: u32;
  /**
 * Minimum time gap (in seconds) between counted remittance cycles to block rapid wash-trading
 */
min_cycle_interval_secs: u64;
  /**
 * Minimum number of verified remittance cycles before Tier-1 borrowing unlocks (e.g., 3)
 */
min_cycles_required: u32;
  /**
 * Stellar Asset Contract (SAC) address for the settlement stablecoin (e.g., USDC)
 */
token: string;
  /**
 * Percentage of incoming remittance routed to repay active debt, in basis points (e.g., 4000 = 40%)
 */
waterfall_split_bps: u32;
}


/**
 * On-chain cash-flow credit profile for an individual remittance recipient.
 */
export interface BorrowerProfile {
  /**
 * Current credit tier (0 = Locked, 1 = 35% of EMA, 2 = 50% of EMA, 3 = 65% of EMA)
 */
credit_tier: u32;
  /**
 * Exponential Moving Average (EMA) of verified remittance inflows (in stroops)
 */
ema_inflow: i128;
  /**
 * Ledger timestamp (seconds) of the last counted remittance cycle
 */
last_remittance_ts: u64;
  /**
 * Number of loans repaid in full via waterfall splits
 */
loans_repaid_count: u32;
  /**
 * Cumulative verified remittance volume received all-time (in stroops)
 */
total_received: i128;
  /**
 * Total number of verified remittance deposits received
 */
verified_cycles: u32;
}

export const RemitError = {
  /**
   * Contract has already been initialized
   */
  1: {message:"AlreadyInitialized"},
  /**
   * Contract has not been initialized yet
   */
  2: {message:"NotInitialized"},
  /**
   * Protocol operations are currently paused by admin circuit breaker
   */
  3: {message:"ProtocolPaused"},
  /**
   * Caller is not authorized for this administrative or role-gated action
   */
  4: {message:"Unauthorized"},
  /**
   * Sender is not a whitelisted remittance anchor or verified distributor
   */
  5: {message:"UnverifiedAnchor"},
  /**
   * Deposit, borrow, or liquidity amount must be strictly greater than zero
   */
  6: {message:"InvalidAmount"},
  /**
   * Configuration parameter (basis points, split ratio, or tier cap) is out of bounds
   */
  7: {message:"InvalidParameter"},
  /**
   * Borrower has not completed the minimum verified remittance cycles required to borrow
   */
  8: {message:"InsufficientCreditHistory"},
  /**
   * Borrower already has an active unpaid loan (single active loan per cycle enforced)
   */
  9: {message:"ActiveLoanExists"},
  /**
   * Requested loan exceeds the borrower's calculated cash-flow credit ceiling
   */
  10: {message:"ExceedsCreditLimit"},
  /**
   * Liquidity pool does not have enough available USDC to fund the loan or LP withdrawal
   */
  11: {message:"InsufficientPoolLiquidity"},
  /**
   * Borrower has no active loan to repay
   */
  12: {message:"NoActiveLoan"},
  /**
   * Integer arithmetic overflow or underflow occurred
   */
  13: {message:"MathOverflow"}
}





export interface Client {
  /**
   * Construct and simulate a borrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Eligible borrower draws an undercollateralized stablecoin loan up to their credit ceiling.
   */
  borrow: ({beneficiary, principal}: {beneficiary: string, principal: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<LoanRecord>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initializes the RemitCredit protocol once with risk parameters and settlement USDC SAC.
   */
  initialize: ({admin, token, min_cycles_required, min_cycle_interval_secs, waterfall_split_bps, loan_fee_bps}: {admin: string, token: string, min_cycles_required: u32, min_cycle_interval_secs: u64, waterfall_split_bps: u32, loan_fee_bps: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_anchor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin function to whitelist or revoke a verified remittance anchor / distributor address.
   */
  set_anchor: ({anchor, is_verified}: {anchor: string, is_verified: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Admin emergency circuit breaker to pause or unpause borrowing and deposits.
   */
  set_paused: ({is_paused}: {is_paused: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a check_anchor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  check_anchor: ({anchor}: {anchor: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_pool_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pool_state: (options?: MethodOptions) => Promise<AssembledTransaction<Result<PoolState>>>

  /**
   * Construct and simulate a get_active_loan transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_active_loan: ({borrower}: {borrower: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<LoanRecord>>>

  /**
   * Construct and simulate a provide_liquidity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Liquidity Providers deposit settlement stablecoins (USDC) into the pool to earn yield.
   */
  provide_liquidity: ({provider, amount}: {provider: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a deposit_remittance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Core entry point: Verified Anchor routes a cross-border remittance to a beneficiary.
   * Logs cash-flow credit metrics and atomically executes waterfall debt repayment if active.
   */
  deposit_remittance: ({anchor, beneficiary, amount}: {anchor: string, beneficiary: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a extend_account_ttl transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Keeper / maintenance method to extend ledger TTL for active borrower profiles and loans.
   */
  extend_account_ttl: ({borrower}: {borrower: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_borrower_limit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_borrower_limit: ({borrower}: {borrower: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a withdraw_liquidity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Liquidity Providers burn shares to withdraw available principal + accrued fee yield.
   */
  withdraw_liquidity: ({provider, shares_to_burn}: {provider: string, shares_to_burn: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<i128>>>

  /**
   * Construct and simulate a get_protocol_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_protocol_config: (options?: MethodOptions) => Promise<AssembledTransaction<Result<ProtocolConfig>>>

  /**
   * Construct and simulate a get_provider_shares transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_provider_shares: ({provider}: {provider: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a get_borrower_profile transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_borrower_profile: ({borrower}: {borrower: string}, options?: MethodOptions) => Promise<AssembledTransaction<BorrowerProfile>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAFpFbGlnaWJsZSBib3Jyb3dlciBkcmF3cyBhbiB1bmRlcmNvbGxhdGVyYWxpemVkIHN0YWJsZWNvaW4gbG9hbiB1cCB0byB0aGVpciBjcmVkaXQgY2VpbGluZy4AAAAAAAZib3Jyb3cAAAAAAAIAAAAAAAAAC2JlbmVmaWNpYXJ5AAAAABMAAAAAAAAACXByaW5jaXBhbAAAAAAAAAsAAAABAAAD6QAAB9AAAAAKTG9hblJlY29yZAAAAAAH0AAAAApSZW1pdEVycm9yAAA=",
        "AAAAAAAAAFdJbml0aWFsaXplcyB0aGUgUmVtaXRDcmVkaXQgcHJvdG9jb2wgb25jZSB3aXRoIHJpc2sgcGFyYW1ldGVycyBhbmQgc2V0dGxlbWVudCBVU0RDIFNBQy4AAAAACmluaXRpYWxpemUAAAAAAAYAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAAAAABNtaW5fY3ljbGVzX3JlcXVpcmVkAAAAAAQAAAAAAAAAF21pbl9jeWNsZV9pbnRlcnZhbF9zZWNzAAAAAAYAAAAAAAAAE3dhdGVyZmFsbF9zcGxpdF9icHMAAAAABAAAAAAAAAAMbG9hbl9mZWVfYnBzAAAABAAAAAEAAAPpAAAAAgAAB9AAAAAKUmVtaXRFcnJvcgAA",
        "AAAAAAAAAFlBZG1pbiBmdW5jdGlvbiB0byB3aGl0ZWxpc3Qgb3IgcmV2b2tlIGEgdmVyaWZpZWQgcmVtaXR0YW5jZSBhbmNob3IgLyBkaXN0cmlidXRvciBhZGRyZXNzLgAAAAAAAApzZXRfYW5jaG9yAAAAAAACAAAAAAAAAAZhbmNob3IAAAAAABMAAAAAAAAAC2lzX3ZlcmlmaWVkAAAAAAEAAAABAAAD6QAAAAIAAAfQAAAAClJlbWl0RXJyb3IAAA==",
        "AAAAAAAAAEtBZG1pbiBlbWVyZ2VuY3kgY2lyY3VpdCBicmVha2VyIHRvIHBhdXNlIG9yIHVucGF1c2UgYm9ycm93aW5nIGFuZCBkZXBvc2l0cy4AAAAACnNldF9wYXVzZWQAAAAAAAEAAAAAAAAACWlzX3BhdXNlZAAAAAAAAAEAAAABAAAD6QAAAAIAAAfQAAAAClJlbWl0RXJyb3IAAA==",
        "AAAAAAAAAAAAAAAMY2hlY2tfYW5jaG9yAAAAAQAAAAAAAAAGYW5jaG9yAAAAAAATAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAOZ2V0X3Bvb2xfc3RhdGUAAAAAAAAAAAABAAAD6QAAB9AAAAAJUG9vbFN0YXRlAAAAAAAH0AAAAApSZW1pdEVycm9yAAA=",
        "AAAAAAAAAAAAAAAPZ2V0X2FjdGl2ZV9sb2FuAAAAAAEAAAAAAAAACGJvcnJvd2VyAAAAEwAAAAEAAAPoAAAH0AAAAApMb2FuUmVjb3JkAAA=",
        "AAAAAAAAAFZMaXF1aWRpdHkgUHJvdmlkZXJzIGRlcG9zaXQgc2V0dGxlbWVudCBzdGFibGVjb2lucyAoVVNEQykgaW50byB0aGUgcG9vbCB0byBlYXJuIHlpZWxkLgAAAAAAEXByb3ZpZGVfbGlxdWlkaXR5AAAAAAAAAgAAAAAAAAAIcHJvdmlkZXIAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAABAAAD6QAAAAsAAAfQAAAAClJlbWl0RXJyb3IAAA==",
        "AAAAAAAAAK5Db3JlIGVudHJ5IHBvaW50OiBWZXJpZmllZCBBbmNob3Igcm91dGVzIGEgY3Jvc3MtYm9yZGVyIHJlbWl0dGFuY2UgdG8gYSBiZW5lZmljaWFyeS4KTG9ncyBjYXNoLWZsb3cgY3JlZGl0IG1ldHJpY3MgYW5kIGF0b21pY2FsbHkgZXhlY3V0ZXMgd2F0ZXJmYWxsIGRlYnQgcmVwYXltZW50IGlmIGFjdGl2ZS4AAAAAABJkZXBvc2l0X3JlbWl0dGFuY2UAAAAAAAMAAAAAAAAABmFuY2hvcgAAAAAAEwAAAAAAAAALYmVuZWZpY2lhcnkAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAQAAA+kAAAALAAAH0AAAAApSZW1pdEVycm9yAAA=",
        "AAAAAAAAAFhLZWVwZXIgLyBtYWludGVuYW5jZSBtZXRob2QgdG8gZXh0ZW5kIGxlZGdlciBUVEwgZm9yIGFjdGl2ZSBib3Jyb3dlciBwcm9maWxlcyBhbmQgbG9hbnMuAAAAEmV4dGVuZF9hY2NvdW50X3R0bAAAAAAAAQAAAAAAAAAIYm9ycm93ZXIAAAATAAAAAQAAA+kAAAACAAAH0AAAAApSZW1pdEVycm9yAAA=",
        "AAAAAAAAAAAAAAASZ2V0X2JvcnJvd2VyX2xpbWl0AAAAAAABAAAAAAAAAAhib3Jyb3dlcgAAABMAAAABAAAD6QAAAAsAAAfQAAAAClJlbWl0RXJyb3IAAA==",
        "AAAAAAAAAFRMaXF1aWRpdHkgUHJvdmlkZXJzIGJ1cm4gc2hhcmVzIHRvIHdpdGhkcmF3IGF2YWlsYWJsZSBwcmluY2lwYWwgKyBhY2NydWVkIGZlZSB5aWVsZC4AAAASd2l0aGRyYXdfbGlxdWlkaXR5AAAAAAACAAAAAAAAAAhwcm92aWRlcgAAABMAAAAAAAAADnNoYXJlc190b19idXJuAAAAAAALAAAAAQAAA+kAAAALAAAH0AAAAApSZW1pdEVycm9yAAA=",
        "AAAAAAAAAAAAAAATZ2V0X3Byb3RvY29sX2NvbmZpZwAAAAAAAAAAAQAAA+kAAAfQAAAADlByb3RvY29sQ29uZmlnAAAAAAfQAAAAClJlbWl0RXJyb3IAAA==",
        "AAAAAAAAAAAAAAATZ2V0X3Byb3ZpZGVyX3NoYXJlcwAAAAABAAAAAAAAAAhwcm92aWRlcgAAABMAAAABAAAACw==",
        "AAAAAAAAAAAAAAAUZ2V0X2JvcnJvd2VyX3Byb2ZpbGUAAAABAAAAAAAAAAhib3Jyb3dlcgAAABMAAAABAAAH0AAAAA9Cb3Jyb3dlclByb2ZpbGUA",
        "AAAAAQAAAFhHbG9iYWwgTGlxdWlkaXR5IFBvb2wgc3RhdGUgdHJhY2tpbmcgdG90YWwgTFAgZGVwb3NpdHMsIG91dHN0YW5kaW5nIGRlYnQsIGFuZCBMUCBzaGFyZXMuAAAAAAAAAAlQb29sU3RhdGUAAAAAAAAEAAAAT1RvdGFsIFVTREMgbGlxdWlkaXR5IGF2YWlsYWJsZSArIGN1cnJlbnRseSBsZW50IG91dCAoaW4gc3Ryb29wcywgMTBeNyA9IDEgVVNEQykAAAAADHRvdGFsX2Fzc2V0cwAAAAsAAAAvVG90YWwgcHJpbmNpcGFsIGN1cnJlbnRseSBsZW50IG91dCB0byBib3Jyb3dlcnMAAAAAFHRvdGFsX3ByaW5jaXBhbF9sZW50AAAACwAAADVUb3RhbCBMUCBzaGFyZXMgaXNzdWVkIGFjcm9zcyBhbGwgbGlxdWlkaXR5IHByb3ZpZGVycwAAAAAAAAx0b3RhbF9zaGFyZXMAAAALAAAAJkN1bXVsYXRpdmUgeWllbGQgZWFybmVkIGZyb20gbG9hbiBmZWVzAAAAAAASdG90YWxfeWllbGRfZWFybmVkAAAAAAAL",
        "AAAAAQAAADZBY3RpdmUgdW5kZXJjb2xsYXRlcmFsaXplZCBsb2FuIHJlY29yZCBmb3IgYSBib3Jyb3dlci4AAAAAAAAAAAAKTG9hblJlY29yZAAAAAAABQAAACxMZWRnZXIgdGltZXN0YW1wIHdoZW4gdGhlIGxvYW4gd2FzIGRpc2J1cnNlZAAAAAxkaXNidXJzZWRfYXQAAAAGAAAAJVdoZXRoZXIgdGhpcyBsb2FuIGlzIGN1cnJlbnRseSBhY3RpdmUAAAAAAAAJaXNfYWN0aXZlAAAAAAAAAQAAADlPcmlnaW5hbCBwcmluY2lwYWwgZGlzYnVyc2VkIHRvIHRoZSBib3Jyb3dlciAoaW4gc3Ryb29wcykAAAAAAAAJcHJpbmNpcGFsAAAAAAAACwAAACVSZW1haW5pbmcgdW5wYWlkIGJhbGFuY2UgKGluIHN0cm9vcHMpAAAAAAAAEXJlbWFpbmluZ19iYWxhbmNlAAAAAAAACwAAAEJUb3RhbCBhbW91bnQgb3dlZCBpbmNsdWRpbmcgZmxhdCBmZWUgKHByaW5jaXBhbCArIGZlZSwgaW4gc3Ryb29wcykAAAAAAAp0b3RhbF9vd2VkAAAAAAAL",
        "AAAAAQAAAE1HbG9iYWwgcHJvdG9jb2wgY29uZmlndXJhdGlvbiBhbmQgcmlzayBwYXJhbWV0ZXJzIHN0b3JlZCBpbiBJbnN0YW5jZSBzdG9yYWdlLgAAAAAAAAAAAAAOUHJvdG9jb2xDb25maWcAAAAAAAcAAABLUHJvdG9jb2wgYWRtaW5pc3RyYXRvciBhZGRyZXNzIChtYW5hZ2VzIGFuY2hvciB3aGl0ZWxpc3QgJiBlbWVyZ2VuY3kgcGF1c2UpAAAAAAVhZG1pbgAAAAAAABMAAAAeRW1lcmdlbmN5IGNpcmN1aXQgYnJlYWtlciBmbGFnAAAAAAAJaXNfcGF1c2VkAAAAAAAAAQAAAFJGbGF0IG9yaWdpbmF0aW9uL2ludGVyZXN0IGZlZSBhcHBsaWVkIHRvIGxvYW5zLCBpbiBiYXNpcyBwb2ludHMgKGUuZy4sIDI1MCA9IDIuNSUpAAAAAAAMbG9hbl9mZWVfYnBzAAAABAAAAFtNaW5pbXVtIHRpbWUgZ2FwIChpbiBzZWNvbmRzKSBiZXR3ZWVuIGNvdW50ZWQgcmVtaXR0YW5jZSBjeWNsZXMgdG8gYmxvY2sgcmFwaWQgd2FzaC10cmFkaW5nAAAAABdtaW5fY3ljbGVfaW50ZXJ2YWxfc2VjcwAAAAAGAAAAVk1pbmltdW0gbnVtYmVyIG9mIHZlcmlmaWVkIHJlbWl0dGFuY2UgY3ljbGVzIGJlZm9yZSBUaWVyLTEgYm9ycm93aW5nIHVubG9ja3MgKGUuZy4sIDMpAAAAAAATbWluX2N5Y2xlc19yZXF1aXJlZAAAAAAEAAAAT1N0ZWxsYXIgQXNzZXQgQ29udHJhY3QgKFNBQykgYWRkcmVzcyBmb3IgdGhlIHNldHRsZW1lbnQgc3RhYmxlY29pbiAoZS5nLiwgVVNEQykAAAAABXRva2VuAAAAAAAAEwAAAGFQZXJjZW50YWdlIG9mIGluY29taW5nIHJlbWl0dGFuY2Ugcm91dGVkIHRvIHJlcGF5IGFjdGl2ZSBkZWJ0LCBpbiBiYXNpcyBwb2ludHMgKGUuZy4sIDQwMDAgPSA0MCUpAAAAAAAAE3dhdGVyZmFsbF9zcGxpdF9icHMAAAAABA==",
        "AAAAAQAAAElPbi1jaGFpbiBjYXNoLWZsb3cgY3JlZGl0IHByb2ZpbGUgZm9yIGFuIGluZGl2aWR1YWwgcmVtaXR0YW5jZSByZWNpcGllbnQuAAAAAAAAAAAAAA9Cb3Jyb3dlclByb2ZpbGUAAAAABgAAAFBDdXJyZW50IGNyZWRpdCB0aWVyICgwID0gTG9ja2VkLCAxID0gMzUlIG9mIEVNQSwgMiA9IDUwJSBvZiBFTUEsIDMgPSA2NSUgb2YgRU1BKQAAAAtjcmVkaXRfdGllcgAAAAAEAAAATEV4cG9uZW50aWFsIE1vdmluZyBBdmVyYWdlIChFTUEpIG9mIHZlcmlmaWVkIHJlbWl0dGFuY2UgaW5mbG93cyAoaW4gc3Ryb29wcykAAAAKZW1hX2luZmxvdwAAAAAACwAAAD9MZWRnZXIgdGltZXN0YW1wIChzZWNvbmRzKSBvZiB0aGUgbGFzdCBjb3VudGVkIHJlbWl0dGFuY2UgY3ljbGUAAAAAEmxhc3RfcmVtaXR0YW5jZV90cwAAAAAABgAAADNOdW1iZXIgb2YgbG9hbnMgcmVwYWlkIGluIGZ1bGwgdmlhIHdhdGVyZmFsbCBzcGxpdHMAAAAAEmxvYW5zX3JlcGFpZF9jb3VudAAAAAAABAAAAERDdW11bGF0aXZlIHZlcmlmaWVkIHJlbWl0dGFuY2Ugdm9sdW1lIHJlY2VpdmVkIGFsbC10aW1lIChpbiBzdHJvb3BzKQAAAA50b3RhbF9yZWNlaXZlZAAAAAAACwAAADVUb3RhbCBudW1iZXIgb2YgdmVyaWZpZWQgcmVtaXR0YW5jZSBkZXBvc2l0cyByZWNlaXZlZAAAAAAAAA92ZXJpZmllZF9jeWNsZXMAAAAABA==",
        "AAAABAAAAAAAAAAAAAAAClJlbWl0RXJyb3IAAAAAAA0AAAAlQ29udHJhY3QgaGFzIGFscmVhZHkgYmVlbiBpbml0aWFsaXplZAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAAAEAAAAlQ29udHJhY3QgaGFzIG5vdCBiZWVuIGluaXRpYWxpemVkIHlldAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAEFQcm90b2NvbCBvcGVyYXRpb25zIGFyZSBjdXJyZW50bHkgcGF1c2VkIGJ5IGFkbWluIGNpcmN1aXQgYnJlYWtlcgAAAAAAAA5Qcm90b2NvbFBhdXNlZAAAAAAAAwAAAEVDYWxsZXIgaXMgbm90IGF1dGhvcml6ZWQgZm9yIHRoaXMgYWRtaW5pc3RyYXRpdmUgb3Igcm9sZS1nYXRlZCBhY3Rpb24AAAAAAAAMVW5hdXRob3JpemVkAAAABAAAAEVTZW5kZXIgaXMgbm90IGEgd2hpdGVsaXN0ZWQgcmVtaXR0YW5jZSBhbmNob3Igb3IgdmVyaWZpZWQgZGlzdHJpYnV0b3IAAAAAAAAQVW52ZXJpZmllZEFuY2hvcgAAAAUAAABHRGVwb3NpdCwgYm9ycm93LCBvciBsaXF1aWRpdHkgYW1vdW50IG11c3QgYmUgc3RyaWN0bHkgZ3JlYXRlciB0aGFuIHplcm8AAAAADUludmFsaWRBbW91bnQAAAAAAAAGAAAAUUNvbmZpZ3VyYXRpb24gcGFyYW1ldGVyIChiYXNpcyBwb2ludHMsIHNwbGl0IHJhdGlvLCBvciB0aWVyIGNhcCkgaXMgb3V0IG9mIGJvdW5kcwAAAAAAABBJbnZhbGlkUGFyYW1ldGVyAAAABwAAAFRCb3Jyb3dlciBoYXMgbm90IGNvbXBsZXRlZCB0aGUgbWluaW11bSB2ZXJpZmllZCByZW1pdHRhbmNlIGN5Y2xlcyByZXF1aXJlZCB0byBib3Jyb3cAAAAZSW5zdWZmaWNpZW50Q3JlZGl0SGlzdG9yeQAAAAAAAAgAAABSQm9ycm93ZXIgYWxyZWFkeSBoYXMgYW4gYWN0aXZlIHVucGFpZCBsb2FuIChzaW5nbGUgYWN0aXZlIGxvYW4gcGVyIGN5Y2xlIGVuZm9yY2VkKQAAAAAAEEFjdGl2ZUxvYW5FeGlzdHMAAAAJAAAASVJlcXVlc3RlZCBsb2FuIGV4Y2VlZHMgdGhlIGJvcnJvd2VyJ3MgY2FsY3VsYXRlZCBjYXNoLWZsb3cgY3JlZGl0IGNlaWxpbmcAAAAAAAASRXhjZWVkc0NyZWRpdExpbWl0AAAAAAAKAAAAVExpcXVpZGl0eSBwb29sIGRvZXMgbm90IGhhdmUgZW5vdWdoIGF2YWlsYWJsZSBVU0RDIHRvIGZ1bmQgdGhlIGxvYW4gb3IgTFAgd2l0aGRyYXdhbAAAABlJbnN1ZmZpY2llbnRQb29sTGlxdWlkaXR5AAAAAAAACwAAACRCb3Jyb3dlciBoYXMgbm8gYWN0aXZlIGxvYW4gdG8gcmVwYXkAAAAMTm9BY3RpdmVMb2FuAAAADAAAADFJbnRlZ2VyIGFyaXRobWV0aWMgb3ZlcmZsb3cgb3IgdW5kZXJmbG93IG9jY3VycmVkAAAAAAAADE1hdGhPdmVyZmxvdwAAAA0=",
        "AAAABQAAAExFbWl0dGVkIHdoZW4gYW4gZWxpZ2libGUgYm9ycm93ZXIgZHJhd3MgYW4gdW5jb2xsYXRlcmFsaXplZCBzdGFibGVjb2luIGxvYW4uAAAAAAAAAA1Mb2FuRGlzYnVyc2VkAAAAAAAAAQAAAA5sb2FuX2Rpc2J1cnNlZAAAAAAABAAAAAAAAAALYmVuZWZpY2lhcnkAAAAAEwAAAAEAAAAAAAAACXByaW5jaXBhbAAAAAAAAAsAAAAAAAAAAAAAAAp0b3RhbF9vd2VkAAAAAAALAAAAAAAAAAAAAAALY3JlZGl0X3RpZXIAAAAABAAAAAAAAAAC",
        "AAAABQAAAGNFbWl0dGVkIHdoZW4gYW4gYWN0aXZlIGxvYW4gdHJpZ2dlcnMgYW4gYXRvbWljIHdhdGVyZmFsbCByZXBheW1lbnQgc3BsaXQgb24gYW4gaW5jb21pbmcgcmVtaXR0YW5jZS4AAAAAAAAAAA9XYXRlcmZhbGxSZXBhaWQAAAAAAQAAABB3YXRlcmZhbGxfcmVwYWlkAAAABQAAAAAAAAALYmVuZWZpY2lhcnkAAAAAEwAAAAEAAAAAAAAADnJlcGFpZF90b19wb29sAAAAAAALAAAAAAAAAAAAAAARZm9yd2FyZGVkX3RvX3VzZXIAAAAAAAALAAAAAAAAAAAAAAAOcmVtYWluaW5nX2RlYnQAAAAAAAsAAAAAAAAAAAAAAAtsb2FuX2Nsb3NlZAAAAAABAAAAAAAAAAI=",
        "AAAABQAAAEtFbWl0dGVkIHdoZW4gYSBMaXF1aWRpdHkgUHJvdmlkZXIgZGVwb3NpdHMgb3Igd2l0aGRyYXdzIFVTREMgZnJvbSB0aGUgcG9vbC4AAAAAAAAAABBMaXF1aWRpdHlVcGRhdGVkAAAAAQAAABFsaXF1aWRpdHlfdXBkYXRlZAAAAAAAAAQAAAAAAAAACHByb3ZpZGVyAAAAEwAAAAEAAAAAAAAACmlzX2RlcG9zaXQAAAAAAAEAAAAAAAAAAAAAAAxhc3NldF9hbW91bnQAAAALAAAAAAAAAAAAAAAMc2hhcmVzX2RlbHRhAAAACwAAAAAAAAAC",
        "AAAABQAAAFZFbWl0dGVkIHdoZW5ldmVyIGEgdmVyaWZpZWQgYW5jaG9yIHJvdXRlcyBhIGNyb3NzLWJvcmRlciByZW1pdHRhbmNlIGludG8gdGhlIHByb3RvY29sLgAAAAAAAAAAABBSZW1pdHRhbmNlTG9nZ2VkAAAAAQAAABFyZW1pdHRhbmNlX2xvZ2dlZAAAAAAAAAYAAAAAAAAAC2JlbmVmaWNpYXJ5AAAAABMAAAABAAAAAAAAAAZhbmNob3IAAAAAABMAAAABAAAAAAAAAAx0b3RhbF9hbW91bnQAAAALAAAAAAAAAAAAAAAObmV3X2VtYV9pbmZsb3cAAAAAAAsAAAAAAAAAAAAAAA92ZXJpZmllZF9jeWNsZXMAAAAABAAAAAAAAAAAAAAAC2NyZWRpdF90aWVyAAAAAAQAAAAAAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    borrow: this.txFromJSON<Result<LoanRecord>>,
        initialize: this.txFromJSON<Result<void>>,
        set_anchor: this.txFromJSON<Result<void>>,
        set_paused: this.txFromJSON<Result<void>>,
        check_anchor: this.txFromJSON<boolean>,
        get_pool_state: this.txFromJSON<Result<PoolState>>,
        get_active_loan: this.txFromJSON<Option<LoanRecord>>,
        provide_liquidity: this.txFromJSON<Result<i128>>,
        deposit_remittance: this.txFromJSON<Result<i128>>,
        extend_account_ttl: this.txFromJSON<Result<void>>,
        get_borrower_limit: this.txFromJSON<Result<i128>>,
        withdraw_liquidity: this.txFromJSON<Result<i128>>,
        get_protocol_config: this.txFromJSON<Result<ProtocolConfig>>,
        get_provider_shares: this.txFromJSON<i128>,
        get_borrower_profile: this.txFromJSON<BorrowerProfile>
  }
}
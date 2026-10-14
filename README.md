# VaultLend — Protocol Design Specification

**Version:** 0.1.0  
**Status:** Initial design — not production-ready

## 1. Protocol Overview

VaultLend is a non-custodial, overcollateralized DeFi lending protocol. Users deposit WETH as collateral and borrow USDC against it. The protocol uses an external price oracle to calculate collateral value, borrowing capacity, and liquidation eligibility.

**Initial scope:** A single collateral asset (WETH), a single borrow asset (USDC), a prefunded USDC liquidity pool, and a Chainlink-compatible price feed.

## 2. Supported Assets

| Parameter | Initial configuration |
|---|---|
| Collateral asset | WETH (Wrapped Ether) |
| Borrow asset | USDC (USD Coin) |
| Collateral price feed | WETH/USD Chainlink-compatible oracle |
| Network | Local Anvil for development; testnet to be selected |
| Token standard | ERC-20 |

The initial implementation will use mock tokens and a mock price feed for deterministic local tests before integrating real external contracts.

## 3. Risk Parameters

| Parameter | Initial value | Purpose |
|---|---:|---|
| Maximum loan-to-value (LTV) | 75% | Limits initial borrowing capacity |
| Liquidation threshold | 80% | Defines when a position becomes eligible for liquidation |
| Liquidation bonus | 5% | Incentivizes liquidators to repay eligible debt |
| Interest rate | 5% simple annual rate | Initial educational interest model |
| Minimum borrow amount | To be defined | Avoids uneconomically small loans |
| Oracle maximum age | To be defined | Rejects stale price data |
| Close factor | To be defined | Limits the share of debt liquidated per transaction |

These are experimental learning parameters, not audited or validated production risk settings.

## 4. Collateral and Borrowing Rules

1. Users may deposit WETH into the protocol.
2. The protocol records collateral balances by user address.
3. The protocol values collateral using a validated WETH/USD price feed.
4. Borrowing capacity is calculated as collateral value multiplied by the maximum LTV.
5. Borrowing is permitted only when the requested amount is within the user's borrowing capacity and sufficient USDC liquidity is available.
6. The protocol records debt when a loan is issued.
7. Users may borrow additional USDC only if the resulting position remains within the maximum LTV.
8. Users may withdraw collateral only if the remaining position satisfies the protocol's withdrawal safety rules.
9. Users may repay debt partially or in full.
10. The protocol must use safe ERC-20 transfer handling and appropriate decimal normalization.

## 5. Liquidation Rules

1. The protocol calculates a position's loan-to-value ratio using current validated oracle data and outstanding debt, including accrued interest.
2. A position becomes eligible for liquidation when its LTV reaches or exceeds the 80% liquidation threshold.
3. A liquidator repays an eligible portion of the borrower's debt using USDC.
4. In exchange, the liquidator receives the corresponding value of WETH plus the configured 5% liquidation bonus, subject to the close factor and available collateral.
5. Liquidation must not transfer more collateral than the borrower has deposited.
6. All debt reduction and collateral transfers must be accounted for atomically within the transaction.
7. The implementation must define rounding, dust, and insufficient-collateral behavior before liquidation is coded.

## 6. Interest and Repayment

The first version will use a simple 5% annual interest rate for educational purposes.

The implementation must define:
- The time unit used for interest accrual.
- The debt accounting model and rounding rules.
- Whether interest accrues lazily when a user interacts with the protocol.
- How partial repayments are applied to accrued interest and principal.
- How timestamps and interest calculations are tested.

The interest model will be reviewed before implementation. A fixed simple-interest model is not intended to represent a production money market.

## 7. Liquidity Model

VaultLend will initially use a prefunded USDC liquidity pool held by the lending contract.

- Borrowers can borrow only against sufficient collateral and available liquidity.
- Borrowing reduces available USDC liquidity.
- Repayment replenishes available USDC liquidity.
- The initial version will not implement lender deposits, yield distribution, or liquidity-provider shares.
- The contract must account for actual token balances and outstanding loans consistently.

## 8. Proposed Contract Architecture

- **VaultLend.sol:** Main lending contract, collateral accounting, borrowing, repayment, withdrawals, and liquidation.
- **IERC20 interfaces / token mocks:** Token interactions and local testing.
- **Price oracle interface / mock:** Collateral price retrieval and oracle validation.
- **Interest and risk calculation helpers:** Reusable calculations where separation improves clarity.
- **VaultLend.t.sol:** Unit, integration, and invariant tests.
- **VaultLend.s.sol:** Deployment scripts.

The first implementation will prioritize a small, understandable contract architecture over unnecessary contract splitting.

## 9. Initial Security Requirements

- Reject zero-value deposits, borrows, and repayments where appropriate.
- Reject borrowing beyond maximum LTV or available liquidity.
- Reject unsafe collateral withdrawals.
- Validate oracle answers, timestamps, and decimals.
- Follow checks-effects-interactions and use appropriate reentrancy protection.
- Use safe ERC-20 transfer handling.
- Prevent unauthorized configuration changes.
- Test arithmetic precision, rounding, and decimal conversions.
- Test liquidation boundaries and partial liquidations.
- Test behavior when oracle data is stale or invalid.
- Verify accounting consistency between token balances, user collateral, and debt.

## 10. Out of Scope for the MVP

- Multiple collateral assets.
- Flash loans.
- Governance and decentralized parameter voting.
- Automated yield strategies.
- Lending pools with lender shares.
- Production deployment with real funds.

## 11. Definition of Done for Protocol Design

- [ ] Asset and risk parameters documented.
- [ ] Borrowing and withdrawal conditions precisely defined.
- [ ] Interest accounting model selected.
- [ ] Liquidation formula, close factor, and rounding behavior specified.
- [ ] Oracle validation requirements documented.
- [ ] Contract architecture and responsibilities defined.
- [ ] Security invariants identified for testing.

**Important:** This document is the initial design baseline. Unresolved parameters must be finalized before the corresponding Solidity functionality is implemented.




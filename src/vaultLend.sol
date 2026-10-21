// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AggregatorV3Interface} from
    "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

contract VaultLend {
    using SafeERC20 for IERC20;

    // --------------------------------------------------
    // STATE VARIABLES
    // --------------------------------------------------

    IERC20 public immutable weth;
    IERC20 public immutable usdc;

    AggregatorV3Interface public immutable priceFeed;

    // --------------------------------------------------
    // PROTOCOL PARAMETERS
    // --------------------------------------------------

    uint256 public constant MAX_LTV_BPS = 7_500; // 75%
    uint256 public constant BPS = 10_000;
    uint256 public constant INTEREST_RATE_BPS = 500; // 5% APR
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // Educational default. Choose an appropriate value for
    // the actual Chainlink feed and network before deployment.
    uint256 public constant MAX_PRICE_AGE = 1 days;

    // --------------------------------------------------
    // USER POSITION
    // --------------------------------------------------

    struct BorrowerPosition {
        uint256 collateralAmount;   // WETH, 18 decimals
        uint256 borrowedPrincipal;   // USDC, 6 decimals
        uint256 accruedInterest;     // USDC, 6 decimals
        uint256 lastAccrualTime;
    }

    mapping(address => BorrowerPosition) public positions;

    // --------------------------------------------------
    // EVENTS
    // --------------------------------------------------

    event CollateralDeposited(address indexed user, uint256 amount);
    event Borrowed(address indexed user, uint256 amount);
    event InterestAccrued(address indexed user, uint256 interest);
    event Repaid(address indexed user, uint256 amount);
    
    // --------------------------------------------------
    // CONSTRUCTOR
    // --------------------------------------------------

    constructor(
        address wethAddress,
        address usdcAddress,
        address priceFeedAddress
    ) {
        require(wethAddress != address(0), "Invalid WETH address");
        require(usdcAddress != address(0), "Invalid USDC address");
        require(priceFeedAddress != address(0), "Invalid price feed");

        weth = IERC20(wethAddress);
        usdc = IERC20(usdcAddress);
        priceFeed = AggregatorV3Interface(priceFeedAddress);
    }

    // --------------------------------------------------
    // ORACLE: GET WETH/USD PRICE
    // --------------------------------------------------

    function getPriceFeed() public view returns (uint256) {
        (
            uint80 roundId,
            int256 price,
            ,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        require(price > 0, "Invalid price");
        require(updatedAt != 0, "Missing price timestamp");
        require(updatedAt <= block.timestamp, "Future price timestamp");

        require(
            block.timestamp - updatedAt <= MAX_PRICE_AGE,
            "Stale price"
        );

        require(answeredInRound >= roundId, "Incomplete price round");

        return uint256(price);
    }

    // --------------------------------------------------
    // COLLATERAL VALUE
    // Returns USDC-scaled value (6 decimals).
    // Assumes WETH has 18 decimals and USDC has 6.
    // --------------------------------------------------

    function getCollateralValue(address user)
        public
        view
        returns (uint256)
    {
        uint256 collateralAmount = positions[user].collateralAmount;

        if (collateralAmount == 0) {
            return 0;
        }

        uint256 price = getPriceFeed();
        uint256 feedDecimals = priceFeed.decimals();

        // Bound the exponent so the denominator is representable.
        require(feedDecimals <= 18, "Unsupported feed decimals");

        // Example:
        // 2 WETH * $2,000/WETH = $4,000
        // Return 4,000e6 to match USDC's 6-decimal units.
        return Math.mulDiv(
            collateralAmount,
            price,
            10 ** (feedDecimals + 12)
        );
    }

    // --------------------------------------------------
    // TOTAL DEBT
    // Principal + stored interest + interest since last accrual.
    // Does not modify storage.
    // --------------------------------------------------

    function getTotalDebt(address user)
        public
        view
        returns (uint256)
    {
        BorrowerPosition storage position = positions[user];

        uint256 currentInterest = 0;

        if (position.borrowedPrincipal > 0) {
            uint256 elapsedTime =
                block.timestamp - position.lastAccrualTime;

            currentInterest = Math.mulDiv(
                position.borrowedPrincipal,
                INTEREST_RATE_BPS * elapsedTime,
                BPS * SECONDS_PER_YEAR
            );
        }

        return
            position.borrowedPrincipal +
            position.accruedInterest +
            currentInterest;
    }

    // --------------------------------------------------
    // ACCRUE INTEREST
    // Calculates interest and saves it to storage.
    // --------------------------------------------------

    function _accrueInterest(address user) internal {
        BorrowerPosition storage position = positions[user];

        if (position.borrowedPrincipal == 0) {
            position.lastAccrualTime = block.timestamp;
            return;
        }

        uint256 elapsedTime =
            block.timestamp - position.lastAccrualTime;

        if (elapsedTime == 0) {
            return;
        }

        uint256 interest = Math.mulDiv(
            position.borrowedPrincipal,
            INTEREST_RATE_BPS * elapsedTime,
            BPS * SECONDS_PER_YEAR
        );

        position.accruedInterest += interest;
        position.lastAccrualTime = block.timestamp;

        emit InterestAccrued(user, interest);
    }

    // --------------------------------------------------
    // DEPOSIT WETH COLLATERAL
    // User must approve this contract to spend their WETH.
    // --------------------------------------------------

    function depositCollateral(uint256 amount) public {
        require(amount > 0, "Amount must be greater than zero");

        weth.safeTransferFrom(msg.sender, address(this), amount);

        positions[msg.sender].collateralAmount += amount;

        emit CollateralDeposited(msg.sender, amount);
    }

    // --------------------------------------------------
    // MAXIMUM ADDITIONAL BORROWING
    // Limited by LTV, current debt and available USDC.
    // --------------------------------------------------

    function maxBorrowAmount(address user)
        public
        view
        returns (uint256)
    {
        uint256 collateralValue = getCollateralValue(user);

        uint256 maxTotalDebt = Math.mulDiv(
            collateralValue,
            MAX_LTV_BPS,
            BPS
        );

        uint256 currentDebt = getTotalDebt(user);

        if (currentDebt >= maxTotalDebt) {
            return 0;
        }

        uint256 remainingCapacity = maxTotalDebt - currentDebt;
        uint256 availableLiquidity = usdc.balanceOf(address(this));

        return remainingCapacity < availableLiquidity
            ? remainingCapacity
            : availableLiquidity;
    }

    // --------------------------------------------------
    // BORROW USDC
    // --------------------------------------------------

    function borrow(uint256 amount) public {
        require(amount > 0, "Amount must be greater than zero");

        // Update interest on any existing loan first.
        _accrueInterest(msg.sender);

        // Includes current debt, collateral limit and pool liquidity.
        uint256 maxAmount = maxBorrowAmount(msg.sender);

        require(
            amount <= maxAmount,
            "Exceeds borrowing capacity"
        );

        BorrowerPosition storage position = positions[msg.sender];

        position.borrowedPrincipal += amount;
        position.lastAccrualTime = block.timestamp;

        // If this transfer fails, the transaction reverts,
        // including the position updates above.
        usdc.safeTransfer(msg.sender, amount);

        emit Borrowed(msg.sender, amount);
    }

    // --------------------------------------------------
    // REPAY USDC DEBT
    // --------------------------------------------------

    function repay(uint256 amount) public {
        require(amount > 0, "Amount must be greater than zero");

        _accrueInterest(msg.sender);

        BorrowerPosition storage position = positions[msg.sender];
        uint256 totalDebt = position.borrowedPrincipal + position.accruedInterest;

        require(totalDebt > 0, "No debt to repay");
        require(amount <= totalDebt, "Repayment exceeds debt");

        if (amount <= position.accruedInterest) {
            position.accruedInterest -= amount;
        } else {
            uint256 remaining = amount - position.accruedInterest;
            position.accruedInterest = 0;
            position.borrowedPrincipal -= remaining;
        }

        position.lastAccrualTime = block.timestamp;

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit Repaid(msg.sender, amount);
    }
}

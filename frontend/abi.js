// VaultLend and Standard ERC-20 / Chainlink ABIs
const VAULT_LEND_ABI = [
  "constructor(address wethAddress, address usdcAddress, address priceFeedAddress)",
  "function BPS() view returns (uint256)",
  "function INTEREST_RATE_BPS() view returns (uint256)",
  "function MAX_LTV_BPS() view returns (uint256)",
  "function MAX_PRICE_AGE() view returns (uint256)",
  "function SECONDS_PER_YEAR() view returns (uint256)",
  "function depositCollateral(uint256 amount)",
  "function borrow(uint256 amount)",
  "function repay(uint256 amount)",
  "function getCollateralValue(address user) view returns (uint256)",
  "function getPriceFeed() view returns (uint256)",
  "function getTotalDebt(address user) view returns (uint256)",
  "function maxBorrowAmount(address user) view returns (uint256)",
  "function positions(address user) view returns (uint256 collateralAmount, uint256 borrowedPrincipal, uint256 accruedInterest, uint256 lastAccrualTime)",
  "function priceFeed() view returns (address)",
  "function usdc() view returns (address)",
  "function weth() view returns (address)",
  "event CollateralDeposited(address indexed user, uint256 amount)",
  "event Borrowed(address indexed user, uint256 amount)",
  "event InterestAccrued(address indexed user, uint256 interest)",
  "event Repaid(address indexed user, uint256 amount)"
];

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

const AGGREGATOR_ABI = [
  "function decimals() view returns (uint8)",
  "function description() view returns (string)",
  "function version() view returns (uint256)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)"
];

window.VAULT_LEND_ABI = VAULT_LEND_ABI;
window.ERC20_ABI = ERC20_ABI;
window.AGGREGATOR_ABI = AGGREGATOR_ABI;

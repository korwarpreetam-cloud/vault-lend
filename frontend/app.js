/**
 * VaultLend Web3 Frontend & Simulation Engine
 * Matches exact Solidity math and state from VaultLend.sol
 */

// Contract Defaults
const CONFIG = {
  defaultVaultAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3", // Typical Anvil first deploy
  defaultWethAddress: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  defaultUsdcAddress: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  defaultOracleAddress: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  maxLtvBps: 7500, // 75%
  bps: 10000,
  interestRateBps: 500, // 5% APR
  secondsPerYear: 365 * 24 * 3600
};

// Simulation State (for presentation / demo mode)
let simState = {
  ethPrice: 2000, // $2,000 / WETH
  feedDecimals: 8,
  currentTime: Math.floor(Date.now() / 1000),
  poolLiquidity: 150000, // 150,000 USDC available in protocol
  tvlWeth: 120, // 120 WETH TVL
  user: {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    wethWalletBalance: 5.0, // 5 WETH in wallet
    usdcWalletBalance: 2500, // 2500 USDC in wallet
    collateralAmount: 2.0, // 2 WETH deposited
    borrowedPrincipal: 1000, // 1000 USDC borrowed
    accruedInterest: 0,
    lastAccrualTime: Math.floor(Date.now() / 1000)
  },
  events: [
    {
      type: "collateral",
      name: "CollateralDeposited",
      desc: "Deposited 2.00 WETH",
      amount: "+2.0000 WETH",
      time: "Initial Setup",
      hash: "0x3a4b...8f91"
    },
    {
      type: "borrow",
      name: "Borrowed",
      desc: "Borrowed 1,000.00 USDC",
      amount: "+1,000.00 USDC",
      time: "Initial Setup",
      hash: "0x8e2c...1d04"
    }
  ]
};

// App Mode: 'demo' or 'live'
let currentMode = 'demo';
let provider = null;
let signer = null;
let vaultContract = null;
let wethContract = null;
let usdcContract = null;
let userAddress = null;

// DOM Elements
const elements = {
  modeDemoBtn: document.getElementById('mode-demo-btn'),
  modeLiveBtn: document.getElementById('mode-live-btn'),
  connectWalletBtn: document.getElementById('connect-wallet-btn'),
  walletAddressBadge: document.getElementById('wallet-address-badge'),
  networkBadge: document.getElementById('network-badge'),
  oraclePriceDisplay: document.getElementById('oracle-price-display'),
  statTvl: document.getElementById('stat-tvl'),
  statLiquidity: document.getElementById('stat-liquidity'),
  statLtv: document.getElementById('stat-ltv'),
  statApr: document.getElementById('stat-apr'),
  healthScore: document.getElementById('health-score'),
  healthBadge: document.getElementById('health-badge'),
  healthExplanation: document.getElementById('health-explanation'),
  gaugeProgress: document.getElementById('gauge-progress'),
  userCollateralWeth: document.getElementById('user-collateral-weth'),
  userCollateralUsd: document.getElementById('user-collateral-usd'),
  userTotalDebt: document.getElementById('user-total-debt'),
  userDebtBreakdown: document.getElementById('user-debt-breakdown'),
  userBorrowCapacity: document.getElementById('user-borrow-capacity'),
  capacityProgressBar: document.getElementById('capacity-progress-bar'),
  capacityPercentText: document.getElementById('capacity-percent-text'),
  userWalletWeth: document.getElementById('user-wallet-weth'),
  userWalletUsdc: document.getElementById('user-wallet-usdc'),
  depositInput: document.getElementById('deposit-amount-input'),
  depositValuePreview: document.getElementById('deposit-value-preview'),
  depositBorrowPreview: document.getElementById('deposit-borrow-preview'),
  depositBtn: document.getElementById('btn-deposit'),
  borrowInput: document.getElementById('borrow-amount-input'),
  borrowSafetyPreview: document.getElementById('borrow-safety-preview'),
  borrowRemainingPreview: document.getElementById('borrow-remaining-preview'),
  borrowBtn: document.getElementById('btn-borrow'),
  warpButtons: document.querySelectorAll('.warp-btn'),
  priceShockSlider: document.getElementById('price-shock-slider'),
  shockPriceDisplay: document.getElementById('shock-price-display'),
  resetDemoBtn: document.getElementById('reset-demo-btn'),
  presetCleanBtn: document.getElementById('preset-clean-btn'),
  presetHealthyBtn: document.getElementById('preset-healthy-btn'),
  presetRiskBtn: document.getElementById('preset-risk-btn'),
  eventsContainer: document.getElementById('events-container'),
  configModal: document.getElementById('config-modal'),
  openConfigBtn: document.getElementById('open-config-btn'),
  closeConfigBtn: document.getElementById('close-config-btn'),
  saveConfigBtn: document.getElementById('save-config-btn')
};

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupEventListeners();
  updateUI();
  showToast("VaultLend initialized in Demo / Presentation Mode. Ready to showcase to your professor!", "info");
});

// Setup Navigation Tabs
function setupTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.dataset.target);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// Event Listeners
function setupEventListeners() {
  // Mode selection
  elements.modeDemoBtn.addEventListener('click', () => setMode('demo'));
  elements.modeLiveBtn.addEventListener('click', () => setMode('live'));

  // Connect wallet
  elements.connectWalletBtn.addEventListener('click', handleWalletConnect);

  // Quick Amount Buttons
  document.querySelectorAll('.quick-amount-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetInputId = btn.dataset.target;
      const percent = parseFloat(btn.dataset.percent) / 100;
      const input = document.getElementById(targetInputId);
      if (!input) return;

      if (targetInputId === 'deposit-amount-input') {
        const max = simState.user.wethWalletBalance;
        input.value = (max * percent).toFixed(4);
        input.dispatchEvent(new Event('input'));
      } else if (targetInputId === 'borrow-amount-input') {
        const { maxBorrow } = calculatePositions();
        input.value = Math.max(0, Math.floor(maxBorrow * percent)).toString();
        input.dispatchEvent(new Event('input'));
      }
    });
  });

  // Dynamic input previews
  elements.depositInput.addEventListener('input', () => {
    const amount = parseFloat(elements.depositInput.value) || 0;
    const value = amount * simState.ethPrice;
    const capacity = value * (CONFIG.maxLtvBps / CONFIG.bps);
    elements.depositValuePreview.innerText = `≈ $${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    elements.depositBorrowPreview.innerText = `+$${capacity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Max Borrow`;
  });

  elements.borrowInput.addEventListener('input', () => {
    const borrowAmount = parseFloat(elements.borrowInput.value) || 0;
    const { collateralVal, totalDebt, maxBorrow } = calculatePositions();
    const newDebt = totalDebt + borrowAmount;
    const maxCapacity = collateralVal * (CONFIG.maxLtvBps / CONFIG.bps);
    const newHf = newDebt > 0 ? (maxCapacity / newDebt) : 999;

    elements.borrowSafetyPreview.innerText = newDebt > maxCapacity
      ? `❌ Exceeds 75% LTV (HF: ${newHf.toFixed(2)})`
      : `✅ Projected HF: ${newHf >= 99 ? '∞' : newHf.toFixed(2)}`;
    elements.borrowSafetyPreview.style.color = newDebt > maxCapacity ? '#f43f5e' : '#10b981';
    elements.borrowRemainingPreview.innerText = `Available pool: $${simState.poolLiquidity.toLocaleString()} USDC`;
  });

  // Action Buttons
  elements.depositBtn.addEventListener('click', handleDeposit);
  elements.borrowBtn.addEventListener('click', handleBorrow);

  // Time Warp Simulation buttons
  elements.warpButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const seconds = parseInt(btn.dataset.seconds, 10);
      handleTimeWarp(seconds, btn.dataset.label);
    });
  });

  // Price Shock Slider
  elements.priceShockSlider.addEventListener('input', (e) => {
    const price = parseInt(e.target.value, 10);
    simState.ethPrice = price;
    elements.shockPriceDisplay.innerText = `$${price.toLocaleString()}`;
    updateUI();
  });

  // Presets
  elements.presetCleanBtn.addEventListener('click', () => loadPreset('clean'));
  elements.presetHealthyBtn.addEventListener('click', () => loadPreset('healthy'));
  elements.presetRiskBtn.addEventListener('click', () => loadPreset('risk'));
  elements.resetDemoBtn.addEventListener('click', () => loadPreset('healthy'));

  // Config modal
  elements.openConfigBtn.addEventListener('click', () => elements.configModal.classList.add('active'));
  elements.closeConfigBtn.addEventListener('click', () => elements.configModal.classList.remove('active'));
  elements.saveConfigBtn.addEventListener('click', saveConfig);
}

// Mathematical calculation mirroring vaultLend.sol
function calculatePositions() {
  const collateral = simState.user.collateralAmount;
  const price = simState.ethPrice;
  // Exact contract math: Math.mulDiv(collateralAmount, price, 10 ** (feedDecimals + 12))
  const collateralVal = collateral * price;

  // Accrued interest calculation:
  // interest = Math.mulDiv(borrowedPrincipal, INTEREST_RATE_BPS * elapsedTime, BPS * SECONDS_PER_YEAR)
  const elapsed = Math.max(0, simState.currentTime - simState.user.lastAccrualTime);
  const currentInterest = simState.user.borrowedPrincipal > 0
    ? (simState.user.borrowedPrincipal * CONFIG.interestRateBps * elapsed) / (CONFIG.bps * CONFIG.secondsPerYear)
    : 0;

  const totalDebt = simState.user.borrowedPrincipal + simState.user.accruedInterest + currentInterest;
  const maxAllowedDebt = collateralVal * (CONFIG.maxLtvBps / CONFIG.bps);
  const remainingCapacity = Math.max(0, maxAllowedDebt - totalDebt);
  const maxBorrow = Math.min(remainingCapacity, simState.poolLiquidity);

  // Health Factor: maxAllowedDebt / totalDebt
  // > 1.0 means safe; < 1.0 means liquidatable
  const healthFactor = totalDebt > 0 ? (maxAllowedDebt / totalDebt) : 999;

  return {
    collateralVal,
    currentInterest,
    totalDebt,
    maxAllowedDebt,
    remainingCapacity,
    maxBorrow,
    healthFactor
  };
}

// Update UI
function updateUI() {
  const { collateralVal, currentInterest, totalDebt, maxAllowedDebt, remainingCapacity, maxBorrow, healthFactor } = calculatePositions();

  // Oracle & Stats
  elements.oraclePriceDisplay.innerText = `ETH/USD: $${simState.ethPrice.toLocaleString()}`;
  elements.statTvl.innerText = `$${(simState.tvlWeth * simState.ethPrice).toLocaleString()}`;
  elements.statLiquidity.innerText = `$${simState.poolLiquidity.toLocaleString()}`;

  // Collateral stats
  elements.userCollateralWeth.innerText = `${simState.user.collateralAmount.toFixed(4)} WETH`;
  elements.userCollateralUsd.innerText = `≈ $${collateralVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Debt stats
  elements.userTotalDebt.innerText = `$${totalDebt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  elements.userDebtBreakdown.innerText = `Principal: $${simState.user.borrowedPrincipal.toFixed(2)} | Accrued Int: $${(simState.user.accruedInterest + currentInterest).toFixed(4)}`;

  // Borrow capacity
  elements.userBorrowCapacity.innerText = `$${maxBorrow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const capacityUsedPercent = maxAllowedDebt > 0 ? Math.min(100, (totalDebt / maxAllowedDebt) * 100) : 0;
  elements.capacityProgressBar.style.width = `${capacityUsedPercent}%`;
  elements.capacityPercentText.innerText = `${capacityUsedPercent.toFixed(1)}% of 75% LTV Cap`;

  // Wallet balances
  elements.userWalletWeth.innerText = `${simState.user.wethWalletBalance.toFixed(4)} WETH`;
  elements.userWalletUsdc.innerText = `$${simState.user.usdcWalletBalance.toLocaleString()} USDC`;

  // Health Factor Gauge
  updateHealthGauge(healthFactor, totalDebt);

  // Events Feed
  renderEvents();
}

// Update Health Gauge
function updateHealthGauge(hf, totalDebt) {
  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.8
  elements.gaugeProgress.style.strokeDasharray = `${circumference}`;

  if (totalDebt === 0) {
    elements.healthScore.innerText = "∞";
    elements.healthScore.style.color = "#10b981";
    elements.gaugeProgress.style.strokeDashoffset = `0`;
    elements.gaugeProgress.style.stroke = "#10b981";
    elements.healthBadge.className = "health-badge safe";
    elements.healthBadge.innerText = "NO DEBT";
    elements.healthExplanation.innerText = "Position has zero outstanding debt. Collateral is completely safe and unencumbered.";
    return;
  }

  elements.healthScore.innerText = hf.toFixed(2);

  // Gauge filling logic (1.0 = threshold, 2.0 = well collateralized)
  const normalized = Math.min(2.5, Math.max(0, hf));
  const offset = circumference - (normalized / 2.5) * circumference;
  elements.gaugeProgress.style.strokeDashoffset = `${offset}`;

  if (hf >= 1.5) {
    elements.healthScore.style.color = "#10b981";
    elements.gaugeProgress.style.stroke = "#10b981";
    elements.healthBadge.className = "health-badge safe";
    elements.healthBadge.innerText = "SAFE";
    elements.healthExplanation.innerText = `Health factor is strong (${hf.toFixed(2)} > 1.5). Well protected against market volatility.`;
  } else if (hf >= 1.1) {
    elements.healthScore.style.color = "#f59e0b";
    elements.gaugeProgress.style.stroke = "#f59e0b";
    elements.healthBadge.className = "health-badge warning";
    elements.healthBadge.innerText = "MODERATE RISK";
    elements.healthExplanation.innerText = `Approaching maximum borrowing limit. ETH price drops could push position into liquidation.`;
  } else {
    elements.healthScore.style.color = "#f43f5e";
    elements.gaugeProgress.style.stroke = "#f43f5e";
    elements.healthBadge.className = "health-badge danger";
    elements.healthBadge.innerText = "DANGER / AT RISK";
    elements.healthExplanation.innerText = `WARNING: Position health factor is ${hf.toFixed(2)} (< 1.10). Vulnerable to liquidation!`;
  }
}

// Handle Deposit
function handleDeposit() {
  const amount = parseFloat(elements.depositInput.value);
  if (!amount || amount <= 0) {
    showToast("Please enter a valid deposit amount > 0", "error");
    return;
  }

  if (currentMode === 'demo') {
    if (amount > simState.user.wethWalletBalance) {
      showToast("Insufficient WETH wallet balance!", "error");
      return;
    }

    simState.user.wethWalletBalance -= amount;
    simState.user.collateralAmount += amount;
    simState.tvlWeth += amount;

    addEvent("collateral", "CollateralDeposited", `Deposited ${amount.toFixed(4)} WETH`, `+${amount.toFixed(4)} WETH`);
    elements.depositInput.value = "";
    elements.depositValuePreview.innerText = "≈ $0.00";
    elements.depositBorrowPreview.innerText = "+$0.00 Max Borrow";
    updateUI();
    showToast(`Successfully deposited ${amount} WETH collateral!`, "success");
  } else {
    executeLiveDeposit(amount);
  }
}

// Handle Borrow
function handleBorrow() {
  const amount = parseFloat(elements.borrowInput.value);
  if (!amount || amount <= 0) {
    showToast("Please enter a valid borrow amount > 0", "error");
    return;
  }

  if (currentMode === 'demo') {
    const { maxBorrow, maxAllowedDebt, totalDebt } = calculatePositions();

    if (amount > maxBorrow) {
      showToast(`Borrow request exceeds capacity! Max available: $${maxBorrow.toFixed(2)} USDC`, "error");
      return;
    }

    // Accrue current pending interest before adding new principal (matches contract _accrueInterest)
    const elapsed = simState.currentTime - simState.user.lastAccrualTime;
    if (simState.user.borrowedPrincipal > 0 && elapsed > 0) {
      const interest = (simState.user.borrowedPrincipal * CONFIG.interestRateBps * elapsed) / (CONFIG.bps * CONFIG.secondsPerYear);
      simState.user.accruedInterest += interest;
      addEvent("interest", "InterestAccrued", `Accrued $${interest.toFixed(4)} USDC interest`, `+$${interest.toFixed(4)} USDC`);
    }

    simState.user.borrowedPrincipal += amount;
    simState.user.lastAccrualTime = simState.currentTime;
    simState.user.usdcWalletBalance += amount;
    simState.poolLiquidity -= amount;

    addEvent("borrow", "Borrowed", `Borrowed ${amount.toLocaleString()} USDC`, `+${amount.toLocaleString()} USDC`);
    elements.borrowInput.value = "";
    elements.borrowSafetyPreview.innerText = "Checks 75% LTV & Pool Liquidity";
    elements.borrowRemainingPreview.innerText = "";
    updateUI();
    showToast(`Successfully borrowed ${amount.toLocaleString()} USDC!`, "success");
  } else {
    executeLiveBorrow(amount);
  }
}

// Time Warp Engine for Presentation
function handleTimeWarp(seconds, label) {
  simState.currentTime += seconds;
  const elapsedDays = (seconds / 86400).toFixed(0);

  // Calculate interest accrued during this time jump
  if (simState.user.borrowedPrincipal > 0) {
    const interest = (simState.user.borrowedPrincipal * CONFIG.interestRateBps * seconds) / (CONFIG.bps * CONFIG.secondsPerYear);
    showToast(`Fast-forwarded ${label}! Simple interest accrued: +$${interest.toFixed(4)} USDC (5.00% APR).`, "info");
  } else {
    showToast(`Fast-forwarded ${label}. No debt to accrue interest on.`, "info");
  }

  updateUI();
}

// Preset Manager
function loadPreset(preset) {
  if (preset === 'clean') {
    simState.user.collateralAmount = 0;
    simState.user.borrowedPrincipal = 0;
    simState.user.accruedInterest = 0;
    simState.user.wethWalletBalance = 5.0;
    simState.user.usdcWalletBalance = 2500;
    simState.ethPrice = 2000;
    elements.priceShockSlider.value = 2000;
    elements.shockPriceDisplay.innerText = "$2,000";
    showToast("Loaded 'Fresh Account' preset (0 collateral, 0 debt)", "info");
  } else if (preset === 'healthy') {
    simState.user.collateralAmount = 2.0;
    simState.user.borrowedPrincipal = 1000;
    simState.user.accruedInterest = 0;
    simState.user.wethWalletBalance = 3.0;
    simState.user.usdcWalletBalance = 3500;
    simState.ethPrice = 2000;
    elements.priceShockSlider.value = 2000;
    elements.shockPriceDisplay.innerText = "$2,000";
    showToast("Loaded 'Healthy Position' preset (2 WETH collateral, $1,000 debt)", "info");
  } else if (preset === 'risk') {
    simState.user.collateralAmount = 2.0;
    simState.user.borrowedPrincipal = 2850;
    simState.user.accruedInterest = 100;
    simState.user.wethWalletBalance = 1.0;
    simState.user.usdcWalletBalance = 500;
    simState.ethPrice = 1950;
    elements.priceShockSlider.value = 1950;
    elements.shockPriceDisplay.innerText = "$1,950";
    showToast("Loaded 'At Risk / Liquidation Zone' preset! Watch Health Factor drop below 1.0 if price slips.", "info");
  }
  simState.currentTime = Math.floor(Date.now() / 1000);
  simState.user.lastAccrualTime = simState.currentTime;
  updateUI();
}

// Render Event Feed
function renderEvents() {
  elements.eventsContainer.innerHTML = simState.events.map(ev => `
    <div class="event-item ${ev.type}">
      <div class="event-info">
        <span class="event-name">${ev.name}</span>
        <span class="event-meta">${ev.desc} • ${ev.time}</span>
      </div>
      <div class="event-amount">${ev.amount}</div>
    </div>
  `).join('');
}

function addEvent(type, name, desc, amount) {
  simState.events.unshift({
    type,
    name,
    desc,
    amount,
    time: "Just now",
    hash: `0x${Math.random().toString(16).substring(2, 8)}...`
  });
  if (simState.events.length > 20) simState.events.pop();
}

// Mode Switcher
function setMode(mode) {
  currentMode = mode;
  if (mode === 'demo') {
    elements.modeDemoBtn.classList.add('active');
    elements.modeLiveBtn.classList.remove('active');
    elements.networkBadge.innerText = "Simulation Sandbox (Offline)";
    elements.networkBadge.style.color = "#a5b4fc";
    showToast("Switched to Interactive Presentation Mode", "info");
  } else {
    elements.modeLiveBtn.classList.add('active');
    elements.modeDemoBtn.classList.remove('active');
    elements.networkBadge.innerText = "Web3 Network Mode";
    elements.networkBadge.style.color = "#34d399";
    showToast("Switched to Live Web3 Mode. Click 'Connect Wallet' to connect MetaMask or Anvil node.", "info");
  }
}

// Wallet & Contract Interaction
async function handleWalletConnect() {
  if (typeof window.ethereum === 'undefined') {
    showToast("MetaMask / Web3 provider not detected in browser. Use Demo Mode or install MetaMask.", "error");
    return;
  }

  try {
    const ethersLib = window.ethers;
    if (!ethersLib) {
      showToast("Ethers library loading... Please try again in a moment.", "error");
      return;
    }

    provider = new ethersLib.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    const network = await provider.getNetwork();
    elements.networkBadge.innerText = `Connected: Chain ${network.chainId}`;
    elements.walletAddressBadge.innerText = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
    elements.connectWalletBtn.innerText = "Connected";
    elements.connectWalletBtn.classList.add('btn-secondary');

    // Initialize contracts
    initContracts();
    showToast(`Wallet connected: ${userAddress.substring(0, 6)}...`, "success");
    setMode('live');
  } catch (err) {
    console.error(err);
    showToast(`Wallet connection failed: ${err.message}`, "error");
  }
}

function initContracts() {
  const vaultAddr = localStorage.getItem('vl_vault') || CONFIG.defaultVaultAddress;
  const wethAddr = localStorage.getItem('vl_weth') || CONFIG.defaultWethAddress;
  const usdcAddr = localStorage.getItem('vl_usdc') || CONFIG.defaultUsdcAddress;

  if (window.ethers && signer) {
    vaultContract = new window.ethers.Contract(vaultAddr, window.VAULT_LEND_ABI, signer);
    wethContract = new window.ethers.Contract(wethAddr, window.ERC20_ABI, signer);
    usdcContract = new window.ethers.Contract(usdcAddr, window.ERC20_ABI, signer);
    fetchLiveContractData();
  }
}

async function fetchLiveContractData() {
  if (!vaultContract || !userAddress) return;
  try {
    const pos = await vaultContract.positions(userAddress);
    const colVal = await vaultContract.getCollateralValue(userAddress);
    const debt = await vaultContract.getTotalDebt(userAddress);
    const maxB = await vaultContract.maxBorrowAmount(userAddress);
    const price = await vaultContract.getPriceFeed();

    simState.ethPrice = Number(price) / 1e8;
    simState.user.collateralAmount = Number(pos.collateralAmount) / 1e18;
    simState.user.borrowedPrincipal = Number(pos.borrowedPrincipal) / 1e6;
    simState.user.accruedInterest = Number(pos.accruedInterest) / 1e6;
    simState.user.lastAccrualTime = Number(pos.lastAccrualTime);

    updateUI();
  } catch (err) {
    console.warn("Could not read live contract (likely undeployed on current network):", err);
  }
}

async function executeLiveDeposit(amount) {
  if (!vaultContract || !wethContract) {
    showToast("Please connect wallet first!", "error");
    return;
  }
  try {
    const ethersLib = window.ethers;
    const amountWei = ethersLib.parseEther(amount.toString());
    const vaultAddr = await vaultContract.getAddress();

    showToast("Step 1/2: Approving WETH...", "info");
    const approveTx = await wethContract.approve(vaultAddr, amountWei);
    await approveTx.wait();

    showToast("Step 2/2: Depositing WETH Collateral...", "info");
    const depositTx = await vaultContract.depositCollateral(amountWei);
    await depositTx.wait();

    showToast("Deposit successful on-chain!", "success");
    fetchLiveContractData();
  } catch (err) {
    console.error(err);
    showToast(`Deposit failed: ${err.reason || err.message}`, "error");
  }
}

async function executeLiveBorrow(amount) {
  if (!vaultContract) {
    showToast("Please connect wallet first!", "error");
    return;
  }
  try {
    const amountUsdc = Math.floor(amount * 1e6);
    showToast("Sending borrow transaction...", "info");
    const tx = await vaultContract.borrow(amountUsdc);
    await tx.wait();
    showToast("Borrow successful on-chain!", "success");
    fetchLiveContractData();
  } catch (err) {
    console.error(err);
    showToast(`Borrow failed: ${err.reason || err.message}`, "error");
  }
}

function saveConfig() {
  const vault = document.getElementById('cfg-vault-address').value;
  const weth = document.getElementById('cfg-weth-address').value;
  const usdc = document.getElementById('cfg-usdc-address').value;
  if (vault) localStorage.setItem('vl_vault', vault);
  if (weth) localStorage.setItem('vl_weth', weth);
  if (usdc) localStorage.setItem('vl_usdc', usdc);
  elements.configModal.classList.remove('active');
  initContracts();
  showToast("Contract configurations saved!", "success");
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <div>${message}</div>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

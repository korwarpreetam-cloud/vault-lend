// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test} from "forge-std/Test.sol";
import {VaultLend} from "../src/vaultLend.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock WETH / USDC for tests
contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// Mock Chainlink PriceFeed ($2,000 / WETH with 8 decimals)
contract MockPriceFeed {
    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            1,
            2000e8,
            block.timestamp,
            block.timestamp,
            1
        );
    }
}

contract VaultLendTest is Test {
    VaultLend vault;
    MockERC20 weth;
    MockERC20 usdc;
    MockPriceFeed priceFeed;
    address user = address(1);

    function setUp() public {
        weth = new MockERC20("wrapped ether", "WETH");
        usdc = new MockERC20("USD coin", "USDC");
        priceFeed = new MockPriceFeed();

        vault = new VaultLend(
            address(weth),
            address(usdc),
            address(priceFeed)
        );

        weth.mint(user, 2 ether);
    }

    function testDepositedCollateral() public {
        vm.startPrank(user);
        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);
        vm.stopPrank();

        (uint256 collateralAmount,,,) = vault.positions(user);
        assertEq(collateralAmount, 2 ether);
        assertEq(weth.balanceOf(address(vault)), 2 ether);
    }

    function test_DepositCollateral_RecordsAmountForCorrectUser() public {
        testDepositedCollateral();
    }
}

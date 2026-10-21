// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test} from "forge-std/Test.sol";
import {VaultLend} from "../src/vaultLend.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

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
        return (1, 2000e8, block.timestamp, block.timestamp, 1);
    }
}

contract VaultLendTest is Test {
    VaultLend vault;
    MockERC20 weth;
    MockERC20 usdc;
    MockPriceFeed priceFeed;

    address user = address(1);

    function setUp() public {
        weth = new MockERC20("Wrapped Ether", "WETH");
        usdc = new MockERC20("USD Coin", "USDC");
        priceFeed = new MockPriceFeed();

        vault = new VaultLend(address(weth), address(usdc), address(priceFeed));

        // Give the borrower 2 WETH.
        weth.mint(user, 2 ether);
    }

    function test_DepositCollateral() public {
        vm.startPrank(user);

        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);

        vm.stopPrank();

        (uint256 collateralAmount, , , ) = vault.positions(user);

        assertEq(collateralAmount, 2 ether);
        assertEq(weth.balanceOf(address(vault)), 2 ether);
    }

    function test_BorrowUSDC() public {
        usdc.mint(address(vault), 3000e6);

        vm.startPrank(user);

        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);
        vault.borrow(1000e6);

        vm.stopPrank();

        assertEq(usdc.balanceOf(user), 1000e6);
        assertEq(vault.getTotalDebt(user), 1000e6);
    }

    function test_BorrowAboveLTVReverts() public {
        usdc.mint(address(vault), 4000e6);

        vm.startPrank(user);

        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);

        vm.expectRevert();
        vault.borrow(4000e6);

        vm.stopPrank();
    }

    function test_BorrowWithoutCollateralReverts() public {
        usdc.mint(address(vault), 3000e6);

        vm.startPrank(user);

        vm.expectRevert();
        vault.borrow(1000e6);

        vm.stopPrank();
    }

    function test_BorrowWithoutUSDCReverts() public {
        // Vault has no USDC.
        vm.startPrank(user);

        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);

        vm.expectRevert();
        vault.borrow(1000e6);

        vm.stopPrank();
    }

    function test_BorrowWithInsufficientLiquidityReverts() public {
        usdc.mint(address(vault), 1000e6);

        vm.startPrank(user);

        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);

        vm.expectRevert();
        vault.borrow(2000e6);

        vm.stopPrank();
    }

    function test_BorrowZeroReverts() public {
        usdc.mint(address(vault), 3000e6);

        vm.startPrank(user);

        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);

        vm.expectRevert();
        vault.borrow(0);

        vm.stopPrank();
    }
    function test_NoInterestImmediatelyAfterBorrowing() public {
        usdc.mint(address(vault), 3000e6);

        vm.startPrank(user);
        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);
        vault.borrow(1000e6);
        vm.stopPrank();

        assertEq(vault.getTotalDebt(user), 1000e6);
    }
    function test_InterestAccruesAfter30Days() public {
        usdc.mint(address(vault), 3000e6);

        vm.startPrank(user);
        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);
        vault.borrow(1000e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);

        assertEq(vault.getTotalDebt(user), 1004109589);
    }
    function test_InterestAccruesAfterSixMonths() public {
        usdc.mint(address(vault), 3000e6);

        vm.startPrank(user);
        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);
        vault.borrow(1000e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days / 2);

        assertEq(vault.getTotalDebt(user), 1025e6);
    }
    function test_InterestAccruesAfterOneYear() public {
        usdc.mint(address(vault), 3000e6);

        vm.startPrank(user);
        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);
        vault.borrow(1000e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days);

        assertEq(vault.getTotalDebt(user), 1050e6);
    }
    function test_InterstDoesnotCompund() public {
        usdc.mint(address(vault), 3000e6);
        vm.startPrank(user);
        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);
        vault.borrow(1000e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 365 days / 2);
        assertEq(vault.getTotalDebt(user), 1025e6);

        vm.warp(block.timestamp + 365 days / 2);
        assertEq(vault.getTotalDebt(user), 1050e6);
    }
    function test_repayment() public {
        usdc.mint(address(vault), 3000e6);
        vm.startPrank(user);
        weth.approve(address(vault), 2 ether);
        vault.depositCollateral(2 ether);
        vault.borrow(1000e6);
        usdc.approve(address(vault), 400e6);
        uint256 vaultBalanceBefore = usdc.balanceOf(address(vault));
        uint256 userBalanceBefore = usdc.balanceOf(user);
        vault.repay(400e6);
        vm.stopPrank();
        assertEq(vault.getTotalDebt(user), 600e6);
        assertEq(usdc.balanceOf(address(vault)), vaultBalanceBefore + 400e6);
        assertEq(usdc.balanceOf(user), userBalanceBefore - 400e6);
    }
}

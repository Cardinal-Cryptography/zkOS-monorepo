// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { CustomUpgrades } from "./Utils.sol";
import { Upgrades } from "openzeppelin-foundry-upgrades/Upgrades.sol";

import { Shielder as ShielderPrev } from "../contracts/Shielder.sol";
import { Shielder as ShielderNext } from "../contracts/ShielderV0_1_0.sol";

// solhint-disable-next-line contract-name-camelcase
contract ShielderV0_1_0Upgrade is Test {
    address public owner;
    uint256 public depositLimit = 100e18;
    string[] public allowedErrors;

    function setUp() public {
        owner = msg.sender;
        vm.startPrank(owner);
    }

    function testUpgrade() public {
        // Deploy upgradeable Shielder
        address shielderProxy = Upgrades.deployUUPSProxy(
            "Shielder.sol:Shielder",
            abi.encodeCall(ShielderPrev.initialize, (owner, depositLimit))
        );
        ShielderPrev shielderPrev = ShielderPrev(shielderProxy);

        bytes3 prevVersion = shielderPrev.CONTRACT_VERSION();
        vm.assertEq(prevVersion, bytes3(0x000001));

        address prevOwner = shielderPrev.owner();
        vm.assertEq(prevOwner, owner);

        bool prevPaused = shielderPrev.paused();
        vm.assertEq(prevPaused, true);

        uint256 prevDepositLimit = shielderPrev.depositLimit();
        vm.assertEq(prevDepositLimit, depositLimit);

        (, uint256 prevFreeLeafId, , ) = shielderPrev.merkleTree();
        vm.assertNotEq(prevFreeLeafId, 0);

        // upgrade to v0.1.0
        CustomUpgrades.upgradeProxyWithErrors(
            shielderProxy,
            "ShielderV0_1_0.sol:Shielder",
            abi.encodeWithSignature("initialize()"),
            allowedErrors
        );

        ShielderNext shielderNext = ShielderNext(shielderProxy);

        bytes3 newVersion = shielderNext.CONTRACT_VERSION();
        vm.assertEq(newVersion, bytes3(0x000100));

        address newOwner = shielderNext.owner();
        vm.assertEq(newOwner, prevOwner);

        bool newPaused = shielderNext.paused();
        vm.assertEq(newPaused, prevPaused);

        uint256 newDepositLimit = shielderNext.depositLimit();
        vm.assertEq(newDepositLimit, prevDepositLimit);

        (, uint256 newFreeLeafId, , ) = shielderNext.merkleTree();
        vm.assertEq(newFreeLeafId, prevFreeLeafId);

        // test TokenList

        address[] memory tokensToSet = new address[](1);
        tokensToSet[0] = address(1234);

        shielderNext.setTokenList(tokensToSet);
        address tokenAddress = shielderNext.getTokenAddress(1);
        vm.assertEq(tokenAddress, address(1234));

        address[] memory tokens = shielderNext.getTokens();
        vm.assertEq(tokens.length, 2);
        vm.assertEq(tokens[0], address(0)); // native token
        vm.assertEq(tokens[1], address(1234)); // added token

        // reset tokens to other token
        {
            address[] memory tokensToSet = new address[](1);
            tokensToSet[0] = address(5678);

            shielderNext.setTokenList(tokensToSet);
            address tokenAddress = shielderNext.getTokenAddress(1);
            vm.assertEq(tokenAddress, address(5678));

            address[] memory tokens = shielderNext.getTokens();
            vm.assertEq(tokens.length, 2);
            vm.assertEq(tokens[0], address(0)); // native token
            vm.assertEq(tokens[1], address(5678)); // added token
        }

        // reset tokens to empty
        {
            address[] memory tokensToSet = new address[](0);

            shielderNext.setTokenList(tokensToSet);
            address tokenAddress = shielderNext.getTokenAddress(1);
            vm.assertEq(tokenAddress, address(0));

            address[] memory tokens = shielderNext.getTokens();
            vm.assertEq(tokens.length, 1);
            vm.assertEq(tokens[0], address(0)); // native token
        }
    }
}

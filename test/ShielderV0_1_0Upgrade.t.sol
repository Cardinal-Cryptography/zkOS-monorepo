// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { CustomUpgrades } from "./Utils.sol";
import { Upgrades } from "openzeppelin-foundry-upgrades/Upgrades.sol";

import { Shielder } from "../contracts/Shielder.sol";
import { ShielderV0_1_0 } from "../contracts/ShielderV0_1_0.sol";

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
            abi.encodeCall(Shielder.initialize, (owner, depositLimit))
        );
        Shielder shielder = Shielder(shielderProxy);

        bytes3 version = shielder.CONTRACT_VERSION();
        vm.assertEq(version, bytes3(0x000001));

        address currentOwner = shielder.owner();
        vm.assertEq(currentOwner, owner);

        bool paused = shielder.paused();
        vm.assertEq(paused, true);

        uint256 currentDepositLimit = shielder.depositLimit();
        vm.assertEq(currentDepositLimit, depositLimit);

        (, uint256 nextFreeLeafId, , ) = shielder.merkleTree();
        vm.assertNotEq(nextFreeLeafId, 0);

        // upgrade Shielder
        CustomUpgrades.upgradeProxyWithErrors(
            shielderProxy,
            "ShielderV0_1_0.sol:ShielderV0_1_0",
            abi.encodeWithSignature("initialize()"),
            allowedErrors
        );

        // solhint-disable-next-line var-name-mixedcase
        ShielderV0_1_0 shielderV0_1_0 = ShielderV0_1_0(shielderProxy);

        bytes3 newVersion = shielderV0_1_0.CONTRACT_VERSION();
        vm.assertEq(newVersion, bytes3(0x000100));

        address newOwner = shielderV0_1_0.owner();
        vm.assertEq(newOwner, currentOwner);

        bool newPaused = shielderV0_1_0.paused();
        vm.assertEq(newPaused, paused);

        uint256 newDepositLimit = shielderV0_1_0.depositLimit();
        vm.assertEq(newDepositLimit, currentDepositLimit);

        // solhint-disable-next-line var-name-mixedcase
        (, uint256 nextFreeLeafIdV0_1_0, , ) = shielderV0_1_0.merkleTree();
        vm.assertEq(nextFreeLeafId, nextFreeLeafIdV0_1_0);

        shielderV0_1_0.addTokenToList(address(1234));
        address tokenAddress = shielderV0_1_0.getTokenAddress(1);
        vm.assertEq(tokenAddress, address(1234));

        address[] memory tokens = shielderV0_1_0.getTokens();
        vm.assertEq(tokens.length, 2);
        vm.assertEq(tokens[0], address(0)); // native token
        vm.assertEq(tokens[1], address(1234)); // added token

        shielderV0_1_0.removeLastToken();
        tokenAddress = shielderV0_1_0.getTokenAddress(1);
        vm.assertEq(tokenAddress, address(0));
    }
}

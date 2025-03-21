// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { CustomUpgrades } from "./Utils.sol";
import { Upgrades, Options } from "openzeppelin-foundry-upgrades/Upgrades.sol";

import { Shielder } from "../contracts/Shielder.sol";
import { ShielderV2Mock } from "./ShielderV2Mock.sol";

contract ShielderUpgrade is Test {
    address public owner;

    uint256 public depositLimit = 100e18;
    uint256 public anonymityRevokerPubkeyX = 42;
    uint256 public anonymityRevokerPubkeyY = 43;

    string[] public allowedErrors;

    function setUp() public {
        owner = msg.sender;
        vm.startPrank(owner);
    }

    function testValidImplementation() public {
        Options memory opts;
        Upgrades.validateImplementation("Shielder.sol:Shielder", opts);
    }

    function testValidUpgrade() public {
        Options memory opts;
        // OZ-Upgrades recognize deleting a namespace from a contract
        // as a storage violaton.
        // We can ignore error for this specific namespace,
        // while keeping all other checks.
        allowedErrors.push(
            "Deleted namespace `erc7201:zkos.storage.DepositLimit"
        );
        CustomUpgrades.validateUpgradeWithErrors(
            "ShielderV2Mock.sol:ShielderV2Mock",
            opts,
            allowedErrors
        );
    }

    function testInvalidUpgrade() public {
        Options memory opts;
        opts.referenceContract = "ShielderV2Mock.sol:ShielderV2Mock";
        // this is not necessary becaue we add this namespace is added
        // when "upgrading" from `ShielderV2Mock` to `Shielder`
        allowedErrors.push(
            "Deleted namespace `erc7201:zkos.storage.DepositLimit`"
        );
        // this is expected to revert because `Shielder`
        // does not have the 'mockStateVariable'
        vm.expectRevert();
        CustomUpgrades.validateUpgradeWithErrors(
            "Shielder.sol:Shielder",
            opts,
            allowedErrors
        );
        // allowing the `mockStateVariable` to be deleted
        // the validation below will not revert showing that
        // it was the only validation error
        allowedErrors.push("Deleted `mockStateVariable`");
        CustomUpgrades.validateUpgradeWithErrors(
            "Shielder.sol:Shielder",
            opts,
            allowedErrors
        );
    }

    function testMockUpgrade() public {
        // Deploy upgradeable Shielder
        address shielderProxy = Upgrades.deployUUPSProxy(
            "Shielder.sol:Shielder",
            abi.encodeCall(
                Shielder.initialize,
                (
                    owner,
                    depositLimit,
                    anonymityRevokerPubkeyX,
                    anonymityRevokerPubkeyY,
                    false
                )
            )
        );
        Shielder shielder = Shielder(shielderProxy);

        (, uint256 nextFreeLeafId, , ) = shielder.merkleTree();
        vm.assertNotEq(nextFreeLeafId, 0);

        uint256 mockVariable = 42;

        allowedErrors.push(
            "Deleted namespace `erc7201:zkos.storage.DepositLimit`"
        );
        // upgrade Shielder
        CustomUpgrades.upgradeProxyWithErrors(
            shielderProxy,
            "ShielderV2Mock.sol:ShielderV2Mock",
            abi.encodeCall(ShielderV2Mock.reinitialize, (mockVariable)),
            allowedErrors
        );

        ShielderV2Mock shielderV2 = ShielderV2Mock(shielderProxy);

        (, uint256 nextFreeLeafIdV2, , ) = shielderV2.merkleTree();
        vm.assertEq(nextFreeLeafId, nextFreeLeafIdV2);
        vm.assertEq(shielderV2.mockStateVariable(), mockVariable);
    }
}

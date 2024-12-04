// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Test } from "forge-std/Test.sol";
import { Upgrades, Options } from "openzeppelin-foundry-upgrades/Upgrades.sol";

import { Halo2Verifier as NewAccountVerifier } from "../contracts/NewAccountVerifier.sol";
import { Halo2VerifyingKey as NewAccountVerifyingKey } from "../contracts/NewAccountVerifyingKey.sol";
import { Halo2Verifier as DepositVerifier } from "../contracts/DepositVerifier.sol";
import { Halo2VerifyingKey as DepositVerifyingKey } from "../contracts/DepositVerifyingKey.sol";
import { Halo2Verifier as WithdrawVerifier } from "../contracts/WithdrawVerifier.sol";
import { Halo2VerifyingKey as WithdrawVerifyingKey } from "../contracts/WithdrawVerifyingKey.sol";
import { Poseidon2T8Assembly as Poseidon2 } from "../contracts/Poseidon2T8Assembly.sol";

import { Shielder } from "../contracts/Shielder.sol";
import { ShielderV2Mock } from "../contracts/mocks/ShielderV2Mock.sol";

contract ShielderUpgrade is Test {
    address owner;

    address poseidon2;

    address newAccountVerifier;
    address newAccountVerifyingKey;
    address depositVerifier;
    address depositVerifyingKey;
    address withdrawVerifier;
    address withdrawVerifyingKey;

    function setUp() public {
        owner = msg.sender;
        vm.startPrank(owner);

        newAccountVerifier = address(new NewAccountVerifier());
        newAccountVerifyingKey = address(new NewAccountVerifyingKey());

        depositVerifier = address(new DepositVerifier());
        depositVerifyingKey = address(new DepositVerifyingKey());

        withdrawVerifier = address(new WithdrawVerifier());
        withdrawVerifyingKey = address(new WithdrawVerifyingKey());

        poseidon2 = address(new Poseidon2());
    }

    function testValidImplementation() public {
        Options memory opts;
        Upgrades.validateImplementation("Shielder.sol:Shielder", opts);
    }

    function testMockUpgrade() public {
        // Deploy upgradeable Shielder
        address shielderProxy = Upgrades.deployUUPSProxy(
            "Shielder.sol:Shielder",
            abi.encodeCall(
                Shielder.initialize,
                (
                    owner,
                    poseidon2,
                    newAccountVerifier,
                    depositVerifier,
                    withdrawVerifier,
                    newAccountVerifyingKey,
                    depositVerifyingKey,
                    withdrawVerifyingKey,
                    type(uint256).max
                )
            )
        );

        address mockVerifier = vm.addr(1);
        address mockVerifyingKey = vm.addr(2);

        // upgrade Shielder
        Upgrades.upgradeProxy(
            shielderProxy,
            "ShielderV2Mock.sol:ShielderV2Mock",
            abi.encodeCall(
                ShielderV2Mock.reinitialize,
                (mockVerifier, mockVerifyingKey)
            )
        );
    }
}

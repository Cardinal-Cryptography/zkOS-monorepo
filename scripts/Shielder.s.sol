// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;

import { Script, console2 } from "forge-std/Script.sol";
import { Upgrades } from "openzeppelin-foundry-upgrades/Upgrades.sol";

import { Poseidon2T8Assembly as Poseidon2 } from "../contracts/Poseidon2T8Assembly.sol";
import { Halo2Verifier as NewAccountVerifier } from "../contracts/NewAccountVerifier.sol";
import { Halo2VerifyingKey as NewAccountVerifyingKey } from "../contracts/NewAccountVerifyingKey.sol";
import { Halo2Verifier as DepositVerifier } from "../contracts/DepositVerifier.sol";
import { Halo2VerifyingKey as DepositVerifyingKey } from "../contracts/DepositVerifyingKey.sol";
import { Halo2Verifier as WithdrawVerifier } from "../contracts/WithdrawVerifier.sol";
import { Halo2VerifyingKey as WithdrawVerifyingKey } from "../contracts/WithdrawVerifyingKey.sol";
import { Shielder } from "../contracts/Shielder.sol";

/* solhint-disable no-console */
contract DeployShielderScript is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        address owner = vm.addr(privateKey);
        console2.log("Using", owner, "as broadcaster");

        vm.startBroadcast(privateKey);

        Poseidon2 poseidon2 = new Poseidon2();
        console2.log("Poseidon2 deployed at:", address(poseidon2));
        NewAccountVerifier newAccountVerifier = new NewAccountVerifier();
        console2.log(
            "NewAccountVerifier deployed at:",
            address(newAccountVerifier)
        );
        NewAccountVerifyingKey newAccountVerifyingKey = new NewAccountVerifyingKey();
        console2.log(
            "NewAccountVerifyingKey deployed at:",
            address(newAccountVerifyingKey)
        );

        DepositVerifier depositVerifier = new DepositVerifier();
        console2.log("DepositVerifier deployed at:", address(depositVerifier));
        DepositVerifyingKey depositVerifyingKey = new DepositVerifyingKey();
        console2.log(
            "DepositVerifyingKey deployed at:",
            address(depositVerifyingKey)
        );

        WithdrawVerifier withdrawVerifier = new WithdrawVerifier();
        console2.log(
            "WithdrawVerifier deployed at:",
            address(withdrawVerifier)
        );
        WithdrawVerifyingKey withdrawVerifyingKey = new WithdrawVerifyingKey();
        console2.log(
            "WithdrawVerifyingKey deployed at:",
            address(withdrawVerifyingKey)
        );

        bytes memory initializerData = abi.encodeCall(
            Shielder.initialize,
            (
                owner,
                address(poseidon2),
                address(newAccountVerifier),
                address(depositVerifier),
                address(withdrawVerifier),
                address(newAccountVerifyingKey),
                address(depositVerifyingKey),
                address(withdrawVerifyingKey),
                type(uint256).max
            )
        );

        address proxy = Upgrades.deployUUPSProxy(
            "Shielder.sol:Shielder",
            initializerData
        );

        Shielder shielder = Shielder(proxy);

        console2.log("Shielder deployed at:", address(shielder));
        shielder.unpause();

        vm.stopBroadcast();
    }
}

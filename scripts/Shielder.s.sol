// SPDX-License-Identifier: MIT

pragma solidity ^0.8.14;

import { Script, console2 } from "forge-std/src/Script.sol";

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
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

        address shielderImplementation = address(new Shielder());

        console2.log(
            "Shielder Implementation deployed at:",
            address(shielderImplementation)
        );

        bytes memory data = abi.encodeCall(
            Shielder.initialize,
            (
                owner,
                address(newAccountVerifier),
                address(depositVerifier),
                address(withdrawVerifier),
                address(newAccountVerifyingKey),
                address(depositVerifyingKey),
                address(withdrawVerifyingKey),
                type(uint256).max
            )
        );

        address proxy = address(new ERC1967Proxy(shielderImplementation, data));

        Shielder shielder = Shielder(proxy);

        console2.log("Shielder deployed at:", address(shielder));
        shielder.unpause();

        vm.stopBroadcast();
    }
}

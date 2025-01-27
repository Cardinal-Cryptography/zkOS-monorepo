// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.14;

import { Script, console2 } from "forge-std/Script.sol";

import { Shielder } from "../contracts/ShielderV0_1_0.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/* solhint-disable no-console */
contract AddTokenSupport is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        address broadcaster = vm.addr(privateKey);
        address proxy = vm.envAddress("SHIELDER_PROXY");
        console2.log("Using", broadcaster, "as broadcaster");

        vm.startBroadcast(privateKey);

        address shielderImplementation = address(new Shielder());

        console2.log(
            "ShielderV0_1_0 Implementation deployed at:",
            address(shielderImplementation)
        );

        bytes memory data = abi.encodeWithSignature("initialize()");

        UUPSUpgradeable(proxy).upgradeToAndCall(shielderImplementation, data);

        Shielder shielder = Shielder(proxy);

        console2.log("Upgraded at proxy:", address(shielder));
        console2.logBytes3(shielder.CONTRACT_VERSION());
        console2.log("Owner:", shielder.owner());

        vm.stopBroadcast();
    }
}

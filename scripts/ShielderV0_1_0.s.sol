// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.14;

import { Script, console2 } from "forge-std/Script.sol";

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Shielder } from "../contracts/Shielder.sol";
import { ShielderV0_1_0 } from "../contracts/ShielderV0_1_0.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/* solhint-disable no-console */
// solhint-disable-next-line contract-name-camelcase
contract DeployShielderV0_1_0Script is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        address owner = vm.envAddress("OWNER_ADDRESS");
        address broadcaster = vm.addr(privateKey);
        console2.log("Using", broadcaster, "as broadcaster");

        vm.startBroadcast(privateKey);

        address shielderImplementation = address(new Shielder());

        console2.log(
            "Shielder Implementation deployed at:",
            address(shielderImplementation)
        );

        bytes memory data = abi.encodeCall(
            Shielder.initialize,
            (owner, type(uint256).max)
        );

        address proxy = address(new ERC1967Proxy(shielderImplementation, data));

        // solhint-disable-next-line var-name-mixedcase
        address shielderV0_1_0Implementation = address(new ShielderV0_1_0());

        console2.log(
            "ShielderV0_1_0 Implementation deployed at:",
            address(shielderV0_1_0Implementation)
        );

        // solhint-disable-next-line var-name-mixedcase
        bytes memory dataV0_1_0 = abi.encodeWithSignature("initialize()");

        UUPSUpgradeable(proxy).upgradeToAndCall(
            shielderV0_1_0Implementation,
            dataV0_1_0
        );

        Shielder shielder = Shielder(proxy);

        console2.log("Shielder deployed at:", address(shielder));
        if (owner == broadcaster) {
            shielder.unpause();
        }
        console2.logBytes3(shielder.CONTRACT_VERSION());
        console2.log("Owner:", shielder.owner());

        vm.stopBroadcast();
    }
}

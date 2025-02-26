// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.14;

import { Script, console2 } from "forge-std/Script.sol";

import { ERC1967Proxy } from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import { Shielder } from "../contracts/Shielder.sol";

/* solhint-disable no-console */
contract DeployShielderScript is Script {
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
            (owner, type(uint256).max, 0, 1) // set deposit limit to max, anonymity revoker pubkey to (0,1) - must be on a curve
        );

        address proxy = address(new ERC1967Proxy(shielderImplementation, data));

        Shielder shielder = Shielder(proxy);

        console2.log("Shielder deployed at:", address(shielder));
        if (owner == broadcaster) {
            shielder.unpause();
        }

        vm.stopBroadcast();
    }
}

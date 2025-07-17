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

        uint256 arPublicKeyX = uint256(vm.envBytes32("AR_PUBLIC_KEY_X"));
        uint256 arPublicKeyY = uint256(vm.envBytes32("AR_PUBLIC_KEY_Y"));

        uint256 protocolDepositFeeBps = vm.envUint("PROTOCOL_DEPOSIT_FEE_BPS");
        uint256 protocolWithdrawFeeBps = vm.envUint(
            "PROTOCOL_WITHDRAW_FEE_BPS"
        );
        address protocolFeeReceiver = vm.envAddress("PROTOCOL_FEE_RECEIVER");

        bool isArbitrumChain = vm.envBool("IS_ARBITRUM_CHAIN");

        vm.startBroadcast(privateKey);

        address shielderImplementation = address(new Shielder());

        console2.log(
            "Shielder Implementation deployed at:",
            address(shielderImplementation)
        );

        bytes memory data = abi.encodeCall(
            Shielder.initialize,
            (
                owner,
                arPublicKeyX,
                arPublicKeyY,
                isArbitrumChain,
                protocolDepositFeeBps,
                protocolWithdrawFeeBps,
                protocolFeeReceiver
            )
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

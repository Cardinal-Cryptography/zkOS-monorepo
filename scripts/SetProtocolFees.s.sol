// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.14;

import { Script, console2 } from "forge-std/Script.sol";

import { Shielder } from "../contracts/Shielder.sol";

/* solhint-disable no-console */
contract SetProtocolFeesShielderScript is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        uint256 protocolDepositFeeBps = vm.envUint("PROTOCOL_DEPOSIT_FEE_BPS");
        uint256 protocolWithdrawFeeBps = vm.envUint(
            "PROTOCOL_WITHDRAW_FEE_BPS"
        );

        Shielder shielder = Shielder(
            vm.envAddress("SHIELDER_CONTRACT_ADDRESS")
        );

        vm.startBroadcast(privateKey);

        shielder.setProtocolDepositFeeBps(protocolDepositFeeBps);
        shielder.setProtocolWithdrawFeeBps(protocolWithdrawFeeBps);

        console2.log("Protocol fees set to:");
        console2.log("Desosit fee: ", protocolDepositFeeBps, " bps");
        console2.log("Withdraw fee: ", protocolWithdrawFeeBps, " bps");

        vm.stopBroadcast();
    }
}

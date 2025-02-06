// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

contract AcceptingShielder {
    function withdraw(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        address tokenAddress,
        uint256 amount,
        address withdrawalAddress,
        uint256 merkleRoot,
        uint256 oldNullifierHash,
        uint256 newNote,
        bytes calldata proof,
        address relayerAddress,
        uint256 relayerFee
    ) external {}
}

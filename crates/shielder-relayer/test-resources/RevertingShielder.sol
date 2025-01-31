// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

contract RevertingShielder {
    function withdrawToken(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        address tokenAddress,
        uint256 amount,
        address withdrawAddress,
        uint256 merkleRoot,
        uint256 oldNullifierHash,
        uint256 newNote,
        bytes calldata proof,
        address relayerAddress,
        uint256 relayerFee
    ) external {
        revert();
    }
}

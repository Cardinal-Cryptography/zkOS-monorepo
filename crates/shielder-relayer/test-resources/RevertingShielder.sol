// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

contract RevertingShielder {
    function withdrawNative(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        uint256 amount,
        address withdrawAddress,
        uint256 merkleRoot,
        uint256 nullifier,
        uint256 newNote,
        bytes calldata proof,
        address relayer,
        uint256 relayerFee
    ) external {
        revert();
    }
}

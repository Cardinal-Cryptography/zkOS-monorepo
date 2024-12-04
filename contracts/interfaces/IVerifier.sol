// SPDX-License-Identifier: MIT
pragma solidity ^0.8.14;

interface IVerifier {
    function verifyProof(
        address vk,
        bytes calldata proof,
        uint256[] calldata instances
    ) external returns (bool);
}

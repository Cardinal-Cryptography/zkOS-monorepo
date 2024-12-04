// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IPoseidon2 {
    function hash(uint256[7] memory) external pure returns (uint256);
}

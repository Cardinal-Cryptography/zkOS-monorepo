// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

library UIntSet {
    struct Set {
        mapping(uint256 => bool) exists;
    }

    function add(Set storage set, uint256 value) internal returns (bool) {
        if (!set.exists[value]) {
            set.exists[value] = true;
            return true;
        }
        return false;
    }

    function contains(
        Set storage set,
        uint256 value
    ) internal view returns (bool) {
        return set.exists[value];
    }
}

// SPDX-License-Identifier: Apache-2.0

pragma solidity 0.8.26;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { Poseidon2T8Assembly as Poseidon2 } from "./Poseidon2T8Assembly.sol";
import { UIntSet } from "./UIntSet.sol";

/*
 * Merkle Tree with Poseidon2
 */

abstract contract MerkleTree is Initializable {
    using UIntSet for UIntSet.Set;

    uint256 public constant ARITY = 7;
    uint256 public constant TREE_HEIGHT = 13;
    // tree height is computed as ceil(log_{ARITY}(2^36))

    // keccak256(abi.encode(uint256(keccak256("zkos.storage.MerkleTree")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant MERKLE_TREE_LOCATION =
        0x8dc6e18c8cfce769481c51bf18d0c9f95b9f5dd0b4b4cafa4091d6a06254b700;

    /// @custom:storage-location erc7201:zkos.storage.MerkleTree
    struct MerkleTreeStorage {
        mapping(uint256 => uint256) notes;
        uint256 root;
        uint256 nextFreeLeafId;
        uint256 maxLeafId;
        uint256 firstLeafId;
        UIntSet.Set merkleRoots;
    }

    function _getMerkleTreeStorage()
        private
        pure
        returns (MerkleTreeStorage storage $)
    {
        assembly {
            $.slot := MERKLE_TREE_LOCATION
        }
    }

    error InvalidTreeHeight();
    error MaxTreeSizeExceeded();
    error LeafNotExisting();

    /*
     * Initialize the tree.
     */
    // solhint-disable func-name-mixedcase
    function __MerkleTree_init() internal onlyInitializing {
        MerkleTreeStorage storage $ = _getMerkleTreeStorage();
        ($.maxLeafId, $.nextFreeLeafId) = treeBounds(TREE_HEIGHT);
        $.firstLeafId = $.nextFreeLeafId;
    }

    /**
     * Getter for MerkleTree data.
     * @return MerkleTree data (root, nextFreeLeafId, maxLeafId, firstLeafId)
     */
    function merkleTree()
        public
        view
        returns (uint256, uint256, uint256, uint256)
    {
        MerkleTreeStorage storage $ = _getMerkleTreeStorage();
        return ($.root, $.nextFreeLeafId, $.maxLeafId, $.firstLeafId);
    }

    /*
     * Given an index of a leaf return the Merkle path from this leaf to the root.
     *
     * Leaves are indexed from 0.
     *
     * Path is an array of length TREE_HEIGHT*ARITY+1, where the first TREE_HEIGHT*ARITY elements is the full path
     * (ancestors with their siblings, ordered) and the last element is the root.
     *
     * If tree looks like this:
     * l_3 = hash(l_1, l_2)
     * l_5 = hash(l_3, l_4)
     * ...
     * root = hash(l_71, l_72)
     * Then the path for l_1 is:
     * | l_1 l_2 | l_3 l_4 | l_5 l_6 | ... | l_71 l_72 | root |
     */
    function getMerklePath(
        uint256 index
    ) public view returns (uint256[] memory) {
        MerkleTreeStorage storage $ = _getMerkleTreeStorage();
        if (index >= $.nextFreeLeafId - $.firstLeafId) {
            revert LeafNotExisting();
        }
        index += $.firstLeafId;

        uint256[] memory path = new uint256[](TREE_HEIGHT * ARITY + 1);

        uint256 parent = 0;
        for (uint256 i = 0; i < TREE_HEIGHT; ++i) {
            unchecked {
                parent = (index + ARITY - 2) / ARITY;
            }
            for (uint256 j = 0; j < ARITY; ++j) {
                path[i * ARITY + j] = $.notes[parent * ARITY + j - (ARITY - 2)];
            }

            index = parent;
        }
        path[TREE_HEIGHT * ARITY] = $.root;

        return path;
    }

    /*
     * Add a note to the tree.
     * Returns the index of the note in the tree starting from 0.
     * If the tree is full, it will revert.
     * Saves new root in the root history.
     */
    function _addNote(uint256 note) internal returns (uint256) {
        MerkleTreeStorage storage $ = _getMerkleTreeStorage();
        if ($.nextFreeLeafId > $.maxLeafId) revert MaxTreeSizeExceeded();

        uint256 index = $.nextFreeLeafId;
        uint256 parent = 0;
        uint256[ARITY] memory subtrees;
        $.notes[index] = note;

        for (uint256 i = 0; i < TREE_HEIGHT; ++i) {
            unchecked {
                parent = (index + ARITY - 2) / ARITY;
            }
            for (uint256 j = 0; j < ARITY; ++j) {
                subtrees[j] = $.notes[parent * ARITY + j - (ARITY - 2)];
            }
            note = Poseidon2.hash(subtrees);
            $.notes[parent] = note;

            index = parent;
        }
        $.root = note;
        $.nextFreeLeafId += 1;

        $.merkleRoots.add($.root);

        return $.nextFreeLeafId - $.firstLeafId - 1;
    }

    function _merkleRootExists(
        uint256 merkleRoot
    ) internal view returns (bool) {
        MerkleTreeStorage storage $ = _getMerkleTreeStorage();
        return $.merkleRoots.contains(merkleRoot);
    }

    /*
     * Given a tree height, return the maximum index of a leaf and the index of the first leaf.
     * Throw an error if height is too big.
     */
    function treeBounds(
        uint256 treeHeight
    ) private pure returns (uint256, uint256) {
        uint256 size = 1;
        uint256 power = 1;
        bool flag = true;
        for (uint256 i = 1; i <= treeHeight; i++) {
            (flag, power) = Math.tryMul(power, ARITY);
            if (!flag) revert InvalidTreeHeight();
            (flag, size) = Math.tryAdd(size, power);
            if (!flag) revert InvalidTreeHeight();
        }
        return (size, size - power + 1);
    }
}

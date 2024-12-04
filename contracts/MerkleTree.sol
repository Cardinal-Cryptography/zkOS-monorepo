// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IPoseidon2 } from "./IPoseidon2.sol";

/*
 * Merkle Tree with Poseidon2
 */

library MerkleTree {
    uint256 public constant ARITY = 7;
    uint256 public constant TREE_HEIGHT = 13;
    // tree height is computed as ceil(log_{ARITY}(2^36))

    struct MerkleTreeData {
        IPoseidon2 poseidon2;
        mapping(uint256 => uint256) notes;
        uint256 root;
        uint256 nextFreeLeafId;
        uint256 maxLeafId;
        uint256 firstLeafId;
    }

    error InvalidTreeHeight();
    error MaxTreeSizeExceeded();
    error LeafNotExisting();

    /*
     * Initialize the tree.
     */
    function init(
        MerkleTreeData storage merkleTree,
        address _poseidon2
    ) internal {
        setPoseidon2(merkleTree, _poseidon2);
        (merkleTree.maxLeafId, merkleTree.nextFreeLeafId) = treeBounds(
            TREE_HEIGHT
        );
        merkleTree.firstLeafId = merkleTree.nextFreeLeafId;
    }

    function setPoseidon2(
        MerkleTreeData storage self,
        address _poseidon2
    ) internal {
        self.poseidon2 = IPoseidon2(_poseidon2);
    }

    /*
     * Add a note to the tree.
     * Returns the index of the note in the tree starting from 0.
     * If the tree is full, it will revert.
     */
    function addNote(
        MerkleTreeData storage self,
        uint256 note
    ) internal returns (uint256) {
        if (self.nextFreeLeafId > self.maxLeafId) revert MaxTreeSizeExceeded();

        uint256 index = self.nextFreeLeafId;
        uint256 parent = 0;
        uint256[ARITY] memory subtrees;
        self.notes[index] = note;

        for (uint256 i = 0; i < TREE_HEIGHT; ) {
            unchecked {
                parent = (index + ARITY - 2) / ARITY;
            }
            for (uint256 j = 0; j < ARITY; ) {
                subtrees[j] = self.notes[parent * ARITY + j - (ARITY - 2)];
                unchecked {
                    j++;
                }
            }
            note = self.poseidon2.hash(subtrees);
            self.notes[parent] = note;

            index = parent;
            unchecked {
                i++;
            }
        }
        self.root = note;
        self.nextFreeLeafId += 1;

        return self.nextFreeLeafId - self.firstLeafId - 1;
    }

    /*
     * Given an index of a leaf return the path from a leaf index to the root.
     * Leaves are indexed from 0.
     * Path is an array of length TREE_HEIGHT*ARITY+1, where the first TREE_HEIGHT*ARITY elements are the siblings of the path,
     * and the last element is the root.
     * If tree looks like this:
     * l_3 = hash(l_1, l_2)
     * l_5 = hash(l_3, l_4)
     * ...
     * root = hash(l_71, l_72)
     * Then the path for l_1 is:
     * | l_1 l_2 | l_3 l_4 | l_5 l_6 | ... | l_71 l_72 | root |
     */
    function getMerklePath(
        MerkleTreeData storage self,
        uint256 index
    ) internal view returns (uint256[] memory) {
        if (index >= self.nextFreeLeafId - self.firstLeafId) {
            revert LeafNotExisting();
        }
        index += self.firstLeafId;

        uint256[] memory path = new uint256[](TREE_HEIGHT * ARITY + 1);

        uint256 parent = 0;
        for (uint256 i = 0; i < TREE_HEIGHT; ) {
            unchecked {
                parent = (index + ARITY - 2) / ARITY;
            }
            for (uint256 j = 0; j < ARITY; ) {
                path[i * ARITY + j] = self.notes[
                    parent * ARITY + j - (ARITY - 2)
                ];
                unchecked {
                    j++;
                }
            }

            index = parent;
            unchecked {
                i++;
            }
        }
        path[TREE_HEIGHT * ARITY] = self.root;

        return path;
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

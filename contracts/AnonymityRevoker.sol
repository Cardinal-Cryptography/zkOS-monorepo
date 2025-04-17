// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract AnonymityRevoker is Initializable {
    // keccak256(abi.encode(uint256(keccak256("zkos.storage.AnonymityRevoker")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ANONYMITY_REVOKER_LOCATION =
        0x82881b1719ba4dfb061ce0c3d608959c0e642d28eb9b6f9efe63d7e5c6c4f000;
    /// The modulus of the field used for the Grumpkin curve.
    uint256 private constant FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    error InvalidGrumpkinPoint();

    /// @custom:storage-location erc7201:zkos.storage.AnonymityRevoker
    struct AnonymityRevokerStorage {
        // IMPORTANT: curve point should be validated in the circuit or the contract!
        uint256 anonymityRevokerPublicKeyX;
        uint256 anonymityRevokerPublicKeyY;
    }

    /*
     * Initialize the anonymity revoker pubkey.
     */
    // solhint-disable func-name-mixedcase
    function __AnonymityRevoker_init(
        uint256 anonymityRevokerPubkeyX,
        uint256 anonymityRevokerPubkeyY
    ) internal onlyInitializing {
        _setAnonymityRevokerPubkey(
            anonymityRevokerPubkeyX,
            anonymityRevokerPubkeyY
        );
    }

    /*
     * Set the anonymity revoker pubkey. Validate that the given point is on the Grumpkin curve.
     */
    function _setAnonymityRevokerPubkey(
        uint256 anonymityRevokerPubkeyX,
        uint256 anonymityRevokerPubkeyY
    ) internal {
        if (
            !isValidGrumpkinPoint(
                anonymityRevokerPubkeyX,
                anonymityRevokerPubkeyY
            )
        ) revert InvalidGrumpkinPoint();

        AnonymityRevokerStorage storage $ = _getAnonymityRevokerStorage();
        $.anonymityRevokerPublicKeyX = anonymityRevokerPubkeyX;
        $.anonymityRevokerPublicKeyY = anonymityRevokerPubkeyY;
    }

    /*
     * @dev Checks if the given point (x, y) lies on the Grumpkin curve (y^2 ≡ x^3 - 17 (mod FIELD_MODULUS)).
     */
    function isValidGrumpkinPoint(
        uint256 x,
        uint256 y
    ) internal pure returns (bool) {
        // Check that x and y are valid field elements.
        if (x >= FIELD_MODULUS || y >= FIELD_MODULUS) {
            return false;
        }

        uint256 lhs = mulmod(y, y, FIELD_MODULUS);
        uint256 xCubed = mulmod(x, mulmod(x, x, FIELD_MODULUS), FIELD_MODULUS);
        uint256 rhs = addmod(xCubed, FIELD_MODULUS - 17, FIELD_MODULUS);

        return lhs == rhs;
    }

    function _getAnonymityRevokerStorage()
        private
        pure
        returns (AnonymityRevokerStorage storage $)
    {
        assembly {
            $.slot := ANONYMITY_REVOKER_LOCATION
        }
    }

    function anonymityRevokerPubkey() public view returns (uint256, uint256) {
        AnonymityRevokerStorage storage $ = _getAnonymityRevokerStorage();
        return ($.anonymityRevokerPublicKeyX, $.anonymityRevokerPublicKeyY);
    }
}

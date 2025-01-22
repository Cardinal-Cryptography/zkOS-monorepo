// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract TokenList is Initializable {
    // keccak256(abi.encode(uint256(keccak256("zkos.storage.TokenList")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant TOKEN_LIST_LOCATION =
        0xc61234ddf70726f3926fa5321981a41638b45dd9806cf5e5b3ad94aec3c7af00;

    /// @custom:storage-location erc7201:zkos.storage.TokenList
    struct TokenListStorage {
        uint256 tokensNumber;
        mapping(uint256 => address) tokenAddressByIndex;
    }

    function _getTokenListStorage()
        private
        pure
        returns (TokenListStorage storage $)
    {
        assembly {
            $.slot := TOKEN_LIST_LOCATION
        }
    }

    // solhint-disable-next-line func-name-mixedcase
    function __TokenList_init() internal onlyInitializing {
        TokenListStorage storage $ = _getTokenListStorage();
        // reserve the first index for the native token
        $.tokensNumber = 1;
    }

    function getTokenAddress(
        uint256 _tokenIndex
    ) public view returns (address) {
        TokenListStorage storage $ = _getTokenListStorage();
        return $.tokenAddressByIndex[_tokenIndex];
    }

    function getTokens() public view returns (address[] memory) {
        TokenListStorage storage $ = _getTokenListStorage();
        address[] memory tokens = new address[]($.tokensNumber);
        for (uint256 i = 0; i < $.tokensNumber; i++) {
            tokens[i] = $.tokenAddressByIndex[i];
        }
        return tokens;
    }

    /*
     * Add a token to the list
     */
    function _addTokenToList(address _token) internal {
        TokenListStorage storage $ = _getTokenListStorage();
        $.tokenAddressByIndex[$.tokensNumber] = _token;
        $.tokensNumber++;
    }

    function _removeLastToken() internal {
        TokenListStorage storage $ = _getTokenListStorage();
        if ($.tokensNumber == 1) {
            // cannot remove the native token
            return;
        }
        delete $.tokenAddressByIndex[$.tokensNumber - 1];
        $.tokensNumber--;
    }
}

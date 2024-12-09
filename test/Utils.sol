// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { Upgrades, Options, Core } from "openzeppelin-foundry-upgrades/Upgrades.sol";
import { console2 } from "forge-std/Script.sol";
import { strings } from "solidity-stringutils/src/strings.sol";

library CustomUpgrades {
    using strings for string;
    using strings for strings.slice;

    /**
     * @dev Performs oz-ugrades upgrade validations.
     *      Ignores all the errors that contain occurance of any of
     *      the `allowedErrors` strings.
     * @dev `allowedErrors` should not conatin new line characters,
     *      otherwise some errors may be not detected.
     * @param contractName Name of the new implementation contract to upgrade to, e.g. "MyContract.sol" or "MyContract.sol:MyContract" or artifact path relative to the project root directory
     * @param opts Common options
     * @param allowedErrors Array of errors to ignore during the validation
     */

    function validateUpgradeWithErrors(
        string memory contractName,
        Options memory opts,
        string[] memory allowedErrors
    ) internal {
        try ValidationWrapper.validateUpgrade(contractName, opts) {} catch (
            bytes memory errorMessage
        ) {
            strings.slice memory errMsg = string(abi.encodePacked(errorMessage))
                .toSlice();
            strings.slice memory delimiter = string("\n\n").toSlice();
            uint256 errorCount = errMsg.count(delimiter) - 1;
            uint256 allowedErrorsFound = 0;
            for (uint256 i = 0; i < allowedErrors.length; i++) {
                strings.slice memory errSlice = allowedErrors[i].toSlice();
                if (errMsg.contains(errSlice)) {
                    strings.slice memory msgStart = errMsg.split(errSlice);
                    msgStart.rsplit(string("      \n").toSlice());
                    strings.slice memory msgEnd = errMsg.rsplit(errSlice);
                    msgEnd.split(string("      \n").toSlice());
                    errMsg = msgStart
                        .concat(string("      \n").toSlice())
                        .toSlice()
                        .concat(msgEnd)
                        .toSlice();
                    allowedErrorsFound++;
                }
            }
            if (errorCount > allowedErrorsFound) {
                revert(errMsg.toString());
            }
        }
    }

    /**
     * @dev Upgrades a proxy to a new implementation contract. Only supported for UUPS or transparent proxies.
     *
     * Requires that either the `referenceContract` option is set, or the new implementation contract has a `@custom:oz-upgrades-from <reference>` annotation.
     *
     * @param proxy Address of the proxy to upgrade
     * @param contractName Name of the new implementation contract to upgrade to, e.g. "MyContract.sol" or "MyContract.sol:MyContract" or artifact path relative to the project root directory
     * @param data Encoded call data of an arbitrary function to call during the upgrade process, or empty if no function needs to be called during the upgrade
     * @param opts Common options
     * @param allowedErrors Array of errors to ignore during the validation
     */
    function upgradeProxyWithErrors(
        address proxy,
        string memory contractName,
        bytes memory data,
        Options memory opts,
        string[] memory allowedErrors
    ) internal {
        validateUpgradeWithErrors(contractName, opts, allowedErrors);
        address newImpl = Core.deploy(contractName, opts.constructorData, opts);
        Core.upgradeProxyTo(proxy, newImpl, data);
    }

    function upgradeProxyWithErrors(
        address proxy,
        string memory contractName,
        bytes memory data,
        string[] memory allowedErrors
    ) internal {
        Options memory opts;
        upgradeProxyWithErrors(proxy, contractName, data, opts, allowedErrors);
    }
}

library ValidationWrapper {
    function validateUpgrade(
        string memory contractName,
        Options memory opts
    ) external {
        Upgrades.validateUpgrade(contractName, opts);
    }
}

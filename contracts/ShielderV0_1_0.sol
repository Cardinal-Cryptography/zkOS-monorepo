// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { DepositLimit } from "./DepositLimit.sol";
import { Halo2Verifier as DepositVerifier } from "./DepositVerifierV0_1_0.sol";
import { Halo2Verifier as NewAccountVerifier } from "./NewAccountVerifierV0_1_0.sol";
import { Halo2Verifier as WithdrawVerifier } from "./WithdrawVerifierV0_1_0.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { MerkleTree } from "./MerkleTree.sol";
import { Nullifiers } from "./Nullifiers.sol";
import { TokenList } from "./TokenList.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title Shielder
 * @author CardinalCryptography
 * @custom:oz-upgrades-from contracts/Shielder.sol:Shielder
 * @custom:oz-upgrades-unsafe-allow external-library-linking
 */
// solhint-disable-next-line contract-name-camelcase
contract Shielder is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    MerkleTree,
    Nullifiers,
    DepositLimit,
    TokenList
{
    // -- Constants --

    /// The contract version, in the form `0x{v1}{v2}{v3}`, where:
    ///  - `v1` is the version of the note schema,
    ///  - `v1.v2` is the version of the circuits used,
    ///  - `v1.v2.v3` is the version of the contract itself.
    bytes3 public constant CONTRACT_VERSION = 0x000100;

    /// This amount of gas should be sufficient for ether transfers
    /// and simple fallback function execution, yet still protecting against reentrancy attack.
    uint256 public constant GAS_LIMIT = 3500;

    /// The range check in circuits will work only if we ensure bounded transaction values
    /// on the contract side.
    uint256 public constant MAX_TRANSACTION_AMOUNT = 2 ** 112 - 1;

    /// Safeguards against a scenario when multiple deposits create a shielded account balance
    /// that fails the new account balance range check in the withdrawal circuit, thus
    /// making withdrawals impossible. In the contract we can't control a single shielded balance,
    /// so we control the sum of balances instead.
    uint256 public constant MAX_CONTRACT_BALANCE = MAX_TRANSACTION_AMOUNT;

    /// The modulus of the field used in the circuits.
    uint256 private constant FIELD_MODULUS =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    // -- Events --
    event NewAccountNative(
        bytes3 contractVersion,
        uint256 idHash,
        uint256 amount,
        uint256 newNote,
        uint256 newNoteIndex
    );
    event Deposit(
        bytes3 contractVersion,
        uint256 idHiding,
        uint256 amount,
        uint256 newNote,
        uint256 newNoteIndex,
        uint256 tokenIndex
    );
    event WithdrawNative(
        bytes3 contractVersion,
        uint256 idHiding,
        uint256 amount,
        address to,
        uint256 newNote,
        uint256 newNoteIndex,
        address relayerAddress,
        uint256 fee
    );

    // -- Errors --

    error DepositVerificationFailed();
    error DuplicatedNullifier();
    error FeeHigherThanAmount();
    error MerkleRootDoesNotExist();
    error NativeTransferFailed();
    error WithdrawVerificationFailed();
    error NewAccountVerificationFailed();
    error ZeroAmount();
    error AmountTooHigh();
    error ContractBalanceLimitReached();
    error WrongContractVersion(bytes3 actual, bytes3 expectedByCaller);
    error NotAFieldElement();
    error TokenDoesNotExist();

    modifier restrictContractVersion(bytes3 expectedByCaller) {
        if (expectedByCaller != CONTRACT_VERSION) {
            revert WrongContractVersion(CONTRACT_VERSION, expectedByCaller);
        }
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public reinitializer(2) {
        __TokenList_init();
    }

    /// @dev required by the OZ UUPS module
    function _authorizeUpgrade(address) internal override onlyOwner {}

    /// @dev disable possibility to renounce ownership
    function renounceOwnership() public virtual override onlyOwner {}

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /*
     * Creates a fresh note, with an optional native token deposit.
     *
     * This transaction serves as the entrypoint to the Shielder.
     */
    function newAccountNative(
        bytes3 expectedContractVersion,
        uint256 newNote,
        uint256 idHash,
        bytes calldata proof
    )
        external
        payable
        whenNotPaused
        withinDepositLimit
        restrictContractVersion(expectedContractVersion)
        fieldElement(newNote)
        fieldElement(idHash)
    {
        uint256 amount = msg.value;
        if (nullifiers(idHash) != 0) revert DuplicatedNullifier();
        // `address(this).balance` already includes `msg.value`.
        if (address(this).balance > MAX_CONTRACT_BALANCE) {
            revert ContractBalanceLimitReached();
        }

        // @dev must follow the same order as in the circuit
        uint256[] memory publicInputs = new uint256[](3);
        publicInputs[0] = newNote;
        publicInputs[1] = idHash;
        publicInputs[2] = amount;

        bool success = NewAccountVerifier.verifyProof(proof, publicInputs);

        if (!success) revert NewAccountVerificationFailed();

        uint256 index = _addNote(newNote);
        _registerNullifier(idHash);

        emit NewAccountNative(CONTRACT_VERSION, idHash, amount, newNote, index);
    }

    /*
     * Make a native token deposit into the Shielder
     */
    function depositNative(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        uint256 oldNullifierHash,
        uint256 newNote,
        uint256 merkleRoot,
        bytes calldata proof
    )
        external
        payable
        whenNotPaused
        withinDepositLimit
        restrictContractVersion(expectedContractVersion)
        fieldElement(idHiding)
        fieldElement(oldNullifierHash)
        fieldElement(newNote)
    {
        uint256 amount = msg.value;
        // `address(this).balance` already includes `msg.value`.
        if (address(this).balance > MAX_CONTRACT_BALANCE) {
            revert ContractBalanceLimitReached();
        }

        deposit(
            idHiding,
            oldNullifierHash,
            newNote,
            merkleRoot,
            amount,
            0,
            proof
        );
    }

    /*
     * Make an ERC-20 token deposit into the Shielder
     */
    function depositERC20(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        uint256 oldNullifierHash,
        uint256 newNote,
        uint256 merkleRoot,
        uint256 amount,
        uint256 tokenIndex,
        bytes calldata proof
    )
        external
        whenNotPaused
        restrictContractVersion(expectedContractVersion)
        fieldElement(idHiding)
        fieldElement(oldNullifierHash)
        fieldElement(newNote)
    {
        if (amount > depositLimit()) revert AmountOverDepositLimit();
        address tokenAddress = getTokenAddress(tokenIndex);
        if (tokenAddress == address(0)) revert TokenDoesNotExist();
        // transfer the tokens to the contract
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);
        if (
            IERC20(tokenAddress).balanceOf(address(this)) > MAX_CONTRACT_BALANCE
        ) {
            revert ContractBalanceLimitReached();
        }

        deposit(
            idHiding,
            oldNullifierHash,
            newNote,
            merkleRoot,
            amount,
            tokenIndex,
            proof
        );
    }

    function deposit(
        uint256 idHiding,
        uint256 oldNullifierHash,
        uint256 newNote,
        uint256 merkleRoot,
        uint256 amount,
        uint256 tokenIndex,
        bytes calldata proof
    ) internal {
        if (amount == 0) revert ZeroAmount();
        if (nullifiers(oldNullifierHash) != 0) revert DuplicatedNullifier();
        if (!_merkleRootExists(merkleRoot)) revert MerkleRootDoesNotExist();
        // @dev needs to match the order in the circuit
        uint256[] memory publicInputs = new uint256[](5);
        publicInputs[0] = idHiding;
        publicInputs[1] = merkleRoot;
        publicInputs[2] = oldNullifierHash;
        publicInputs[3] = newNote;
        publicInputs[4] = amount;
        publicInputs[5] = tokenIndex;

        bool success = DepositVerifier.verifyProof(proof, publicInputs);

        if (!success) revert DepositVerificationFailed();

        uint256 newNoteIndex = _addNote(newNote);
        _registerNullifier(oldNullifierHash);

        emit Deposit(
            CONTRACT_VERSION,
            idHiding,
            amount,
            newNote,
            newNoteIndex,
            tokenIndex
        );
    }

    /*
     * Withdraw shielded native funds
     */
    function withdrawNative(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        uint256 amount,
        address withdrawAddress,
        uint256 merkleRoot,
        uint256 oldNullifierHash,
        uint256 newNote,
        bytes calldata proof,
        address relayerAddress,
        uint256 relayerFee
    )
        external
        whenNotPaused
        restrictContractVersion(expectedContractVersion)
        fieldElement(idHiding)
        fieldElement(oldNullifierHash)
        fieldElement(newNote)
    {
        if (amount == 0) revert ZeroAmount();
        if (amount <= relayerFee) revert FeeHigherThanAmount();
        if (amount > MAX_TRANSACTION_AMOUNT) revert AmountTooHigh();

        if (!_merkleRootExists(merkleRoot)) revert MerkleRootDoesNotExist();
        if (nullifiers(oldNullifierHash) != 0) revert DuplicatedNullifier();

        // @dev needs to match the order in the circuit
        uint256[] memory publicInputs = new uint256[](6);
        publicInputs[0] = idHiding;
        publicInputs[1] = merkleRoot;
        publicInputs[2] = oldNullifierHash;
        publicInputs[3] = newNote;
        publicInputs[4] = amount;

        bytes memory commitment = abi.encodePacked(
            CONTRACT_VERSION,
            addressToUInt256(withdrawAddress),
            addressToUInt256(relayerAddress),
            relayerFee
        );
        // @dev shifting right by 4 bits so the commitment is smaller from r
        publicInputs[5] = uint256(keccak256(commitment)) >> 4;

        bool success = WithdrawVerifier.verifyProof(proof, publicInputs);

        if (!success) revert WithdrawVerificationFailed();

        uint256 newNoteIndex = _addNote(newNote);
        _registerNullifier(oldNullifierHash);

        // return the tokens
        (bool nativeTransferSuccess, ) = withdrawAddress.call{
            value: amount - relayerFee,
            gas: GAS_LIMIT
        }("");
        if (!nativeTransferSuccess) revert NativeTransferFailed();

        // pay out the fee
        (nativeTransferSuccess, ) = relayerAddress.call{
            value: relayerFee,
            gas: GAS_LIMIT
        }("");
        if (!nativeTransferSuccess) revert NativeTransferFailed();

        emit WithdrawNative(
            CONTRACT_VERSION,
            idHiding,
            amount,
            withdrawAddress,
            newNote,
            newNoteIndex,
            relayerAddress,
            relayerFee
        );
    }

    function addressToUInt256(address addr) public pure returns (uint256) {
        return uint256(uint160(addr));
    }

    modifier fieldElement(uint256 x) {
        require(x < FIELD_MODULUS, NotAFieldElement());
        _;
    }

    // -- Setters ---

    /*
     * Set the deposit limit for the maximal amount
     */
    function setDepositLimit(uint256 _depositLimit) external onlyOwner {
        _setDepositLimit(_depositLimit);
    }

    function setTokenList(address[] calldata _tokens) external onlyOwner {
        _setTokenList(_tokens);
    }
}

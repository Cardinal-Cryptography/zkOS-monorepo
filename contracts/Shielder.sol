// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { DepositLimit } from "./DepositLimit.sol";
import { Halo2Verifier as DepositVerifier } from "./DepositVerifier.sol";
import { Halo2Verifier as NewAccountVerifier } from "./NewAccountVerifier.sol";
import { Halo2Verifier as WithdrawVerifier } from "./WithdrawVerifier.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { MerkleTree } from "./MerkleTree.sol";
import { Nullifiers } from "./Nullifiers.sol";
import { AnonymityRevoker } from "./AnonymityRevoker.sol";
import { Ownable2StepUpgradeable } from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import { PausableUpgradeable } from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import { UUPSUpgradeable } from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

using SafeERC20 for IERC20;

/// @title Shielder
/// @author CardinalCryptography
/// @custom:oz-upgrades-unsafe-allow external-library-linking
contract Shielder is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    MerkleTree,
    Nullifiers,
    DepositLimit,
    AnonymityRevoker
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

    /// A special value of `tokenAddress` in circuits used to represent the native token.
    address private constant NATIVE_TOKEN_NOTE_ADDRESS = address(0);

    // -- Events --
    event NewAccount(
        bytes3 contractVersion,
        uint256 idHash,
        address tokenAddress,
        uint256 amount,
        uint256 newNote,
        uint256 newNoteIndex
    );
    event Deposit(
        bytes3 contractVersion,
        uint256 idHiding,
        address tokenAddress,
        uint256 amount,
        uint256 newNote,
        uint256 newNoteIndex
    );
    event Withdraw(
        bytes3 contractVersion,
        uint256 idHiding,
        address tokenAddress,
        uint256 amount,
        address withdrawalAddress,
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

    function initialize(
        address initialOwner,
        uint256 _depositLimit,
        uint256 _anonymityRevokerPublicKey
    ) public initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __MerkleTree_init();
        __DepositLimit_init(_depositLimit);
        __AnonymityRevoker_init(_anonymityRevokerPublicKey);
        _pause();
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
     * This transaction serves as an entrypoint to the Shielder.
     */
    function newAccountNative(
        bytes3 expectedContractVersion,
        uint256 newNote,
        uint256 idHash,
        uint256 symKeyEncryption,
        bytes calldata proof
    ) external payable whenNotPaused {
        uint256 amount = msg.value;
        // `address(this).balance` already includes `msg.value`.
        if (address(this).balance > MAX_CONTRACT_BALANCE) {
            revert ContractBalanceLimitReached();
        }

        uint256 newNoteIndex = _newAccount(
            expectedContractVersion,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            newNote,
            idHash,
            symKeyEncryption,
            proof
        );

        emit NewAccount(
            CONTRACT_VERSION,
            idHash,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            newNote,
            newNoteIndex
        );
    }

    /*
     * Creates a fresh note, with an optional ERC20 token deposit.
     *
     * This transaction serves as an entrypoint to the Shielder.
     */
    function newAccountERC20(
        bytes3 expectedContractVersion,
        address tokenAddress,
        uint256 amount,
        uint256 newNote,
        uint256 idHash,
        uint256 symKeyEncryption,
        bytes calldata proof
    ) external whenNotPaused {
        IERC20 token = IERC20(tokenAddress);
        if (
            amount > MAX_CONTRACT_BALANCE ||
            token.balanceOf(address(this)) + amount > MAX_CONTRACT_BALANCE
        ) {
            revert ContractBalanceLimitReached();
        }

        uint256 newNoteIndex = _newAccount(
            expectedContractVersion,
            tokenAddress,
            amount,
            newNote,
            idHash,
            symKeyEncryption,
            proof
        );

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit NewAccount(
            CONTRACT_VERSION,
            idHash,
            tokenAddress,
            amount,
            newNote,
            newNoteIndex
        );
    }

    function _newAccount(
        bytes3 expectedContractVersion,
        address tokenAddress,
        uint256 amount,
        uint256 newNote,
        uint256 idHash,
        uint256 symKeyEncryption,
        bytes calldata proof
    )
        private
        restrictContractVersion(expectedContractVersion)
        fieldElement(newNote)
        fieldElement(idHash)
        fieldElement(symKeyEncryption)
        returns (uint256)
    {
        if (amount > depositLimit()) revert AmountOverDepositLimit();

        if (nullifiers(idHash) != 0) revert DuplicatedNullifier();
        // @dev must follow the same order as in the circuit
        uint256[] memory publicInputs = new uint256[](6);
        publicInputs[0] = newNote;
        publicInputs[1] = idHash;
        publicInputs[2] = amount;
        publicInputs[3] = addressToUInt256(tokenAddress);
        publicInputs[4] = anonymityRevokerPubkey();
        publicInputs[5] = symKeyEncryption;

        bool success = NewAccountVerifier.verifyProof(proof, publicInputs);

        if (!success) revert NewAccountVerificationFailed();

        uint256 newNoteIndex = _addNote(newNote);
        _registerNullifier(idHash);

        return newNoteIndex;
    }

    /*
     * Makes a native token deposit into the Shielder.
     */
    function depositNative(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        uint256 oldNullifierHash,
        uint256 newNote,
        uint256 merkleRoot,
        bytes calldata proof
    ) external payable whenNotPaused {
        uint256 amount = msg.value;
        if (address(this).balance > MAX_CONTRACT_BALANCE) {
            revert ContractBalanceLimitReached();
        }

        uint256 newNoteIndex = _deposit(
            expectedContractVersion,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            idHiding,
            oldNullifierHash,
            newNote,
            merkleRoot,
            proof
        );

        emit Deposit(
            CONTRACT_VERSION,
            idHiding,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            newNote,
            newNoteIndex
        );
    }

    /*
     * Makes an ERC20 token deposit into the Shielder.
     */
    function depositERC20(
        bytes3 expectedContractVersion,
        address tokenAddress,
        uint256 amount,
        uint256 idHiding,
        uint256 oldNullifierHash,
        uint256 newNote,
        uint256 merkleRoot,
        bytes calldata proof
    ) external whenNotPaused {
        IERC20 token = IERC20(tokenAddress);
        if (
            amount > MAX_CONTRACT_BALANCE ||
            token.balanceOf(address(this)) + amount > MAX_CONTRACT_BALANCE
        ) {
            revert ContractBalanceLimitReached();
        }

        uint256 newNoteIndex = _deposit(
            expectedContractVersion,
            tokenAddress,
            amount,
            idHiding,
            oldNullifierHash,
            newNote,
            merkleRoot,
            proof
        );

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposit(
            CONTRACT_VERSION,
            idHiding,
            tokenAddress,
            amount,
            newNote,
            newNoteIndex
        );
    }

    function _deposit(
        bytes3 expectedContractVersion,
        address tokenAddress,
        uint256 amount,
        uint256 idHiding,
        uint256 oldNullifierHash,
        uint256 newNote,
        uint256 merkleRoot,
        bytes calldata proof
    )
        private
        restrictContractVersion(expectedContractVersion)
        fieldElement(idHiding)
        fieldElement(oldNullifierHash)
        fieldElement(newNote)
        returns (uint256)
    {
        if (amount > depositLimit()) revert AmountOverDepositLimit();
        if (amount == 0) revert ZeroAmount();
        if (nullifiers(oldNullifierHash) != 0) revert DuplicatedNullifier();
        if (!_merkleRootExists(merkleRoot)) revert MerkleRootDoesNotExist();

        // @dev needs to match the order in the circuit
        uint256[] memory publicInputs = new uint256[](6);
        publicInputs[0] = idHiding;
        publicInputs[1] = merkleRoot;
        publicInputs[2] = oldNullifierHash;
        publicInputs[3] = newNote;
        publicInputs[4] = amount;
        publicInputs[5] = addressToUInt256(tokenAddress);

        bool success = DepositVerifier.verifyProof(proof, publicInputs);

        if (!success) revert DepositVerificationFailed();

        uint256 newNoteIndex = _addNote(newNote);
        _registerNullifier(oldNullifierHash);

        return newNoteIndex;
    }

    /*
     * Withdraw shielded native funds
     */
    function withdrawNative(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        uint256 amount,
        address withdrawalAddress,
        uint256 merkleRoot,
        uint256 oldNullifierHash,
        uint256 newNote,
        bytes calldata proof,
        address relayerAddress,
        uint256 relayerFee
    ) external whenNotPaused {
        uint256 newNoteIndex = _withdraw(
            expectedContractVersion,
            idHiding,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            withdrawalAddress,
            merkleRoot,
            oldNullifierHash,
            newNote,
            proof,
            relayerAddress,
            relayerFee
        );

        // return the tokens
        (bool nativeTransferSuccess, ) = withdrawalAddress.call{
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

        emit Withdraw(
            CONTRACT_VERSION,
            idHiding,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            withdrawalAddress,
            newNote,
            newNoteIndex,
            relayerAddress,
            relayerFee
        );
    }

    function withdrawERC20(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        address tokenAddress,
        uint256 amount,
        address withdrawalAddress,
        uint256 merkleRoot,
        uint256 oldNullifierHash,
        uint256 newNote,
        bytes calldata proof,
        address relayerAddress,
        uint256 relayerFee
    ) external whenNotPaused {
        uint256 newNoteIndex = _withdraw(
            expectedContractVersion,
            idHiding,
            tokenAddress,
            amount,
            withdrawalAddress,
            merkleRoot,
            oldNullifierHash,
            newNote,
            proof,
            relayerAddress,
            relayerFee
        );

        IERC20 token = IERC20(tokenAddress);
        token.safeTransfer(withdrawalAddress, amount - relayerFee);
        token.safeTransfer(relayerAddress, relayerFee);

        emit Withdraw(
            CONTRACT_VERSION,
            idHiding,
            tokenAddress,
            amount,
            withdrawalAddress,
            newNote,
            newNoteIndex,
            relayerAddress,
            relayerFee
        );
    }

    function _withdraw(
        bytes3 expectedContractVersion,
        uint256 idHiding,
        address tokenAddress,
        uint256 amount,
        address withdrawalAddress,
        uint256 merkleRoot,
        uint256 oldNullifierHash,
        uint256 newNote,
        bytes calldata proof,
        address relayerAddress,
        uint256 relayerFee
    )
        private
        restrictContractVersion(expectedContractVersion)
        fieldElement(idHiding)
        fieldElement(oldNullifierHash)
        fieldElement(newNote)
        returns (uint256)
    {
        if (amount == 0) revert ZeroAmount();
        if (amount <= relayerFee) revert FeeHigherThanAmount();
        if (amount > MAX_TRANSACTION_AMOUNT) revert AmountTooHigh();

        if (!_merkleRootExists(merkleRoot)) revert MerkleRootDoesNotExist();
        if (nullifiers(oldNullifierHash) != 0) revert DuplicatedNullifier();

        // @dev needs to match the order in the circuit
        uint256[] memory publicInputs = new uint256[](7);
        publicInputs[0] = idHiding;
        publicInputs[1] = merkleRoot;
        publicInputs[2] = oldNullifierHash;
        publicInputs[3] = newNote;
        publicInputs[4] = amount;
        publicInputs[5] = addressToUInt256(tokenAddress);

        bytes memory commitment = abi.encodePacked(
            CONTRACT_VERSION,
            addressToUInt256(withdrawalAddress),
            addressToUInt256(relayerAddress),
            relayerFee
        );
        // @dev shifting right by 4 bits so the commitment is smaller from r
        publicInputs[6] = uint256(keccak256(commitment)) >> 4;

        bool success = WithdrawVerifier.verifyProof(proof, publicInputs);

        if (!success) revert WithdrawVerificationFailed();

        uint256 newNoteIndex = _addNote(newNote);
        _registerNullifier(oldNullifierHash);

        return newNoteIndex;
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
}

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
import { Poseidon2T8Assembly as Poseidon2 } from "./Poseidon2T8Assembly.sol";

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
        uint256 newNoteIndex,
        uint256 macSalt,
        uint256 macCommitment
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
        uint256 fee,
        uint256 macSalt,
        uint256 macCommitment
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
        uint256 _anonymityRevokerPublicKeyX,
        uint256 _anonymityRevokerPublicKeyY
    ) public initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __MerkleTree_init();
        __DepositLimit_init(_depositLimit);
        __AnonymityRevoker_init(
            _anonymityRevokerPublicKeyX,
            _anonymityRevokerPublicKeyY
        );
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
        uint256 symKeyEncryptionC1X,
        uint256 symKeyEncryptionC1Y,
        uint256 symKeyEncryptionC2X,
        uint256 symKeyEncryptionC2Y,
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
            symKeyEncryptionC1X,
            symKeyEncryptionC1Y,
            symKeyEncryptionC2X,
            symKeyEncryptionC2Y,
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
        uint256 symKeyEncryptionC1X,
        uint256 symKeyEncryptionC1Y,
        uint256 symKeyEncryptionC2X,
        uint256 symKeyEncryptionC2Y,
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
            symKeyEncryptionC1X,
            symKeyEncryptionC1Y,
            symKeyEncryptionC2X,
            symKeyEncryptionC2Y,
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
        uint256 symKeyEncryptionC1X,
        uint256 symKeyEncryptionC1Y,
        uint256 symKeyEncryptionC2X,
        uint256 symKeyEncryptionC2Y,
        bytes calldata proof
    )
        private
        restrictContractVersion(expectedContractVersion)
        fieldElement(newNote)
        fieldElement(idHash)
        fieldElement(symKeyEncryptionC1X)
        fieldElement(symKeyEncryptionC1Y)
        fieldElement(symKeyEncryptionC2X)
        fieldElement(symKeyEncryptionC2Y)
        returns (uint256)
    {
        if (amount > depositLimit()) revert AmountOverDepositLimit();

        if (nullifiers(idHash) != 0) revert DuplicatedNullifier();
        // @dev must follow the same order as in the circuit

        uint256[7] memory innerHash;
        innerHash[0] = symKeyEncryptionC1X;
        innerHash[1] = symKeyEncryptionC1Y;
        innerHash[2] = symKeyEncryptionC2X;
        innerHash[3] = symKeyEncryptionC2Y;
        innerHash[4] = 0;
        innerHash[5] = 0;
        innerHash[6] = 0;
        uint256 innerHashValue = Poseidon2.hash(innerHash);

        uint256[7] memory outerHash;
        outerHash[0] = newNote;
        outerHash[1] = idHash;
        outerHash[2] = amount;
        outerHash[3] = addressToUInt256(tokenAddress);
        (uint256 arX, uint256 arY) = anonymityRevokerPubkey();
        outerHash[4] = arX;
        outerHash[5] = arY;
        outerHash[6] = innerHashValue;

        uint256[] memory publicInputs = new uint256[](1);
        publicInputs[0] = Poseidon2.hash(outerHash);

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
        uint256 macSalt,
        uint256 macCommitment,
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
            macSalt,
            macCommitment,
            proof
        );

        emit Deposit(
            CONTRACT_VERSION,
            idHiding,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            newNote,
            newNoteIndex,
            macSalt,
            macCommitment
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
        uint256 macSalt,
        uint256 macCommitment,
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
            macSalt,
            macCommitment,
            proof
        );

        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Deposit(
            CONTRACT_VERSION,
            idHiding,
            tokenAddress,
            amount,
            newNote,
            newNoteIndex,
            macSalt,
            macCommitment
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
        uint256 macSalt,
        uint256 macCommitment,
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
        uint256[7] memory innerHash;
        innerHash[0] = macSalt;
        innerHash[1] = macCommitment;
        innerHash[2] = 0;
        innerHash[3] = 0;
        innerHash[4] = 0;
        innerHash[5] = 0;
        innerHash[6] = 0;
        uint256 innerHashValue = Poseidon2.hash(innerHash);

        uint256[7] memory outerHash;
        outerHash[0] = idHiding;
        outerHash[1] = merkleRoot;
        outerHash[2] = oldNullifierHash;
        outerHash[3] = newNote;
        outerHash[4] = amount;
        outerHash[5] = addressToUInt256(tokenAddress);
        outerHash[6] = innerHashValue;

        uint256[] memory publicInputs = new uint256[](1);
        publicInputs[0] = Poseidon2.hash(outerHash);

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
        uint256 relayerFee,
        uint256 macSalt,
        uint256 macCommitment
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
            relayerFee,
            macSalt,
            macCommitment
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
            relayerFee,
            macSalt,
            macCommitment
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
        uint256 relayerFee,
        uint256 macSalt,
        uint256 macCommitment
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
            relayerFee,
            macSalt,
            macCommitment
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
            relayerFee,
            macSalt,
            macCommitment
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
        uint256 relayerFee,
        uint256 macSalt,
        uint256 macCommitment
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
        uint256 chainId = block.chainid;

        bytes memory commitment = abi.encodePacked(
            CONTRACT_VERSION,
            addressToUInt256(withdrawalAddress),
            addressToUInt256(relayerAddress),
            relayerFee,
            chainId
        );

        uint256[7] memory innerHash;
        // @dev shifting right by 4 bits so the commitment is smaller from r
        innerHash[0] = uint256(keccak256(commitment)) >> 4;
        innerHash[1] = macSalt;
        innerHash[2] = macCommitment;
        innerHash[3] = 0;
        innerHash[4] = 0;
        innerHash[5] = 0;
        innerHash[6] = 0;
        uint256 innerHashValue = Poseidon2.hash(innerHash);

        uint256[7] memory outerHash;
        outerHash[0] = idHiding;
        outerHash[1] = merkleRoot;
        outerHash[2] = oldNullifierHash;
        outerHash[3] = newNote;
        outerHash[4] = amount;
        outerHash[5] = addressToUInt256(tokenAddress);
        outerHash[6] = innerHashValue;

        uint256[] memory publicInputs = new uint256[](1);
        publicInputs[0] = Poseidon2.hash(outerHash);

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

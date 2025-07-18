// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.26;

import { Halo2Verifier as DepositVerifier } from "./DepositVerifier.sol";
import { Halo2Verifier as NewAccountVerifier } from "./NewAccountVerifier.sol";
import { Halo2Verifier as WithdrawVerifier } from "./WithdrawVerifier.sol";
import { Initializable } from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import { MerkleTree } from "./MerkleTree.sol";
import { Nullifiers } from "./Nullifiers.sol";
import { AnonymityRevoker } from "./AnonymityRevoker.sol";
import { ProtocolFee } from "./ProtocolFee.sol";
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
    AnonymityRevoker,
    ProtocolFee
{
    // -- Constants --

    /// The contract version, in the form `0x{v1}{v2}{v3}`, where:
    ///  - `v1` is the version of the note schema,
    ///  - `v1.v2` is the version of the circuits used,
    ///  - `v1.v2.v3` is the version of the contract itself.
    bytes3 public constant CONTRACT_VERSION = 0x000101;

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
        uint256 prenullifier,
        address tokenAddress,
        uint256 amount,
        uint256 newNote,
        uint256 newNoteIndex,
        uint256 macSalt,
        uint256 macCommitment,
        uint256 protocolFee,
        bytes memo
    );
    event Deposit(
        bytes3 contractVersion,
        address tokenAddress,
        uint256 amount,
        uint256 newNote,
        uint256 newNoteIndex,
        uint256 macSalt,
        uint256 macCommitment,
        uint256 protocolFee,
        bytes memo
    );
    event Withdraw(
        bytes3 contractVersion,
        address tokenAddress,
        uint256 amount,
        address withdrawalAddress,
        uint256 newNote,
        uint256 newNoteIndex,
        address relayerAddress,
        uint256 fee,
        uint256 macSalt,
        uint256 macCommitment,
        uint256 pocketMoney,
        uint256 protocolFee,
        bytes memo
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
        uint256 _anonymityRevokerPublicKeyX,
        uint256 _anonymityRevokerPublicKeyY,
        bool _isArbitrumChain,
        uint256 _protocolDepositFeeBps,
        uint256 _protocolWithdrawFeeBps,
        address _protocolFeeReceiver
    ) public initializer {
        __Ownable_init(initialOwner);
        __Pausable_init();
        __MerkleTree_init();
        __AnonymityRevoker_init(
            _anonymityRevokerPublicKeyX,
            _anonymityRevokerPublicKeyY
        );
        __Nullifiers_init(_isArbitrumChain);
        __ProtocolFee_init(
            _protocolDepositFeeBps,
            _protocolWithdrawFeeBps,
            _protocolFeeReceiver
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

    function setProtocolFeeReceiver(
        address newProtocolFeeReceiver
    ) external onlyOwner {
        _setProtocolFeeReceiver(newProtocolFeeReceiver);
    }

    function setProtocolDepositFeeBps(
        uint256 newProtocolDepositFeeBps
    ) external onlyOwner {
        _setProtocolDepositFeeBps(newProtocolDepositFeeBps);
    }

    function setProtocolWithdrawFeeBps(
        uint256 newProtocolWithdrawFeeBps
    ) external onlyOwner {
        _setProtocolWithdrawFeeBps(newProtocolWithdrawFeeBps);
    }

    /*
     * Allows the owner to set the anonymity revoker pubkey.
     */
    function setAnonymityRevokerPubkey(
        uint256 anonymityRevokerPubkeyX,
        uint256 anonymityRevokerPubkeyY
    ) external onlyOwner {
        _setAnonymityRevokerPubkey(
            anonymityRevokerPubkeyX,
            anonymityRevokerPubkeyY
        );
    }

    /*
     * Creates a fresh note, with an optional native token deposit.
     *
     * This transaction serves as an entrypoint to the Shielder.
     */
    function newAccountNative(
        bytes3 expectedContractVersion,
        uint256 newNote,
        uint256 prenullifier,
        uint256 symKeyEncryptionC1X,
        uint256 symKeyEncryptionC1Y,
        uint256 symKeyEncryptionC2X,
        uint256 symKeyEncryptionC2Y,
        uint256 macSalt,
        uint256 macCommitment,
        bytes calldata proof,
        bytes calldata memo
    ) external payable whenNotPaused {
        uint256 amount = msg.value;
        // `address(this).balance` already includes `msg.value`.
        if (address(this).balance > MAX_CONTRACT_BALANCE) {
            revert ContractBalanceLimitReached();
        }

        (uint256 newNoteIndex, uint256 protocolFee) = _newAccount(
            expectedContractVersion,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            newNote,
            prenullifier,
            symKeyEncryptionC1X,
            symKeyEncryptionC1Y,
            symKeyEncryptionC2X,
            symKeyEncryptionC2Y,
            macSalt,
            macCommitment,
            proof
        );

        // pay out the protocol fee
        _transferNative(protocolFeeReceiver(), protocolFee);

        emit NewAccount(
            CONTRACT_VERSION,
            prenullifier,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            newNote,
            newNoteIndex,
            macSalt,
            macCommitment,
            protocolFee,
            memo
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
        uint256 prenullifier,
        uint256 symKeyEncryptionC1X,
        uint256 symKeyEncryptionC1Y,
        uint256 symKeyEncryptionC2X,
        uint256 symKeyEncryptionC2Y,
        uint256 macSalt,
        uint256 macCommitment,
        bytes calldata proof,
        bytes calldata memo
    ) external whenNotPaused {
        IERC20 token = IERC20(tokenAddress);
        if (
            amount > MAX_CONTRACT_BALANCE ||
            token.balanceOf(address(this)) + amount > MAX_CONTRACT_BALANCE
        ) {
            revert ContractBalanceLimitReached();
        }

        (uint256 newNoteIndex, uint256 protocolFee) = _newAccount(
            expectedContractVersion,
            tokenAddress,
            amount,
            newNote,
            prenullifier,
            symKeyEncryptionC1X,
            symKeyEncryptionC1Y,
            symKeyEncryptionC2X,
            symKeyEncryptionC2Y,
            macSalt,
            macCommitment,
            proof
        );

        _transferERC20(token, msg.sender, address(this), amount);
        _transferERC20(token, protocolFeeReceiver(), protocolFee);

        emit NewAccount(
            CONTRACT_VERSION,
            prenullifier,
            tokenAddress,
            amount,
            newNote,
            newNoteIndex,
            macSalt,
            macCommitment,
            protocolFee,
            memo
        );
    }

    function _newAccount(
        bytes3 expectedContractVersion,
        address tokenAddress,
        uint256 amount,
        uint256 newNote,
        uint256 prenullifier,
        uint256 symKeyEncryptionC1X,
        uint256 symKeyEncryptionC1Y,
        uint256 symKeyEncryptionC2X,
        uint256 symKeyEncryptionC2Y,
        uint256 macSalt,
        uint256 macCommitment,
        bytes calldata proof
    )
        private
        restrictContractVersion(expectedContractVersion)
        fieldElement(newNote)
        fieldElement(prenullifier)
        fieldElement(symKeyEncryptionC1X)
        fieldElement(symKeyEncryptionC1Y)
        fieldElement(symKeyEncryptionC2X)
        fieldElement(symKeyEncryptionC2Y)
        fieldElement(macSalt)
        fieldElement(macCommitment)
        returns (uint256 newNoteIndex, uint256 protocolFee)
    {
        if (nullifiers(prenullifier) != 0) revert DuplicatedNullifier();

        protocolFee = _computeProtocolDepositFee(amount);

        // @dev must follow the same order as in the circuit
        uint256[] memory publicInputs = new uint256[](13);
        publicInputs[0] = newNote;
        publicInputs[1] = prenullifier;
        publicInputs[2] = amount - protocolFee;

        bytes memory commitment = abi.encodePacked(
            addressToUInt256(msg.sender),
            protocolFee
        );
        // @dev shifting right by 4 bits so the commitment is smaller from r
        publicInputs[3] = uint256(keccak256(commitment)) >> 4;

        publicInputs[4] = addressToUInt256(tokenAddress);

        (uint256 arX, uint256 arY) = anonymityRevokerPubkey();
        publicInputs[5] = arX;
        publicInputs[6] = arY;

        publicInputs[7] = symKeyEncryptionC1X;
        publicInputs[8] = symKeyEncryptionC1Y;
        publicInputs[9] = symKeyEncryptionC2X;
        publicInputs[10] = symKeyEncryptionC2Y;

        publicInputs[11] = macSalt;
        publicInputs[12] = macCommitment;

        bool success = NewAccountVerifier.verifyProof(proof, publicInputs);

        if (!success) revert NewAccountVerificationFailed();

        newNoteIndex = _addNote(newNote);
        _registerNullifier(prenullifier);
    }

    /*
     * Makes a native token deposit into the Shielder.
     */
    function depositNative(
        bytes3 expectedContractVersion,
        uint256 oldNullifierHash,
        uint256 newNote,
        uint256 merkleRoot,
        uint256 macSalt,
        uint256 macCommitment,
        bytes calldata proof,
        bytes calldata memo
    ) external payable whenNotPaused {
        uint256 amount = msg.value;
        // `address(this).balance` already includes `msg.value`.
        if (address(this).balance > MAX_CONTRACT_BALANCE) {
            revert ContractBalanceLimitReached();
        }

        (uint256 newNoteIndex, uint256 protocolFee) = _deposit(
            expectedContractVersion,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            oldNullifierHash,
            newNote,
            merkleRoot,
            macSalt,
            macCommitment,
            proof
        );

        // pay out the protocol fee
        _transferNative(protocolFeeReceiver(), protocolFee);

        emit Deposit(
            CONTRACT_VERSION,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            newNote,
            newNoteIndex,
            macSalt,
            macCommitment,
            protocolFee,
            memo
        );
    }

    /*
     * Makes an ERC20 token deposit into the Shielder.
     */
    function depositERC20(
        bytes3 expectedContractVersion,
        address tokenAddress,
        uint256 amount,
        uint256 oldNullifierHash,
        uint256 newNote,
        uint256 merkleRoot,
        uint256 macSalt,
        uint256 macCommitment,
        bytes calldata proof,
        bytes calldata memo
    ) external whenNotPaused {
        IERC20 token = IERC20(tokenAddress);
        if (
            amount > MAX_CONTRACT_BALANCE ||
            token.balanceOf(address(this)) + amount > MAX_CONTRACT_BALANCE
        ) {
            revert ContractBalanceLimitReached();
        }

        (uint256 newNoteIndex, uint256 protocolFee) = _deposit(
            expectedContractVersion,
            tokenAddress,
            amount,
            oldNullifierHash,
            newNote,
            merkleRoot,
            macSalt,
            macCommitment,
            proof
        );

        _transferERC20(token, msg.sender, address(this), amount);
        _transferERC20(token, protocolFeeReceiver(), protocolFee);

        emit Deposit(
            CONTRACT_VERSION,
            tokenAddress,
            amount,
            newNote,
            newNoteIndex,
            macSalt,
            macCommitment,
            protocolFee,
            memo
        );
    }

    function _deposit(
        bytes3 expectedContractVersion,
        address tokenAddress,
        uint256 amount,
        uint256 oldNullifierHash,
        uint256 newNote,
        uint256 merkleRoot,
        uint256 macSalt,
        uint256 macCommitment,
        bytes calldata proof
    )
        private
        restrictContractVersion(expectedContractVersion)
        fieldElement(oldNullifierHash)
        fieldElement(newNote)
        fieldElement(macSalt)
        fieldElement(macCommitment)
        returns (uint256 newNoteIndex, uint256 protocolFee)
    {
        if (amount == 0) revert ZeroAmount();
        if (nullifiers(oldNullifierHash) != 0) revert DuplicatedNullifier();
        if (!_merkleRootExists(merkleRoot)) revert MerkleRootDoesNotExist();

        protocolFee = _computeProtocolDepositFee(amount);

        // @dev needs to match the order in the circuit
        uint256[] memory publicInputs = new uint256[](8);
        publicInputs[0] = merkleRoot;
        publicInputs[1] = oldNullifierHash;
        publicInputs[2] = newNote;
        publicInputs[3] = amount - protocolFee;

        bytes memory commitment = abi.encodePacked(
            addressToUInt256(msg.sender),
            protocolFee
        );
        // @dev shifting right by 4 bits so the commitment is smaller from r
        publicInputs[4] = uint256(keccak256(commitment)) >> 4;

        publicInputs[5] = addressToUInt256(tokenAddress);
        publicInputs[6] = macSalt;
        publicInputs[7] = macCommitment;

        bool success = DepositVerifier.verifyProof(proof, publicInputs);

        if (!success) revert DepositVerificationFailed();

        newNoteIndex = _addNote(newNote);
        _registerNullifier(oldNullifierHash);
    }

    /*
     * Withdraw shielded native funds
     */
    function withdrawNative(
        bytes3 expectedContractVersion,
        uint256 amount,
        address withdrawalAddress,
        uint256 merkleRoot,
        uint256 oldNullifierHash,
        uint256 newNote,
        bytes calldata proof,
        address relayerAddress,
        uint256 relayerFee,
        uint256 macSalt,
        uint256 macCommitment,
        bytes calldata memo
    ) external whenNotPaused {
        (uint256 newNoteIndex, uint256 protocolFee) = _withdraw(
            expectedContractVersion,
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
            macCommitment,
            0,
            memo
        );

        _transferNative(withdrawalAddress, amount - protocolFee - relayerFee);
        _transferNative(protocolFeeReceiver(), protocolFee);
        _transferNative(relayerAddress, relayerFee);

        emit Withdraw(
            CONTRACT_VERSION,
            NATIVE_TOKEN_NOTE_ADDRESS,
            amount,
            withdrawalAddress,
            newNote,
            newNoteIndex,
            relayerAddress,
            relayerFee,
            macSalt,
            macCommitment,
            0,
            protocolFee,
            memo
        );
    }

    function withdrawERC20(
        bytes3 expectedContractVersion,
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
        uint256 macCommitment,
        bytes calldata memo
    ) external payable whenNotPaused {
        uint256 pocketMoney = msg.value;

        (uint256 newNoteIndex, uint256 protocolFee) = _withdraw(
            expectedContractVersion,
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
            macCommitment,
            pocketMoney,
            memo
        );

        IERC20 token = IERC20(tokenAddress);
        _transferERC20(
            token,
            withdrawalAddress,
            amount - protocolFee - relayerFee
        );
        _transferERC20(token, protocolFeeReceiver(), protocolFee);
        _transferERC20(token, relayerAddress, relayerFee);

        // forward pocket money
        _transferNative(withdrawalAddress, pocketMoney);

        emit Withdraw(
            CONTRACT_VERSION,
            tokenAddress,
            amount,
            withdrawalAddress,
            newNote,
            newNoteIndex,
            relayerAddress,
            relayerFee,
            macSalt,
            macCommitment,
            pocketMoney,
            protocolFee,
            memo
        );
    }

    function _withdraw(
        bytes3 expectedContractVersion,
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
        uint256 macCommitment,
        uint256 pocketMoney,
        bytes calldata memo
    )
        private
        restrictContractVersion(expectedContractVersion)
        fieldElement(oldNullifierHash)
        fieldElement(newNote)
        returns (uint256 newNoteIndex, uint256 protocolFee)
    {
        require(amount != 0, ZeroAmount());
        require(amount <= MAX_TRANSACTION_AMOUNT, AmountTooHigh());

        protocolFee = _computeProtocolWithdrawFee(amount);

        require(amount - protocolFee > relayerFee, FeeHigherThanAmount());
        require(_merkleRootExists(merkleRoot), MerkleRootDoesNotExist());
        require(nullifiers(oldNullifierHash) == 0, DuplicatedNullifier());

        // @dev needs to match the order in the circuit
        uint256[] memory publicInputs = new uint256[](8);
        publicInputs[0] = merkleRoot;
        publicInputs[1] = oldNullifierHash;
        publicInputs[2] = newNote;
        publicInputs[3] = amount;
        publicInputs[4] = addressToUInt256(tokenAddress);

        uint256 chainId = block.chainid;

        bytes memory commitment = abi.encodePacked(
            CONTRACT_VERSION,
            addressToUInt256(withdrawalAddress),
            addressToUInt256(relayerAddress),
            relayerFee,
            chainId,
            pocketMoney,
            protocolFee,
            memo
        );
        // @dev shifting right by 4 bits so the commitment is smaller from r
        publicInputs[5] = uint256(keccak256(commitment)) >> 4;
        publicInputs[6] = macSalt;
        publicInputs[7] = macCommitment;

        bool success = WithdrawVerifier.verifyProof(proof, publicInputs);

        if (!success) revert WithdrawVerificationFailed();

        newNoteIndex = _addNote(newNote);
        _registerNullifier(oldNullifierHash);
    }

    function _transferNative(address to, uint256 amount) private {
        if (amount != 0) {
            (bool nativeTransferSuccess, ) = to.call{
                value: amount,
                gas: GAS_LIMIT
            }("");
            if (!nativeTransferSuccess) revert NativeTransferFailed();
        }
    }

    function _transferERC20(IERC20 token, address to, uint256 amount) private {
        if (amount != 0) {
            token.safeTransfer(to, amount);
        }
    }

    function _transferERC20(
        IERC20 token,
        address from,
        address to,
        uint256 amount
    ) private {
        if (amount != 0) {
            token.safeTransferFrom(from, to, amount);
        }
    }

    function addressToUInt256(address addr) public pure returns (uint256) {
        return uint256(uint160(addr));
    }

    modifier fieldElement(uint256 x) {
        require(x < FIELD_MODULUS, NotAFieldElement());
        _;
    }
}

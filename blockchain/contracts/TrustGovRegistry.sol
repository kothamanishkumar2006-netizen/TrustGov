// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TrustGovRegistry
 * @notice Immutable blockchain integrity anchor and status registry for TrustGov
 *         Decentralized Identifiers (DIDs) and W3C Verifiable Credentials (VCs).
 *
 * @dev SECURITY & PRIVACY PRINCIPLES:
 * 1. ZERO PERSONAL DATA ON-CHAIN:
 *    Only cryptographic bytes32 hashes (SHA-256), timestamps, and status enums
 *    are stored on-chain. No personal identities, Aadhaar, PAN, phone numbers,
 *    or credential JSON payloads are ever stored.
 * 2. ZERO PRIVATE KEYS:
 *    The contract never accepts, stores, or handles private keys.
 * 3. STRICT ACCESS CONTROL:
 *    Administrative write functions (registration, status updates) are restricted
 *    to authorized contract owners/administrators.
 * 4. PERMANENT REVOCATION:
 *    Once a credential is REVOKED on-chain, it CANNOT be reactivated or suspended.
 */

contract TrustGovRegistry {
    // --- Access Control ---
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized(msg.sender);
        }
        _;
    }

    // --- Status Enumeration ---
    enum CredentialStatus {
        NONE,       // 0: Unregistered
        ACTIVE,     // 1: Active and valid
        SUSPENDED,  // 2: Temporarily suspended
        REVOKED     // 3: Permanently revoked (irreversible)
    }

    // --- Data Models ---
    struct DIDRecord {
        bytes32 didHash;
        bool registered;
        uint256 registeredAt;
    }

    struct CredentialRecord {
        bytes32 credentialHash;
        bytes32 officerDIDHash;
        bytes32 issuerDIDHash;
        CredentialStatus status;
        uint256 registeredAt;
        bool registered;
    }

    // --- State Storage ---
    mapping(bytes32 => DIDRecord) private _didRegistry;
    mapping(bytes32 => CredentialRecord) private _credentialRegistry;

    // --- Events ---
    event DIDRegistered(
        bytes32 indexed didHash,
        uint256 timestamp
    );

    event CredentialRegistered(
        bytes32 indexed credentialHash,
        bytes32 indexed officerDIDHash,
        bytes32 indexed issuerDIDHash,
        CredentialStatus status,
        uint256 timestamp
    );

    event CredentialStatusUpdated(
        bytes32 indexed credentialHash,
        CredentialStatus status,
        uint256 timestamp
    );

    // --- Custom Errors ---
    error Unauthorized(address caller);
    error ZeroAddressNotAllowed();
    error ZeroHashNotAllowed();
    error DIDAlreadyRegistered(bytes32 didHash);
    error DIDNotRegistered(bytes32 didHash);
    error CredentialAlreadyRegistered(bytes32 credentialHash);
    error CredentialNotRegistered(bytes32 credentialHash);
    error InvalidInitialStatus();
    error CannotRegisterAsRevoked();
    error RevocationIsPermanent();
    error InvalidStatusTransition();
    error StatusUnchanged();

    /**
     * @notice Deploy TrustGovRegistry and set deployer as owner
     */
    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @notice Transfer contract ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // =========================================================================
    // DID REGISTRY
    // =========================================================================

    /**
     * @notice Register a Decentralized Identifier hash on the immutable blockchain registry
     * @param didHash The SHA-256 bytes32 hash of the canonical DID string
     */
    function registerDID(bytes32 didHash) external onlyOwner {
        if (didHash == bytes32(0)) {
            revert ZeroHashNotAllowed();
        }
        if (_didRegistry[didHash].registered) {
            revert DIDAlreadyRegistered(didHash);
        }

        _didRegistry[didHash] = DIDRecord({
            didHash: didHash,
            registered: true,
            registeredAt: block.timestamp
        });

        emit DIDRegistered(didHash, block.timestamp);
    }

    /**
     * @notice Check if a DID hash is registered on-chain
     * @param didHash The SHA-256 bytes32 hash of the DID
     */
    function isDIDRegistered(bytes32 didHash) external view returns (bool) {
        return _didRegistry[didHash].registered;
    }

    /**
     * @notice Retrieve the full DID registry record
     * @param didHash The SHA-256 bytes32 hash of the DID
     */
    function getDIDRecord(bytes32 didHash) external view returns (DIDRecord memory) {
        return _didRegistry[didHash];
    }

    // =========================================================================
    // VERIFIABLE CREDENTIAL REGISTRY
    // =========================================================================

    /**
     * @notice Register and anchor a Verifiable Credential integrity hash on-chain
     * @param credentialHash The SHA-256 bytes32 hash of the RFC 8785-canonicalized credential payload
     * @param officerDIDHash The SHA-256 bytes32 hash of the subject officer's DID
     * @param issuerDIDHash The SHA-256 bytes32 hash of the issuing authority's DID
     * @param status Initial credential status (must be ACTIVE or SUSPENDED)
     */
    function registerCredential(
        bytes32 credentialHash,
        bytes32 officerDIDHash,
        bytes32 issuerDIDHash,
        CredentialStatus status
    ) external onlyOwner {
        if (credentialHash == bytes32(0) || officerDIDHash == bytes32(0) || issuerDIDHash == bytes32(0)) {
            revert ZeroHashNotAllowed();
        }
        if (_credentialRegistry[credentialHash].registered) {
            revert CredentialAlreadyRegistered(credentialHash);
        }
        if (status == CredentialStatus.NONE) {
            revert InvalidInitialStatus();
        }
        if (status == CredentialStatus.REVOKED) {
            revert CannotRegisterAsRevoked();
        }

        _credentialRegistry[credentialHash] = CredentialRecord({
            credentialHash: credentialHash,
            officerDIDHash: officerDIDHash,
            issuerDIDHash: issuerDIDHash,
            status: status,
            registeredAt: block.timestamp,
            registered: true
        });

        emit CredentialRegistered(credentialHash, officerDIDHash, issuerDIDHash, status, block.timestamp);
    }

    /**
     * @notice Update the lifecycle status of an anchored Verifiable Credential
     * @dev Enforces permanent revocation: a REVOKED credential can NEVER be reactivated or suspended.
     * @param credentialHash The SHA-256 bytes32 hash of the credential
     * @param newStatus The target CredentialStatus (ACTIVE, SUSPENDED, or REVOKED)
     */
    function updateCredentialStatus(
        bytes32 credentialHash,
        CredentialStatus newStatus
    ) external onlyOwner {
        if (!_credentialRegistry[credentialHash].registered) {
            revert CredentialNotRegistered(credentialHash);
        }

        CredentialStatus currentStatus = _credentialRegistry[credentialHash].status;

        // Permanent revocation rule: once revoked, state can never change
        if (currentStatus == CredentialStatus.REVOKED) {
            revert RevocationIsPermanent();
        }

        if (newStatus == CredentialStatus.NONE) {
            revert InvalidStatusTransition();
        }

        if (newStatus == currentStatus) {
            revert StatusUnchanged();
        }

        _credentialRegistry[credentialHash].status = newStatus;

        emit CredentialStatusUpdated(credentialHash, newStatus, block.timestamp);
    }

    /**
     * @notice Check if a credential hash is registered on-chain
     * @param credentialHash The SHA-256 bytes32 hash of the credential
     */
    function isCredentialRegistered(bytes32 credentialHash) external view returns (bool) {
        return _credentialRegistry[credentialHash].registered;
    }

    /**
     * @notice Retrieve the full Credential registry record
     * @param credentialHash The SHA-256 bytes32 hash of the credential
     */
    function getCredentialRecord(bytes32 credentialHash) external view returns (CredentialRecord memory) {
        return _credentialRegistry[credentialHash];
    }

    /**
     * @notice Verify a credential hash and return its registration status, current status, and registration timestamp
     * @param credentialHash The SHA-256 bytes32 hash of the credential
     */
    function verifyCredentialHash(
        bytes32 credentialHash
    ) external view returns (
        bool registered,
        CredentialStatus status,
        uint256 registeredAt
    ) {
        CredentialRecord memory record = _credentialRegistry[credentialHash];
        return (record.registered, record.status, record.registeredAt);
    }
}

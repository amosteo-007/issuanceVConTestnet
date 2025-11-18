// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title VCRegistry
 * @notice Simplified Verifiable Credential Registry for Base Sepolia
 * @dev Stores and manages KYC verifiable credentials on-chain
 */
contract VCRegistry {

    // ============ Structs ============

    struct VerifiableCredential {
        bytes32 credentialHash;      // Hash of the credential data
        address subject;             // User who owns the credential
        address issuer;              // Entity that issued the credential
        uint256 issuanceDate;        // When credential was issued
        uint256 expirationDate;      // When credential expires (0 for no expiration)
        bool isRevoked;              // Whether credential has been revoked
        uint256 revocationTimestamp; // When credential was revoked (0 if not revoked)
        string credentialType;       // Type of credential (e.g., "KYCVerification")
        bytes credentialData;        // Encrypted or hashed credential data
    }

    // ============ State Variables ============

    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => bytes32[]) public subjectCredentials;
    mapping(address => bytes32[]) public issuerCredentials;

    uint256 public totalCredentials;
    address public admin;
    mapping(address => bool) public authorizedIssuers;

    // ============ Events ============

    event CredentialIssued(
        bytes32 indexed credentialHash,
        address indexed subject,
        address indexed issuer,
        string credentialType,
        uint256 issuanceDate,
        uint256 expirationDate
    );

    event CredentialRevoked(
        bytes32 indexed credentialHash,
        address indexed subject,
        uint256 revocationDate
    );

    event IssuerAuthorized(address indexed issuer, bool authorized);

    event ExpiredCredentialRemoved(
        bytes32 indexed credentialHash,
        address indexed subject,
        uint256 removalDate
    );

    // ============ Modifiers ============

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyAuthorizedIssuer() {
        require(authorizedIssuers[msg.sender] || msg.sender == admin, "Not authorized to issue credentials");
        _;
    }

    // ============ Constructor ============

    constructor() {
        admin = msg.sender;
        authorizedIssuers[msg.sender] = true;
    }

    // ============ Core Functions ============

    /**
     * @notice Issue a new verifiable credential
     * @param _subject Address of the credential subject
     * @param _credentialType Type of credential
     * @param _credentialData Credential data (can be encrypted/hashed)
     * @param _expirationDate Expiration timestamp (0 for no expiration)
     */
    function issueCredential(
        address _subject,
        string memory _credentialType,
        bytes memory _credentialData,
        uint256 _expirationDate
    ) external onlyAuthorizedIssuer returns (bytes32 credentialHash) {
        require(_subject != address(0), "Invalid subject address");

        // Generate credential hash
        credentialHash = keccak256(
            abi.encodePacked(
                _subject,
                msg.sender,
                _credentialType,
                _credentialData,
                block.timestamp,
                totalCredentials
            )
        );

        require(credentials[credentialHash].issuanceDate == 0, "Credential already exists");

        // Create credential
        VerifiableCredential memory newCredential = VerifiableCredential({
            credentialHash: credentialHash,
            subject: _subject,
            issuer: msg.sender,
            issuanceDate: block.timestamp,
            expirationDate: _expirationDate,
            isRevoked: false,
            revocationTimestamp: 0,
            credentialType: _credentialType,
            credentialData: _credentialData
        });

        // Store credential
        credentials[credentialHash] = newCredential;
        subjectCredentials[_subject].push(credentialHash);
        issuerCredentials[msg.sender].push(credentialHash);
        totalCredentials++;

        emit CredentialIssued(
            credentialHash,
            _subject,
            msg.sender,
            _credentialType,
            block.timestamp,
            _expirationDate
        );

        return credentialHash;
    }

    /**
     * @notice Revoke a credential
     * @param _credentialHash Hash of the credential to revoke
     */
    function revokeCredential(bytes32 _credentialHash) external {
        VerifiableCredential storage credential = credentials[_credentialHash];

        require(credential.issuanceDate != 0, "Credential does not exist");
        require(!credential.isRevoked, "Credential already revoked");
        require(
            msg.sender == credential.issuer || msg.sender == admin,
            "Only issuer or admin can revoke"
        );

        credential.isRevoked = true;
        credential.revocationTimestamp = block.timestamp;

        emit CredentialRevoked(_credentialHash, credential.subject, block.timestamp);
    }

    /**
     * @notice Check if a credential is valid
     * @param _credentialHash Hash of the credential to check
     * @return isValid Whether the credential is valid
     */
    function isCredentialValid(bytes32 _credentialHash) external view returns (bool isValid) {
        VerifiableCredential memory credential = credentials[_credentialHash];

        if (credential.issuanceDate == 0) return false;
        if (credential.isRevoked) return false;
        if (credential.expirationDate != 0 && block.timestamp > credential.expirationDate) {
            return false;
        }

        return true;
    }

    /**
     * @notice Get credential details
     * @param _credentialHash Hash of the credential
     */
    function getCredential(bytes32 _credentialHash)
        external
        view
        returns (
            address subject,
            address issuer,
            uint256 issuanceDate,
            uint256 expirationDate,
            bool isRevoked,
            string memory credentialType
        )
    {
        VerifiableCredential memory credential = credentials[_credentialHash];
        return (
            credential.subject,
            credential.issuer,
            credential.issuanceDate,
            credential.expirationDate,
            credential.isRevoked,
            credential.credentialType
        );
    }

    /**
     * @notice Get all credentials for a subject
     * @param _subject Address of the subject
     */
    function getSubjectCredentials(address _subject)
        external
        view
        returns (bytes32[] memory)
    {
        return subjectCredentials[_subject];
    }

    /**
     * @notice Get all credentials issued by an issuer
     * @param _issuer Address of the issuer
     */
    function getIssuerCredentials(address _issuer)
        external
        view
        returns (bytes32[] memory)
    {
        return issuerCredentials[_issuer];
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize or deauthorize an issuer
     * @param _issuer Address of the issuer
     * @param _authorized Whether to authorize or deauthorize
     */
    function setAuthorizedIssuer(address _issuer, bool _authorized) external onlyAdmin {
        require(_issuer != address(0), "Invalid issuer address");
        authorizedIssuers[_issuer] = _authorized;
        emit IssuerAuthorized(_issuer, _authorized);
    }

    /**
     * @notice Transfer admin role
     * @param _newAdmin Address of the new admin
     */
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        admin = _newAdmin;
        authorizedIssuers[_newAdmin] = true;
    }

    /**
     * @notice Check if an address is an authorized issuer
     * @param _issuer Address to check
     */
    function isAuthorizedIssuer(address _issuer) external view returns (bool) {
        return authorizedIssuers[_issuer];
    }

    /**
     * @notice Remove an expired credential from the registry
     * @param _credentialHash Hash of the credential to remove
     * @dev Only authorized issuers or admin can remove expired credentials
     * @dev This marks the credential as revoked if it's expired
     */
    function removeExpiredCredential(bytes32 _credentialHash) external onlyAuthorizedIssuer {
        VerifiableCredential storage credential = credentials[_credentialHash];

        require(credential.issuanceDate != 0, "Credential does not exist");
        require(!credential.isRevoked, "Credential already revoked");
        require(credential.expirationDate != 0, "Credential has no expiration date");
        require(block.timestamp > credential.expirationDate, "Credential has not expired yet");

        // Mark as revoked instead of deleting to maintain history
        credential.isRevoked = true;
        credential.revocationTimestamp = block.timestamp;

        emit ExpiredCredentialRemoved(_credentialHash, credential.subject, block.timestamp);
    }

    /**
     * @notice Batch remove multiple expired credentials
     * @param _credentialHashes Array of credential hashes to remove
     * @dev Only authorized issuers or admin can remove expired credentials
     * @dev Skips credentials that don't meet removal criteria
     */
    function batchRemoveExpiredCredentials(bytes32[] calldata _credentialHashes)
        external
        onlyAuthorizedIssuer
        returns (uint256 removedCount)
    {
        removedCount = 0;

        for (uint256 i = 0; i < _credentialHashes.length; i++) {
            bytes32 credHash = _credentialHashes[i];
            VerifiableCredential storage credential = credentials[credHash];

            // Skip if credential doesn't exist or is already revoked
            if (credential.issuanceDate == 0 || credential.isRevoked) {
                continue;
            }

            // Skip if no expiration date or not yet expired
            if (credential.expirationDate == 0 || block.timestamp <= credential.expirationDate) {
                continue;
            }

            // Mark as revoked
            credential.isRevoked = true;
            credential.revocationTimestamp = block.timestamp;
            removedCount++;

            emit ExpiredCredentialRemoved(credHash, credential.subject, block.timestamp);
        }

        return removedCount;
    }

    /**
     * @notice Get all expired credentials for a subject
     * @param _subject Address of the subject
     * @return expiredCredentials Array of expired credential hashes
     */
    function getExpiredCredentials(address _subject)
        external
        view
        returns (bytes32[] memory expiredCredentials)
    {
        bytes32[] memory allCreds = subjectCredentials[_subject];
        uint256 expiredCount = 0;

        // First pass: count expired credentials
        for (uint256 i = 0; i < allCreds.length; i++) {
            VerifiableCredential memory cred = credentials[allCreds[i]];
            if (cred.expirationDate != 0 &&
                block.timestamp > cred.expirationDate &&
                !cred.isRevoked) {
                expiredCount++;
            }
        }

        // Second pass: populate array
        expiredCredentials = new bytes32[](expiredCount);
        uint256 index = 0;

        for (uint256 i = 0; i < allCreds.length; i++) {
            VerifiableCredential memory cred = credentials[allCreds[i]];
            if (cred.expirationDate != 0 &&
                block.timestamp > cred.expirationDate &&
                !cred.isRevoked) {
                expiredCredentials[index] = allCreds[i];
                index++;
            }
        }

        return expiredCredentials;
    }
}

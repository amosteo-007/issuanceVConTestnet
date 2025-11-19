// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title VCRegistry
 * @notice Primary Verifiable Credential Registry for Base Sepolia
 * @dev Manages KYC verifiable credentials with AVS operator staking requirements
 * @notice Integrates with AVSManagement contract for issuer stake validation
 */

interface IAVSManagement {
    function isActiveIssuer(address issuer) external view returns (bool);
    function recordCredentialIssued(address issuer, bytes32 credentialHash) external;
    function recordCredentialRevoked(address issuer, bytes32 credentialHash) external;
}

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
        bool isPurged;               // Whether credential has been purged from active registry
        uint256 purgeTimestamp;      // When credential was purged
    }

    // ============ State Variables ============

    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => bytes32[]) public subjectCredentials;
    mapping(address => bytes32[]) public issuerCredentials;

    uint256 public totalCredentials;
    uint256 public totalPurged;
    address public admin;

    // AVSManagement contract reference
    IAVSManagement public avsManagement;

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
        address indexed issuer,
        uint256 revocationDate
    );

    event CredentialPurged(
        bytes32 indexed credentialHash,
        address indexed subject,
        address indexed issuer,
        string reason,
        uint256 purgeDate
    );

    event AVSManagementUpdated(address indexed oldAddress, address indexed newAddress);

    // ============ Modifiers ============

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyActiveIssuer() {
        require(
            avsManagement.isActiveIssuer(msg.sender),
            "Caller must be active issuer with minimum stake"
        );
        _;
    }

    // ============ Constructor ============

    /**
     * @dev Constructor sets the AVSManagement contract address
     * @param _avsManagementAddress Address of the AVSManagement contract
     */
    constructor(address _avsManagementAddress) {
        require(_avsManagementAddress != address(0), "Invalid AVSManagement address");
        admin = msg.sender;
        avsManagement = IAVSManagement(_avsManagementAddress);
    }

    // ============ Core Functions ============

    /**
     * @notice Issue a new verifiable credential
     * @dev Caller must be an active issuer with minimum DID3 stake (999,999 tokens)
     * @param _subject Address of the credential subject
     * @param _credentialType Type of credential (e.g., "KYCVerification", "AgeProof")
     * @param _credentialData Credential data (can be encrypted/hashed)
     * @param _expirationDate Expiration timestamp (0 for no expiration)
     * @return credentialHash Unique hash identifying the credential
     */
    function issueCredential(
        address _subject,
        string memory _credentialType,
        bytes memory _credentialData,
        uint256 _expirationDate
    ) external onlyActiveIssuer returns (bytes32 credentialHash) {
        require(_subject != address(0), "Invalid subject address");
        require(bytes(_credentialType).length > 0, "Credential type cannot be empty");

        // Generate unique credential hash
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
            credentialData: _credentialData,
            isPurged: false,
            purgeTimestamp: 0
        });

        // Store credential
        credentials[credentialHash] = newCredential;
        subjectCredentials[_subject].push(credentialHash);
        issuerCredentials[msg.sender].push(credentialHash);
        totalCredentials++;

        // Record issuance in AVSManagement
        avsManagement.recordCredentialIssued(msg.sender, credentialHash);

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
     * @dev Only the original issuer can revoke their credential
     * @param _credentialHash Hash of the credential to revoke
     */
    function revokeCredential(bytes32 _credentialHash) external {
        VerifiableCredential storage credential = credentials[_credentialHash];

        require(credential.issuanceDate != 0, "Credential does not exist");
        require(!credential.isRevoked, "Credential already revoked");
        require(!credential.isPurged, "Credential has been purged");
        require(
            msg.sender == credential.issuer,
            "Only original issuer can revoke"
        );

        credential.isRevoked = true;
        credential.revocationTimestamp = block.timestamp;

        // Record revocation in AVSManagement
        avsManagement.recordCredentialRevoked(msg.sender, _credentialHash);

        emit CredentialRevoked(
            _credentialHash,
            credential.subject,
            credential.issuer,
            block.timestamp
        );
    }

    /**
     * @notice Purge a revoked or expired credential from the registry
     * @dev Only the original issuer can purge their credential
     * @dev Credential must be either revoked or expired to be purged
     * @param _credentialHash Hash of the credential to purge
     */
    function purgeCredential(bytes32 _credentialHash) external {
        VerifiableCredential storage credential = credentials[_credentialHash];

        require(credential.issuanceDate != 0, "Credential does not exist");
        require(!credential.isPurged, "Credential already purged");
        require(
            msg.sender == credential.issuer,
            "Only original issuer can purge"
        );

        // Check if credential is revoked or expired
        bool isExpired = credential.expirationDate != 0 && block.timestamp > credential.expirationDate;
        require(
            credential.isRevoked || isExpired,
            "Credential must be revoked or expired to purge"
        );

        // Determine purge reason
        string memory reason;
        if (credential.isRevoked) {
            reason = "revoked";
        } else {
            reason = "expired";
        }

        credential.isPurged = true;
        credential.purgeTimestamp = block.timestamp;
        totalPurged++;

        emit CredentialPurged(
            _credentialHash,
            credential.subject,
            credential.issuer,
            reason,
            block.timestamp
        );
    }

    /**
     * @notice Batch purge multiple revoked or expired credentials
     * @dev Only the original issuer can purge their credentials
     * @param _credentialHashes Array of credential hashes to purge
     * @return purgedCount Number of credentials successfully purged
     */
    function batchPurgeCredentials(bytes32[] calldata _credentialHashes)
        external
        returns (uint256 purgedCount)
    {
        purgedCount = 0;

        for (uint256 i = 0; i < _credentialHashes.length; i++) {
            bytes32 credHash = _credentialHashes[i];
            VerifiableCredential storage credential = credentials[credHash];

            // Skip if credential doesn't exist or is already purged
            if (credential.issuanceDate == 0 || credential.isPurged) {
                continue;
            }

            // Skip if not the original issuer
            if (msg.sender != credential.issuer) {
                continue;
            }

            // Check if credential is revoked or expired
            bool isExpired = credential.expirationDate != 0 && block.timestamp > credential.expirationDate;
            if (!credential.isRevoked && !isExpired) {
                continue;
            }

            // Determine purge reason
            string memory reason = credential.isRevoked ? "revoked" : "expired";

            credential.isPurged = true;
            credential.purgeTimestamp = block.timestamp;
            totalPurged++;
            purgedCount++;

            emit CredentialPurged(
                credHash,
                credential.subject,
                credential.issuer,
                reason,
                block.timestamp
            );
        }

        return purgedCount;
    }

    /**
     * @notice Check if a credential is valid
     * @param _credentialHash Hash of the credential to check
     * @return isValid Whether the credential is valid (not revoked, not expired, not purged)
     */
    function isCredentialValid(bytes32 _credentialHash) external view returns (bool isValid) {
        VerifiableCredential memory credential = credentials[_credentialHash];

        if (credential.issuanceDate == 0) return false;
        if (credential.isRevoked) return false;
        if (credential.isPurged) return false;
        if (credential.expirationDate != 0 && block.timestamp > credential.expirationDate) {
            return false;
        }

        return true;
    }

    /**
     * @notice Get credential details
     * @param _credentialHash Hash of the credential
     * @return subject Address of the credential subject
     * @return issuer Address of the credential issuer
     * @return issuanceDate Timestamp when credential was issued
     * @return expirationDate Timestamp when credential expires (0 if no expiration)
     * @return isRevoked Whether credential is revoked
     * @return isPurged Whether credential is purged
     * @return credentialType Type of credential
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
            bool isPurged,
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
            credential.isPurged,
            credential.credentialType
        );
    }

    /**
     * @notice Get full credential details including data
     * @param _credentialHash Hash of the credential
     * @return credential Full VerifiableCredential struct
     */
    function getFullCredential(bytes32 _credentialHash)
        external
        view
        returns (VerifiableCredential memory credential)
    {
        return credentials[_credentialHash];
    }

    /**
     * @notice Get all credentials for a subject
     * @param _subject Address of the subject
     * @return Array of credential hashes
     */
    function getSubjectCredentials(address _subject)
        external
        view
        returns (bytes32[] memory)
    {
        return subjectCredentials[_subject];
    }

    /**
     * @notice Get all valid (non-purged, non-revoked, non-expired) credentials for a subject
     * @param _subject Address of the subject
     * @return validCredentials Array of valid credential hashes
     */
    function getValidSubjectCredentials(address _subject)
        external
        view
        returns (bytes32[] memory validCredentials)
    {
        bytes32[] memory allCreds = subjectCredentials[_subject];
        uint256 validCount = 0;

        // First pass: count valid credentials
        for (uint256 i = 0; i < allCreds.length; i++) {
            VerifiableCredential memory cred = credentials[allCreds[i]];
            bool isExpired = cred.expirationDate != 0 && block.timestamp > cred.expirationDate;
            if (!cred.isRevoked && !cred.isPurged && !isExpired) {
                validCount++;
            }
        }

        // Second pass: populate array
        validCredentials = new bytes32[](validCount);
        uint256 index = 0;

        for (uint256 i = 0; i < allCreds.length; i++) {
            VerifiableCredential memory cred = credentials[allCreds[i]];
            bool isExpired = cred.expirationDate != 0 && block.timestamp > cred.expirationDate;
            if (!cred.isRevoked && !cred.isPurged && !isExpired) {
                validCredentials[index] = allCreds[i];
                index++;
            }
        }

        return validCredentials;
    }

    /**
     * @notice Get all credentials issued by an issuer
     * @param _issuer Address of the issuer
     * @return Array of credential hashes
     */
    function getIssuerCredentials(address _issuer)
        external
        view
        returns (bytes32[] memory)
    {
        return issuerCredentials[_issuer];
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
                !cred.isPurged) {
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
                !cred.isPurged) {
                expiredCredentials[index] = allCreds[i];
                index++;
            }
        }

        return expiredCredentials;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the AVSManagement contract address
     * @param _newAVSManagement Address of the new AVSManagement contract
     */
    function updateAVSManagement(address _newAVSManagement) external onlyAdmin {
        require(_newAVSManagement != address(0), "Invalid address");
        address oldAddress = address(avsManagement);
        avsManagement = IAVSManagement(_newAVSManagement);
        emit AVSManagementUpdated(oldAddress, _newAVSManagement);
    }

    /**
     * @notice Transfer admin role
     * @param _newAdmin Address of the new admin
     */
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid admin address");
        admin = _newAdmin;
    }

    /**
     * @notice Get registry statistics
     * @return total Total credentials issued
     * @return purged Total credentials purged
     * @return active Active credentials (total - purged)
     */
    function getStatistics() external view returns (
        uint256 total,
        uint256 purged,
        uint256 active
    ) {
        return (totalCredentials, totalPurged, totalCredentials - totalPurged);
    }

    // ============================================================
    // ============ ZK PROOF INTEGRATION (Groth16) ================
    // ============================================================

    /**
     * TODO: Integrate Groth16 zk-SNARKs for privacy-preserving credential verification
     *
     * Planned Features:
     * 1. Zero-Knowledge Proof Generation:
     *    - Generate Groth16 proofs for credential attributes without revealing full data
     *    - Prove age > 18 without revealing exact date of birth
     *    - Prove citizenship without revealing full credential
     *
     * 2. Proof Verification:
     *    function verifyGroth16Proof(
     *        bytes32 credentialHash,
     *        uint256[2] memory a,
     *        uint256[2][2] memory b,
     *        uint256[2] memory c,
     *        uint256[] memory publicInputs
     *    ) external view returns (bool)
     *
     * 3. Selective Disclosure:
     *    - Allow subjects to prove specific attributes without full credential disclosure
     *    - Support for multiple proof types (age, residency, accreditation)
     *
     * 4. Trusted Setup:
     *    - Store verification keys for different credential types
     *    - Support multiple circuits for different proof requirements
     *
     * 5. Integration Points:
     *    - Snarkjs library for proof generation (client-side)
     *    - Verifier contract deployment for on-chain verification
     *    - Circuit design for common KYC attributes
     *
     * 6. Privacy Enhancements:
     *    - Nullifier system to prevent double-spending of proofs
     *    - Anonymous credential presentation
     *    - Revocation check within ZK proof
     *
     * Implementation Steps:
     * a) Design circuits for common credential attributes
     * b) Generate trusted setup parameters (powers of tau ceremony)
     * c) Deploy Groth16 verifier contracts
     * d) Integrate proof generation in frontend
     * e) Add proof verification functions to this contract
     * f) Create proof templates for common use cases
     */

    // Placeholder for future ZK proof verification
    // function verifyCredentialProof(
    //     bytes32 credentialHash,
    //     bytes memory zkProof,
    //     bytes memory publicSignals
    // ) external view returns (bool) {
    //     // TODO: Implement Groth16 proof verification
    //     revert("ZK proof verification not yet implemented");
    // }

    // ============================================================
    // ============ DeFi PROTOCOL INTEGRATION =====================
    // ============================================================

    /**
     * TODO: Integrate with DeFi protocols requiring KYC verification
     *
     * Planned Features:
     * 1. KYC Status Check for DeFi Protocols:
     *    - Allow whitelisted DeFi protocols to verify user KYC status
     *    - Support for multiple KYC tiers (basic, advanced, accredited)
     *
     * 2. Protocol Registration:
     *    function registerProtocol(
     *        address protocolAddress,
     *        string memory protocolName,
     *        uint256 requiredKYCLevel
     *    ) external onlyAdmin
     *
     * 3. KYC Verification Interface:
     *    function isUserKYCVerified(
     *        address user,
     *        address protocol
     *    ) external view returns (bool verified, uint256 kycLevel, uint256 expiresAt)
     *
     * 4. Credential Requirements:
     *    - Define minimum credential requirements per protocol
     *    - Support for jurisdiction-specific requirements
     *    - Age verification for age-restricted protocols
     *
     * 5. Protocol Categories:
     *    - Lending/Borrowing platforms (Aave, Compound)
     *    - DEX with KYC requirements (regulated exchanges)
     *    - Tokenized securities platforms
     *    - Stablecoin issuers requiring KYC
     *    - Derivatives and options platforms
     *
     * 6. Callback Integration:
     *    - Event emissions for protocol monitoring
     *    - Webhook support for real-time updates
     *    - Revocation notifications to integrated protocols
     *
     * 7. Compliance Features:
     *    - Jurisdiction blocking (e.g., US person check)
     *    - Sanctions list checking integration
     *    - AML risk scoring integration points
     *
     * 8. Privacy Considerations:
     *    - Minimal data exposure to protocols (only verification status)
     *    - ZK proof integration for privacy-preserving verification
     *    - User consent management for protocol access
     *
     * Implementation Steps:
     * a) Create protocol registry and management system
     * b) Define KYC level requirements and standards
     * c) Implement verification interface for protocols
     * d) Add jurisdiction and sanctions checking
     * e) Integrate with major DeFi protocols
     * f) Create SDK for easy protocol integration
     * g) Add monitoring and analytics dashboard
     */

    // Placeholder for protocol verification
    // mapping(address => bool) public registeredProtocols;

    // function verifyUserForProtocol(
    //     address user,
    //     address protocol
    // ) external view returns (bool) {
    //     // TODO: Implement DeFi protocol KYC verification
    //     revert("DeFi protocol integration not yet implemented");
    // }
}

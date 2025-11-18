// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.25;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@othentic/NetworkManagement/Common/interfaces/IOBLS.sol";

/**
 * @title DID3AttestationCenter
 * @author DID3 Labs
 * @notice Manages identity verification tasks with BLS signature aggregation and quorum requirements
 * @dev Integrates with OBLS for efficient multi-signature verification
 */
contract DID3AttestationCenter is 
    Initializable, 
    AccessControlUpgradeable, 
    ReentrancyGuardUpgradeable 
{
    // ============ Constants ============
    
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REGISTRY_MANAGER_ROLE = keccak256("REGISTRY_MANAGER_ROLE");
    
    uint256 public constant MINIMUM_VOTING_POWER = 3 ether; // 3 ETH minimum stake
    uint256 public constant QUORUM_PERCENTAGE = 6600; // 66% in basis points (out of 10000)
    uint256 public constant BASIS_POINTS = 10000;
    
    // ============ Task Types ============
    
    enum TaskType {
        ISSUANCE,                    // Issue new verifiable credential
        PROOF_VERIFICATION,          // Verify ZK proof of credential
        REVOCATION,                  // Revoke existing credential
        REGISTRY_UPDATE,             // Update digital registry entry
        PROTOCOL_ACCEPTANCE_RECORD   // Record DeFi protocol acceptance/refusal
    }
    
    // ============ Structs ============
    
    struct Task {
        uint256 taskId;
        TaskType taskType;
        bytes32 credentialHash;      // Hash of the credential/proof
        address subject;             // DID subject (user address)
        address issuer;              // Credential issuer (for issuance/revocation)
        bytes metadata;              // Additional task-specific data
        uint256 timestamp;
        TaskStatus status;
        uint256 votingPowerSigned;   // Total voting power that signed
        uint256 requiredVotingPower; // Required voting power for this task
    }
    
    struct ProtocolAcceptance {
        address protocol;            // DeFi protocol address
        address user;                // User whose credential was checked
        bool accepted;               // Whether protocol accepted the credential
        bytes32 credentialHash;      // Credential that was verified
        uint256 timestamp;
        string reason;               // Reason for acceptance/rejection
    }
    
    struct CredentialRegistry {
        bytes32 credentialHash;
        address subject;
        address issuer;
        uint256 issuanceTimestamp;
        uint256 expirationTimestamp;
        bool isRevoked;
        uint256 revocationTimestamp;
        bytes32[] proofHashes;       // Historical proof verifications
    }
    
    enum TaskStatus {
        PENDING,
        VERIFIED,
        REJECTED,
        EXPIRED
    }
    
    // ============ State Variables ============
    
    IOBLS public oblsContract;
    
    uint256 public taskCounter;
    mapping(uint256 => Task) public tasks;
    mapping(bytes32 => CredentialRegistry) public credentialRegistry;
    mapping(bytes32 => bool) public processedTaskHashes; // Prevent replay attacks
    
    // Protocol acceptance tracking
    mapping(address => mapping(address => ProtocolAcceptance[])) public protocolAcceptanceHistory; // protocol => user => history
    
    // Task type specific configurations
    mapping(TaskType => uint256) public taskTypeQuorumOverride; // Optional custom quorum per task type
    mapping(TaskType => bool) public taskTypeEnabled;
    
    // Operator activity tracking
    mapping(address => uint256) public operatorTaskCount;
    mapping(uint256 => uint256[]) public taskOperatorIndexes; // taskId => operator indexes that signed
    
    // ============ Events ============
    
    event TaskCreated(
        uint256 indexed taskId,
        TaskType indexed taskType,
        bytes32 indexed credentialHash,
        address subject,
        uint256 requiredVotingPower
    );
    
    event TaskVerified(
        uint256 indexed taskId,
        TaskType indexed taskType,
        uint256 votingPowerSigned,
        uint256[] operatorIndexes
    );
    
    event TaskRejected(
        uint256 indexed taskId,
        TaskType indexed taskType,
        string reason
    );
    
    event CredentialIssued(
        bytes32 indexed credentialHash,
        address indexed subject,
        address indexed issuer,
        uint256 expirationTimestamp
    );
    
    event CredentialRevoked(
        bytes32 indexed credentialHash,
        address indexed subject,
        uint256 timestamp
    );
    
    event ProofVerified(
        bytes32 indexed proofHash,
        bytes32 indexed credentialHash,
        address indexed subject,
        uint256 taskId
    );
    
    event RegistryUpdated(
        bytes32 indexed credentialHash,
        address indexed subject,
        uint256 timestamp
    );
    
    event ProtocolAcceptanceRecorded(
        address indexed protocol,
        address indexed user,
        bytes32 indexed credentialHash,
        bool accepted,
        uint256 timestamp
    );
    
    event QuorumPercentageUpdated(uint256 newQuorum);
    event TaskTypeEnabledStatusChanged(TaskType taskType, bool enabled);
    event OBLSContractUpdated(address newOBLSContract);
    
    // ============ Errors ============
    
    error InvalidTaskType();
    error TaskNotFound();
    error TaskAlreadyProcessed();
    error InsufficientQuorum();
    error TaskTypeDisabled();
    error InvalidQuorumPercentage();
    error CredentialAlreadyRevoked();
    error CredentialNotFound();
    error InvalidSignature();
    error MinimumVotingPowerNotMet();
    error TaskExpired();
    error UnauthorizedIssuer();
    
    // ============ Initialization ============
    
    function initialize(address _oblsContract) public initializer {
        __AccessControl_init();
        __ReentrancyGuard_init();
        
        oblsContract = IOBLS(_oblsContract);
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRY_MANAGER_ROLE, msg.sender);
        
        // Enable all task types by default
        taskTypeEnabled[TaskType.ISSUANCE] = true;
        taskTypeEnabled[TaskType.PROOF_VERIFICATION] = true;
        taskTypeEnabled[TaskType.REVOCATION] = true;
        taskTypeEnabled[TaskType.REGISTRY_UPDATE] = true;
        taskTypeEnabled[TaskType.PROTOCOL_ACCEPTANCE_RECORD] = true;
    }
    
    // ============ Core Task Functions ============
    
    /**
     * @notice Submit and verify a credential issuance task
     * @param _credentialHash Hash of the credential being issued
     * @param _subject Address of the credential subject
     * @param _issuer Address of the credential issuer
     * @param _expirationTimestamp When the credential expires
     * @param _metadata Additional credential metadata
     * @param _signature Aggregated BLS signature from operators
     * @param _operatorIndexes Array of operator indexes who signed
     */
    function submitCredentialIssuance(
        bytes32 _credentialHash,
        address _subject,
        address _issuer,
        uint256 _expirationTimestamp,
        bytes calldata _metadata,
        uint256[2] calldata _signature,
        uint256[] calldata _operatorIndexes
    ) external nonReentrant returns (uint256 taskId) {
        if (!taskTypeEnabled[TaskType.ISSUANCE]) revert TaskTypeDisabled();
        if (credentialRegistry[_credentialHash].issuanceTimestamp != 0) revert TaskAlreadyProcessed();
        
        // Create task
        taskId = _createTask(
            TaskType.ISSUANCE,
            _credentialHash,
            _subject,
            _issuer,
            _metadata
        );
        
        // Verify signatures and check quorum
        _verifyTaskSignature(taskId, _signature, _operatorIndexes);
        
        // Issue credential
        _issueCredential(_credentialHash, _subject, _issuer, _expirationTimestamp);
        
        emit CredentialIssued(_credentialHash, _subject, _issuer, _expirationTimestamp);
    }
    
    /**
     * @notice Submit and verify a proof verification task
     * @param _proofHash Hash of the ZK proof
     * @param _credentialHash Hash of the credential being proven
     * @param _subject Subject of the proof
     * @param _metadata Proof metadata (public inputs, etc.)
     * @param _signature Aggregated BLS signature
     * @param _operatorIndexes Operator indexes who signed
     */
    function submitProofVerification(
        bytes32 _proofHash,
        bytes32 _credentialHash,
        address _subject,
        bytes calldata _metadata,
        uint256[2] calldata _signature,
        uint256[] calldata _operatorIndexes
    ) external nonReentrant returns (uint256 taskId) {
        if (!taskTypeEnabled[TaskType.PROOF_VERIFICATION]) revert TaskTypeDisabled();
        
        CredentialRegistry storage credential = credentialRegistry[_credentialHash];
        if (credential.issuanceTimestamp == 0) revert CredentialNotFound();
        if (credential.isRevoked) revert CredentialAlreadyRevoked();
        
        // Create task
        taskId = _createTask(
            TaskType.PROOF_VERIFICATION,
            _proofHash,
            _subject,
            credential.issuer,
            _metadata
        );
        
        // Verify signatures and check quorum
        _verifyTaskSignature(taskId, _signature, _operatorIndexes);
        
        // Record proof verification
        credential.proofHashes.push(_proofHash);
        
        emit ProofVerified(_proofHash, _credentialHash, _subject, taskId);
    }
    
    /**
     * @notice Submit and verify a credential revocation task
     * @param _credentialHash Hash of the credential to revoke
     * @param _subject Subject of the credential
     * @param _issuer Issuer of the credential
     * @param _reason Revocation reason
     * @param _signature Aggregated BLS signature
     * @param _operatorIndexes Operator indexes who signed
     */
    function submitCredentialRevocation(
        bytes32 _credentialHash,
        address _subject,
        address _issuer,
        bytes calldata _reason,
        uint256[2] calldata _signature,
        uint256[] calldata _operatorIndexes
    ) external nonReentrant returns (uint256 taskId) {
        if (!taskTypeEnabled[TaskType.REVOCATION]) revert TaskTypeDisabled();
        
        CredentialRegistry storage credential = credentialRegistry[_credentialHash];
        if (credential.issuanceTimestamp == 0) revert CredentialNotFound();
        if (credential.isRevoked) revert CredentialAlreadyRevoked();
        if (credential.issuer != _issuer) revert UnauthorizedIssuer();
        
        // Create task
        taskId = _createTask(
            TaskType.REVOCATION,
            _credentialHash,
            _subject,
            _issuer,
            _reason
        );
        
        // Verify signatures and check quorum
        _verifyTaskSignature(taskId, _signature, _operatorIndexes);
        
        // Revoke credential
        credential.isRevoked = true;
        credential.revocationTimestamp = block.timestamp;
        
        emit CredentialRevoked(_credentialHash, _subject, block.timestamp);
    }
    
    /**
     * @notice Update digital registry entry
     * @param _credentialHash Hash of the credential to update
     * @param _subject Subject of the credential
     * @param _updateData Data to update
     * @param _signature Aggregated BLS signature
     * @param _operatorIndexes Operator indexes who signed
     */
    function submitRegistryUpdate(
        bytes32 _credentialHash,
        address _subject,
        bytes calldata _updateData,
        uint256[2] calldata _signature,
        uint256[] calldata _operatorIndexes
    ) external nonReentrant returns (uint256 taskId) {
        if (!taskTypeEnabled[TaskType.REGISTRY_UPDATE]) revert TaskTypeDisabled();
        
        CredentialRegistry storage credential = credentialRegistry[_credentialHash];
        if (credential.issuanceTimestamp == 0) revert CredentialNotFound();
        
        // Create task
        taskId = _createTask(
            TaskType.REGISTRY_UPDATE,
            _credentialHash,
            _subject,
            credential.issuer,
            _updateData
        );
        
        // Verify signatures and check quorum
        _verifyTaskSignature(taskId, _signature, _operatorIndexes);
        
        emit RegistryUpdated(_credentialHash, _subject, block.timestamp);
    }
    
    /**
     * @notice Record acceptance or refusal of credential by DeFi protocol
     * @dev This doesn't require operator signatures - protocols self-report
     * @param _user User whose credential was checked
     * @param _credentialHash Credential that was verified
     * @param _accepted Whether protocol accepted the credential
     * @param _reason Reason for acceptance/rejection
     */
    function recordProtocolAcceptance(
        address _user,
        bytes32 _credentialHash,
        bool _accepted,
        string calldata _reason
    ) external nonReentrant {
        if (!taskTypeEnabled[TaskType.PROTOCOL_ACCEPTANCE_RECORD]) revert TaskTypeDisabled();
        
        ProtocolAcceptance memory acceptance = ProtocolAcceptance({
            protocol: msg.sender,
            user: _user,
            accepted: _accepted,
            credentialHash: _credentialHash,
            timestamp: block.timestamp,
            reason: _reason
        });
        
        protocolAcceptanceHistory[msg.sender][_user].push(acceptance);
        
        emit ProtocolAcceptanceRecorded(
            msg.sender,
            _user,
            _credentialHash,
            _accepted,
            block.timestamp
        );
    }
    
    // ============ Internal Functions ============
    
    /**
     * @notice Create a new task
     */
    function _createTask(
        TaskType _taskType,
        bytes32 _credentialHash,
        address _subject,
        address _issuer,
        bytes memory _metadata
    ) internal returns (uint256 taskId) {
        taskId = ++taskCounter;
        
        uint256 requiredVotingPower = _calculateRequiredVotingPower(_taskType);
        
        Task storage task = tasks[taskId];
        task.taskId = taskId;
        task.taskType = _taskType;
        task.credentialHash = _credentialHash;
        task.subject = _subject;
        task.issuer = _issuer;
        task.metadata = _metadata;
        task.timestamp = block.timestamp;
        task.status = TaskStatus.PENDING;
        task.requiredVotingPower = requiredVotingPower;
        
        emit TaskCreated(taskId, _taskType, _credentialHash, _subject, requiredVotingPower);
    }
    
    /**
     * @notice Verify BLS signature and check quorum
     */
    function _verifyTaskSignature(
        uint256 _taskId,
        uint256[2] calldata _signature,
        uint256[] calldata _operatorIndexes
    ) internal {
        Task storage task = tasks[_taskId];
        
        // Create message hash for BLS verification
        bytes32 messageHash = _createTaskMessageHash(task);
        uint256[2] memory message = _hashToPoint(messageHash);
        
        // Check that no operator has already signed this task hash (prevent replay)
        bytes32 taskSignatureHash = keccak256(abi.encodePacked(messageHash, _signature));
        if (processedTaskHashes[taskSignatureHash]) revert TaskAlreadyProcessed();
        processedTaskHashes[taskSignatureHash] = true;
        
        // Verify signature using OBLS contract
        try oblsContract.verifySignature(
            message,
            _signature,
            _operatorIndexes,
            task.requiredVotingPower,
            MINIMUM_VOTING_POWER
        ) {
            // Calculate actual voting power signed
            uint256 votingPowerSigned = _calculateVotingPower(_operatorIndexes);
            
            // Verify quorum is met
            if (votingPowerSigned < task.requiredVotingPower) {
                revert InsufficientQuorum();
            }
            
            // Update task
            task.status = TaskStatus.VERIFIED;
            task.votingPowerSigned = votingPowerSigned;
            taskOperatorIndexes[_taskId] = _operatorIndexes;
            
            // Update operator statistics
            for (uint256 i = 0; i < _operatorIndexes.length; i++) {
                operatorTaskCount[address(uint160(_operatorIndexes[i]))]++;
            }
            
            emit TaskVerified(_taskId, task.taskType, votingPowerSigned, _operatorIndexes);
            
        } catch {
            task.status = TaskStatus.REJECTED;
            emit TaskRejected(_taskId, task.taskType, "Invalid signature or insufficient voting power");
            revert InvalidSignature();
        }
    }
    
    /**
     * @notice Issue a new credential to the registry
     */
    function _issueCredential(
        bytes32 _credentialHash,
        address _subject,
        address _issuer,
        uint256 _expirationTimestamp
    ) internal {
        CredentialRegistry storage credential = credentialRegistry[_credentialHash];
        credential.credentialHash = _credentialHash;
        credential.subject = _subject;
        credential.issuer = _issuer;
        credential.issuanceTimestamp = block.timestamp;
        credential.expirationTimestamp = _expirationTimestamp;
        credential.isRevoked = false;
    }
    
    /**
     * @notice Calculate required voting power for a task type
     */
    function _calculateRequiredVotingPower(TaskType _taskType) internal view returns (uint256) {
        uint256 totalVotingPower = oblsContract.totalVotingPower();
        
        // Check if there's a custom quorum for this task type
        uint256 quorum = taskTypeQuorumOverride[_taskType];
        if (quorum == 0) {
            quorum = QUORUM_PERCENTAGE; // Default 66%
        }
        
        return (totalVotingPower * quorum) / BASIS_POINTS;
    }
    
    /**
     * @notice Calculate total voting power from operator indexes
     */
    function _calculateVotingPower(uint256[] calldata _operatorIndexes) internal view returns (uint256 total) {
        for (uint256 i = 0; i < _operatorIndexes.length; i++) {
            uint256 votingPower = oblsContract.votingPower(_operatorIndexes[i]);
            if (votingPower < MINIMUM_VOTING_POWER) {
                revert MinimumVotingPowerNotMet();
            }
            total += votingPower;
        }
    }
    
    /**
     * @notice Create message hash for task verification
     */
    function _createTaskMessageHash(Task memory _task) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            _task.taskId,
            _task.taskType,
            _task.credentialHash,
            _task.subject,
            _task.issuer,
            _task.timestamp
        ));
    }
    
    /**
     * @notice Hash to BLS point for signature verification
     */
    function _hashToPoint(bytes32 _hash) internal view returns (uint256[2] memory) {
        return oblsContract.hashToPoint(_hash, abi.encodePacked(_hash));
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get credential details
     */
    function getCredential(bytes32 _credentialHash) 
        external 
        view 
        returns (CredentialRegistry memory) 
    {
        return credentialRegistry[_credentialHash];
    }
    
    /**
     * @notice Check if credential is valid (issued and not revoked)
     */
    function isCredentialValid(bytes32 _credentialHash) external view returns (bool) {
        CredentialRegistry memory credential = credentialRegistry[_credentialHash];
        return credential.issuanceTimestamp != 0 
            && !credential.isRevoked 
            && (credential.expirationTimestamp == 0 || credential.expirationTimestamp > block.timestamp);
    }
    
    /**
     * @notice Get protocol acceptance history for a user
     */
    function getProtocolAcceptanceHistory(address _protocol, address _user) 
        external 
        view 
        returns (ProtocolAcceptance[] memory) 
    {
        return protocolAcceptanceHistory[_protocol][_user];
    }
    
    /**
     * @notice Get task details
     */
    function getTask(uint256 _taskId) external view returns (Task memory) {
        return tasks[_taskId];
    }
    
    /**
     * @notice Get required voting power for current quorum
     */
    function getRequiredVotingPower() external view returns (uint256) {
        uint256 totalVotingPower = oblsContract.totalVotingPower();
        return (totalVotingPower * QUORUM_PERCENTAGE) / BASIS_POINTS;
    }
    
    /**
     * @notice Calculate current quorum percentage
     */
    function getCurrentQuorumPercentage() external pure returns (uint256) {
        return QUORUM_PERCENTAGE;
    }
    
    // ============ Admin Functions ============
    
    /**
     * @notice Set custom quorum for specific task type
     */
    function setTaskTypeQuorum(TaskType _taskType, uint256 _quorumBasisPoints) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        if (_quorumBasisPoints > BASIS_POINTS) revert InvalidQuorumPercentage();
        taskTypeQuorumOverride[_taskType] = _quorumBasisPoints;
    }
    
    /**
     * @notice Enable or disable a task type
     */
    function setTaskTypeEnabled(TaskType _taskType, bool _enabled) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        taskTypeEnabled[_taskType] = _enabled;
        emit TaskTypeEnabledStatusChanged(_taskType, _enabled);
    }
    
    /**
     * @notice Update OBLS contract address
     */
    function setOBLSContract(address _newOBLSContract) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        oblsContract = IOBLS(_newOBLSContract);
        emit OBLSContractUpdated(_newOBLSContract);
    }
    
    /**
     * @notice Emergency pause specific task type
     */
    function pauseTaskType(TaskType _taskType) external onlyRole(ADMIN_ROLE) {
        taskTypeEnabled[_taskType] = false;
        emit TaskTypeEnabledStatusChanged(_taskType, false);
    }
}

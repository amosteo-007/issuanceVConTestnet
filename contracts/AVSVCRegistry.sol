// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

// Interface for ERC20 token
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/**
 * @title AVSVCRegistry
 * @notice Verifiable Credential Registry with AVS Operator Consensus
 * @dev Implements DID3 token-based staking and quorum-based credential purging
 */
contract AVSVCRegistry {

    // ============ Constants ============

    // DID3 token address on Base Sepolia
    address public constant DID3_TOKEN = 0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff;

    // Minimum stake: 999,999 DID3 tokens (with 18 decimals)
    uint256 public constant MINIMUM_STAKE = 999999 * 1e18;

    uint256 public constant QUORUM_PERCENTAGE = 6600; // 66% in basis points
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant VOTING_PERIOD = 3 days;

    // ============ Structs ============

    struct VerifiableCredential {
        bytes32 credentialHash;
        address subject;
        address issuer;
        uint256 issuanceDate;
        uint256 expirationDate;
        bool isRevoked;
        uint256 revocationTimestamp;
        string credentialType;
        bytes credentialData;
    }

    struct AVSOperator {
        uint256 stake;
        bool isActive;
        uint256 credentialsIssued;
        uint256 lastActivityTimestamp;
    }

    struct PurgeProposal {
        bytes32 credentialHash;
        address proposer;
        string reason; // "expired" or "revoked"
        uint256 proposalTimestamp;
        uint256 approvalCount;
        uint256 totalVotingPower;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    enum PurgeReason {
        EXPIRED,
        REVOKED
    }

    // ============ State Variables ============

    mapping(bytes32 => VerifiableCredential) public credentials;
    mapping(address => bytes32[]) public subjectCredentials;
    mapping(address => bytes32[]) public issuerCredentials;
    mapping(address => AVSOperator) public operators;
    mapping(uint256 => PurgeProposal) public purgeProposals;

    uint256 public totalCredentials;
    uint256 public purgeProposalCounter;
    uint256 public totalStake;
    address public admin;

    address[] public operatorList;

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

    event OperatorRegistered(
        address indexed operator,
        uint256 stake
    );

    event OperatorStakeUpdated(
        address indexed operator,
        uint256 newStake
    );

    event OperatorDeactivated(
        address indexed operator
    );

    event PurgeProposalCreated(
        uint256 indexed proposalId,
        bytes32 indexed credentialHash,
        address indexed proposer,
        string reason
    );

    event PurgeVoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        uint256 votingPower
    );

    event PurgeExecuted(
        uint256 indexed proposalId,
        bytes32 indexed credentialHash,
        uint256 approvalCount,
        uint256 totalVotingPower
    );

    // ============ Modifiers ============

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyActiveOperator() {
        require(operators[msg.sender].isActive, "Not active operator");
        require(operators[msg.sender].stake >= MINIMUM_STAKE, "Insufficient stake");
        _;
    }

    modifier validCredential(bytes32 _credentialHash) {
        require(credentials[_credentialHash].issuanceDate != 0, "Credential does not exist");
        _;
    }

    // ============ Constructor ============

    constructor() {
        admin = msg.sender;
    }

    // ============ Operator Management ============

    /**
     * @notice Register as an AVS operator with DID3 token stake
     * @dev Requires minimum 999,999 DID3 tokens. User must approve this contract first.
     * @param _stakeAmount Amount of DID3 tokens to stake (must be >= MINIMUM_STAKE)
     */
    function registerOperator(uint256 _stakeAmount) external {
        require(_stakeAmount >= MINIMUM_STAKE, "Insufficient stake");
        require(!operators[msg.sender].isActive, "Already registered");

        // Transfer DID3 tokens from operator to this contract
        IERC20 did3Token = IERC20(DID3_TOKEN);
        require(
            did3Token.transferFrom(msg.sender, address(this), _stakeAmount),
            "Token transfer failed"
        );

        operators[msg.sender] = AVSOperator({
            stake: _stakeAmount,
            isActive: true,
            credentialsIssued: 0,
            lastActivityTimestamp: block.timestamp
        });

        operatorList.push(msg.sender);
        totalStake += _stakeAmount;

        emit OperatorRegistered(msg.sender, _stakeAmount);
    }

    /**
     * @notice Add more DID3 token stake to operator account
     * @param _additionalStake Amount of DID3 tokens to add to stake
     */
    function addStake(uint256 _additionalStake) external {
        require(operators[msg.sender].isActive, "Not an active operator");
        require(_additionalStake > 0, "Stake amount must be greater than 0");

        // Transfer DID3 tokens from operator to this contract
        IERC20 did3Token = IERC20(DID3_TOKEN);
        require(
            did3Token.transferFrom(msg.sender, address(this), _additionalStake),
            "Token transfer failed"
        );

        operators[msg.sender].stake += _additionalStake;
        totalStake += _additionalStake;

        emit OperatorStakeUpdated(msg.sender, operators[msg.sender].stake);
    }

    /**
     * @notice Withdraw DID3 token stake and deactivate operator
     * @dev Can only withdraw if no active purge proposals involving operator's credentials
     */
    function withdrawStake() external {
        AVSOperator storage operator = operators[msg.sender];
        require(operator.isActive, "Not an active operator");

        uint256 stakeAmount = operator.stake;
        require(stakeAmount > 0, "No stake to withdraw");

        operator.isActive = false;
        operator.stake = 0;
        totalStake -= stakeAmount;

        emit OperatorDeactivated(msg.sender);

        // Transfer DID3 tokens back to operator
        IERC20 did3Token = IERC20(DID3_TOKEN);
        require(
            did3Token.transfer(msg.sender, stakeAmount),
            "Token transfer failed"
        );
    }

    // ============ Credential Issuance ============

    /**
     * @notice Issue a verifiable credential
     * @param _subject Address of credential subject
     * @param _credentialType Type of credential
     * @param _credentialData Credential data
     * @param _expirationDate Expiration timestamp (0 for no expiration)
     * @dev Requires operator to have >= 999,999 DID3 token stake
     */
    function issueCredential(
        address _subject,
        string memory _credentialType,
        bytes memory _credentialData,
        uint256 _expirationDate
    ) external onlyActiveOperator returns (bytes32 credentialHash) {
        require(_subject != address(0), "Invalid subject");

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
        credentials[credentialHash] = VerifiableCredential({
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

        // Update mappings
        subjectCredentials[_subject].push(credentialHash);
        issuerCredentials[msg.sender].push(credentialHash);
        totalCredentials++;

        // Update operator stats
        operators[msg.sender].credentialsIssued++;
        operators[msg.sender].lastActivityTimestamp = block.timestamp;

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

    // ============ Credential Purging with Consensus ============

    /**
     * @notice Create a proposal to purge an expired or revoked credential
     * @param _credentialHash Hash of credential to purge
     * @param _reason Reason for purge: "expired" or "revoked"
     * @dev Only the original issuer can propose purging
     */
    function proposePurge(
        bytes32 _credentialHash,
        string memory _reason
    ) external onlyActiveOperator validCredential(_credentialHash) returns (uint256 proposalId) {
        VerifiableCredential storage credential = credentials[_credentialHash];

        // Only issuer can propose purge
        require(credential.issuer == msg.sender, "Only issuer can propose purge");

        // Validate reason
        bool isExpired = credential.expirationDate != 0 && block.timestamp > credential.expirationDate;
        bool isRevoked = credential.isRevoked;

        bytes32 reasonHash = keccak256(bytes(_reason));
        bool validReason = (reasonHash == keccak256(bytes("expired")) && isExpired) ||
                          (reasonHash == keccak256(bytes("revoked")) && isRevoked);

        require(validReason, "Invalid purge reason or credential status");

        // Create proposal
        proposalId = purgeProposalCounter++;
        PurgeProposal storage proposal = purgeProposals[proposalId];

        proposal.credentialHash = _credentialHash;
        proposal.proposer = msg.sender;
        proposal.reason = _reason;
        proposal.proposalTimestamp = block.timestamp;
        proposal.approvalCount = 0;
        proposal.totalVotingPower = 0;
        proposal.executed = false;

        emit PurgeProposalCreated(proposalId, _credentialHash, msg.sender, _reason);

        return proposalId;
    }

    /**
     * @notice Vote to approve a purge proposal
     * @param _proposalId ID of the purge proposal
     * @dev Operators vote with their stake as voting power
     */
    function voteOnPurge(uint256 _proposalId) external onlyActiveOperator {
        PurgeProposal storage proposal = purgeProposals[_proposalId];

        require(!proposal.executed, "Proposal already executed");
        require(proposal.proposalTimestamp != 0, "Proposal does not exist");
        require(block.timestamp <= proposal.proposalTimestamp + VOTING_PERIOD, "Voting period ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");

        // Verify the purge reason is valid
        VerifiableCredential storage credential = credentials[proposal.credentialHash];

        bool isExpired = credential.expirationDate != 0 && block.timestamp > credential.expirationDate;
        bool isRevoked = credential.isRevoked;

        bytes32 reasonHash = keccak256(bytes(proposal.reason));
        bool validReason = (reasonHash == keccak256(bytes("expired")) && isExpired) ||
                          (reasonHash == keccak256(bytes("revoked")) && isRevoked);

        require(validReason, "Credential status no longer matches purge reason");

        // Verify proposer is the issuer
        require(credential.issuer == proposal.proposer, "Proposer is not the issuer");

        // Cast vote with operator's stake as voting power
        uint256 votingPower = operators[msg.sender].stake;
        proposal.hasVoted[msg.sender] = true;
        proposal.approvalCount++;
        proposal.totalVotingPower += votingPower;

        emit PurgeVoteCast(_proposalId, msg.sender, votingPower);
    }

    /**
     * @notice Execute a purge proposal if quorum is reached
     * @param _proposalId ID of the purge proposal
     * @dev Requires 66% quorum of total stake
     */
    function executePurge(uint256 _proposalId) external {
        PurgeProposal storage proposal = purgeProposals[_proposalId];

        require(!proposal.executed, "Already executed");
        require(proposal.proposalTimestamp != 0, "Proposal does not exist");

        // Check if quorum is reached
        uint256 requiredVotingPower = (totalStake * QUORUM_PERCENTAGE) / BASIS_POINTS;
        require(proposal.totalVotingPower >= requiredVotingPower, "Quorum not reached");

        // Mark proposal as executed
        proposal.executed = true;

        // Mark credential as revoked (purged)
        VerifiableCredential storage credential = credentials[proposal.credentialHash];
        if (!credential.isRevoked) {
            credential.isRevoked = true;
            credential.revocationTimestamp = block.timestamp;
        }

        emit PurgeExecuted(
            _proposalId,
            proposal.credentialHash,
            proposal.approvalCount,
            proposal.totalVotingPower
        );

        emit CredentialRevoked(
            proposal.credentialHash,
            credential.subject,
            block.timestamp
        );
    }

    // ============ View Functions ============

    /**
     * @notice Check if a credential is valid
     */
    function isCredentialValid(bytes32 _credentialHash) external view returns (bool) {
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
     */
    function getSubjectCredentials(address _subject) external view returns (bytes32[] memory) {
        return subjectCredentials[_subject];
    }

    /**
     * @notice Get operator information
     */
    function getOperator(address _operator)
        external
        view
        returns (
            uint256 stake,
            bool isActive,
            uint256 credentialsIssued,
            uint256 lastActivityTimestamp
        )
    {
        AVSOperator memory operator = operators[_operator];
        return (
            operator.stake,
            operator.isActive,
            operator.credentialsIssued,
            operator.lastActivityTimestamp
        );
    }

    /**
     * @notice Get purge proposal details
     */
    function getPurgeProposal(uint256 _proposalId)
        external
        view
        returns (
            bytes32 credentialHash,
            address proposer,
            string memory reason,
            uint256 proposalTimestamp,
            uint256 approvalCount,
            uint256 totalVotingPower,
            bool executed,
            bool quorumReached
        )
    {
        PurgeProposal storage proposal = purgeProposals[_proposalId];
        uint256 requiredVotingPower = (totalStake * QUORUM_PERCENTAGE) / BASIS_POINTS;

        return (
            proposal.credentialHash,
            proposal.proposer,
            proposal.reason,
            proposal.proposalTimestamp,
            proposal.approvalCount,
            proposal.totalVotingPower,
            proposal.executed,
            proposal.totalVotingPower >= requiredVotingPower
        );
    }

    /**
     * @notice Check if operator has voted on a proposal
     */
    function hasVotedOnProposal(uint256 _proposalId, address _operator) external view returns (bool) {
        return purgeProposals[_proposalId].hasVoted[_operator];
    }

    /**
     * @notice Get current quorum requirement
     */
    function getQuorumRequirement() external view returns (uint256) {
        return (totalStake * QUORUM_PERCENTAGE) / BASIS_POINTS;
    }

    /**
     * @notice Get total number of active operators
     */
    function getActiveOperatorCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < operatorList.length; i++) {
            if (operators[operatorList[i]].isActive &&
                operators[operatorList[i]].stake >= MINIMUM_STAKE) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice Get all active operators
     */
    function getActiveOperators() external view returns (address[] memory) {
        uint256 activeCount = 0;

        // Count active operators
        for (uint256 i = 0; i < operatorList.length; i++) {
            if (operators[operatorList[i]].isActive &&
                operators[operatorList[i]].stake >= MINIMUM_STAKE) {
                activeCount++;
            }
        }

        // Create array of active operators
        address[] memory activeOps = new address[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < operatorList.length; i++) {
            if (operators[operatorList[i]].isActive &&
                operators[operatorList[i]].stake >= MINIMUM_STAKE) {
                activeOps[index] = operatorList[i];
                index++;
            }
        }

        return activeOps;
    }

    // ============ Admin Functions ============

    /**
     * @notice Emergency pause for specific operator (admin only)
     */
    function emergencyDeactivateOperator(address _operator) external onlyAdmin {
        require(operators[_operator].isActive, "Operator not active");
        operators[_operator].isActive = false;
        emit OperatorDeactivated(_operator);
    }

    /**
     * @notice Transfer admin role
     */
    function transferAdmin(address _newAdmin) external onlyAdmin {
        require(_newAdmin != address(0), "Invalid address");
        admin = _newAdmin;
    }
}

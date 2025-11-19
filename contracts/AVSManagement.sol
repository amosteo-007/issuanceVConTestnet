// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title AVSManagement
 * @dev Manages issuer staking in DID3 tokens for Verifiable Credential issuance
 * @notice Issuers must stake a minimum of 999,999 DID3 tokens to issue credentials
 */

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
}

contract AVSManagement {
    // DID3 Token contract address on Base Sepolia
    IERC20 public immutable did3Token;

    // Minimum stake required to be an issuer (999,999 DID3 tokens)
    uint256 public constant MINIMUM_STAKE = 999_999 * 10**18;

    // Owner of the contract
    address public owner;

    // Issuer information
    struct IssuerInfo {
        uint256 stakedAmount;
        bool isActive;
        uint256 registrationTimestamp;
        uint256 totalCredentialsIssued;
        uint256 totalCredentialsRevoked;
        uint256 lastActivityTimestamp;
    }

    // Mapping from issuer address to their info
    mapping(address => IssuerInfo) public issuers;

    // Array of all issuer addresses for enumeration
    address[] public issuerAddresses;

    // Total staked in the system
    uint256 public totalStaked;

    // Events
    event IssuerRegistered(address indexed issuer, uint256 stakedAmount, uint256 timestamp);
    event StakeAdded(address indexed issuer, uint256 amount, uint256 newTotal);
    event StakeWithdrawn(address indexed issuer, uint256 amount, uint256 remaining);
    event IssuerDeactivated(address indexed issuer, uint256 timestamp);
    event IssuerReactivated(address indexed issuer, uint256 timestamp);
    event CredentialIssued(address indexed issuer, bytes32 credentialHash);
    event CredentialRevoked(address indexed issuer, bytes32 credentialHash);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier onlyActiveIssuer() {
        require(isActiveIssuer(msg.sender), "Caller is not an active issuer");
        _;
    }

    /**
     * @dev Constructor sets the DID3 token address
     * @param _did3TokenAddress Address of the DID3 token contract
     */
    constructor(address _did3TokenAddress) {
        require(_did3TokenAddress != address(0), "Invalid token address");
        did3Token = IERC20(_did3TokenAddress);
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
     * @dev Register as an issuer by staking DID3 tokens
     * @param stakeAmount Amount of DID3 tokens to stake (must be >= MINIMUM_STAKE)
     */
    function registerIssuer(uint256 stakeAmount) external {
        require(stakeAmount >= MINIMUM_STAKE, "Stake amount below minimum required");
        require(!issuers[msg.sender].isActive, "Issuer already registered");

        // Transfer tokens from issuer to this contract
        require(
            did3Token.transferFrom(msg.sender, address(this), stakeAmount),
            "Token transfer failed"
        );

        // Create issuer record
        issuers[msg.sender] = IssuerInfo({
            stakedAmount: stakeAmount,
            isActive: true,
            registrationTimestamp: block.timestamp,
            totalCredentialsIssued: 0,
            totalCredentialsRevoked: 0,
            lastActivityTimestamp: block.timestamp
        });

        issuerAddresses.push(msg.sender);
        totalStaked += stakeAmount;

        emit IssuerRegistered(msg.sender, stakeAmount, block.timestamp);
    }

    /**
     * @dev Add more stake to existing issuer account
     * @param amount Amount of DID3 tokens to add
     */
    function addStake(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(issuers[msg.sender].isActive, "Issuer not registered");

        require(
            did3Token.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );

        issuers[msg.sender].stakedAmount += amount;
        issuers[msg.sender].lastActivityTimestamp = block.timestamp;
        totalStaked += amount;

        emit StakeAdded(msg.sender, amount, issuers[msg.sender].stakedAmount);
    }

    /**
     * @dev Withdraw stake (can withdraw down to minimum if still active, or all if deactivating)
     * @param amount Amount of DID3 tokens to withdraw
     */
    function withdrawStake(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(issuers[msg.sender].stakedAmount >= amount, "Insufficient stake");

        uint256 remainingStake = issuers[msg.sender].stakedAmount - amount;

        // If withdrawing below minimum, deactivate the issuer
        if (remainingStake < MINIMUM_STAKE) {
            require(remainingStake == 0, "Must withdraw all if going below minimum");
            issuers[msg.sender].isActive = false;
            emit IssuerDeactivated(msg.sender, block.timestamp);
        }

        issuers[msg.sender].stakedAmount = remainingStake;
        issuers[msg.sender].lastActivityTimestamp = block.timestamp;
        totalStaked -= amount;

        require(
            did3Token.transfer(msg.sender, amount),
            "Token transfer failed"
        );

        emit StakeWithdrawn(msg.sender, amount, remainingStake);
    }

    /**
     * @dev Reactivate a deactivated issuer by staking minimum amount
     * @param stakeAmount Amount to stake (must be >= MINIMUM_STAKE)
     */
    function reactivateIssuer(uint256 stakeAmount) external {
        require(stakeAmount >= MINIMUM_STAKE, "Stake amount below minimum required");
        require(issuers[msg.sender].registrationTimestamp > 0, "Issuer never registered");
        require(!issuers[msg.sender].isActive, "Issuer already active");

        require(
            did3Token.transferFrom(msg.sender, address(this), stakeAmount),
            "Token transfer failed"
        );

        issuers[msg.sender].stakedAmount += stakeAmount;
        issuers[msg.sender].isActive = true;
        issuers[msg.sender].lastActivityTimestamp = block.timestamp;
        totalStaked += stakeAmount;

        emit IssuerReactivated(msg.sender, block.timestamp);
    }

    /**
     * @dev Record credential issuance (called by VCRegistry contract)
     * @param issuer Address of the issuer
     * @param credentialHash Hash of the credential
     */
    function recordCredentialIssued(address issuer, bytes32 credentialHash) external {
        require(isActiveIssuer(issuer), "Issuer is not active");
        issuers[issuer].totalCredentialsIssued++;
        issuers[issuer].lastActivityTimestamp = block.timestamp;
        emit CredentialIssued(issuer, credentialHash);
    }

    /**
     * @dev Record credential revocation (called by VCRegistry contract)
     * @param issuer Address of the issuer
     * @param credentialHash Hash of the credential
     */
    function recordCredentialRevoked(address issuer, bytes32 credentialHash) external {
        require(isActiveIssuer(issuer), "Issuer is not active");
        issuers[issuer].totalCredentialsRevoked++;
        issuers[issuer].lastActivityTimestamp = block.timestamp;
        emit CredentialRevoked(issuer, credentialHash);
    }

    /**
     * @dev Check if an address is an active issuer
     * @param issuer Address to check
     * @return bool True if the address is an active issuer with sufficient stake
     */
    function isActiveIssuer(address issuer) public view returns (bool) {
        return issuers[issuer].isActive && issuers[issuer].stakedAmount >= MINIMUM_STAKE;
    }

    /**
     * @dev Get issuer information
     * @param issuer Address of the issuer
     * @return IssuerInfo struct with all issuer details
     */
    function getIssuerInfo(address issuer) external view returns (IssuerInfo memory) {
        return issuers[issuer];
    }

    /**
     * @dev Get total number of registered issuers
     * @return uint256 Total count of issuers
     */
    function getTotalIssuers() external view returns (uint256) {
        return issuerAddresses.length;
    }

    /**
     * @dev Get all active issuers
     * @return address[] Array of active issuer addresses
     */
    function getActiveIssuers() external view returns (address[] memory) {
        uint256 activeCount = 0;

        // Count active issuers
        for (uint256 i = 0; i < issuerAddresses.length; i++) {
            if (isActiveIssuer(issuerAddresses[i])) {
                activeCount++;
            }
        }

        // Create array of active issuers
        address[] memory activeIssuers = new address[](activeCount);
        uint256 index = 0;

        for (uint256 i = 0; i < issuerAddresses.length; i++) {
            if (isActiveIssuer(issuerAddresses[i])) {
                activeIssuers[index] = issuerAddresses[i];
                index++;
            }
        }

        return activeIssuers;
    }

    /**
     * @dev Transfer ownership of the contract
     * @param newOwner Address of the new owner
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /**
     * @dev Get contract statistics
     * @return totalIssuers Total number of registered issuers
     * @return activeIssuers Number of active issuers
     * @return totalStakedAmount Total DID3 tokens staked
     */
    function getStatistics() external view returns (
        uint256 totalIssuers,
        uint256 activeIssuers,
        uint256 totalStakedAmount
    ) {
        totalIssuers = issuerAddresses.length;

        for (uint256 i = 0; i < issuerAddresses.length; i++) {
            if (isActiveIssuer(issuerAddresses[i])) {
                activeIssuers++;
            }
        }

        totalStakedAmount = totalStaked;
    }
}

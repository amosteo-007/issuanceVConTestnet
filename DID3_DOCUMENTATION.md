# DID3 Attestation Center - Technical Documentation

## Overview

The `DID3AttestationCenter` contract is the core attestation layer for DID3's privacy-preserving identity verification system. It manages identity verification tasks using BLS signature aggregation for efficient multi-operator consensus, with a minimum 3 ETH voting power requirement and 66% quorum threshold.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DID3 AttestationCenter                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Task Management & Verification                 │ │
│  │  • Issuance    • Proof Verification    • Revocation        │ │
│  │  • Registry Updates    • Protocol Acceptance               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Quorum & Voting Power Manager                  │ │
│  │  • 3 ETH Minimum    • 66% Quorum    • Dynamic Calculation  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              ▼                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 OBLS Integration                            │ │
│  │  • BLS Signature Aggregation    • Operator Verification    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              ▼
                    ┌──────────────────┐
                    │   OBLS Contract  │
                    │  • BLS Keys      │
                    │  • Voting Power  │
                    │  • Verification  │
                    └──────────────────┘
```

## Key Features

### 1. **Minimum Voting Power Requirement**
- **3 ETH minimum stake** required to participate in any task
- Enforced at verification time via `MINIMUM_VOTING_POWER` constant
- Operators with less than 3 ETH are rejected during signature verification

### 2. **Quorum Calculation**
- **Default: 66% of total voting power** required for task approval
- Calculated dynamically: `(totalVotingPower * 6600) / 10000`
- Task-type specific quorum overrides available
- Always uses current network voting power at time of task submission

### 3. **BLS Signature Aggregation**
- Single aggregated signature verifies consensus from multiple operators
- O(1) verification cost regardless of operator count
- Prevents replay attacks via unique task hash tracking

## Task Types

### 1. **ISSUANCE** - Issue New Verifiable Credential
```solidity
submitCredentialIssuance(
    bytes32 credentialHash,      // Hash of credential being issued
    address subject,              // User receiving credential
    address issuer,               // KYC provider issuing credential
    uint256 expirationTimestamp,  // When credential expires
    bytes metadata,               // Additional credential data
    uint256[2] signature,         // Aggregated BLS signature
    uint256[] operatorIndexes     // Operators who signed
)
```

**Use Case:** Banks/KYC providers collectively attest that a user has passed KYC verification.

**Quorum Check:**
- Requires ≥66% of total voting power to sign
- Each operator must have ≥3 ETH staked
- Creates permanent registry entry

---

### 2. **PROOF_VERIFICATION** - Verify ZK Proof of Credential
```solidity
submitProofVerification(
    bytes32 proofHash,            // Hash of ZK proof
    bytes32 credentialHash,       // Credential being proven
    address subject,              // User presenting proof
    bytes metadata,               // Public inputs, etc.
    uint256[2] signature,         // Aggregated signature
    uint256[] operatorIndexes     // Operators who verified
)
```

**Use Case:** User presents ZK proof to DeFi protocol. Operators verify proof validity without revealing credential details.

**Quorum Check:**
- Verifies credential exists and isn't revoked
- Records proof hash in credential's history
- Maintains privacy while proving credential validity

---

### 3. **REVOCATION** - Revoke Existing Credential
```solidity
submitCredentialRevocation(
    bytes32 credentialHash,       // Credential to revoke
    address subject,              // User whose credential is revoked
    address issuer,               // Must match original issuer
    bytes reason,                 // Revocation reason
    uint256[2] signature,         // Aggregated signature
    uint256[] operatorIndexes     // Operators who signed
)
```

**Use Case:** User fails ongoing compliance checks, credential needs immediate revocation.

**Quorum Check:**
- Requires issuer authorization
- Permanently marks credential as revoked
- Records revocation timestamp

---

### 4. **REGISTRY_UPDATE** - Update Digital Registry Entry
```solidity
submitRegistryUpdate(
    bytes32 credentialHash,       // Credential to update
    address subject,              // User whose credential is updated
    bytes updateData,             // Update payload
    uint256[2] signature,         // Aggregated signature
    uint256[] operatorIndexes     // Operators who signed
)
```

**Use Case:** Update credential metadata, extend expiration, or modify attributes without reissuing.

**Quorum Check:**
- Doesn't modify core credential validity
- Allows governance-approved updates
- Maintains credential history

---

### 5. **PROTOCOL_ACCEPTANCE_RECORD** - Record DeFi Protocol Decision
```solidity
recordProtocolAcceptance(
    address user,                 // User whose credential was checked
    bytes32 credentialHash,       // Credential that was verified
    bool accepted,                // Whether protocol accepted user
    string reason                 // Acceptance/rejection reason
)
```

**Use Case:** DeFi protocols self-report their acceptance decisions for transparency and analytics.

**Special Note:** 
- **No operator signatures required** - protocols self-report
- Creates immutable audit trail
- Helps identify protocol-specific requirements

## Voting Power & Quorum Management

### How Voting Power Works

1. **Operator Registration** (via OBLS contract)
```solidity
// Operator stakes 10 ETH on L1
// OBLS receives update: registerOperator(index: 1, votingPower: 10 ether, blsKey: [...])
```

2. **Task Submission**
```solidity
// Total network voting power: 100 ETH
// Required for 66% quorum: 66 ETH
uint256 required = (100 ether * 6600) / 10000; // = 66 ether
```

3. **Signature Verification**
```solidity
// Operators [1, 3, 5, 7] sign (10 ETH each)
// Total signed: 40 ETH
// 40 ETH < 66 ETH → REJECTED (InsufficientQuorum)

// Operators [1, 2, 3, 4, 5, 6, 7, 8] sign (10 ETH each)  
// Total signed: 80 ETH
// 80 ETH ≥ 66 ETH → APPROVED ✓
```

### Minimum Voting Power Enforcement

```solidity
function _calculateVotingPower(uint256[] calldata _operatorIndexes) internal view {
    for (uint256 i = 0; i < _operatorIndexes.length; i++) {
        uint256 votingPower = oblsContract.votingPower(_operatorIndexes[i]);
        
        // Reject operators with less than 3 ETH
        if (votingPower < MINIMUM_VOTING_POWER) {
            revert MinimumVotingPowerNotMet();
        }
        
        total += votingPower;
    }
}
```

**Why 3 ETH?**
- High enough to deter Sybil attacks
- Low enough for regional banks to participate
- Creates meaningful economic stake in honest behavior

### Task-Specific Quorum Overrides

```solidity
// Set custom quorum for sensitive operations
setTaskTypeQuorum(TaskType.REVOCATION, 7500); // Require 75% for revocations
setTaskTypeQuorum(TaskType.ISSUANCE, 5000);   // Require 50% for issuance
```

## Security Features

### 1. **Replay Attack Prevention**
```solidity
bytes32 taskSignatureHash = keccak256(abi.encodePacked(messageHash, _signature));
if (processedTaskHashes[taskSignatureHash]) revert TaskAlreadyProcessed();
processedTaskHashes[taskSignatureHash] = true;
```

Each unique task+signature combination can only be processed once.

### 2. **Operator Index Validation**
The OBLS contract ensures:
- Operator indexes are in ascending order (prevents double-counting)
- All operators are active
- All operators meet minimum voting power
- BLS public keys are valid

### 3. **Access Control**
```solidity
ADMIN_ROLE              → Manage quorum, pause tasks
REGISTRY_MANAGER_ROLE   → Update registry entries
OPERATOR_ROLE           → Reserved for future operator-specific actions
```

### 4. **Reentrancy Protection**
All external functions use `nonReentrant` modifier to prevent reentrancy attacks.

## Integration Example

### Scenario: Bank Issues KYC Credential

```solidity
// 1. User completes KYC with Bank A
// Bank A creates credential hash
bytes32 credentialHash = keccak256(abi.encodePacked(
    userAddress,
    "TIER_2_KYC",
    jurisdiction,
    timestamp
));

// 2. Bank A broadcasts credential to operators
// Operators verify KYC documentation off-chain

// 3. Operators sign with their BLS private keys
// Signatures aggregated off-chain into single signature

// 4. Submit to AttestationCenter
uint256 taskId = attestationCenter.submitCredentialIssuance(
    credentialHash,
    userAddress,
    bankAddress,
    block.timestamp + 365 days, // 1 year expiration
    abi.encode("TIER_2", "SINGAPORE"), // metadata
    aggregatedSignature,
    [1, 2, 3, 4, 5, 6, 7] // Operator indexes (70 ETH total)
);

// 5. Contract verifies:
// ✓ 70 ETH ≥ 66 ETH required (66% of 100 ETH network)
// ✓ Each operator has ≥ 3 ETH
// ✓ BLS signature valid
// ✓ Credential doesn't already exist

// 6. Credential issued and recorded on-chain
```

### Scenario: DeFi Protocol Verifies Credential

```solidity
// User presents ZK proof to DeFi protocol
// Protocol queries contract
bool isValid = attestationCenter.isCredentialValid(credentialHash);

if (isValid) {
    // Grant access to DeFi services
    protocol.grantAccess(user);
    
    // Record acceptance
    attestationCenter.recordProtocolAcceptance(
        user,
        credentialHash,
        true,
        "Met minimum KYC requirements"
    );
} else {
    // Deny access
    attestationCenter.recordProtocolAcceptance(
        user,
        credentialHash,
        false,
        "Credential expired or revoked"
    );
}
```

## Gas Optimization

### BLS Aggregation Benefits
- **Without BLS:** 7 operators × 65k gas = 455k gas
- **With BLS:** Single verification = ~150k gas
- **Savings:** ~67% gas reduction with 7+ operators

### Batch Operations
Consider implementing batch credential issuance for multiple users:
```solidity
function submitBatchCredentialIssuance(
    bytes32[] calldata _credentialHashes,
    address[] calldata _subjects,
    // ... other batch parameters
) external {
    // Issue multiple credentials with one quorum check
    // Amortize verification cost across many credentials
}
```

## Deployment Checklist

1. ✅ Deploy OBLS contract first
2. ✅ Deploy AttestationCenter with OBLS address
3. ✅ Register operators on OBLS (minimum 3 ETH each)
4. ✅ Verify total voting power ≥ 9 ETH (3 operators minimum)
5. ✅ Test quorum calculation
6. ✅ Grant appropriate roles (ADMIN, REGISTRY_MANAGER)
7. ✅ Enable desired task types
8. ✅ Set task-specific quorum overrides if needed

## Monitoring & Analytics

### Key Metrics to Track

```solidity
// Network health
- oblsContract.totalVotingPower() → Monitor network security
- taskCounter → Total tasks processed
- Task verification success rate

// Operator performance
- operatorTaskCount[operatorIndex] → Task participation
- Average voting power per task
- Operator churn rate

// Protocol adoption
- protocolAcceptanceHistory[protocol][user] → Protocol activity
- Acceptance vs rejection rates per protocol
- Most common rejection reasons
```

## Future Enhancements

1. **Task Expiration**
   - Add time limits for task submission
   - Auto-reject tasks older than X blocks

2. **Slashing Conditions**
   - Penalize operators who sign invalid credentials
   - Implement challenge period for disputes

3. **Reputation System**
   - Track operator accuracy over time
   - Weight voting power by reputation score

4. **Credential Templates**
   - Predefined schemas for common KYC types
   - Standardized metadata formats

5. **Cross-Chain Support**
   - Bridge credentials to other chains
   - Maintain registry across multiple networks

## Security Considerations

⚠️ **Critical**: Always verify:
- Operators are properly registered on OBLS
- Total voting power is sufficient for network security
- Quorum thresholds align with security requirements
- Off-chain signature aggregation is secure
- Private keys are properly managed in HSMs

## Support & Questions

For technical questions or integration support:
- Review OBLS contract documentation
- Test on testnet with minimum 3 operators
- Simulate various quorum scenarios
- Monitor gas costs at scale

---

**Contract Version:** 1.0.0  
**Solidity Version:** ^0.8.25  
**License:** BUSL-1.1

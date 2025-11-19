# Verifiable Credentials System on Base Sepolia

A complete blockchain-based KYC verification system with stake-based issuance, credential management, and privacy-preserving features. Built for Base Sepolia testnet using W3C Verifiable Credentials standards.

## 🎨 Design

Featuring a sleek Robinhood-inspired color scheme:
- Primary Green: `#5ac53a` (90, 197, 58)
- Accent Yellow: `#d5fd51` (213, 253, 81)
- Accent Orange: `#f6c86a` (246, 200, 106)
- Warning Orange: `#eb5d2a` (235, 93, 42)
- Background Dark: `#1f2123` (31, 33, 35)

## 🚀 Features

### Refactored Architecture

The system has been refactored into two primary smart contracts:

1. **AVSManagement.sol** - Issuer staking management
   - DID3 token staking (minimum 999,999 tokens)
   - Issuer registration and activation
   - Stake addition and withdrawal
   - Operator statistics and tracking

2. **VCRegistry.sol** - Credential registry with full lifecycle management
   - Issue verifiable credentials (requires active issuer stake)
   - Revoke credentials (issuer-only)
   - Purge revoked/expired credentials (issuer-only, no voting required)
   - View and verify credentials
   - Batch operations support

### Core Functionality

✅ **Issue Verifiable Credentials** - Stake 999,999 DID3 tokens and issue KYC credentials on Base Sepolia
✅ **Revoke Credentials** - Original issuer can revoke their issued credentials
✅ **Purge Registry** - Automatically purge revoked or expired credentials (no consensus needed)
✅ **Stake Management** - Complete DID3 token staking with add/withdraw functionality
✅ **Multi-Role Frontend** - Unified interface with Issuer/Operator, User, and DeFi Protocol views
✅ **Credential Verification** - Check validity and view credential details

### Future Integration (TODOs)

🔮 **ZK Proof Integration (Groth16)** - Privacy-preserving credential verification
🔮 **DeFi Protocol Integration** - KYC verification for compliant DeFi platforms

## 📁 Project Structure

```
issuanceVConTestnet/
├── contracts/
│   ├── AVSManagement.sol        # DID3 token staking management
│   └── VCRegistry.sol            # Primary VC registry with purge
├── deploy-refactored.js          # Deployment script for new architecture
├── app.html                      # Unified frontend with role switching
├── app.js                        # Frontend Web3 integration
├── app-styles.css                # Robinhood-themed styling
├── hardhat.config.js             # Hardhat configuration
├── package.json                  # Dependencies and scripts
└── deployment-refactored.json    # Deployment info (generated)
```

## 🔧 Prerequisites

1. **Web Browser with MetaMask**
   - Install [MetaMask](https://metamask.io/) browser extension
   - Switch to Base Sepolia testnet

2. **Testnet ETH**
   - Get Base Sepolia testnet ETH from [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)

3. **DID3 Tokens** (for issuers)
   - DID3 Token Address: `0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff`
   - Minimum stake: 999,999 DID3 tokens

4. **Node.js & npm** (for contract deployment)
   - Node.js v16+ recommended
   - npm package manager

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Create .env file with your private key
echo "PRIVATE_KEY=your_private_key_here" > .env
echo "BASE_SEPOLIA_RPC=https://sepolia.base.org" >> .env
```

### 3. Compile Contracts

```bash
npm run compile
```

### 4. Deploy to Base Sepolia

```bash
npx hardhat run deploy-refactored.js --network baseSepolia
```

This will deploy both contracts and save deployment info to `deployment-refactored.json`.

### 5. Use the Frontend

```bash
# Serve the application locally
npx serve .

# Or simply open app.html in your browser
```

## 🎯 How to Use

### For Issuers/Operators

1. **Connect Wallet** - Click "Connect Wallet" and approve MetaMask connection
2. **Approve DID3 Tokens** - Enter amount (minimum 999,999) and click "Approve Tokens"
3. **Register as Issuer** - Click "Register as Issuer" and confirm transaction
4. **Issue Credentials** - Fill out the KYC form and issue credentials to users
5. **Manage Credentials** - View, revoke, and purge credentials you've issued
6. **Manage Stake** - Add more stake or withdraw (must maintain minimum 999,999)

### For Users

1. **Switch to User View** - Click the "User" role button
2. **Load Credentials** - Click "Load My Credentials" to see all credentials issued to you
3. **Verify Credentials** - Enter a credential hash to verify its validity

### For DeFi Protocols

1. **Switch to DeFi View** - Click the "DeFi Protocol" role button
2. **Verify User KYC** - Enter a user address to check their KYC status
3. **Integration** - Use the provided code examples to integrate into your protocol

## 📖 Smart Contract Details

### AVSManagement.sol

Manages DID3 token staking for credential issuers.

**Key Functions:**

```solidity
// Register as issuer with minimum stake
function registerIssuer(uint256 stakeAmount) external

// Add more stake to your account
function addStake(uint256 amount) external

// Withdraw stake (deactivates if below minimum)
function withdrawStake(uint256 amount) external

// Reactivate after withdrawal
function reactivateIssuer(uint256 stakeAmount) external

// Check if address is active issuer
function isActiveIssuer(address issuer) external view returns (bool)

// Get issuer information
function getIssuerInfo(address issuer) external view returns (IssuerInfo memory)
```

**Constants:**
- `MINIMUM_STAKE` = 999,999 DID3 tokens (999,999 * 10^18 wei)
- `DID3_TOKEN` = 0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff

### VCRegistry.sol

Primary verifiable credential registry with full lifecycle management.

**Key Functions:**

```solidity
// Issue a new credential (requires active issuer status)
function issueCredential(
    address _subject,
    string memory _credentialType,
    bytes memory _credentialData,
    uint256 _expirationDate
) external returns (bytes32 credentialHash)

// Revoke a credential (issuer-only)
function revokeCredential(bytes32 _credentialHash) external

// Purge revoked/expired credential (issuer-only)
function purgeCredential(bytes32 _credentialHash) external

// Batch purge multiple credentials
function batchPurgeCredentials(bytes32[] calldata _credentialHashes)
    external returns (uint256 purgedCount)

// Check if credential is valid
function isCredentialValid(bytes32 _credentialHash)
    external view returns (bool)

// Get credential details
function getCredential(bytes32 _credentialHash) external view returns (...)

// Get all credentials for a subject
function getSubjectCredentials(address _subject)
    external view returns (bytes32[] memory)

// Get only valid credentials
function getValidSubjectCredentials(address _subject)
    external view returns (bytes32[] memory)
```

**Credential Structure:**

```solidity
struct VerifiableCredential {
    bytes32 credentialHash;      // Unique identifier
    address subject;             // Credential owner
    address issuer;              // Who issued it
    uint256 issuanceDate;        // When issued
    uint256 expirationDate;      // When expires (0 = no expiration)
    bool isRevoked;              // Revocation status
    uint256 revocationTimestamp; // When revoked
    string credentialType;       // Type (e.g., "KYCVerification")
    bytes credentialData;        // Credential data
    bool isPurged;               // Purge status
    uint256 purgeTimestamp;      // When purged
}
```

## 🔮 Future Integration

### ZK Proof Integration (Groth16)

The VCRegistry contract includes detailed TODOs for integrating Groth16 zk-SNARKs for privacy-preserving credential verification. Planned features include:

- **Zero-Knowledge Proof Generation** - Prove attributes without revealing full credential
- **Selective Disclosure** - Prove age > 18 without revealing exact birthdate
- **Anonymous Verification** - Verify credentials without exposing identity
- **Revocation Checks** - Include revocation status in ZK proofs
- **Circuit Design** - Pre-built circuits for common KYC attributes

**Implementation Steps:**
1. Design circuits for credential attributes
2. Generate trusted setup parameters
3. Deploy Groth16 verifier contracts
4. Integrate proof generation in frontend
5. Add proof verification to VCRegistry
6. Create proof templates for common use cases

See `VCRegistry.sol` lines 506-563 for detailed implementation plan.

### DeFi Protocol Integration

The system includes TODOs for integrating with DeFi protocols requiring KYC verification. Target use cases:

- **Lending/Borrowing Platforms** - Aave, Compound integration
- **Regulated DEX** - Compliant exchange platforms
- **Tokenized Securities** - Security token platforms
- **Derivatives Platforms** - Options and futures trading
- **Stablecoins** - KYC-required stablecoin issuers

**Planned Features:**
- Protocol registration and whitelisting
- KYC tier system (basic, advanced, accredited)
- Jurisdiction-specific requirements
- Real-time verification callbacks
- Privacy-preserving verification with ZK proofs
- Sanctions and AML screening integration

See `VCRegistry.sol` lines 565-637 for detailed implementation plan.

## 🔒 Security Considerations

1. **Stake Requirements** - 999,999 DID3 tokens ensures serious commitment from issuers
2. **Issuer Validation** - Only active issuers with sufficient stake can issue credentials
3. **Issuer-Only Operations** - Only original issuer can revoke/purge their credentials
4. **No Voting Required** - Streamlined purge process (issuer directly purges revoked/expired VCs)
5. **On-Chain Transparency** - All operations recorded on blockchain
6. **Data Privacy** - Consider encrypting sensitive credential data before storing on-chain

### Production Recommendations

- **Security Audits** - Conduct thorough audits before mainnet deployment
- **Data Encryption** - Implement encryption for sensitive PII
- **Key Management** - Use hardware wallets or MPC for production
- **Monitoring** - Implement event monitoring for all operations
- **Upgradeability** - Consider proxy patterns for contract upgrades

## 🌐 Network Information

**Base Sepolia Testnet**
- Chain ID: 84532
- RPC URL: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org
- Currency: ETH (testnet)

**DID3 Token**
- Address: 0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff
- Network: Base Sepolia

## 💻 Usage Examples

### Register as Issuer

```javascript
// 1. Approve DID3 tokens
const did3Token = new ethers.Contract(DID3_ADDRESS, ERC20_ABI, signer);
const amount = ethers.utils.parseEther("999999");
await did3Token.approve(AVS_MANAGEMENT_ADDRESS, amount);

// 2. Register as issuer
const avsManagement = new ethers.Contract(AVS_MANAGEMENT_ADDRESS, AVS_ABI, signer);
await avsManagement.registerIssuer(amount);
```

### Issue a Credential

```javascript
const vcRegistry = new ethers.Contract(VC_REGISTRY_ADDRESS, VC_ABI, signer);

const credentialData = {
    fullName: "John Doe",
    dateOfBirth: "1990-01-01",
    country: "United States",
    email: "john@example.com"
};

const credentialBytes = ethers.utils.toUtf8Bytes(JSON.stringify(credentialData));
const expirationDate = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year

const tx = await vcRegistry.issueCredential(
    subjectAddress,
    "KYCVerification",
    credentialBytes,
    expirationDate
);

const receipt = await tx.wait();
const credentialHash = receipt.events[0].args.credentialHash;
console.log("Credential issued:", credentialHash);
```

### Revoke and Purge

```javascript
// Revoke credential
await vcRegistry.revokeCredential(credentialHash);

// Purge revoked credential
await vcRegistry.purgeCredential(credentialHash);
```

### Verify Credential

```javascript
// Check if valid
const isValid = await vcRegistry.isCredentialValid(credentialHash);

// Get full details
const credential = await vcRegistry.getFullCredential(credentialHash);
console.log("Subject:", credential.subject);
console.log("Type:", credential.credentialType);
console.log("Is Revoked:", credential.isRevoked);
console.log("Is Purged:", credential.isPurged);
```

## 🛠️ Development

### Compile Contracts

```bash
npm run compile
```

### Deploy to Local Network

```bash
# Start local Hardhat node
npm run node

# In another terminal, deploy
npx hardhat run deploy-refactored.js --network localhost
```

### Run Tests

```bash
npm test
```

## 🐛 Troubleshooting

**Wallet won't connect?**
- Ensure MetaMask is installed and unlocked
- Check you're on Base Sepolia network (Chain ID: 84532)
- Refresh the page and try again

**Can't register as issuer?**
- Ensure you have at least 999,999 DID3 tokens
- Approve tokens first before registering
- Check you have enough ETH for gas fees

**Can't issue credentials?**
- Verify you're registered as an active issuer
- Check your stake is >= 999,999 DID3 tokens
- Ensure you haven't withdrawn below minimum

**Can't purge credentials?**
- Only the original issuer can purge
- Credential must be revoked OR expired
- Check the credential exists and isn't already purged

## 📚 Resources

- [Base Sepolia Documentation](https://docs.base.org/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [Ethers.js Documentation](https://docs.ethers.org/v5/)
- [Hardhat Documentation](https://hardhat.org/)
- [Groth16 ZK-SNARKs](https://eprint.iacr.org/2016/260.pdf)

## 🤝 Contributing

Contributions welcome! Please ensure:
- Code follows existing style
- Security best practices maintained
- Tests included for new features
- Documentation updated

## 📄 License

MIT License

---

**Note**: This is a testnet implementation for demonstration and development. For production use:
- Conduct thorough security audits
- Implement proper key management
- Add data encryption for sensitive information
- Consider ZK proofs for privacy
- Monitor all contract interactions

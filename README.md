# KYC Verifiable Credential System

A complete blockchain-based KYC verification system with two implementations:
1. **Standard Registry** - Simple verifiable credential issuance with authorized issuers
2. **AVS Registry** - Advanced stake-based issuance with operator consensus for credential purging

Built for Base Sepolia testnet using W3C Verifiable Credentials standards.

## Features

### Standard VC Registry (`VCRegistry.sol`)

- **Elegant Web Form**: Simple, user-friendly interface for KYC data entry
- **Wallet Integration**: MetaMask and Web3 wallet connectivity
- **Smart Contract Registry**: On-chain verifiable credential storage
- **W3C Compliant**: Follows the Verifiable Credentials standard
- **Credential Management**: Issue, verify, and revoke credentials
- **Expired Credential Removal**: Batch and individual removal functions

### AVS VC Registry (`AVSVCRegistry.sol`)

- **Stake-Based Issuance**: Only operators with >= 3 ETH stake can issue credentials
For testing purposes, we will use this DID3 token (0x4e754738cb69d6f066c9a036f67ee44cc3e9abff), each operator will be require to hold at least 1000000 DID3 tokens to be able to issue credentials
- **66% Quorum Purging**: Credential removal requires 66% of total stake to approve
- **Consensus Voting**: Operators vote weighted by their stake amount
- **Issuer Validation**: Only the original issuer can propose credential purging
- **Reason Verification**: Purge proposals validate credentials are actually expired or revoked
- **3-Day Voting Period**: Active proposals remain open for operator voting

## Project Structure

```
projectfriedchix/
├── contracts/
│   ├── VCRegistry.sol          # Standard VC registry contract
│   └── AVSVCRegistry.sol        # AVS operator consensus contract
├── deploy.js                    # Standard registry deployment script
├── deploy-avs.js                # AVS registry deployment script
├── index.html                   # Standard registry UI
├── avs-dashboard.html           # AVS operator dashboard UI
├── wallet.js                    # Standard registry Web3 integration
├── avs-wallet.js                # AVS registry Web3 integration
├── styles.css                   # Standard UI styling
├── avs-styles.css               # AVS dashboard styling
├── test-wallet.html             # Wallet connection testing tool
├── hardhat.config.js            # Hardhat configuration
├── package.json                 # Dependencies and scripts
└── .env                         # Environment variables (not committed)
```

## Prerequisites

1. **Web Browser with MetaMask**
   - Install [MetaMask](https://metamask.io/) browser extension
   - Switch to Base Sepolia testnet

2. **Testnet ETH**
   - Get Base Sepolia testnet ETH from [Coinbase Faucet](https://thirdweb.com/base-sepolia-testnet)
   - Or bridge Sepolia ETH to Base Sepolia

3. **Node.js & npm** (for contract deployment)
   - Node.js v16+ recommended
   - npm or yarn package manager

## Quick Start

### Option 1: Use the Web Interface (Recommended)

1. **Open the Application**
   ```bash
   # Simply open index.html in a web browser
   # Or use a local server:
   npx serve .
   # Then navigate to http://localhost:3000
   ```

2. **Connect Your Wallet**
   - Click "Connect Wallet"
   - Approve the connection in MetaMask
   - Ensure you're on Base Sepolia network

3. **Deploy the Registry Contract**
   - Click "Deploy Registry Contract"
   - Confirm the transaction in MetaMask
   - Wait for deployment confirmation

4. **Issue a Verifiable Credential**
   - Fill in the KYC form:
     - Full Legal Name (required)
     - Date of Birth (required)
     - Country of Citizenship (optional)
     - Email Address (optional)
     - Expiration Date (optional)
   - Click "Issue Verifiable Credential"
   - Confirm the transaction
   - View your credential on the blockchain!

### Option 2: Deploy Using Hardhat

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   # Create .env file with your private key
   echo "PRIVATE_KEY=your_private_key_here" > .env
   echo "BASE_SEPOLIA_RPC=https://sepolia.base.org" >> .env
   ```

3. **Compile Contracts**
   ```bash
   npm run compile
   ```

4. **Deploy Standard Registry to Base Sepolia**
   ```bash
   npm run deploy
   ```

5. **Deploy AVS Registry to Base Sepolia**
   ```bash
   npm run deploy:avs
   ```

   This saves deployment info to `avs-deployment.json`

6. **Update the UI**
   - For standard registry: Already deployed at `0xcF90505B9e31b3D7E215995490Dd3d394E81520E`
   - For AVS registry: Copy address from `avs-deployment.json` and set in `avs-dashboard.html`

## Smart Contract Details

### VCRegistry.sol

**Key Functions:**
- `issueCredential(address _subject, string _credentialType, bytes _credentialData, uint256 _expirationDate)` - Issue a new credential
- `revokeCredential(bytes32 _credentialHash)` - Revoke a credential
- `isCredentialValid(bytes32 _credentialHash)` - Check if credential is valid
- `removeExpiredCredential(bytes32 _credentialHash)` - Remove expired credential
- `batchRemoveExpiredCredentials(bytes32[] _credentialHashes)` - Batch remove expired credentials

**View Functions:**
- `getCredential(bytes32 _credentialHash)` - Get credential details
- `getSubjectCredentials(address _subject)` - Get all credentials for a subject
- `getExpiredCredentials(address _subject)` - Get expired credentials for a subject
- `isAuthorizedIssuer(address _issuer)` - Check if address is authorized issuer

**Access Control:**
- Admin role for contract management
- Authorized issuers can create and remove credentials
- Only issuers or admin can revoke credentials

### AVSVCRegistry.sol

**Operator Management:**
- `registerOperator()` - Register as operator with minimum 3 ETH stake (payable)
- `addStake()` - Add more stake to your operator account (payable)
- `withdrawStake()` - Withdraw stake and deactivate
- `getOperator(address _operator)` - Get operator information
- `getActiveOperators()` - Get all active operators
- `getActiveOperatorCount()` - Get count of active operators

**Credential Management:**
- `issueCredential(...)` - Issue credential (requires >= 3 ETH stake, operator-only)
- `proposePurge(bytes32 _credentialHash, string _reason)` - Propose credential purge (issuer-only)
- `voteOnPurge(uint256 _proposalId)` - Vote on purge proposal (operator-only)
- `executePurge(uint256 _proposalId)` - Execute purge if quorum reached (anyone)

**View Functions:**
- `getPurgeProposal(uint256 _proposalId)` - Get purge proposal details including quorum status
- `hasVotedOnProposal(uint256 _proposalId, address _operator)` - Check if operator voted
- `getQuorumRequirement()` - Get current quorum requirement (66% of total stake)
- `isCredentialValid(bytes32 _credentialHash)` - Check credential validity
- `getCredential(bytes32 _credentialHash)` - Get credential details

**Constants:**
- `MINIMUM_STAKE` = 3 ETH (3000000000000000000 wei)
- `QUORUM_PERCENTAGE` = 6600 (66% in basis points)
- `VOTING_PERIOD` = 3 days (259200 seconds)

### Network Information

**Base Sepolia Testnet**
- Chain ID: 84532
- RPC URL: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org
- Currency: ETH (testnet)

## Credential Schema

Based on `KYC Verification V2.json`, credentials include:

**Required Fields:**
- Full Legal Name
- Date of Birth

**Optional Fields:**
- Country of Citizenship
- Email Address

**System Fields:**
- Credential Hash
- Issuer Address
- Subject Address
- Issuance Date
- Expiration Date
- Revocation Status

## Usage Examples

### Check Credential Validity

```javascript
const isValid = await vcRegistryContract.isCredentialValid(credentialHash);
console.log("Credential is valid:", isValid);
```

### Get User's Credentials

```javascript
const credentials = await vcRegistryContract.getSubjectCredentials(userAddress);
console.log("User has", credentials.length, "credentials");
```

### Revoke a Credential

```javascript
const tx = await vcRegistryContract.revokeCredential(credentialHash);
await tx.wait();
console.log("Credential revoked");
```

## Security Considerations

1. **Private Keys**: Never commit your `.env` file or expose private keys
2. **Testnet Only**: This is configured for testnet use - review carefully before mainnet
3. **Data Privacy**: Credential data is stored on-chain - consider encryption for sensitive data
4. **Access Control**: Only authorized issuers can create credentials
5. **Revocation**: Credentials can be revoked by the issuer or admin

## AVS Consensus Workflow

### 1. Operator Registration
Operators must register with minimum 3 ETH stake to participate:

```solidity
// Register as operator
await avsRegistry.registerOperator({ value: ethers.utils.parseEther("3") });
```

### 2. Credential Issuance
Only active operators with >= 3 ETH stake can issue credentials:

```solidity
await avsRegistry.issueCredential(
    subjectAddress,
    "KYCVerification",
    credentialDataBytes,
    expirationTimestamp
);
```

### 3. Purge Proposal
Only the original issuer can propose purging their credentials:

```solidity
// Propose purge for expired credential
await avsRegistry.proposePurge(credentialHash, "expired");

// Or for revoked credential
await avsRegistry.proposePurge(credentialHash, "revoked");
```

**Validation Rules:**
- Only issuer of the credential can propose
- Reason must be "expired" or "revoked"
- Credential status must match the stated reason
- If "expired": credential.expirationDate must be < current time
- If "revoked": credential.isRevoked must be true

### 4. Consensus Voting
All active operators can vote on purge proposals:

```solidity
await avsRegistry.voteOnPurge(proposalId);
```

**Voting Rules:**
- Each operator can vote once per proposal
- Vote weight = operator's stake amount
- Voting period: 3 days from proposal creation
- Contract re-validates issuer and reason on each vote

### 5. Execution
Anyone can execute a purge once 66% quorum is reached:

```solidity
await avsRegistry.executePurge(proposalId);
```

**Execution Requirements:**
- Total voting power >= 66% of total stake
- Proposal hasn't been executed already
- Marks credential as revoked if not already

## Usage Examples

### Standard Registry

#### Issue a Credential
```javascript
const credentialData = {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'KYCVerification'],
    credentialSubject: {
        Full_Legal_Name: "John Doe",
        DateOfBirth: "1990-01-01",
        Country: "United States"
    }
};

const credentialBytes = ethers.utils.toUtf8Bytes(JSON.stringify(credentialData));
const expirationTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year

const tx = await vcRegistry.issueCredential(
    subjectAddress,
    "KYCVerification",
    credentialBytes,
    expirationTimestamp
);
const receipt = await tx.wait();
```

#### Check Credential Validity
```javascript
const isValid = await vcRegistry.isCredentialValid(credentialHash);
console.log("Credential is valid:", isValid);
```

#### Remove Expired Credentials
```javascript
// Get expired credentials for a subject
const expiredCreds = await vcRegistry.getExpiredCredentials(subjectAddress);

// Batch remove them
if (expiredCreds.length > 0) {
    const tx = await vcRegistry.batchRemoveExpiredCredentials(expiredCreds);
    await tx.wait();
    console.log(`Removed ${expiredCreds.length} expired credentials`);
}
```

### AVS Registry

#### Register as Operator
```javascript
const stakeAmount = ethers.utils.parseEther("5"); // 5 ETH
const tx = await avsRegistry.registerOperator({ value: stakeAmount });
await tx.wait();
console.log("Registered as operator with 5 ETH stake");
```

#### Propose and Vote on Purge
```javascript
// Issuer proposes purge
const proposeTx = await avsRegistry.proposePurge(credentialHash, "expired");
const proposeReceipt = await proposeTx.wait();
const proposalId = proposeReceipt.events[0].args.proposalId;

// Other operators vote
const voteTx = await avsRegistry.voteOnPurge(proposalId);
await voteTx.wait();

// Check quorum
const proposal = await avsRegistry.getPurgeProposal(proposalId);
if (proposal.quorumReached) {
    // Execute purge
    const executeTx = await avsRegistry.executePurge(proposalId);
    await executeTx.wait();
    console.log("Purge executed successfully");
}
```

## Troubleshooting

### General Issues

**Wallet won't connect?**
- Ensure MetaMask is installed and unlocked
- Check that you're on Base Sepolia network (Chain ID: 84532)
- Try refreshing the page
- Use `test-wallet.html` to diagnose connection issues

**Wrong network?**
- The app will prompt you to switch to Base Sepolia
- Approve the network switch in MetaMask
- If Base Sepolia doesn't exist, the app will add it automatically

**Transaction failing?**
- Ensure you have enough Base Sepolia ETH for gas
- Get testnet ETH from [Base faucet](https://www.coinbase.com/faucets/base-ethereum-goerli-faucet)
- Check that the contract is deployed
- Verify you meet the requirements for the operation

### Standard Registry Issues

**Can't issue credentials?**
- Verify you're an authorized issuer
- Admin can authorize issuers using `setAuthorizedIssuer()`
- Check console for specific error messages

**Can't remove expired credentials?**
- Only authorized issuers can remove credentials
- Verify the credential has actually expired
- Check that the credential exists and isn't already revoked

### AVS Registry Issues

**Can't register as operator?**
- Minimum stake is 3 ETH
- Ensure you're not already registered
- Check you have enough ETH (stake + gas)

**Can't issue credentials?**
- Only operators with >= 3 ETH stake can issue
- Verify your operator status is active
- Check your stake amount hasn't fallen below minimum

**Can't propose purge?**
- Only the original issuer can propose purging a credential
- Verify you issued the credential you're trying to purge
- Reason must be "expired" or "revoked" (exact match)
- Credential status must match the reason:
  - "expired": credential.expirationDate must be < current time
  - "revoked": credential.isRevoked must be true

**Can't vote on purge?**
- Only active operators can vote
- You can only vote once per proposal
- Voting period is 3 days - check proposal hasn't expired
- Ensure you have >= 3 ETH stake

**Can't execute purge?**
- Quorum must be reached (66% of total stake)
- Check proposal.quorumReached status
- Proposal must not be already executed
- Anyone can execute once quorum is reached

## Development

### Local Testing

```bash
# Start local Hardhat node
npm run node

# In another terminal, deploy to local network
npm run deploy:local
```

### Running Tests

```bash
npm test
```

## Resources

- [Base Sepolia Documentation](https://docs.base.org/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [Ethers.js Documentation](https://docs.ethers.io/v5/)
- [Hardhat Documentation](https://hardhat.org/getting-started/)

## License

MIT License - see project files for details

## Contributing

Contributions are welcome! Please ensure:
- Code follows existing style
- Security best practices are maintained
- Tests are included for new features
- Documentation is updated

## Deployment Info

### Standard Registry (VCRegistry.sol)
- **Contract Address**: `0xcF90505B9e31b3D7E215995490Dd3d394E81520E`
- **Network**: Base Sepolia (Chain ID: 84532)
- **Explorer**: [View on BaseScan](https://sepolia.basescan.org/address/0xcF90505B9e31b3D7E215995490Dd3d394E81520E)
- **UI**: `index.html`

### AVS Registry (AVSVCRegistry.sol)
- **Status**: Ready to deploy
- **Deployment Command**: `npm run deploy:avs`
- **Deployment Info**: Saved to `avs-deployment.json`
- **UI**: `avs-dashboard.html`

## Security Considerations

### Standard Registry
1. **Private Keys**: Never commit `.env` file or expose private keys
2. **Data Privacy**: Credential data is stored on-chain - consider encryption for sensitive PII
3. **Access Control**: Only authorized issuers can create credentials
4. **Revocation**: Credentials can be revoked by issuer or admin
5. **Expiration**: Expired credentials can be removed to clean up state

### AVS Registry
1. **Stake Requirements**: 3 ETH minimum prevents spam and ensures operator commitment
2. **Issuer Validation**: Only original issuer can propose purging - prevents unauthorized deletion
3. **Reason Verification**: Smart contract validates purge reasons match actual credential status
4. **Quorum Enforcement**: 66% of total stake required - prevents single operator control
5. **Voting Period**: 3-day window allows proper review and participation
6. **Double-Vote Prevention**: Each operator can only vote once per proposal
7. **Real-Time Validation**: Credential status verified on each vote and execution

### Production Considerations
- **Testnet Only**: Current implementation is for Base Sepolia testnet
- **Security Audits**: Conduct thorough audits before mainnet deployment
- **Data Encryption**: Consider encrypting sensitive credential data
- **Key Management**: Use hardware wallets or MPC for production keys
- **Monitoring**: Implement event monitoring for all credential operations
- **Upgradeability**: Consider proxy patterns for contract upgrades

## Technologies Used

- **Solidity 0.8.25** - Smart contract language
- **Hardhat** - Ethereum development environment
- **Ethers.js v5.7.2** - Web3 library for blockchain interaction
- **Base Sepolia** - Layer 2 Ethereum testnet
- **W3C Verifiable Credentials** - Standard for digital credentials
- **MetaMask** - Web3 wallet integration

## Resources

- [Base Sepolia Documentation](https://docs.base.org/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [Ethers.js Documentation](https://docs.ethers.org/v5/)
- [Hardhat Documentation](https://hardhat.org/getting-started/)
- [Solidity Documentation](https://docs.soliditylang.org/)
- [EigenLayer AVS Documentation](https://docs.eigenlayer.xyz/)

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Base Sepolia documentation
3. Ensure you have testnet ETH from the faucet
4. Verify contract deployment and configuration
5. Check browser console for detailed error messages
6. Use `test-wallet.html` for connection diagnostics

## License

MIT License

## Contributing

This is a demonstration project for KYC verifiable credentials on Base Sepolia testnet. Contributions are welcome for:
- Bug fixes and improvements
- Additional credential types
- Enhanced UI/UX
- Testing and documentation
- Security enhancements

---

**Note**: This is a testnet implementation for demonstration and development purposes. For production use, conduct thorough security audits, implement proper key management, and consider additional privacy measures such as zero-knowledge proofs or encryption.

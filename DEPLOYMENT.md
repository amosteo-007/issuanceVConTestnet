# Deployment Guide

Complete step-by-step guide to deploy the Verifiable Credentials System on Base Sepolia.

## Prerequisites

Before deploying, ensure you have:

1. **Node.js and npm** (v16 or higher)
2. **MetaMask** with Base Sepolia network configured
3. **Base Sepolia ETH** for gas fees (get from [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet))
4. **Private Key** for deployment account (with Base Sepolia ETH)
5. **DID3 Tokens** (optional, for testing as issuer)

## Step 1: Environment Setup

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file in the project root:

```bash
# .env
PRIVATE_KEY=your_private_key_here_without_0x_prefix
BASE_SEPOLIA_RPC=https://sepolia.base.org
```

**Security Note**: Never commit the `.env` file to version control!

## Step 2: Compile Contracts

Compile all smart contracts:

```bash
npm run compile
```

Expected output:
```
Compiled 3 Solidity files successfully
```

## Step 3: Run Tests (Optional but Recommended)

Before deploying, run the test suite to ensure everything works:

```bash
# Run all tests
npm test

# Or run specific tests
npm run test:avs    # Test AVSManagement contract
npm run test:vc     # Test VCRegistry contract
```

All tests should pass before proceeding to deployment.

## Step 4: Deploy to Base Sepolia

Deploy the refactored contracts:

```bash
npm run deploy:refactored
```

This will:
1. Deploy the **AVSManagement** contract
2. Deploy the **VCRegistry** contract (linked to AVSManagement)
3. Save deployment info to `deployment-refactored.json`

### Expected Output

```
🚀 Starting deployment of refactored VC system to Base Sepolia...

📝 Deploying contracts with account: 0x...
💰 Account balance: ...

🪙 DID3 Token Address: 0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff

📦 Deploying AVSManagement contract...
✅ AVSManagement deployed to: 0x...
   - Minimum Stake: 999,999 DID3 tokens
   - DID3 Token:  0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff

📦 Deploying VCRegistry contract...
✅ VCRegistry deployed to: 0x...
   - AVSManagement:  0x...

📄 Deployment info saved to deployment-refactored.json

============================================================
🎉 DEPLOYMENT COMPLETE!
============================================================
```

## Step 5: Verify Contracts on BaseScan

After deployment, verify your contracts on [BaseScan](https://sepolia.basescan.org):

### Verify AVSManagement

```bash
npx hardhat verify --network baseSepolia <AVSManagement_ADDRESS> "0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff"
```

### Verify VCRegistry

```bash
npx hardhat verify --network baseSepolia <VCRegistry_ADDRESS> <AVSManagement_ADDRESS>
```

### Verify MockERC20 (if deployed for testing)

```bash
npx hardhat verify --network baseSepolia <MockERC20_ADDRESS> "DID3 Token" "DID3" "10000000000000000000000000"
```

## Step 6: Configure Frontend

Update the frontend to use your deployed contracts:

1. The frontend automatically loads contract addresses from `deployment-refactored.json`
2. If you need to manually update addresses, edit `app.js`:

```javascript
// Update these lines if needed
let AVS_MANAGEMENT_ADDRESS = 'your_avs_management_address';
let VC_REGISTRY_ADDRESS = 'your_vc_registry_address';
```

## Step 7: Launch Frontend

Start a local web server to serve the frontend:

```bash
npm run serve
```

Then open your browser to:
- http://localhost:3000/app.html

Or simply open `app.html` directly in your browser.

## Step 8: Become an Issuer

To issue credentials, you need to stake DID3 tokens:

### Option A: Using the Frontend

1. **Connect Wallet** - Click "Connect Wallet" in the app
2. **Get DID3 Tokens** - Ensure you have at least 999,999 DID3 tokens
3. **Approve Tokens**:
   - Enter amount: `999999` (or more)
   - Click "1. Approve Tokens"
   - Confirm transaction in MetaMask
4. **Register as Issuer**:
   - Click "2. Register as Issuer"
   - Confirm transaction in MetaMask
5. **Verify Status** - You should see "✅ Active" status

### Option B: Using Hardhat Console

```bash
npx hardhat console --network baseSepolia
```

Then:

```javascript
const AVSManagement = await ethers.getContractFactory("AVSManagement");
const avsManagement = await AVSManagement.attach("YOUR_AVS_MANAGEMENT_ADDRESS");

const ERC20 = await ethers.getContractFactory("MockERC20");
const did3Token = await ERC20.attach("0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff");

// Approve tokens
const amount = ethers.utils.parseEther("999999");
await did3Token.approve(avsManagement.address, amount);

// Register as issuer
await avsManagement.registerIssuer(amount);

// Check status
console.log(await avsManagement.isActiveIssuer(await ethers.provider.getSigner().getAddress()));
```

## Step 9: Issue Your First Credential

### Using the Frontend

1. Switch to "Issuer / Operator" view (should be default)
2. Fill out the credential form:
   - **Subject Address**: Ethereum address to receive the credential
   - **Credential Type**: Select "KYC Verification" (or other type)
   - **Full Legal Name**: Required field
   - **Date of Birth**: Required field
   - **Country**: Optional
   - **Email**: Optional
   - **Expiration Date**: Optional (leave empty for no expiration)
3. Click "Issue Credential"
4. Confirm transaction in MetaMask
5. Wait for confirmation - you'll see the credential hash

### Using Hardhat Console

```javascript
const VCRegistry = await ethers.getContractFactory("VCRegistry");
const vcRegistry = await VCRegistry.attach("YOUR_VC_REGISTRY_ADDRESS");

const credentialData = {
    fullName: "John Doe",
    dateOfBirth: "1990-01-01",
    country: "United States",
    email: "john@example.com"
};

const credentialBytes = ethers.utils.toUtf8Bytes(JSON.stringify(credentialData));
const expirationDate = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60); // 1 year

const tx = await vcRegistry.issueCredential(
    "0xSubjectAddress",
    "KYCVerification",
    credentialBytes,
    expirationDate
);

const receipt = await tx.wait();
console.log("Credential issued:", receipt.events[0].args.credentialHash);
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Dependencies installed (`npm install`)
- [ ] Contracts compiled successfully
- [ ] Tests passing
- [ ] Sufficient Base Sepolia ETH for deployment
- [ ] Contracts deployed to Base Sepolia
- [ ] Deployment addresses saved
- [ ] Contracts verified on BaseScan
- [ ] Frontend configured with contract addresses
- [ ] DID3 tokens obtained (for issuers)
- [ ] Successfully registered as issuer
- [ ] First credential issued successfully

## Troubleshooting

### Compilation Errors

**Issue**: Solidity compiler download fails
```
Error HH502: Couldn't download compiler version list
```

**Solution**: This may be a temporary network issue. Try:
1. Check your internet connection
2. Wait a few minutes and try again
3. Use a VPN if the issue persists

### Deployment Fails

**Issue**: Transaction reverts during deployment
```
Error: transaction failed
```

**Solutions**:
1. Check you have enough Base Sepolia ETH
2. Increase gas limit in `hardhat.config.js`:
   ```javascript
   gas: 8000000
   ```
3. Verify the DID3 token address is correct

### Can't Register as Issuer

**Issue**: Registration transaction reverts

**Solutions**:
1. Ensure you have at least 999,999 DID3 tokens
2. Check token approval was successful
3. Verify you're not already registered:
   ```javascript
   await avsManagement.getIssuerInfo(yourAddress)
   ```

### Frontend Not Loading Contracts

**Issue**: "Contract not found" or similar errors

**Solutions**:
1. Check `deployment-refactored.json` exists and has correct addresses
2. Verify you're connected to Base Sepolia network
3. Clear browser cache and reload
4. Check browser console for detailed errors

## Network Information

**Base Sepolia Testnet**
- **Chain ID**: 84532 (0x14a34)
- **RPC URL**: https://sepolia.base.org
- **Explorer**: https://sepolia.basescan.org
- **Currency**: ETH (testnet)
- **Faucet**: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

**DID3 Token**
- **Address**: 0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff
- **Network**: Base Sepolia
- **Required Stake**: 999,999 DID3

## Post-Deployment Tasks

After successful deployment:

1. **Document Contract Addresses** - Save all addresses securely
2. **Share with Team** - Provide addresses to frontend developers
3. **Monitor Events** - Set up event monitoring for contract activities
4. **Test All Features**:
   - Issue credentials
   - Revoke credentials
   - Purge credentials
   - Verify credentials
   - Stake management
5. **Security Audit** - Consider professional audit for production

## Local Development Deployment

For testing on local Hardhat network:

```bash
# Terminal 1: Start local node
npm run node

# Terminal 2: Deploy to local network
npm run deploy:refactored:local
```

The local network provides 20 test accounts with 10,000 ETH each for testing.

## Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [Base Sepolia Documentation](https://docs.base.org/using-base/)
- [Ethers.js Documentation](https://docs.ethers.org/v5/)
- [MetaMask Guide](https://metamask.io/faqs/)
- [Verifiable Credentials Standard](https://www.w3.org/TR/vc-data-model/)

## Support

If you encounter issues not covered in this guide:

1. Check the [README.md](README.md) for general information
2. Review the [Troubleshooting](#troubleshooting) section above
3. Check contract events on BaseScan for detailed error messages
4. Review Hardhat logs for deployment issues
5. Ensure all prerequisites are met

---

**Security Reminder**: This is a testnet deployment. For production:
- Conduct thorough security audits
- Use hardware wallets for deployment
- Implement proper key management
- Add multi-sig controls for admin functions
- Monitor all contract interactions

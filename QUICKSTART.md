# Quick Start Guide

Get your Verifiable Credentials system up and running in 5 minutes!

## 🚀 One-Command Setup

```bash
# 1. Install dependencies and compile
npm run setup

# 2. Create .env file with your private key
echo "PRIVATE_KEY=your_private_key_here" > .env
echo "BASE_SEPOLIA_RPC=https://sepolia.base.org" >> .env

# 3. Deploy to Base Sepolia
npm run deploy:refactored

# 4. Verify contracts on BaseScan (optional)
npm run verify

# 5. Start the frontend
npm run serve
```

Then open http://localhost:3000/app.html 🎉

## 📋 What You Need

Before starting, make sure you have:

✅ Node.js v16+ installed
✅ MetaMask with Base Sepolia network
✅ Base Sepolia ETH ([Get from faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet))
✅ 999,999 DID3 tokens to become an issuer (Address: `0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff`)

## 🎯 First Steps After Deployment

### 1. Open the App

Navigate to http://localhost:3000/app.html or open `app.html` directly in your browser.

### 2. Connect Your Wallet

Click "Connect Wallet" and approve the connection in MetaMask.

### 3. Become an Issuer

**Option A: Use the Frontend** (Easiest!)
1. Make sure you're in the "Issuer / Operator" view
2. Enter `999999` in the "Stake Amount" field
3. Click "1. Approve Tokens" → Confirm in MetaMask
4. Click "2. Register as Issuer" → Confirm in MetaMask
5. Wait for confirmation - you should see "✅ Active" status

**Option B: Use Hardhat Console**
```bash
npx hardhat console --network baseSepolia
```

Then run:
```javascript
const AVSManagement = await ethers.getContractFactory("AVSManagement");
const avsManagement = await AVSManagement.attach("YOUR_AVS_ADDRESS_FROM_DEPLOYMENT");

const ERC20 = await ethers.getContractFactory("MockERC20");
const did3Token = await ERC20.attach("0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff");

const amount = ethers.utils.parseEther("999999");
await did3Token.approve(avsManagement.address, amount);
await avsManagement.registerIssuer(amount);
```

### 4. Issue Your First Credential

1. Stay in "Issuer / Operator" view
2. Fill out the form:
   - **Subject Address**: `0x...` (the person receiving the credential)
   - **Credential Type**: Select "KYC Verification"
   - **Full Legal Name**: "John Doe"
   - **Date of Birth**: "1990-01-01"
   - **Country**: "United States" (optional)
   - **Email**: "john@example.com" (optional)
   - **Expiration Date**: Leave blank for no expiration
3. Click "Issue Credential"
4. Confirm in MetaMask
5. Done! 🎉

## 🔄 Common Operations

### View Your Issued Credentials

1. Click "Load My Credentials" in the Issuer view
2. See all credentials you've issued
3. Use buttons to revoke or purge credentials

### Check User Credentials (User View)

1. Click the "User" role button at the top
2. Click "Load My Credentials"
3. View all credentials issued to your address

### Verify a Credential

1. Switch to "User" view
2. Paste a credential hash in the "Verify Credential" section
3. Click "Verify"
4. See if the credential is valid

### Stake More DID3 Tokens

1. In Issuer view, enter amount in "Stake Amount" field
2. Click "Approve Tokens" if needed
3. Click "Add More Stake"
4. Confirm in MetaMask

### Withdraw Your Stake

1. In Issuer view, enter amount to withdraw
2. Click "Withdraw Stake"
3. Confirm in MetaMask
4. **Note**: Withdrawing below 999,999 will deactivate you as an issuer

## 🧪 Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:avs    # Test AVSManagement
npm run test:vc     # Test VCRegistry
```

## 🔍 Useful Commands

```bash
# Compile contracts
npm run compile

# Clean compiled artifacts
npm run clean

# Deploy to local Hardhat network (for testing)
npm run node                      # Terminal 1
npm run deploy:refactored:local   # Terminal 2

# Serve frontend
npm run serve
```

## 🌐 Network Details

**Base Sepolia**
- Chain ID: 84532
- RPC: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org

**DID3 Token**
- Address: `0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff`
- Minimum Stake: 999,999 DID3

## 🐛 Troubleshooting

**"Insufficient funds" error?**
- Get Base Sepolia ETH from the faucet

**"Not an active issuer" error?**
- Make sure you've staked at least 999,999 DID3 tokens
- Check your status in the Issuer view

**Frontend not connecting?**
- Make sure you're on Base Sepolia network (Chain ID: 84532)
- Check that contracts are deployed (look for `deployment-refactored.json`)
- Refresh the page and try again

**Contracts not deployed?**
- Run `npm run deploy:refactored` again
- Check you have Base Sepolia ETH for gas

## 📚 Learn More

- **Full Documentation**: See [README.md](README.md)
- **Deployment Guide**: See [DEPLOYMENT.md](DEPLOYMENT.md)
- **Smart Contracts**: Check `contracts/` directory
- **Tests**: Check `test/` directory

## 💡 Pro Tips

1. **Save your deployment info**: The `deployment-refactored.json` file contains important contract addresses
2. **Test locally first**: Use `npm run node` and `npm run deploy:refactored:local` to test without spending real ETH
3. **Verify on BaseScan**: Run `npm run verify` after deployment to make contracts readable on the explorer
4. **Keep your private key safe**: Never commit `.env` to git!

## 🎨 Frontend Features

The app has three main views:

1. **Issuer / Operator**: Manage stake, issue credentials, view issued credentials
2. **User**: View your credentials, verify credential validity
3. **DeFi Protocol**: Check user KYC status (coming soon with full integration)

Switch between views using the role buttons at the top!

## ✨ What's Next?

After getting started:

- Issue credentials to different addresses
- Try revoking and purging credentials
- Test expiration by creating credentials with past expiration dates
- Explore the ZK proof integration TODOs in `VCRegistry.sol`
- Check out DeFi integration TODOs for building on this system

---

**Happy credentialing!** 🎉

For detailed information, see the full [README.md](README.md) and [DEPLOYMENT.md](DEPLOYMENT.md).

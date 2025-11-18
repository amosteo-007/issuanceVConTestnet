# DID3 Token Migration Guide

## Overview

The AVS VC Registry has been updated to use **DID3 ERC20 tokens** instead of ETH for operator staking. This provides more flexibility and allows for testing with custom tokens.

## DID3 Token Details

- **Token Address**: `0x4e754738cb69d6f066c9a036f67ee44cc3e9abff`
- **Network**: Base Sepolia Testnet
- **Decimals**: 18
- **Minimum Stake**: 999,999 DID3 tokens (999999000000000000000000 wei)

## Changes Made

### Smart Contract (AVSVCRegistry.sol)

1. **Added ERC20 Interface**
   ```solidity
   interface IERC20 {
       function transfer(address to, uint256 amount) external returns (bool);
       function transferFrom(address from, address to, uint256 amount) external returns (bool);
       function balanceOf(address account) external view returns (uint256);
       function approve(address spender, uint256 amount) external returns (bool);
   }
   ```

2. **Updated Constants**
   ```solidity
   address public constant DID3_TOKEN = 0x4e754738cb69d6f066c9a036f67ee44cc3e9abff;
   uint256 public constant MINIMUM_STAKE = 999999 * 1e18; // 999,999 DID3
   ```

3. **Modified Operator Functions**
   - `registerOperator(uint256 _stakeAmount)` - Now takes stake amount parameter instead of payable
   - `addStake(uint256 _additionalStake)` - Now takes stake amount parameter instead of payable
   - `withdrawStake()` - Now transfers DID3 tokens instead of ETH

### Frontend (avs-wallet.js)

1. **Added DID3 Token Configuration**
   ```javascript
   const DID3_TOKEN_ADDRESS = '0x4e754738cb69d6f066c9a036f67ee44cc3e9abff';
   const MINIMUM_DID3_STAKE = '999999000000000000000000'; // 999,999 DID3
   ```

2. **Added ERC20 ABI**
   - Includes functions for `balanceOf`, `approve`, `allowance`, `transfer`, etc.

3. **Updated Registration Flow**
   - Check DID3 token balance
   - Approve DID3 tokens for contract
   - Call `registerOperator(stakeAmount)`

4. **Updated Staking Functions**
   - All stake amounts now use DID3 tokens
   - Automatic approval workflow before staking

### UI Updates (avs-dashboard.html)

1. **Registration Section**
   - Changed from "3 ETH" to "999,999 DID3 tokens"
   - Added token address display
   - Updated input validation (min: 999999)

2. **Network Statistics**
   - Changed all ETH references to DID3
   - Added DID3 token address display

3. **Operator Status**
   - Shows stake in DID3 tokens instead of ETH

## How to Use

### Step 1: Get DID3 Tokens

You need to obtain DID3 test tokens at address `0x4e754738cb69d6f066c9a036f67ee44cc3e9abff` on Base Sepolia.

### Step 2: Approve DID3 Tokens

Before registering as an operator, you need to approve the AVS contract to spend your DID3 tokens. This is handled automatically by the UI, but manually it would be:

```javascript
const did3Token = new ethers.Contract(DID3_TOKEN_ADDRESS, ERC20_ABI, signer);
await did3Token.approve(avsContractAddress, stakeAmount);
```

### Step 3: Register as Operator

```javascript
// Enter 999,999 or more DID3 tokens in the stake amount field
// The UI will:
// 1. Check your DID3 balance
// 2. Approve the tokens
// 3. Register you as operator
await avsRegistry.registerOperator(ethers.utils.parseEther("999999"));
```

### Step 4: Add More Stake (Optional)

```javascript
// Approve more tokens
await did3Token.approve(avsContractAddress, additionalAmount);

// Add stake
await avsRegistry.addStake(additionalAmount);
```

### Step 5: Withdraw Stake

```javascript
// Withdraw all stake and deactivate
await avsRegistry.withdrawStake();
// DID3 tokens are returned to your wallet
```

## Important Notes

### Token Approval Required

Unlike ETH transfers (which are sent directly), ERC20 tokens require a two-step process:

1. **Approve**: Grant the contract permission to spend your tokens
2. **Transfer**: The contract pulls the tokens from your wallet

The UI handles this automatically, showing progress for both steps.

### Minimum Stake Calculation

```
Minimum Stake = 999,999 DID3
In Wei = 999,999 * 10^18
       = 999999000000000000000000 wei
```

### Gas Considerations

- Token approval requires a transaction (gas cost)
- Registration/staking requires a transaction (gas cost)
- You need Base Sepolia ETH for gas, separate from DID3 tokens

### Security

1. **Check Token Address**: Always verify you're approving the correct contract
2. **Approval Amount**: The UI approves only the exact amount needed
3. **Revoke Approvals**: You can revoke token approvals through your wallet settings

## Deployment

When deploying the AVS contract:

```bash
npm run compile
npm run deploy:avs
```

The contract will be configured with:
- DID3 Token: `0x4e754738cb69d6f066c9a036f67ee44cc3e9abff`
- Minimum Stake: 999,999 DID3 tokens
- Quorum: 66% of total DID3 stake

## Testing Checklist

- [ ] Obtain DID3 test tokens
- [ ] Approve DID3 tokens for AVS contract
- [ ] Register as operator with 999,999+ DID3
- [ ] Verify operator status shows DID3 stake
- [ ] Issue a credential as operator
- [ ] Add more DID3 stake
- [ ] Vote on purge proposal
- [ ] Withdraw DID3 stake
- [ ] Verify DID3 tokens returned to wallet

## Troubleshooting

### "Insufficient stake" Error
- Ensure you have at least 999,999 DID3 tokens
- Check your DID3 balance: `did3Token.balanceOf(yourAddress)`

### "Token transfer failed" Error
- Approve tokens first: `did3Token.approve(avsContract, amount)`
- Check approval: `did3Token.allowance(yourAddress, avsContract)`

### "Insufficient DID3 balance" Message
- You don't have enough DID3 tokens in your wallet
- Obtain more DID3 tokens before attempting to stake

### Transaction Reverts on Registration
- Ensure you approved enough tokens
- Check you're not already registered
- Verify the DID3 token contract is accessible

## Migration from ETH to DID3

If you had the previous ETH-based version:

1. **No Automatic Migration**: Old ETH stakes cannot be migrated
2. **Deploy New Contract**: Deploy fresh AVSVCRegistry with DID3 support
3. **Re-register**: Operators must register again with DID3 tokens
4. **Update Frontend**: Point UI to new contract address

## Smart Contract Functions Summary

### Operator Management
- `registerOperator(uint256 _stakeAmount)` - Register with DID3 tokens
- `addStake(uint256 _additionalStake)` - Add more DID3 stake
- `withdrawStake()` - Withdraw DID3 stake and deactivate

### View Functions
- `DID3_TOKEN()` - Returns DID3 token address
- `MINIMUM_STAKE()` - Returns minimum stake (999,999 * 1e18)
- `getOperator(address)` - Returns operator info including DID3 stake
- `totalStake()` - Returns total DID3 staked in the system

### Constants
```solidity
address public constant DID3_TOKEN = 0x4e754738cb69d6f066c9a036f67ee44cc3e9abff;
uint256 public constant MINIMUM_STAKE = 999999 * 1e18;
uint256 public constant QUORUM_PERCENTAGE = 6600; // 66%
uint256 public constant VOTING_PERIOD = 3 days;
```

## Benefits of DID3 Token Staking

1. **Flexibility**: Test with custom token supply
2. **Realistic Testing**: Mimics real-world ERC20 staking mechanisms
3. **Governance Ready**: Can be used for token-based governance
4. **Cross-Chain Compatibility**: ERC20 standard works across EVM chains

## Resources

- [ERC20 Token Standard](https://eips.ethereum.org/EIPS/eip-20)
- [OpenZeppelin ERC20 Documentation](https://docs.openzeppelin.com/contracts/4.x/erc20)
- [Ethers.js ERC20 Guide](https://docs.ethers.org/v5/api/contract/example/#example-erc-20-contract)

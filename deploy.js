/**
 * Deployment script for VCRegistry contract on Base Sepolia
 *
 * Prerequisites:
 * 1. Install dependencies: npm install --save-dev hardhat @nomiclabs/hardhat-ethers ethers
 * 2. Set up .env file with PRIVATE_KEY and BASE_SEPOLIA_RPC_URL
 * 3. Run: npx hardhat run deploy.js --network baseSepolia
 */

const hre = require("hardhat");

async function main() {
    console.log("Starting deployment of VCRegistry to Base Sepolia...\n");

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    const deployerAddress = await deployer.getAddress();
    console.log("Deploying contracts with account:", deployerAddress);

    const balance = await deployer.getBalance();
    console.log("Account balance:", hre.ethers.utils.formatEther(balance), "ETH\n");

    // Deploy VCRegistry
    console.log("Deploying VCRegistry contract...");
    const VCRegistry = await hre.ethers.getContractFactory("VCRegistry");
    const vcRegistry = await VCRegistry.deploy();

    await vcRegistry.deployed();

    console.log("\n✅ VCRegistry deployed successfully!");
    console.log("Contract address:", vcRegistry.address);
    console.log("Transaction hash:", vcRegistry.deployTransaction.hash);
    console.log("\nDeployer is set as admin and authorized issuer");

    // Verify deployment
    console.log("\nVerifying deployment...");
    const admin = await vcRegistry.admin();
    const isAuthorized = await vcRegistry.isAuthorizedIssuer(deployerAddress);
    console.log("Admin address:", admin);
    console.log("Deployer is authorized issuer:", isAuthorized);

    // Save deployment info
    const deploymentInfo = {
        network: "Base Sepolia",
        contractAddress: vcRegistry.address,
        deployer: deployerAddress,
        transactionHash: vcRegistry.deployTransaction.hash,
        blockNumber: vcRegistry.deployTransaction.blockNumber,
        timestamp: new Date().toISOString()
    };

    console.log("\n📋 Deployment Information:");
    console.log(JSON.stringify(deploymentInfo, null, 2));

    console.log("\n🔗 View on Base Sepolia Explorer:");
    console.log(`https://sepolia.basescan.org/address/${vcRegistry.address}`);

    console.log("\n📝 Next Steps:");
    console.log("1. Update wallet.js with the contract address");
    console.log("2. Or use the 'Deploy Registry Contract' button in the UI");
    console.log("3. Authorize additional issuers if needed using setAuthorizedIssuer()");

    return vcRegistry.address;
}

// Execute deployment
main()
    .then((address) => {
        console.log("\n✨ Deployment completed successfully!");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });

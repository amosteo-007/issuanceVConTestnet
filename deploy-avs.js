const hre = require("hardhat");

async function main() {
    console.log("Deploying AVSVCRegistry to Base Sepolia...");

    const [deployer] = await hre.ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    console.log("Deploying contracts with account:", deployerAddress);

    const balance = await deployer.getBalance();
    console.log("Account balance:", hre.ethers.utils.formatEther(balance), "ETH");

    // Deploy AVSVCRegistry
    const AVSVCRegistry = await hre.ethers.getContractFactory("AVSVCRegistry");
    const registry = await AVSVCRegistry.deploy();

    await registry.deployed();

    console.log("AVSVCRegistry deployed to:", registry.address);
    console.log("Admin address:", deployerAddress);

    // Get contract constants
    const did3TokenAddress = await registry.DID3_TOKEN();
    const minimumStake = await registry.MINIMUM_STAKE();
    const quorumPercentage = await registry.QUORUM_PERCENTAGE();
    const votingPeriod = await registry.VOTING_PERIOD();

    console.log("\n=== Deployment Summary ===");
    console.log("Contract Address:", registry.address);
    console.log("Network: Base Sepolia (Chain ID: 84532)");
    console.log("Block Explorer:", `https://sepolia.basescan.org/address/${registry.address}`);
    console.log("\n=== Configuration ===");
    console.log("DID3 Token Address:", did3TokenAddress);
    console.log("Minimum Stake:", hre.ethers.utils.formatEther(minimumStake), "DID3 tokens");
    console.log("Quorum Percentage:", quorumPercentage.toString(), "basis points (66%)");
    console.log("Voting Period:", votingPeriod.toString(), "seconds (3 days)");

    // Save deployment info
    const fs = require('fs');
    const deploymentInfo = {
        contractAddress: registry.address,
        deployer: deployerAddress,
        network: "Base Sepolia",
        chainId: 84532,
        deploymentTime: new Date().toISOString(),
        did3TokenAddress: did3TokenAddress,
        minimumStake: minimumStake.toString(), // 999,999 DID3 in wei
        minimumStakeFormatted: hre.ethers.utils.formatEther(minimumStake) + " DID3",
        quorumPercentage: quorumPercentage.toString(),
        votingPeriod: votingPeriod.toString(), // 3 days in seconds
        stakingType: "DID3 ERC20 Token"
    };

    fs.writeFileSync(
        'avs-deployment.json',
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\nDeployment info saved to avs-deployment.json");
    console.log("\n=== Next Steps ===");
    console.log("1. Users need DID3 tokens at:", did3TokenAddress);
    console.log("2. Users must approve the AVS contract before staking");
    console.log("3. Minimum stake required: 999,999 DID3 tokens");
    console.log("4. Update avs-dashboard.html with contract address:", registry.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

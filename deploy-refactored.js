const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🚀 Starting deployment of refactored VC system to Base Sepolia...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("📝 Deploying contracts with account:", deployer.address);
    console.log("💰 Account balance:", (await deployer.getBalance()).toString(), "\n");

    // DID3 Token address on Base Sepolia
    const DID3_TOKEN_ADDRESS = "0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff";
    console.log("🪙 DID3 Token Address:", DID3_TOKEN_ADDRESS, "\n");

    // Step 1: Deploy AVSManagement contract
    console.log("📦 Deploying AVSManagement contract...");
    const AVSManagement = await hre.ethers.getContractFactory("AVSManagement");
    const avsManagement = await AVSManagement.deploy(DID3_TOKEN_ADDRESS);
    await avsManagement.deployed();
    console.log("✅ AVSManagement deployed to:", avsManagement.address);
    console.log("   - Minimum Stake: 999,999 DID3 tokens");
    console.log("   - DID3 Token: ", DID3_TOKEN_ADDRESS, "\n");

    // Step 2: Deploy VCRegistry contract
    console.log("📦 Deploying VCRegistry contract...");
    const VCRegistry = await hre.ethers.getContractFactory("VCRegistry");
    const vcRegistry = await VCRegistry.deploy(avsManagement.address);
    await vcRegistry.deployed();
    console.log("✅ VCRegistry deployed to:", vcRegistry.address);
    console.log("   - AVSManagement: ", avsManagement.address, "\n");

    // Save deployment info
    const deploymentInfo = {
        network: "baseSepolia",
        chainId: 84532,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        contracts: {
            AVSManagement: {
                address: avsManagement.address,
                did3Token: DID3_TOKEN_ADDRESS,
                minimumStake: "999999000000000000000000", // 999,999 * 10^18
                description: "Manages issuer staking in DID3 tokens"
            },
            VCRegistry: {
                address: vcRegistry.address,
                avsManagement: avsManagement.address,
                description: "Primary Verifiable Credential Registry with purge functionality"
            }
        }
    };

    // Write to deployment file
    fs.writeFileSync(
        "deployment-refactored.json",
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("📄 Deployment info saved to deployment-refactored.json\n");

    // Display summary
    console.log("=" .repeat(60));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=" .repeat(60));
    console.log("\n📋 Contract Addresses:");
    console.log("   AVSManagement:", avsManagement.address);
    console.log("   VCRegistry:   ", vcRegistry.address);
    console.log("\n🔗 Network: Base Sepolia (Chain ID: 84532)");
    console.log("🔗 Explorer: https://sepolia.basescan.org");
    console.log("\n📝 Next Steps:");
    console.log("   1. Verify contracts on BaseScan");
    console.log("   2. Register as issuer by staking 999,999 DID3 tokens");
    console.log("   3. Issue verifiable credentials");
    console.log("   4. Use frontend to interact with contracts");
    console.log("=" .repeat(60) + "\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

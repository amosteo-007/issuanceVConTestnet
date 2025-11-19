const hre = require("hardhat");
const fs = require("fs");

async function main() {
    console.log("🔍 Starting contract verification on BaseScan...\n");

    // Load deployment info
    let deploymentInfo;
    try {
        const deploymentFile = fs.readFileSync("deployment-refactored.json", "utf8");
        deploymentInfo = JSON.parse(deploymentFile);
        console.log("✅ Loaded deployment info from deployment-refactored.json\n");
    } catch (error) {
        console.error("❌ Error: deployment-refactored.json not found!");
        console.error("Please deploy contracts first using: npm run deploy:refactored\n");
        process.exit(1);
    }

    const avsManagementAddress = deploymentInfo.contracts.AVSManagement.address;
    const vcRegistryAddress = deploymentInfo.contracts.VCRegistry.address;
    const did3TokenAddress = deploymentInfo.contracts.AVSManagement.did3Token;

    console.log("📋 Contract Addresses:");
    console.log("   AVSManagement:", avsManagementAddress);
    console.log("   VCRegistry:", vcRegistryAddress);
    console.log("   DID3 Token:", did3TokenAddress);
    console.log("\n");

    // Verify AVSManagement
    console.log("1️⃣  Verifying AVSManagement contract...");
    try {
        await hre.run("verify:verify", {
            address: avsManagementAddress,
            constructorArguments: [did3TokenAddress],
        });
        console.log("✅ AVSManagement verified successfully!\n");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("ℹ️  AVSManagement already verified\n");
        } else {
            console.error("❌ Error verifying AVSManagement:", error.message, "\n");
        }
    }

    // Wait a bit between verifications
    await delay(3000);

    // Verify VCRegistry
    console.log("2️⃣  Verifying VCRegistry contract...");
    try {
        await hre.run("verify:verify", {
            address: vcRegistryAddress,
            constructorArguments: [avsManagementAddress],
        });
        console.log("✅ VCRegistry verified successfully!\n");
    } catch (error) {
        if (error.message.includes("Already Verified")) {
            console.log("ℹ️  VCRegistry already verified\n");
        } else {
            console.error("❌ Error verifying VCRegistry:", error.message, "\n");
        }
    }

    console.log("=" .repeat(60));
    console.log("🎉 VERIFICATION COMPLETE!");
    console.log("=" .repeat(60));
    console.log("\n📝 View verified contracts on BaseScan:");
    console.log(`   AVSManagement: https://sepolia.basescan.org/address/${avsManagementAddress}#code`);
    console.log(`   VCRegistry: https://sepolia.basescan.org/address/${vcRegistryAddress}#code`);
    console.log("\n");
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

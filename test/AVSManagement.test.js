const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AVSManagement", function () {
    let AVSManagement;
    let avsManagement;
    let MockERC20;
    let did3Token;
    let owner;
    let issuer1;
    let issuer2;
    let user;

    const MINIMUM_STAKE = ethers.utils.parseEther("999999");

    beforeEach(async function () {
        [owner, issuer1, issuer2, user] = await ethers.getSigners();

        // Deploy mock DID3 token
        MockERC20 = await ethers.getContractFactory("MockERC20");
        did3Token = await MockERC20.deploy("DID3 Token", "DID3", ethers.utils.parseEther("10000000"));
        await did3Token.deployed();

        // Deploy AVSManagement
        AVSManagement = await ethers.getContractFactory("AVSManagement");
        avsManagement = await AVSManagement.deploy(did3Token.address);
        await avsManagement.deployed();

        // Mint tokens to issuers
        await did3Token.transfer(issuer1.address, ethers.utils.parseEther("2000000"));
        await did3Token.transfer(issuer2.address, ethers.utils.parseEther("2000000"));
    });

    describe("Deployment", function () {
        it("Should set the correct DID3 token address", async function () {
            expect(await avsManagement.did3Token()).to.equal(did3Token.address);
        });

        it("Should set the correct owner", async function () {
            expect(await avsManagement.owner()).to.equal(owner.address);
        });

        it("Should have correct minimum stake", async function () {
            expect(await avsManagement.MINIMUM_STAKE()).to.equal(MINIMUM_STAKE);
        });
    });

    describe("Issuer Registration", function () {
        it("Should allow registration with minimum stake", async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await expect(avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE))
                .to.emit(avsManagement, "IssuerRegistered")
                .withArgs(issuer1.address, MINIMUM_STAKE, await getBlockTimestamp());

            expect(await avsManagement.isActiveIssuer(issuer1.address)).to.be.true;
        });

        it("Should allow registration with more than minimum stake", async function () {
            const stakeAmount = ethers.utils.parseEther("1500000");
            await did3Token.connect(issuer1).approve(avsManagement.address, stakeAmount);
            await avsManagement.connect(issuer1).registerIssuer(stakeAmount);

            const issuerInfo = await avsManagement.getIssuerInfo(issuer1.address);
            expect(issuerInfo.stakedAmount).to.equal(stakeAmount);
            expect(issuerInfo.isActive).to.be.true;
        });

        it("Should reject registration below minimum stake", async function () {
            const lowStake = ethers.utils.parseEther("999998");
            await did3Token.connect(issuer1).approve(avsManagement.address, lowStake);
            await expect(
                avsManagement.connect(issuer1).registerIssuer(lowStake)
            ).to.be.revertedWith("Stake amount below minimum required");
        });

        it("Should reject double registration", async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE);

            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await expect(
                avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE)
            ).to.be.revertedWith("Issuer already registered");
        });

        it("Should transfer tokens from issuer to contract", async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);

            const balanceBefore = await did3Token.balanceOf(issuer1.address);
            await avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE);
            const balanceAfter = await did3Token.balanceOf(issuer1.address);

            expect(balanceBefore.sub(balanceAfter)).to.equal(MINIMUM_STAKE);
            expect(await did3Token.balanceOf(avsManagement.address)).to.equal(MINIMUM_STAKE);
        });
    });

    describe("Add Stake", function () {
        beforeEach(async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE);
        });

        it("Should allow adding more stake", async function () {
            const additionalStake = ethers.utils.parseEther("500000");
            await did3Token.connect(issuer1).approve(avsManagement.address, additionalStake);

            await expect(avsManagement.connect(issuer1).addStake(additionalStake))
                .to.emit(avsManagement, "StakeAdded")
                .withArgs(issuer1.address, additionalStake, MINIMUM_STAKE.add(additionalStake));

            const issuerInfo = await avsManagement.getIssuerInfo(issuer1.address);
            expect(issuerInfo.stakedAmount).to.equal(MINIMUM_STAKE.add(additionalStake));
        });

        it("Should reject adding stake if not registered", async function () {
            const additionalStake = ethers.utils.parseEther("100000");
            await did3Token.connect(issuer2).approve(avsManagement.address, additionalStake);

            await expect(
                avsManagement.connect(issuer2).addStake(additionalStake)
            ).to.be.revertedWith("Issuer not registered");
        });

        it("Should reject adding zero stake", async function () {
            await expect(
                avsManagement.connect(issuer1).addStake(0)
            ).to.be.revertedWith("Amount must be greater than 0");
        });
    });

    describe("Withdraw Stake", function () {
        beforeEach(async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE.mul(2));
            await avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE.mul(2));
        });

        it("Should allow partial withdrawal above minimum", async function () {
            const withdrawAmount = ethers.utils.parseEther("500000");

            await expect(avsManagement.connect(issuer1).withdrawStake(withdrawAmount))
                .to.emit(avsManagement, "StakeWithdrawn")
                .withArgs(issuer1.address, withdrawAmount, MINIMUM_STAKE.mul(2).sub(withdrawAmount));

            const issuerInfo = await avsManagement.getIssuerInfo(issuer1.address);
            expect(issuerInfo.stakedAmount).to.equal(MINIMUM_STAKE.mul(2).sub(withdrawAmount));
            expect(issuerInfo.isActive).to.be.true;
        });

        it("Should allow full withdrawal and deactivate", async function () {
            const fullStake = MINIMUM_STAKE.mul(2);

            await expect(avsManagement.connect(issuer1).withdrawStake(fullStake))
                .to.emit(avsManagement, "StakeWithdrawn")
                .to.emit(avsManagement, "IssuerDeactivated");

            const issuerInfo = await avsManagement.getIssuerInfo(issuer1.address);
            expect(issuerInfo.stakedAmount).to.equal(0);
            expect(issuerInfo.isActive).to.be.false;
            expect(await avsManagement.isActiveIssuer(issuer1.address)).to.be.false;
        });

        it("Should reject partial withdrawal below minimum", async function () {
            const withdrawAmount = MINIMUM_STAKE.add(ethers.utils.parseEther("1"));

            await expect(
                avsManagement.connect(issuer1).withdrawStake(withdrawAmount)
            ).to.be.revertedWith("Must withdraw all if going below minimum");
        });

        it("Should return tokens to issuer", async function () {
            const withdrawAmount = ethers.utils.parseEther("500000");
            const balanceBefore = await did3Token.balanceOf(issuer1.address);

            await avsManagement.connect(issuer1).withdrawStake(withdrawAmount);

            const balanceAfter = await did3Token.balanceOf(issuer1.address);
            expect(balanceAfter.sub(balanceBefore)).to.equal(withdrawAmount);
        });
    });

    describe("Reactivate Issuer", function () {
        beforeEach(async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE);
            await avsManagement.connect(issuer1).withdrawStake(MINIMUM_STAKE);
        });

        it("Should allow reactivation with minimum stake", async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);

            await expect(avsManagement.connect(issuer1).reactivateIssuer(MINIMUM_STAKE))
                .to.emit(avsManagement, "IssuerReactivated");

            expect(await avsManagement.isActiveIssuer(issuer1.address)).to.be.true;
        });

        it("Should reject reactivation below minimum", async function () {
            const lowStake = ethers.utils.parseEther("999998");
            await did3Token.connect(issuer1).approve(avsManagement.address, lowStake);

            await expect(
                avsManagement.connect(issuer1).reactivateIssuer(lowStake)
            ).to.be.revertedWith("Stake amount below minimum required");
        });

        it("Should reject reactivation if already active", async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer1).reactivateIssuer(MINIMUM_STAKE);

            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await expect(
                avsManagement.connect(issuer1).reactivateIssuer(MINIMUM_STAKE)
            ).to.be.revertedWith("Issuer already active");
        });
    });

    describe("Statistics", function () {
        it("Should track total staked amount", async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE);

            await did3Token.connect(issuer2).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer2).registerIssuer(MINIMUM_STAKE);

            const stats = await avsManagement.getStatistics();
            expect(stats.totalStakedAmount).to.equal(MINIMUM_STAKE.mul(2));
        });

        it("Should track active and total issuers", async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE);

            await did3Token.connect(issuer2).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer2).registerIssuer(MINIMUM_STAKE);

            let stats = await avsManagement.getStatistics();
            expect(stats.totalIssuers).to.equal(2);
            expect(stats.activeIssuers).to.equal(2);

            // Deactivate one
            await avsManagement.connect(issuer1).withdrawStake(MINIMUM_STAKE);

            stats = await avsManagement.getStatistics();
            expect(stats.totalIssuers).to.equal(2);
            expect(stats.activeIssuers).to.equal(1);
        });

        it("Should return list of active issuers", async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE);

            await did3Token.connect(issuer2).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer2).registerIssuer(MINIMUM_STAKE);

            const activeIssuers = await avsManagement.getActiveIssuers();
            expect(activeIssuers.length).to.equal(2);
            expect(activeIssuers).to.include(issuer1.address);
            expect(activeIssuers).to.include(issuer2.address);
        });
    });

    describe("Credential Tracking", function () {
        beforeEach(async function () {
            await did3Token.connect(issuer1).approve(avsManagement.address, MINIMUM_STAKE);
            await avsManagement.connect(issuer1).registerIssuer(MINIMUM_STAKE);
        });

        it("Should allow VCRegistry to record credential issuance", async function () {
            const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

            await expect(avsManagement.recordCredentialIssued(issuer1.address, credentialHash))
                .to.emit(avsManagement, "CredentialIssued")
                .withArgs(issuer1.address, credentialHash);

            const issuerInfo = await avsManagement.getIssuerInfo(issuer1.address);
            expect(issuerInfo.totalCredentialsIssued).to.equal(1);
        });

        it("Should allow VCRegistry to record credential revocation", async function () {
            const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));

            await expect(avsManagement.recordCredentialRevoked(issuer1.address, credentialHash))
                .to.emit(avsManagement, "CredentialRevoked")
                .withArgs(issuer1.address, credentialHash);

            const issuerInfo = await avsManagement.getIssuerInfo(issuer1.address);
            expect(issuerInfo.totalCredentialsRevoked).to.equal(1);
        });

        it("Should reject recording for inactive issuer", async function () {
            await avsManagement.connect(issuer1).withdrawStake(MINIMUM_STAKE);

            const credentialHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("test"));
            await expect(
                avsManagement.recordCredentialIssued(issuer1.address, credentialHash)
            ).to.be.revertedWith("Issuer is not active");
        });
    });

    // Helper function
    async function getBlockTimestamp() {
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        return block.timestamp;
    }
});

// Mock ERC20 for testing (add this to a separate file in production)
// This is a simple mock for testing purposes

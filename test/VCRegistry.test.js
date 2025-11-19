const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("VCRegistry", function () {
    let AVSManagement;
    let avsManagement;
    let VCRegistry;
    let vcRegistry;
    let MockERC20;
    let did3Token;
    let admin;
    let issuer;
    let subject;
    let other;

    const MINIMUM_STAKE = ethers.utils.parseEther("999999");
    const CREDENTIAL_TYPE = "KYCVerification";

    beforeEach(async function () {
        [admin, issuer, subject, other] = await ethers.getSigners();

        // Deploy mock DID3 token
        MockERC20 = await ethers.getContractFactory("MockERC20");
        did3Token = await MockERC20.deploy("DID3 Token", "DID3", ethers.utils.parseEther("10000000"));
        await did3Token.deployed();

        // Deploy AVSManagement
        AVSManagement = await ethers.getContractFactory("AVSManagement");
        avsManagement = await AVSManagement.deploy(did3Token.address);
        await avsManagement.deployed();

        // Deploy VCRegistry
        VCRegistry = await ethers.getContractFactory("VCRegistry");
        vcRegistry = await VCRegistry.deploy(avsManagement.address);
        await vcRegistry.deployed();

        // Setup issuer with stake
        await did3Token.transfer(issuer.address, MINIMUM_STAKE.mul(2));
        await did3Token.connect(issuer).approve(avsManagement.address, MINIMUM_STAKE);
        await avsManagement.connect(issuer).registerIssuer(MINIMUM_STAKE);
    });

    describe("Deployment", function () {
        it("Should set the correct AVSManagement address", async function () {
            expect(await vcRegistry.avsManagement()).to.equal(avsManagement.address);
        });

        it("Should set the correct admin", async function () {
            expect(await vcRegistry.admin()).to.equal(admin.address);
        });

        it("Should have zero credentials initially", async function () {
            expect(await vcRegistry.totalCredentials()).to.equal(0);
        });
    });

    describe("Issue Credential", function () {
        it("Should allow active issuer to issue credential", async function () {
            const credentialData = ethers.utils.toUtf8Bytes(JSON.stringify({
                fullName: "John Doe",
                dateOfBirth: "1990-01-01"
            }));
            const expirationDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 1 year

            await expect(
                vcRegistry.connect(issuer).issueCredential(
                    subject.address,
                    CREDENTIAL_TYPE,
                    credentialData,
                    expirationDate
                )
            ).to.emit(vcRegistry, "CredentialIssued");

            expect(await vcRegistry.totalCredentials()).to.equal(1);
        });

        it("Should reject issuance from non-issuer", async function () {
            const credentialData = ethers.utils.toUtf8Bytes("test");
            await expect(
                vcRegistry.connect(other).issueCredential(
                    subject.address,
                    CREDENTIAL_TYPE,
                    credentialData,
                    0
                )
            ).to.be.revertedWith("Caller must be active issuer with minimum stake");
        });

        it("Should reject issuance with invalid subject address", async function () {
            const credentialData = ethers.utils.toUtf8Bytes("test");
            await expect(
                vcRegistry.connect(issuer).issueCredential(
                    ethers.constants.AddressZero,
                    CREDENTIAL_TYPE,
                    credentialData,
                    0
                )
            ).to.be.revertedWith("Invalid subject address");
        });

        it("Should reject issuance with empty credential type", async function () {
            const credentialData = ethers.utils.toUtf8Bytes("test");
            await expect(
                vcRegistry.connect(issuer).issueCredential(
                    subject.address,
                    "",
                    credentialData,
                    0
                )
            ).to.be.revertedWith("Credential type cannot be empty");
        });

        it("Should store credential correctly", async function () {
            const credentialData = ethers.utils.toUtf8Bytes("test data");
            const expirationDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                credentialData,
                expirationDate
            );

            const receipt = await tx.wait();
            const event = receipt.events.find(e => e.event === "CredentialIssued");
            const credentialHash = event.args.credentialHash;

            const credential = await vcRegistry.getCredential(credentialHash);
            expect(credential.subject).to.equal(subject.address);
            expect(credential.issuer).to.equal(issuer.address);
            expect(credential.credentialType).to.equal(CREDENTIAL_TYPE);
            expect(credential.isRevoked).to.be.false;
            expect(credential.isPurged).to.be.false;
        });

        it("Should add credential to subject's list", async function () {
            const credentialData = ethers.utils.toUtf8Bytes("test");
            await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                credentialData,
                0
            );

            const subjectCreds = await vcRegistry.getSubjectCredentials(subject.address);
            expect(subjectCreds.length).to.equal(1);
        });

        it("Should add credential to issuer's list", async function () {
            const credentialData = ethers.utils.toUtf8Bytes("test");
            await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                credentialData,
                0
            );

            const issuerCreds = await vcRegistry.getIssuerCredentials(issuer.address);
            expect(issuerCreds.length).to.equal(1);
        });
    });

    describe("Revoke Credential", function () {
        let credentialHash;

        beforeEach(async function () {
            const credentialData = ethers.utils.toUtf8Bytes("test");
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                credentialData,
                0
            );
            const receipt = await tx.wait();
            credentialHash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;
        });

        it("Should allow issuer to revoke their credential", async function () {
            await expect(vcRegistry.connect(issuer).revokeCredential(credentialHash))
                .to.emit(vcRegistry, "CredentialRevoked")
                .withArgs(credentialHash, subject.address, issuer.address, await getNextBlockTimestamp());

            const credential = await vcRegistry.getCredential(credentialHash);
            expect(credential.isRevoked).to.be.true;
        });

        it("Should reject revocation from non-issuer", async function () {
            await expect(
                vcRegistry.connect(other).revokeCredential(credentialHash)
            ).to.be.revertedWith("Only original issuer can revoke");
        });

        it("Should reject double revocation", async function () {
            await vcRegistry.connect(issuer).revokeCredential(credentialHash);
            await expect(
                vcRegistry.connect(issuer).revokeCredential(credentialHash)
            ).to.be.revertedWith("Credential already revoked");
        });

        it("Should reject revocation of non-existent credential", async function () {
            const fakeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fake"));
            await expect(
                vcRegistry.connect(issuer).revokeCredential(fakeHash)
            ).to.be.revertedWith("Credential does not exist");
        });
    });

    describe("Purge Credential", function () {
        let revokedCredentialHash;
        let expiredCredentialHash;
        let validCredentialHash;

        beforeEach(async function () {
            // Create revoked credential
            let tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("revoked"),
                0
            );
            let receipt = await tx.wait();
            revokedCredentialHash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;
            await vcRegistry.connect(issuer).revokeCredential(revokedCredentialHash);

            // Create expired credential
            const pastDate = Math.floor(Date.now() / 1000) - 1000; // Expired 1000 seconds ago
            tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("expired"),
                pastDate
            );
            receipt = await tx.wait();
            expiredCredentialHash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;

            // Create valid credential
            tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("valid"),
                0
            );
            receipt = await tx.wait();
            validCredentialHash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;
        });

        it("Should allow issuer to purge revoked credential", async function () {
            await expect(vcRegistry.connect(issuer).purgeCredential(revokedCredentialHash))
                .to.emit(vcRegistry, "CredentialPurged")
                .withArgs(revokedCredentialHash, subject.address, issuer.address, "revoked", await getNextBlockTimestamp());

            const credential = await vcRegistry.getCredential(revokedCredentialHash);
            expect(credential.isPurged).to.be.true;
        });

        it("Should allow issuer to purge expired credential", async function () {
            await expect(vcRegistry.connect(issuer).purgeCredential(expiredCredentialHash))
                .to.emit(vcRegistry, "CredentialPurged")
                .withArgs(expiredCredentialHash, subject.address, issuer.address, "expired", await getNextBlockTimestamp());

            const credential = await vcRegistry.getCredential(expiredCredentialHash);
            expect(credential.isPurged).to.be.true;
        });

        it("Should reject purging valid credential", async function () {
            await expect(
                vcRegistry.connect(issuer).purgeCredential(validCredentialHash)
            ).to.be.revertedWith("Credential must be revoked or expired to purge");
        });

        it("Should reject purging from non-issuer", async function () {
            await expect(
                vcRegistry.connect(other).purgeCredential(revokedCredentialHash)
            ).to.be.revertedWith("Only original issuer can purge");
        });

        it("Should reject double purge", async function () {
            await vcRegistry.connect(issuer).purgeCredential(revokedCredentialHash);
            await expect(
                vcRegistry.connect(issuer).purgeCredential(revokedCredentialHash)
            ).to.be.revertedWith("Credential already purged");
        });

        it("Should update total purged count", async function () {
            expect(await vcRegistry.totalPurged()).to.equal(0);

            await vcRegistry.connect(issuer).purgeCredential(revokedCredentialHash);
            expect(await vcRegistry.totalPurged()).to.equal(1);

            await vcRegistry.connect(issuer).purgeCredential(expiredCredentialHash);
            expect(await vcRegistry.totalPurged()).to.equal(2);
        });
    });

    describe("Batch Purge", function () {
        let credentialHashes;

        beforeEach(async function () {
            credentialHashes = [];

            // Create 3 revoked credentials
            for (let i = 0; i < 3; i++) {
                const tx = await vcRegistry.connect(issuer).issueCredential(
                    subject.address,
                    CREDENTIAL_TYPE,
                    ethers.utils.toUtf8Bytes(`revoked-${i}`),
                    0
                );
                const receipt = await tx.wait();
                const hash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;
                await vcRegistry.connect(issuer).revokeCredential(hash);
                credentialHashes.push(hash);
            }

            // Create 1 valid credential
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("valid"),
                0
            );
            const receipt = await tx.wait();
            credentialHashes.push(receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash);
        });

        it("Should purge multiple revoked credentials", async function () {
            const tx = await vcRegistry.connect(issuer).batchPurgeCredentials(credentialHashes.slice(0, 3));
            const receipt = await tx.wait();

            // Should emit 3 CredentialPurged events
            const purgeEvents = receipt.events.filter(e => e.event === "CredentialPurged");
            expect(purgeEvents.length).to.equal(3);
        });

        it("Should return correct purge count", async function () {
            const purgedCount = await vcRegistry.connect(issuer).callStatic.batchPurgeCredentials(credentialHashes);
            expect(purgedCount).to.equal(3); // Only revoked ones
        });

        it("Should skip valid credentials", async function () {
            await vcRegistry.connect(issuer).batchPurgeCredentials(credentialHashes);

            // Check that the valid credential is not purged
            const credential = await vcRegistry.getCredential(credentialHashes[3]);
            expect(credential.isPurged).to.be.false;
        });
    });

    describe("Credential Validation", function () {
        it("Should return true for valid credential", async function () {
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("valid"),
                0
            );
            const receipt = await tx.wait();
            const credentialHash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;

            expect(await vcRegistry.isCredentialValid(credentialHash)).to.be.true;
        });

        it("Should return false for revoked credential", async function () {
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("test"),
                0
            );
            const receipt = await tx.wait();
            const credentialHash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;

            await vcRegistry.connect(issuer).revokeCredential(credentialHash);
            expect(await vcRegistry.isCredentialValid(credentialHash)).to.be.false;
        });

        it("Should return false for expired credential", async function () {
            const pastDate = Math.floor(Date.now() / 1000) - 1000;
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("expired"),
                pastDate
            );
            const receipt = await tx.wait();
            const credentialHash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;

            expect(await vcRegistry.isCredentialValid(credentialHash)).to.be.false;
        });

        it("Should return false for purged credential", async function () {
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("test"),
                0
            );
            const receipt = await tx.wait();
            const credentialHash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;

            await vcRegistry.connect(issuer).revokeCredential(credentialHash);
            await vcRegistry.connect(issuer).purgeCredential(credentialHash);
            expect(await vcRegistry.isCredentialValid(credentialHash)).to.be.false;
        });

        it("Should return false for non-existent credential", async function () {
            const fakeHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("fake"));
            expect(await vcRegistry.isCredentialValid(fakeHash)).to.be.false;
        });
    });

    describe("Get Valid Subject Credentials", function () {
        beforeEach(async function () {
            // Create 2 valid credentials
            await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("valid1"),
                0
            );
            await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("valid2"),
                0
            );

            // Create 1 revoked credential
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("revoked"),
                0
            );
            const receipt = await tx.wait();
            const hash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;
            await vcRegistry.connect(issuer).revokeCredential(hash);

            // Create 1 expired credential
            const pastDate = Math.floor(Date.now() / 1000) - 1000;
            await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("expired"),
                pastDate
            );
        });

        it("Should return only valid credentials", async function () {
            const validCreds = await vcRegistry.getValidSubjectCredentials(subject.address);
            expect(validCreds.length).to.equal(2);
        });

        it("Should exclude revoked credentials", async function () {
            const allCreds = await vcRegistry.getSubjectCredentials(subject.address);
            const validCreds = await vcRegistry.getValidSubjectCredentials(subject.address);
            expect(allCreds.length).to.equal(4);
            expect(validCreds.length).to.equal(2);
        });
    });

    describe("Statistics", function () {
        it("Should track total credentials", async function () {
            await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("test1"),
                0
            );
            await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("test2"),
                0
            );

            const stats = await vcRegistry.getStatistics();
            expect(stats.total).to.equal(2);
            expect(stats.purged).to.equal(0);
            expect(stats.active).to.equal(2);
        });

        it("Should update statistics after purge", async function () {
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.utils.toUtf8Bytes("test"),
                0
            );
            const receipt = await tx.wait();
            const hash = receipt.events.find(e => e.event === "CredentialIssued").args.credentialHash;

            await vcRegistry.connect(issuer).revokeCredential(hash);
            await vcRegistry.connect(issuer).purgeCredential(hash);

            const stats = await vcRegistry.getStatistics();
            expect(stats.total).to.equal(1);
            expect(stats.purged).to.equal(1);
            expect(stats.active).to.equal(0);
        });
    });

    // Helper function
    async function getNextBlockTimestamp() {
        const block = await ethers.provider.getBlock("latest");
        return block.timestamp + 1;
    }
});

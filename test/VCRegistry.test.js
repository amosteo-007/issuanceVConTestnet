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

    const MINIMUM_STAKE = ethers.parseEther("999999");
    const CREDENTIAL_TYPE = "KYCVerification";

    beforeEach(async function () {
        [admin, issuer, subject, other] = await ethers.getSigners();

        // Deploy mock DID3 token
        MockERC20 = await ethers.getContractFactory("MockERC20");
        did3Token = await MockERC20.deploy("DID3 Token", "DID3", ethers.parseEther("10000000"));

        // Deploy AVSManagement
        AVSManagement = await ethers.getContractFactory("AVSManagement");
        avsManagement = await AVSManagement.deploy(await did3Token.getAddress());

        // Deploy VCRegistry
        VCRegistry = await ethers.getContractFactory("VCRegistry");
        vcRegistry = await VCRegistry.deploy(await avsManagement.getAddress());

        // Setup issuer with stake
        await did3Token.transfer(issuer.address, MINIMUM_STAKE * 2n);
        await did3Token.connect(issuer).approve(await avsManagement.getAddress(), MINIMUM_STAKE);
        await avsManagement.connect(issuer).registerIssuer(MINIMUM_STAKE);
    });

    describe("Deployment", function () {
        it("Should set the correct AVSManagement address", async function () {
            expect(await vcRegistry.avsManagement()).to.equal(await avsManagement.getAddress());
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
            const credentialData = ethers.toUtf8Bytes(JSON.stringify({
                fullName: "John Doe",
                dateOfBirth: "1990-01-01"
            }));
            const expirationDate = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

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
            const credentialData = ethers.toUtf8Bytes("test");
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
            const credentialData = ethers.toUtf8Bytes("test");
            await expect(
                vcRegistry.connect(issuer).issueCredential(
                    ethers.ZeroAddress,
                    CREDENTIAL_TYPE,
                    credentialData,
                    0
                )
            ).to.be.revertedWith("Invalid subject address");
        });
    });

    describe("Revoke Credential", function () {
        let credentialHash;

        beforeEach(async function () {
            const credentialData = ethers.toUtf8Bytes("test");
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                credentialData,
                0
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return vcRegistry.interface.parseLog(log).name === "CredentialIssued";
                } catch (e) {
                    return false;
                }
            });
            credentialHash = vcRegistry.interface.parseLog(event).args.credentialHash;
        });

        it("Should allow issuer to revoke their credential", async function () {
            await expect(vcRegistry.connect(issuer).revokeCredential(credentialHash))
                .to.emit(vcRegistry, "CredentialRevoked");

            const credential = await vcRegistry.getCredential(credentialHash);
            expect(credential.isRevoked).to.be.true;
        });

        it("Should reject revocation from non-issuer", async function () {
            await expect(
                vcRegistry.connect(other).revokeCredential(credentialHash)
            ).to.be.revertedWith("Only original issuer can revoke");
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
                ethers.toUtf8Bytes("revoked"),
                0
            );
            let receipt = await tx.wait();
            let event = receipt.logs.find(log => {
                try {
                    return vcRegistry.interface.parseLog(log).name === "CredentialIssued";
                } catch (e) {
                    return false;
                }
            });
            revokedCredentialHash = vcRegistry.interface.parseLog(event).args.credentialHash;
            await vcRegistry.connect(issuer).revokeCredential(revokedCredentialHash);

            // Create expired credential
            const pastDate = Math.floor(Date.now() / 1000) - 1000;
            tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.toUtf8Bytes("expired"),
                pastDate
            );
            receipt = await tx.wait();
            event = receipt.logs.find(log => {
                try {
                    return vcRegistry.interface.parseLog(log).name === "CredentialIssued";
                } catch (e) {
                    return false;
                }
            });
            expiredCredentialHash = vcRegistry.interface.parseLog(event).args.credentialHash;

            // Create valid credential
            tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.toUtf8Bytes("valid"),
                0
            );
            receipt = await tx.wait();
            event = receipt.logs.find(log => {
                try {
                    return vcRegistry.interface.parseLog(log).name === "CredentialIssued";
                } catch (e) {
                    return false;
                }
            });
            validCredentialHash = vcRegistry.interface.parseLog(event).args.credentialHash;
        });

        it("Should allow issuer to purge revoked credential", async function () {
            await expect(vcRegistry.connect(issuer).purgeCredential(revokedCredentialHash))
                .to.emit(vcRegistry, "CredentialPurged");

            const credential = await vcRegistry.getCredential(revokedCredentialHash);
            expect(credential.isPurged).to.be.true;
        });

        it("Should allow issuer to purge expired credential", async function () {
            await expect(vcRegistry.connect(issuer).purgeCredential(expiredCredentialHash))
                .to.emit(vcRegistry, "CredentialPurged");

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
    });

    describe("Credential Validation", function () {
        it("Should return true for valid credential", async function () {
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.toUtf8Bytes("valid"),
                0
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return vcRegistry.interface.parseLog(log).name === "CredentialIssued";
                } catch (e) {
                    return false;
                }
            });
            const credentialHash = vcRegistry.interface.parseLog(event).args.credentialHash;

            expect(await vcRegistry.isCredentialValid(credentialHash)).to.be.true;
        });

        it("Should return false for revoked credential", async function () {
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.toUtf8Bytes("test"),
                0
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return vcRegistry.interface.parseLog(log).name === "CredentialIssued";
                } catch (e) {
                    return false;
                }
            });
            const credentialHash = vcRegistry.interface.parseLog(event).args.credentialHash;

            await vcRegistry.connect(issuer).revokeCredential(credentialHash);
            expect(await vcRegistry.isCredentialValid(credentialHash)).to.be.false;
        });

        it("Should return false for expired credential", async function () {
            const pastDate = Math.floor(Date.now() / 1000) - 1000;
            const tx = await vcRegistry.connect(issuer).issueCredential(
                subject.address,
                CREDENTIAL_TYPE,
                ethers.toUtf8Bytes("expired"),
                pastDate
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find(log => {
                try {
                    return vcRegistry.interface.parseLog(log).name === "CredentialIssued";
                } catch (e) {
                    return false;
                }
            });
            const credentialHash = vcRegistry.interface.parseLog(event).args.credentialHash;

            expect(await vcRegistry.isCredentialValid(credentialHash)).to.be.false;
        });

        it("Should return false for non-existent credential", async function () {
            const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("fake"));
            expect(await vcRegistry.isCredentialValid(fakeHash)).to.be.false;
        });
    });
});

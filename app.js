// Contract addresses - Update these after deployment
let AVS_MANAGEMENT_ADDRESS = '';
let VC_REGISTRY_ADDRESS = '';
const DID3_TOKEN_ADDRESS = '0x4e754738cb69D6f066C9A036f67EE44cC3e9aBff';

// Contract ABIs
const AVS_MANAGEMENT_ABI = [
    "function registerIssuer(uint256 stakeAmount) external",
    "function addStake(uint256 amount) external",
    "function withdrawStake(uint256 amount) external",
    "function reactivateIssuer(uint256 stakeAmount) external",
    "function isActiveIssuer(address issuer) external view returns (bool)",
    "function getIssuerInfo(address issuer) external view returns (tuple(uint256 stakedAmount, bool isActive, uint256 registrationTimestamp, uint256 totalCredentialsIssued, uint256 totalCredentialsRevoked, uint256 lastActivityTimestamp))",
    "function getStatistics() external view returns (uint256 totalIssuers, uint256 activeIssuers, uint256 totalStakedAmount)",
    "function MINIMUM_STAKE() external view returns (uint256)"
];

const VC_REGISTRY_ABI = [
    "function issueCredential(address _subject, string memory _credentialType, bytes memory _credentialData, uint256 _expirationDate) external returns (bytes32)",
    "function revokeCredential(bytes32 _credentialHash) external",
    "function purgeCredential(bytes32 _credentialHash) external",
    "function batchPurgeCredentials(bytes32[] calldata _credentialHashes) external returns (uint256)",
    "function isCredentialValid(bytes32 _credentialHash) external view returns (bool)",
    "function getCredential(bytes32 _credentialHash) external view returns (address subject, address issuer, uint256 issuanceDate, uint256 expirationDate, bool isRevoked, bool isPurged, string memory credentialType)",
    "function getFullCredential(bytes32 _credentialHash) external view returns (tuple(bytes32 credentialHash, address subject, address issuer, uint256 issuanceDate, uint256 expirationDate, bool isRevoked, uint256 revocationTimestamp, string credentialType, bytes credentialData, bool isPurged, uint256 purgeTimestamp))",
    "function getSubjectCredentials(address _subject) external view returns (bytes32[] memory)",
    "function getValidSubjectCredentials(address _subject) external view returns (bytes32[] memory)",
    "function getIssuerCredentials(address _issuer) external view returns (bytes32[] memory)",
    "function getStatistics() external view returns (uint256 total, uint256 purged, uint256 active)",
    "event CredentialIssued(bytes32 indexed credentialHash, address indexed subject, address indexed issuer, string credentialType, uint256 issuanceDate, uint256 expirationDate)",
    "event CredentialRevoked(bytes32 indexed credentialHash, address indexed subject, address indexed issuer, uint256 revocationDate)",
    "event CredentialPurged(bytes32 indexed credentialHash, address indexed subject, address indexed issuer, string reason, uint256 purgeDate)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
];

// Global variables
let provider;
let signer;
let userAddress;
let avsManagementContract;
let vcRegistryContract;
let did3TokenContract;

// Load deployment info
async function loadDeploymentInfo() {
    try {
        const response = await fetch('deployment-refactored.json');
        const data = await response.json();
        AVS_MANAGEMENT_ADDRESS = data.contracts.AVSManagement.address;
        VC_REGISTRY_ADDRESS = data.contracts.VCRegistry.address;

        document.getElementById('avsAddress').textContent = `AVSManagement: ${AVS_MANAGEMENT_ADDRESS}`;
        document.getElementById('vcRegistryAddress').textContent = `VCRegistry: ${VC_REGISTRY_ADDRESS}`;

        return true;
    } catch (error) {
        console.log('Deployment info not found. Please deploy contracts first.');
        showStatus('Please deploy contracts first and ensure deployment-refactored.json exists', 'error');
        return false;
    }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', async () => {
    await loadDeploymentInfo();
    setupEventListeners();

    // Check if wallet is already connected
    if (typeof window.ethereum !== 'undefined') {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }
});

// Setup event listeners
function setupEventListeners() {
    // Wallet connection
    document.getElementById('connectWallet').addEventListener('click', connectWallet);

    // Role switching
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', () => switchRole(btn.dataset.role));
    });

    // Issuer/Operator actions
    document.getElementById('approveTokens').addEventListener('click', approveTokens);
    document.getElementById('registerIssuer').addEventListener('click', registerIssuer);
    document.getElementById('addStake').addEventListener('click', addStake);
    document.getElementById('withdrawStake').addEventListener('click', withdrawStake);
    document.getElementById('issueCredentialForm').addEventListener('submit', issueCredential);
    document.getElementById('loadIssuerCredentials').addEventListener('click', loadIssuerCredentials);

    // User actions
    document.getElementById('loadUserCredentials').addEventListener('click', loadUserCredentials);
    document.getElementById('verifyCredential').addEventListener('click', verifyCredential);

    // DeFi actions
    document.getElementById('verifyUserKYC').addEventListener('click', verifyUserKYC);
}

// Connect wallet
async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        showStatus('Please install MetaMask!', 'error');
        return;
    }

    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        // Check network
        const network = await provider.getNetwork();
        if (network.chainId !== 84532) {
            showStatus('Please switch to Base Sepolia network!', 'error');
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: '0x14a34' }], // 84532 in hex
                });
            } catch (switchError) {
                if (switchError.code === 4902) {
                    // Network not added, add it
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0x14a34',
                            chainName: 'Base Sepolia',
                            nativeCurrency: {
                                name: 'ETH',
                                symbol: 'ETH',
                                decimals: 18
                            },
                            rpcUrls: ['https://sepolia.base.org'],
                            blockExplorerUrls: ['https://sepolia.basescan.org']
                        }]
                    });
                }
            }
            return;
        }

        // Initialize contracts
        if (AVS_MANAGEMENT_ADDRESS && VC_REGISTRY_ADDRESS) {
            avsManagementContract = new ethers.Contract(AVS_MANAGEMENT_ADDRESS, AVS_MANAGEMENT_ABI, signer);
            vcRegistryContract = new ethers.Contract(VC_REGISTRY_ADDRESS, VC_REGISTRY_ABI, signer);
            did3TokenContract = new ethers.Contract(DID3_TOKEN_ADDRESS, ERC20_ABI, signer);
        }

        // Update UI
        document.getElementById('connectWallet').textContent = 'Connected';
        document.getElementById('connectWallet').disabled = true;
        document.getElementById('walletAddress').textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        document.getElementById('networkInfo').textContent = '🟢 Base Sepolia';

        showStatus('Wallet connected successfully!', 'success');

        // Load issuer info if in issuer view
        if (document.getElementById('issuerView').classList.contains('active')) {
            await loadIssuerInfo();
        }
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showStatus('Failed to connect wallet', 'error');
    }
}

// Switch role
function switchRole(role) {
    // Update active button
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.role-btn').classList.add('active');

    // Show corresponding view
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    if (role === 'issuer') {
        document.getElementById('issuerView').classList.add('active');
        if (userAddress) loadIssuerInfo();
    } else if (role === 'user') {
        document.getElementById('userView').classList.add('active');
    } else if (role === 'defi') {
        document.getElementById('defiView').classList.add('active');
    }
}

// Load issuer info
async function loadIssuerInfo() {
    if (!avsManagementContract || !userAddress) return;

    try {
        const issuerInfo = await avsManagementContract.getIssuerInfo(userAddress);
        const stakedAmount = ethers.utils.formatEther(issuerInfo.stakedAmount);

        document.getElementById('issuerStake').textContent = parseFloat(stakedAmount).toLocaleString();
        document.getElementById('issuerStatus').textContent = issuerInfo.isActive ? '✅ Active' : '❌ Inactive';
        document.getElementById('credentialsIssued').textContent = issuerInfo.totalCredentialsIssued.toString();
        document.getElementById('credentialsRevoked').textContent = issuerInfo.totalCredentialsRevoked.toString();

        // Update status card styling
        const statusElement = document.getElementById('issuerStatus');
        if (issuerInfo.isActive) {
            statusElement.style.color = 'var(--primary-green)';
        } else {
            statusElement.style.color = 'var(--warning-orange)';
        }
    } catch (error) {
        console.error('Error loading issuer info:', error);
    }
}

// Approve DID3 tokens
async function approveTokens() {
    if (!did3TokenContract) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    const amountInput = document.getElementById('stakeAmount');
    const amount = amountInput.value;

    if (!amount || parseFloat(amount) < 999999) {
        showStatus('Minimum stake is 999,999 DID3 tokens', 'error');
        return;
    }

    try {
        showStatus('Approving tokens...', 'info');
        const amountWei = ethers.utils.parseEther(amount);
        const tx = await did3TokenContract.approve(AVS_MANAGEMENT_ADDRESS, amountWei);
        await tx.wait();
        showStatus('Tokens approved successfully!', 'success');
    } catch (error) {
        console.error('Error approving tokens:', error);
        showStatus('Failed to approve tokens: ' + error.message, 'error');
    }
}

// Register as issuer
async function registerIssuer() {
    if (!avsManagementContract) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    const amountInput = document.getElementById('stakeAmount');
    const amount = amountInput.value;

    if (!amount || parseFloat(amount) < 999999) {
        showStatus('Minimum stake is 999,999 DID3 tokens', 'error');
        return;
    }

    try {
        showStatus('Registering as issuer...', 'info');
        const amountWei = ethers.utils.parseEther(amount);
        const tx = await avsManagementContract.registerIssuer(amountWei);
        await tx.wait();
        showStatus('Successfully registered as issuer!', 'success');
        await loadIssuerInfo();
    } catch (error) {
        console.error('Error registering:', error);
        showStatus('Failed to register: ' + error.message, 'error');
    }
}

// Add stake
async function addStake() {
    if (!avsManagementContract) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    const amountInput = document.getElementById('stakeAmount');
    const amount = amountInput.value;

    if (!amount || parseFloat(amount) <= 0) {
        showStatus('Please enter a valid amount', 'error');
        return;
    }

    try {
        showStatus('Adding stake...', 'info');
        const amountWei = ethers.utils.parseEther(amount);
        const tx = await avsManagementContract.addStake(amountWei);
        await tx.wait();
        showStatus('Stake added successfully!', 'success');
        await loadIssuerInfo();
    } catch (error) {
        console.error('Error adding stake:', error);
        showStatus('Failed to add stake: ' + error.message, 'error');
    }
}

// Withdraw stake
async function withdrawStake() {
    if (!avsManagementContract) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    const amountInput = document.getElementById('stakeAmount');
    const amount = amountInput.value;

    if (!amount || parseFloat(amount) <= 0) {
        showStatus('Please enter a valid amount', 'error');
        return;
    }

    try {
        showStatus('Withdrawing stake...', 'info');
        const amountWei = ethers.utils.parseEther(amount);
        const tx = await avsManagementContract.withdrawStake(amountWei);
        await tx.wait();
        showStatus('Stake withdrawn successfully!', 'success');
        await loadIssuerInfo();
    } catch (error) {
        console.error('Error withdrawing stake:', error);
        showStatus('Failed to withdraw stake: ' + error.message, 'error');
    }
}

// Issue credential
async function issueCredential(e) {
    e.preventDefault();

    if (!vcRegistryContract) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    const subjectAddress = document.getElementById('subjectAddress').value;
    const credentialType = document.getElementById('credentialType').value;
    const fullName = document.getElementById('fullName').value;
    const dateOfBirth = document.getElementById('dateOfBirth').value;
    const country = document.getElementById('country').value;
    const email = document.getElementById('email').value;
    const expirationDate = document.getElementById('expirationDate').value;

    // Create credential data object
    const credentialData = {
        fullName,
        dateOfBirth,
        country,
        email,
        issuedAt: new Date().toISOString()
    };

    // Convert to bytes
    const credentialDataBytes = ethers.utils.toUtf8Bytes(JSON.stringify(credentialData));

    // Convert expiration date to timestamp
    let expirationTimestamp = 0;
    if (expirationDate) {
        expirationTimestamp = Math.floor(new Date(expirationDate).getTime() / 1000);
    }

    try {
        showStatus('Issuing credential...', 'info');
        const tx = await vcRegistryContract.issueCredential(
            subjectAddress,
            credentialType,
            credentialDataBytes,
            expirationTimestamp
        );
        const receipt = await tx.wait();

        // Get credential hash from event
        const event = receipt.events.find(e => e.event === 'CredentialIssued');
        const credentialHash = event.args.credentialHash;

        showStatus(`Credential issued successfully! Hash: ${credentialHash}`, 'success');

        // Reset form
        document.getElementById('issueCredentialForm').reset();

        // Reload issuer info
        await loadIssuerInfo();
    } catch (error) {
        console.error('Error issuing credential:', error);
        showStatus('Failed to issue credential: ' + error.message, 'error');
    }
}

// Load issuer credentials
async function loadIssuerCredentials() {
    if (!vcRegistryContract || !userAddress) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    try {
        showStatus('Loading credentials...', 'info');
        const credentialHashes = await vcRegistryContract.getIssuerCredentials(userAddress);

        const container = document.getElementById('issuerCredentialsList');
        container.innerHTML = '';

        if (credentialHashes.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No credentials issued yet</p>';
            showStatus('No credentials found', 'info');
            return;
        }

        for (const hash of credentialHashes) {
            const credential = await vcRegistryContract.getFullCredential(hash);
            const credentialElement = createCredentialElement(credential, true);
            container.appendChild(credentialElement);
        }

        showStatus(`Loaded ${credentialHashes.length} credentials`, 'success');
    } catch (error) {
        console.error('Error loading credentials:', error);
        showStatus('Failed to load credentials: ' + error.message, 'error');
    }
}

// Load user credentials
async function loadUserCredentials() {
    if (!vcRegistryContract || !userAddress) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    try {
        showStatus('Loading credentials...', 'info');
        const credentialHashes = await vcRegistryContract.getSubjectCredentials(userAddress);

        const container = document.getElementById('userCredentialsList');
        container.innerHTML = '';

        if (credentialHashes.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No credentials found</p>';
            showStatus('No credentials found', 'info');
            return;
        }

        for (const hash of credentialHashes) {
            const credential = await vcRegistryContract.getFullCredential(hash);
            const credentialElement = createCredentialElement(credential, false);
            container.appendChild(credentialElement);
        }

        showStatus(`Loaded ${credentialHashes.length} credentials`, 'success');
    } catch (error) {
        console.error('Error loading credentials:', error);
        showStatus('Failed to load credentials: ' + error.message, 'error');
    }
}

// Create credential element
function createCredentialElement(credential, isIssuer) {
    const div = document.createElement('div');
    div.className = 'credential-item';

    // Determine status
    let status = 'Valid';
    let statusClass = 'status-valid';

    if (credential.isPurged) {
        status = 'Purged';
        statusClass = 'status-purged';
    } else if (credential.isRevoked) {
        status = 'Revoked';
        statusClass = 'status-revoked';
    } else if (credential.expirationDate > 0 && Date.now() / 1000 > credential.expirationDate) {
        status = 'Expired';
        statusClass = 'status-expired';
    }

    // Parse credential data
    let credentialDataObj = {};
    try {
        const dataString = ethers.utils.toUtf8String(credential.credentialData);
        credentialDataObj = JSON.parse(dataString);
    } catch (e) {
        console.error('Error parsing credential data:', e);
    }

    div.innerHTML = `
        <div class="credential-header">
            <div class="credential-type">${credential.credentialType}</div>
            <div class="credential-status ${statusClass}">${status}</div>
        </div>
        <div class="credential-details">
            <div class="detail-item">
                <div class="detail-label">Credential Hash</div>
                <div class="detail-value">${credential.credentialHash}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Subject</div>
                <div class="detail-value">${credential.subject}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Issuer</div>
                <div class="detail-value">${credential.issuer}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Issued Date</div>
                <div class="detail-value">${new Date(credential.issuanceDate * 1000).toLocaleDateString()}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Expiration Date</div>
                <div class="detail-value">${credential.expirationDate > 0 ? new Date(credential.expirationDate * 1000).toLocaleDateString() : 'No Expiration'}</div>
            </div>
            ${credentialDataObj.fullName ? `
            <div class="detail-item">
                <div class="detail-label">Full Name</div>
                <div class="detail-value">${credentialDataObj.fullName}</div>
            </div>
            ` : ''}
        </div>
        ${isIssuer ? `
        <div class="credential-actions">
            ${!credential.isRevoked && !credential.isPurged ? `
                <button class="btn-warning" onclick="revokeCredential('${credential.credentialHash}')">Revoke</button>
            ` : ''}
            ${(credential.isRevoked || (credential.expirationDate > 0 && Date.now() / 1000 > credential.expirationDate)) && !credential.isPurged ? `
                <button class="btn-danger" onclick="purgeCredential('${credential.credentialHash}')">Purge</button>
            ` : ''}
        </div>
        ` : ''}
    `;

    return div;
}

// Revoke credential
async function revokeCredential(credentialHash) {
    if (!vcRegistryContract) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    try {
        showStatus('Revoking credential...', 'info');
        const tx = await vcRegistryContract.revokeCredential(credentialHash);
        await tx.wait();
        showStatus('Credential revoked successfully!', 'success');
        await loadIssuerCredentials();
    } catch (error) {
        console.error('Error revoking credential:', error);
        showStatus('Failed to revoke credential: ' + error.message, 'error');
    }
}

// Purge credential
async function purgeCredential(credentialHash) {
    if (!vcRegistryContract) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    try {
        showStatus('Purging credential...', 'info');
        const tx = await vcRegistryContract.purgeCredential(credentialHash);
        await tx.wait();
        showStatus('Credential purged successfully!', 'success');
        await loadIssuerCredentials();
    } catch (error) {
        console.error('Error purging credential:', error);
        showStatus('Failed to purge credential: ' + error.message, 'error');
    }
}

// Verify credential
async function verifyCredential() {
    if (!vcRegistryContract) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    const credentialHash = document.getElementById('verifyCredentialHash').value;

    if (!credentialHash) {
        showStatus('Please enter a credential hash', 'error');
        return;
    }

    try {
        const isValid = await vcRegistryContract.isCredentialValid(credentialHash);
        const credential = await vcRegistryContract.getFullCredential(credentialHash);

        const resultDiv = document.getElementById('verificationResult');
        resultDiv.className = 'verification-result show ' + (isValid ? 'valid' : 'invalid');

        resultDiv.innerHTML = `
            <h3>${isValid ? '✅ Valid Credential' : '❌ Invalid Credential'}</h3>
            <div class="credential-details">
                <div class="detail-item">
                    <div class="detail-label">Type</div>
                    <div class="detail-value">${credential.credentialType}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Subject</div>
                    <div class="detail-value">${credential.subject}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Issuer</div>
                    <div class="detail-value">${credential.issuer}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Status</div>
                    <div class="detail-value">${credential.isPurged ? 'Purged' : credential.isRevoked ? 'Revoked' : 'Active'}</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error verifying credential:', error);
        showStatus('Failed to verify credential: ' + error.message, 'error');
    }
}

// Verify user KYC (DeFi view)
async function verifyUserKYC() {
    if (!vcRegistryContract) {
        showStatus('Please connect wallet first', 'error');
        return;
    }

    const userAddress = document.getElementById('defiUserAddress').value;

    if (!userAddress) {
        showStatus('Please enter a user address', 'error');
        return;
    }

    try {
        const validCredentials = await vcRegistryContract.getValidSubjectCredentials(userAddress);

        const resultDiv = document.getElementById('defiVerificationResult');
        resultDiv.className = 'verification-result show ' + (validCredentials.length > 0 ? 'valid' : 'invalid');

        if (validCredentials.length > 0) {
            let credentialsHtml = '';
            for (const hash of validCredentials) {
                const cred = await vcRegistryContract.getCredential(hash);
                credentialsHtml += `
                    <div style="margin: 10px 0; padding: 10px; background: var(--background-card); border-radius: 8px;">
                        <strong>${cred.credentialType}</strong><br>
                        <small>Issued: ${new Date(cred.issuanceDate * 1000).toLocaleDateString()}</small>
                    </div>
                `;
            }

            resultDiv.innerHTML = `
                <h3>✅ User is KYC Verified</h3>
                <p>Found ${validCredentials.length} valid credential(s):</p>
                ${credentialsHtml}
            `;
        } else {
            resultDiv.innerHTML = `
                <h3>❌ User is NOT KYC Verified</h3>
                <p>No valid credentials found for this address.</p>
            `;
        }
    } catch (error) {
        console.error('Error verifying user KYC:', error);
        showStatus('Failed to verify user KYC: ' + error.message, 'error');
    }
}

// Show status message
function showStatus(message, type) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.className = `status-message show ${type}`;
    statusDiv.textContent = message;

    setTimeout(() => {
        statusDiv.classList.remove('show');
    }, 5000);
}

// Make functions globally available
window.revokeCredential = revokeCredential;
window.purgeCredential = purgeCredential;

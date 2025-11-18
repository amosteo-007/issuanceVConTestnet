// DID3 Token Configuration
const DID3_TOKEN_ADDRESS = '0x4e754738cb69d6f066c9a036f67ee44cc3e9abff';
const MINIMUM_DID3_STAKE = '999999000000000000000000'; // 999,999 DID3 with 18 decimals

// ERC20 Token ABI (for DID3)
const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)"
];

// AVS VC Registry ABI
const AVS_REGISTRY_ABI = [
    // Operator Management
    "function registerOperator(uint256 _stakeAmount)",
    "function addStake(uint256 _additionalStake)",
    "function withdrawStake()",
    "function DID3_TOKEN() view returns (address)",
    "function MINIMUM_STAKE() view returns (uint256)",
    "function getOperator(address _operator) view returns (uint256 stake, bool isActive, uint256 credentialsIssued, uint256 lastActivityTimestamp)",
    "function getActiveOperators() view returns (address[])",
    "function getActiveOperatorCount() view returns (uint256)",

    // Credential Issuance
    "function issueCredential(address _subject, string _credentialType, bytes _credentialData, uint256 _expirationDate) returns (bytes32)",
    "function getCredential(bytes32 _credentialHash) view returns (address subject, address issuer, uint256 issuanceDate, uint256 expirationDate, bool isRevoked, string credentialType)",
    "function isCredentialValid(bytes32 _credentialHash) view returns (bool)",
    "function getSubjectCredentials(address _subject) view returns (bytes32[])",

    // Purge Proposals
    "function proposePurge(bytes32 _credentialHash, string _reason) returns (uint256)",
    "function voteOnPurge(uint256 _proposalId)",
    "function executePurge(uint256 _proposalId)",
    "function getPurgeProposal(uint256 _proposalId) view returns (bytes32 credentialHash, address proposer, string reason, uint256 proposalTimestamp, uint256 approvalCount, uint256 totalVotingPower, bool executed, bool quorumReached)",
    "function hasVotedOnProposal(uint256 _proposalId, address _operator) view returns (bool)",

    // View Functions
    "function getQuorumRequirement() view returns (uint256)",
    "function totalStake() view returns (uint256)",
    "function MINIMUM_STAKE() view returns (uint256)",
    "function QUORUM_PERCENTAGE() view returns (uint256)",

    // Events
    "event CredentialIssued(bytes32 indexed credentialHash, address indexed subject, address indexed issuer, string credentialType, uint256 issuanceDate, uint256 expirationDate)",
    "event OperatorRegistered(address indexed operator, uint256 stake)",
    "event OperatorStakeUpdated(address indexed operator, uint256 newStake)",
    "event PurgeProposalCreated(uint256 indexed proposalId, bytes32 indexed credentialHash, address indexed proposer, string reason)",
    "event PurgeVoteCast(uint256 indexed proposalId, address indexed voter, uint256 votingPower)",
    "event PurgeExecuted(uint256 indexed proposalId, bytes32 indexed credentialHash, uint256 approvalCount, uint256 totalVotingPower)"
];

// Global AVS variables
let avsRegistryContract;
let avsContractAddress = localStorage.getItem('avsRegistryAddress') || '';
let isOperator = false;
let operatorStake = '0';

// Initialize AVS functionality
async function initializeAVS() {
    if (avsContractAddress && signer) {
        avsRegistryContract = new ethers.Contract(
            avsContractAddress,
            AVS_REGISTRY_ABI,
            signer
        );

        // Check if current user is an operator
        await updateOperatorStatus();
    }
}

// Update operator status for current user
async function updateOperatorStatus() {
    if (!avsRegistryContract || !userAddress) return;

    try {
        const operatorInfo = await avsRegistryContract.getOperator(userAddress);
        isOperator = operatorInfo.isActive;
        operatorStake = ethers.utils.formatEther(operatorInfo.stake);

        // Update UI
        updateAVSUI();
    } catch (error) {
        console.error('Error fetching operator status:', error);
    }
}

// Register as AVS operator with DID3 tokens
async function registerAsOperator() {
    if (!avsRegistryContract) {
        showAVSStatus('Please deploy AVS contract first!', 'error');
        return;
    }

    const stakeInput = document.getElementById('operatorStake');
    const stakeAmount = stakeInput.value;

    // Minimum is 999,999 DID3 tokens
    if (!stakeAmount || parseFloat(stakeAmount) < 999999) {
        showAVSStatus('Minimum stake is 999,999 DID3 tokens!', 'error');
        return;
    }

    const registerBtn = document.getElementById('registerOperator');
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<span class="loading-spinner"></span>Approving & Registering...';

    try {
        // Convert to wei (18 decimals)
        const stakeAmountWei = ethers.utils.parseEther(stakeAmount);

        // Get DID3 token contract
        const did3Token = new ethers.Contract(DID3_TOKEN_ADDRESS, ERC20_ABI, signer);

        // Check balance
        showAVSStatus('Checking DID3 token balance...', 'info');
        const balance = await did3Token.balanceOf(userAddress);
        if (balance.lt(stakeAmountWei)) {
            showAVSStatus(`Insufficient DID3 balance. You have ${ethers.utils.formatEther(balance)} DID3`, 'error');
            return;
        }

        // Check current allowance
        const currentAllowance = await did3Token.allowance(userAddress, avsContractAddress);

        // Approve DID3 tokens if needed
        if (currentAllowance.lt(stakeAmountWei)) {
            showAVSStatus('Approving DID3 tokens...', 'info');
            const approveTx = await did3Token.approve(avsContractAddress, stakeAmountWei);
            showAVSStatus('Approval transaction submitted! Waiting for confirmation...', 'info');
            await approveTx.wait();
            showAVSStatus('DID3 tokens approved! Now registering...', 'info');
        }

        // Register as operator
        showAVSStatus('Registering as operator...', 'info');
        const tx = await avsRegistryContract.registerOperator(stakeAmountWei);
        showAVSStatus('Registration transaction submitted! Waiting for confirmation...', 'info');
        await tx.wait();

        // Update operator status
        await updateOperatorStatus();

        showAVSStatus(`Successfully registered as operator with ${stakeAmount} DID3 tokens!`, 'success');
        stakeInput.value = '';

    } catch (error) {
        console.error('Error registering operator:', error);
        let errorMessage = 'Error registering operator: ';

        if (error.code === 'ACTION_REJECTED') {
            errorMessage += 'Transaction was rejected';
        } else if (error.message.includes('Already registered')) {
            errorMessage += 'Already registered as operator';
        } else if (error.message.includes('Insufficient stake')) {
            errorMessage += 'Insufficient stake amount';
        } else if (error.message) {
            errorMessage += error.message;
        } else {
            errorMessage += 'Unknown error occurred';
        }

        showAVSStatus(errorMessage, 'error');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register as Operator';
    }
}

// Add more stake with DID3 tokens
async function addOperatorStake() {
    if (!avsRegistryContract || !isOperator) {
        showAVSStatus('You are not a registered operator!', 'error');
        return;
    }

    const stakeInput = document.getElementById('addStakeAmount');
    const stakeAmount = stakeInput.value;

    if (!stakeAmount || parseFloat(stakeAmount) <= 0) {
        showAVSStatus('Please enter a valid stake amount!', 'error');
        return;
    }

    const addStakeBtn = document.getElementById('addStake');
    addStakeBtn.disabled = true;
    addStakeBtn.innerHTML = '<span class="loading-spinner"></span>Approving & Adding Stake...';

    try {
        const stakeAmountWei = ethers.utils.parseEther(stakeAmount);

        // Get DID3 token contract
        const did3Token = new ethers.Contract(DID3_TOKEN_ADDRESS, ERC20_ABI, signer);

        // Check balance
        showAVSStatus('Checking DID3 token balance...', 'info');
        const balance = await did3Token.balanceOf(userAddress);
        if (balance.lt(stakeAmountWei)) {
            showAVSStatus(`Insufficient DID3 balance. You have ${ethers.utils.formatEther(balance)} DID3`, 'error');
            return;
        }

        // Check current allowance
        const currentAllowance = await did3Token.allowance(userAddress, avsContractAddress);

        // Approve DID3 tokens if needed
        if (currentAllowance.lt(stakeAmountWei)) {
            showAVSStatus('Approving DID3 tokens...', 'info');
            const approveTx = await did3Token.approve(avsContractAddress, stakeAmountWei);
            showAVSStatus('Approval transaction submitted! Waiting for confirmation...', 'info');
            await approveTx.wait();
        }

        // Add stake
        showAVSStatus('Adding stake...', 'info');
        const tx = await avsRegistryContract.addStake(stakeAmountWei);
        showAVSStatus('Transaction submitted! Waiting for confirmation...', 'info');
        await tx.wait();

        // Update operator status
        await updateOperatorStatus();

        showAVSStatus(`Successfully added ${stakeAmount} DID3 tokens to stake!`, 'success');
        stakeInput.value = '';

    } catch (error) {
        console.error('Error adding stake:', error);
        showAVSStatus('Error adding stake: ' + error.message, 'error');
    } finally {
        addStakeBtn.disabled = false;
        addStakeBtn.textContent = 'Add Stake';
    }
}

// Withdraw stake
async function withdrawOperatorStake() {
    if (!avsRegistryContract || !isOperator) {
        showAVSStatus('You are not a registered operator!', 'error');
        return;
    }

    if (!confirm('Are you sure you want to withdraw your stake and deactivate as an operator?')) {
        return;
    }

    const withdrawBtn = document.getElementById('withdrawStake');
    withdrawBtn.disabled = true;
    withdrawBtn.innerHTML = '<span class="loading-spinner"></span>Withdrawing...';

    try {
        showAVSStatus('Withdrawing stake...', 'info');

        const tx = await avsRegistryContract.withdrawStake();

        showAVSStatus('Transaction submitted! Waiting for confirmation...', 'info');

        await tx.wait();

        // Update operator status
        await updateOperatorStatus();

        showAVSStatus('Successfully withdrawn stake and deactivated!', 'success');

    } catch (error) {
        console.error('Error withdrawing stake:', error);
        showAVSStatus('Error withdrawing stake: ' + error.message, 'error');
    } finally {
        withdrawBtn.disabled = false;
        withdrawBtn.textContent = 'Withdraw Stake';
    }
}

// Issue credential (for operators only)
async function issueAVSCredential(event) {
    event.preventDefault();

    if (!avsRegistryContract || !isOperator) {
        showAVSStatus('Only operators with >= 3 ETH stake can issue credentials!', 'error');
        return;
    }

    const submitBtn = document.getElementById('avsSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span>Issuing Credential...';

    try {
        // Get form data
        const formData = {
            fullName: document.getElementById('avsFullName').value,
            dateOfBirth: document.getElementById('avsDateOfBirth').value,
            country: document.getElementById('avsCountry').value || 'Not Specified',
            email: document.getElementById('avsEmail').value || 'Not Provided',
            expirationDate: document.getElementById('avsExpirationDate').value,
            subjectAddress: document.getElementById('avsSubjectAddress').value
        };

        // Validate subject address
        if (!ethers.utils.isAddress(formData.subjectAddress)) {
            throw new Error('Invalid subject address');
        }

        // Create credential data
        const credentialData = {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiableCredential', 'KYCVerification'],
            issuer: userAddress,
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
                id: formData.subjectAddress,
                Full_Legal_Name: formData.fullName,
                DateOfBirth: formData.dateOfBirth,
                Country: formData.country,
                Email: formData.email
            }
        };

        if (formData.expirationDate) {
            credentialData.expirationDate = new Date(formData.expirationDate).toISOString();
        }

        const credentialJSON = JSON.stringify(credentialData);
        const credentialBytes = ethers.utils.toUtf8Bytes(credentialJSON);

        const expirationTimestamp = formData.expirationDate
            ? Math.floor(new Date(formData.expirationDate).getTime() / 1000)
            : 0;

        showAVSStatus('Waiting for transaction confirmation...', 'info');

        const tx = await avsRegistryContract.issueCredential(
            formData.subjectAddress,
            'KYCVerification',
            credentialBytes,
            expirationTimestamp
        );

        showAVSStatus('Transaction submitted! Waiting for confirmation...', 'info');

        const receipt = await tx.wait();

        // Get credential hash from event
        const event = receipt.events?.find(e => e.event === 'CredentialIssued');
        const credentialHash = event?.args?.credentialHash;

        displayAVSCredentialResult(receipt.transactionHash, credentialHash, formData.subjectAddress);
        showAVSStatus('Credential issued successfully!', 'success');

        // Reset form
        document.getElementById('avsKycForm').reset();

    } catch (error) {
        console.error('Error issuing credential:', error);
        showAVSStatus('Error issuing credential: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Issue Verifiable Credential';
    }
}

// Propose purge
async function proposePurgeCredential() {
    if (!avsRegistryContract || !isOperator) {
        showAVSStatus('Only operators can propose purge!', 'error');
        return;
    }

    const credHashInput = document.getElementById('purgeCredentialHash');
    const reasonSelect = document.getElementById('purgeReason');

    const credHash = credHashInput.value.trim();
    const reason = reasonSelect.value;

    if (!credHash || credHash.length !== 66 || !credHash.startsWith('0x')) {
        showAVSStatus('Please enter a valid credential hash!', 'error');
        return;
    }

    const proposeBtn = document.getElementById('proposePurge');
    proposeBtn.disabled = true;
    proposeBtn.innerHTML = '<span class="loading-spinner"></span>Proposing...';

    try {
        showAVSStatus('Creating purge proposal...', 'info');

        const tx = await avsRegistryContract.proposePurge(credHash, reason);

        showAVSStatus('Transaction submitted! Waiting for confirmation...', 'info');

        const receipt = await tx.wait();

        // Get proposal ID from event
        const event = receipt.events?.find(e => e.event === 'PurgeProposalCreated');
        const proposalId = event?.args?.proposalId;

        showAVSStatus(`Purge proposal created! Proposal ID: ${proposalId}`, 'success');

        credHashInput.value = '';

        // Load proposals
        await loadPurgeProposals();

    } catch (error) {
        console.error('Error proposing purge:', error);
        showAVSStatus('Error proposing purge: ' + error.message, 'error');
    } finally {
        proposeBtn.disabled = false;
        proposeBtn.textContent = 'Propose Purge';
    }
}

// Vote on purge
async function voteOnPurgeProposal(proposalId) {
    if (!avsRegistryContract || !isOperator) {
        showAVSStatus('Only operators can vote!', 'error');
        return;
    }

    try {
        showAVSStatus('Casting vote...', 'info');

        const tx = await avsRegistryContract.voteOnPurge(proposalId);

        showAVSStatus('Transaction submitted! Waiting for confirmation...', 'info');

        await tx.wait();

        showAVSStatus('Vote cast successfully!', 'success');

        // Reload proposals
        await loadPurgeProposals();

    } catch (error) {
        console.error('Error voting:', error);
        showAVSStatus('Error voting: ' + error.message, 'error');
    }
}

// Execute purge
async function executePurgeProposal(proposalId) {
    if (!avsRegistryContract) {
        showAVSStatus('Contract not initialized!', 'error');
        return;
    }

    try {
        showAVSStatus('Executing purge...', 'info');

        const tx = await avsRegistryContract.executePurge(proposalId);

        showAVSStatus('Transaction submitted! Waiting for confirmation...', 'info');

        await tx.wait();

        showAVSStatus('Purge executed successfully!', 'success');

        // Reload proposals
        await loadPurgeProposals();

    } catch (error) {
        console.error('Error executing purge:', error);
        showAVSStatus('Error executing purge: ' + error.message, 'error');
    }
}

// Load active purge proposals
async function loadPurgeProposals() {
    if (!avsRegistryContract) return;

    const proposalsList = document.getElementById('purgeProposalsList');
    proposalsList.innerHTML = '<p>Loading proposals...</p>';

    try {
        // This is a simple implementation - in production you'd want to track proposal IDs
        // For now, we'll check the last 20 proposals
        const proposals = [];

        for (let i = 0; i < 20; i++) {
            try {
                const proposal = await avsRegistryContract.getPurgeProposal(i);
                if (proposal.proposalTimestamp > 0) {
                    const hasVoted = await avsRegistryContract.hasVotedOnProposal(i, userAddress);
                    proposals.push({
                        id: i,
                        ...proposal,
                        hasVoted
                    });
                }
            } catch (error) {
                // Proposal doesn't exist, continue
                break;
            }
        }

        if (proposals.length === 0) {
            proposalsList.innerHTML = '<p>No active proposals</p>';
            return;
        }

        // Get quorum requirement once
        const quorumRequirement = await avsRegistryContract.getQuorumRequirement();
        const quorumFormatted = ethers.utils.formatEther(quorumRequirement);

        // Display proposals
        proposalsList.innerHTML = proposals.map(p => `
            <div class="proposal-card ${p.executed ? 'executed' : ''}">
                <h4>Proposal #${p.id}</h4>
                <p><strong>Credential:</strong> ${p.credentialHash.substring(0, 10)}...${p.credentialHash.substring(58)}</p>
                <p><strong>Reason:</strong> ${p.reason}</p>
                <p><strong>Proposer:</strong> ${p.proposer.substring(0, 6)}...${p.proposer.substring(38)}</p>
                <p><strong>Voting Power:</strong> ${ethers.utils.formatEther(p.totalVotingPower)} / ${quorumFormatted} DID3 (${p.quorumReached ? 'Quorum Reached' : 'Quorum Not Reached'})</p>
                <p><strong>Status:</strong> ${p.executed ? 'Executed' : 'Active'}</p>
                ${!p.executed && isOperator && !p.hasVoted ? `
                    <button onclick="voteOnPurgeProposal(${p.id})" class="btn-vote">Vote to Approve</button>
                ` : ''}
                ${!p.executed && p.quorumReached ? `
                    <button onclick="executePurgeProposal(${p.id})" class="btn-execute">Execute Purge</button>
                ` : ''}
                ${p.hasVoted ? '<span class="voted-badge">You Voted</span>' : ''}
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading proposals:', error);
        proposalsList.innerHTML = '<p class="error">Error loading proposals</p>';
    }
}

// Update AVS UI based on operator status
function updateAVSUI() {
    const operatorStatusDiv = document.getElementById('operatorStatus');

    if (isOperator) {
        operatorStatusDiv.innerHTML = `
            <div class="operator-active">
                <h3>Operator Status: Active</h3>
                <p>Current Stake: ${operatorStake} DID3</p>
            </div>
        `;

        // Show operator-only sections
        document.querySelectorAll('.operator-only').forEach(el => {
            el.style.display = 'block';
        });
    } else {
        operatorStatusDiv.innerHTML = `
            <div class="operator-inactive">
                <h3>Operator Status: Not Registered</h3>
                <p>Register as an operator with 999,999+ DID3 tokens to issue credentials</p>
            </div>
        `;

        // Hide operator-only sections
        document.querySelectorAll('.operator-only').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// Display AVS credential result
function displayAVSCredentialResult(txHash, credHash, subject) {
    const resultDiv = document.getElementById('avsCredentialResult');
    document.getElementById('avsTxHash').textContent = txHash;
    document.getElementById('avsCredHash').textContent = credHash;
    document.getElementById('avsSubjectAddr').textContent = subject;

    const explorerLink = document.getElementById('avsExplorerLink');
    explorerLink.href = `${BASE_SEPOLIA_EXPLORER}/tx/${txHash}`;

    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

// Show AVS status message
function showAVSStatus(message, type) {
    const statusDiv = document.getElementById('avsStatusMessage');
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    statusDiv.style.display = 'block';

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }
}

// Deploy AVS Registry Contract
async function deployAVSRegistry() {
    if (!signer) {
        showAVSStatus('Please connect your wallet first!', 'error');
        return;
    }

    const deployBtn = document.getElementById('deployAVSRegistry');
    deployBtn.disabled = true;
    deployBtn.innerHTML = '<span class="loading-spinner"></span>Deploying Contract...';

    showAVSStatus('Please use the deploy-avs.js script with Hardhat to deploy the AVS contract.', 'info');

    deployBtn.disabled = false;
    deployBtn.textContent = 'Deploy AVS Registry';
}

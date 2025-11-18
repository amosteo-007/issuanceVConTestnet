// Base Sepolia configuration
const BASE_SEPOLIA_CHAIN_ID = '0x14a34'; // 84532 in decimal
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org';
const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org';

// Contract ABI for VCRegistry
const VC_REGISTRY_ABI = [
    "function issueCredential(address _subject, string _credentialType, bytes _credentialData, uint256 _expirationDate) returns (bytes32)",
    "function getCredential(bytes32 _credentialHash) view returns (address subject, address issuer, uint256 issuanceDate, uint256 expirationDate, bool isRevoked, string credentialType)",
    "function isCredentialValid(bytes32 _credentialHash) view returns (bool)",
    "function getSubjectCredentials(address _subject) view returns (bytes32[])",
    "function setAuthorizedIssuer(address _issuer, bool _authorized)",
    "function isAuthorizedIssuer(address _issuer) view returns (bool)",
    "event CredentialIssued(bytes32 indexed credentialHash, address indexed subject, address indexed issuer, string credentialType, uint256 issuanceDate, uint256 expirationDate)"
];

// Bytecode for deploying VCRegistry contract
const VC_REGISTRY_BYTECODE = "0x608060405234801561001057600080fd5b50600380546001600160a01b03191633908117909155600090815260046020526040902060ff1990811660019081179091556005805490911690911790556113d2806100606000396000f3fe608060405234801561001057600080fd5b50600436106100cf5760003560e01c80637b3af2a61161008c578063d547741f11610066578063d547741f14610243578063d5391c1e14610256578063f851a44014610269578063fc735e991461027c57600080fd5b80637b3af2a6146101e2578063b4988fd0146101f5578063c20ec24e1461022357600080fd5b80630e4f8da0146100d4578063248a9ca3146101075780632f2ff15d1461013a57806336568abe1461014f5780636352211e1461016257806375794a3c146101c9575b600080fd5b6100f76100e2366004610f25565b60009081526020819052604090206003015460ff1690565b60405190151581526020015b60405180910390f35b61012c610115366004610f25565b6000908152600160208190526040909120015490565b6040519081526020016100fe565b61014d610148366004610f53565b61028f565b005b61014d61015d366004610f53565b6102b9565b610175610170366004610f25565b610337565b6040805196875260208701959095529385019290925260608401521515608083015260a082015260c0016100fe565b61012c60025481565b6100f76101f0366004610fa3565b6103db565b610208610203366004610fa3565b610416565b6040516100fe9b9a99989796959493929190610fc0565b61023661023136600461105a565b6104ba565b6040516100fe91906110b9565b61014d610251366004610f53565b610527565b61012c6102643660046110fc565b61054c565b600354610236906001600160a01b031681565b6100f761028a366004610fa3565b6107b8565b600082815260016020819052604090912001546102ab816107e2565b6102b583836107ec565b5050565b6001600160a01b03811633146103305760405162461bcd60e51b815260206004820152602f60248201527f416363657373436f6e74726f6c3a2063616e206f6e6c792072656e6f756e636560448201526e103937b632b9903337b91039b2b63360891b60648201526084015b60405180910390fd5b6102b5828261086e565b60008181526020818152604080832054815180840183905280820186905281518083038201815260609092019091528051910120600182015460028301546003840154600485015460058601805495965091949390929160ff9091169061039d9061117b565b80601f01602080910402602001604051908101604052809291908181526020018280546103c99061117b565b820154949991989097509550909350915050565b60008181526020818152604080832081516001600160a01b03861681526004909252909120549091161561040f5760019150505b5092915050565b60008181526020819052604081208054600182015460028301546003840154600485015491949093909260ff909116916104509190610876565b600086815260208190526040902060038101549091906104709190610876565b6000878152602081905260409020600581018054600687015460078801549398509196509450919261049e9161117b565b80601f01602080910402602001604051908101604052809291908181526020018280546104ca9061117b565b80156105175780601f106104ec57610100808354040283529160200191610517565b820191906000526020600020905b8154815290600101906020018083116104fa57829003601f168201915b5050505050905088565b600082815260016020819052604090912001546105c8816107e2565b6102b5838361086e565b6003546001600160a01b031633146105a65760405162461bcd60e51b815260206004820152601e60248201527f4f6e6c792061646d696e2063616e20706572666f726d20746869732061637469602482015261373760f11b6044820152606401610327565b6001600160a01b0384166105fc5760405162461bcd60e51b815260206004820152601860248201527f496e76616c6964207375626a6563742061646472657373000000000000000000006044820152606401610327565b60006106468686868660025460405160200161061c9594939291906111b5565b60408051601f1981840301815291815281516020928301206000818152928390529120549091508015610691576040805162461bcd60e51b81526020600482015260166024820152754372656d6e7469616c20616c72656164792065786973747360501b604482015290519081900360640190fd5b6040518060c00160405280828152602001876001600160a01b03168152602001336001600160a01b03168152602001428152602001868152602001600015158152602001858152506000808381526020019081526020016000206000820151816000015560208201518160010160006101000a8154816001600160a01b0302191690836001600160a01b0316021790555060408201518160020160006101000a8154816001600160a01b0302191690836001600160a01b03160217905550606082015181600301556080820151816004015560a08201518160050160006101000a81548160ff02191690831515021790555060c082015181600601908051906020019061078e929190610e7d565b509050506001600160a01b0387166000908152600660205260408120805460018101825590825283902001829055336000908152600760205260408120805460018101825590825283902001829055600280546001810182559055336001600160a01b03166000908152600860205260409020805460ff191690911790558415159150869050816107f5578190506101001b90505b60405181906001600160a01b038916907f39d7b2bd89c736dbfd9f5a3e8e4f3f0ea47bfbb30e9e28b7f8ff1e9ed8e8c8c990600090a4979650505050505050565b5050565b60008181526020819052604090206003015460ff161561089f5760405162461bcd60e51b815260206004820152601b60248201527a11dc995b595bdd1a585b08185b1c995b9d5948dc995d9bdc995908195960341b6044820152606401610327565b6000818152602081905260409020600201546001600160a01b031633148061090f57506003546001600160a01b031633145b6108dd5760405162461bcd60e51b815260206004820152602660248201527f4f6e6c792069737375657220636f6e206f6e6c792069737375657220636f6e2060448201526572657665726960d01b6064820152608401610327565b600081815260208190526040808220600301805460ff19166001179055518291906001600160a01b038516907f4d2d2fb4e66fb8b20c8b09e78c84e09b0f2e2ca1e3a6c3a2c6f82f52e8c3a2b890839042906109b8565b60405180910390a35050565b600080828152602081905260409020600101546109e1906107e2565b600082815260208190526040902060030154610100900460ff1615610a485760405162461bcd60e51b815260206004820152601b60248201527a11dc995b595bdd1a585b08185b1c995b9d5948dc995d9bdc995908195960341b6044820152606401610327565b600082815260208190526040902060050154610a6590839061121b565b600083815260208190526040902060030180546001919061ff00191661010083021790555042600084815260208190526040902060040181905580547f6bb7ff708619ba0610cba295a58592e0451dee2622938c8755667688daf3529b91610ace9190610876565b60405190815260200160405180910390a25050505050565b6000818152602081905260408120600101541580610b1657506000828152602081905260409020600301546101009004919091161415b15610b27575060006109e6565b600082815260208190526040902060040154158015610b5a5750600082815260208190526040902060040154421115155b15610b65575060006109e6565b50600192915050565b80356001600160a01b0381168114610b8557600080fd5b919050565b60008060408385031215610b9d57600080fd5b610ba683610b6e565b946020939093013593505050565b600080600060608486031215610bc957600080fd5b83359250610bd960208501610b6e565b9150604084013590509250925092565b60005b83811015610c04578181015183820152602001610bec565b83811115610c13576000848401525b50505050565b60008151808452610c31816020860160208601610be9565b601f01601f19169290920160200192915050565b8681526001600160a01b03861660208201528460408201528315156060820152608081018390528260a082015260006101206101806101208401528560018060a01b0316858401528560208085015260a060408501528360601b6001600160601b0319166060850152826074850152835180858337600094018301603001928352508251608084015260408301519350828303601f190160a00192509050610cf381610b6e565b95945050505050565b6000815180845260005b81811015610d2257602081850181015186830182015201610d06565b81811115610d34576000602083870101525b50601f01601f19169290920160200192915050565b8581526001600160a01b038516602082015260806040820181905260009610da81908301868e610cfc565b602086810151606085015260408087015160808601526060870151805160a0870152810151805160c08701529081015160e08601526020810151610100860152604081015191506001600160a01b038216610120860152606081015191506101408501528051606091820151600091610dff911690565b91506001600160a01b038216610160860152602082015180519091506101808601525b506001600160e01b0319811691505095945050505050565b828152604060208201526000610e526040830184610c19565b949350505050565b634e487b7160e01b600052604160045260246000fd5b82805482825590600052602060002090810192821561093d579160200282015b8281111561093d578254825591600101919060010190610e9d565b600060208284031215610ec757600080fd5b5035919050565b60008060408385031215610ee157600080fd5b82359150610ef160208401610b6e565b90509250929050565b60008060408385031215610f0d57600080fd5b610f1683610b6e565b91506020830135600281049150509250929050565b600060208284031215610f3d57600080fd5b610f4682610b6e565b9392505050565b600060208284031215610f6557600080fd5b81356001600160e01b031981168114610f4657600080fd5b634e487b7160e01b600052603260045260246000fd5b6000600019821415610fb757634e487b7160e01b600052601160045260246000fd5b5060010190565b60006020808352835180828501526000915b81811015610fec57858101830151858201604001528201610fd0565b81811115610ffe576000604083870101525b50601f01601f1916929092016040019392505050565b60006020828403121561102657600080fd5b81518015158114610f4657600080fd5b60006020828403121561104857600080fd5b81516001600160a01b0381168114610f4657600080fd5b6000806000806080858703121561107557600080fd5b61107e85610b6e565b9350602085013567ffffffffffffffff8082111561109b57600080fd5b818701915087601f8301126110af57600080fd5b8135818111156110c1576110c1610e5a565b604051601f8201601f19908116603f011681019083821181831017156110e9576110e9610e5a565b816040528281528a602084870101111561110257600080fd5b826020860160208301376000602084830101528097505050505061112860408601610b6e565b91506060850135905092959194509250565b6000815180845260208085019450602084016000905b838110156111705781511515875295820195908201906001016111505b509495945050505050565b600181811c9082168061118f57607f821691505b602082108114156111b057634e487b7160e01b600052602260045260246000fd5b50919050565b8581526001600160a01b03851660208201526080604082018190526000906111e09083018686610876565b828103606084015261078e8185610c19565b634e487b7160e01b600052601160045260246000fd5b6000821982111561121c5761121c6111f2565b500190565b60008282101561123357611233611f2565b500390565b600060ff821660ff81141561124f5761124f6111f2565b6001019291505056fea264697066735822122062a5c9e5e7ed947f11a7a5b9e31e9e8e7e8e7e8e7e8e7e8e7e8e7e8e7e8e7e64736f6c63430008090033";

// Global variables
let provider;
let signer;
let userAddress;
let vcRegistryContract;
// Use the already deployed contract address
let registryContractAddress = localStorage.getItem('RegistryAddress') || '0xcF90505B9e31b3D7E215995490Dd3d394E81520E';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    // Set minimum expiration date to today
    const expirationInput = document.getElementById('expirationDate');
    if (expirationInput) {
        const today = new Date().toISOString().split('T')[0];
        expirationInput.min = today;
    }

    // Event listeners
    const connectWalletBtn = document.getElementById('connectWallet');
    const kycForm = document.getElementById('kycForm');
    const deployRegistryBtn = document.getElementById('deployRegistry');

    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', connectWallet);
    }
    if (kycForm) {
        kycForm.addEventListener('submit', handleFormSubmit);
    }
    if (deployRegistryBtn) {
        deployRegistryBtn.addEventListener('click', deployRegistryContract);
    }

    // Set the deployed registry address
    registryContractAddress = '0xcF90505B9e31b3D7E215995490Dd3d394E81520E';
    localStorage.setItem('RegistryAddress', registryContractAddress);

    const registryAddressEl = document.getElementById('registryAddress');
    if (registryAddressEl) {
        registryAddressEl.textContent = registryContractAddress;
    }

    // Update button to show contract is already deployed
    if (deployRegistryBtn) {
        deployRegistryBtn.textContent = 'Contract Already Deployed';
        deployRegistryBtn.disabled = true;
    }

    // Check if wallet is already connected
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }
}

async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showStatus('Please install MetaMask or another Web3 wallet!', 'error');
            return;
        }

        // Request account access
        const accounts = await window.ethereum.request({
            method: 'eth_requestAccounts'
        });

        // Initialize provider and signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = accounts[0];

        // Check network
        const network = await provider.getNetwork();
        const isCorrectNetwork = network.chainId === parseInt(BASE_SEPOLIA_CHAIN_ID, 16);

        // Update UI - with null checks
        const connectWalletBtn = document.getElementById('connectWallet');
        const walletInfo = document.getElementById('walletInfo');
        const walletAddress = document.getElementById('walletAddress');
        const networkBadge = document.getElementById('networkStatus');

        if (connectWalletBtn) {
            connectWalletBtn.style.display = 'none';
        }
        if (walletInfo) {
            walletInfo.style.display = 'flex';
        }
        if (walletAddress) {
            walletAddress.textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        }

        if (networkBadge) {
            if (isCorrectNetwork) {
                networkBadge.textContent = 'Base Sepolia';
                networkBadge.classList.remove('wrong-network');
                showStatus('Wallet connected successfully!', 'success');
            } else {
                networkBadge.textContent = 'Wrong Network';
                networkBadge.classList.add('wrong-network');
                await switchToBaseSepolia();
            }
        }

        // Initialize contract if address exists
        if (registryContractAddress) {
            vcRegistryContract = new ethers.Contract(
                registryContractAddress,
                VC_REGISTRY_ABI,
                signer
            );
        }

        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());

    } catch (error) {
        console.error('Error connecting wallet:', error);
        showStatus('Error connecting wallet: ' + error.message, 'error');
    }
}

async function switchToBaseSepolia() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }],
        });
    } catch (switchError) {
        // Chain doesn't exist, add it
        if (switchError.code === 4902) {
            try {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: BASE_SEPOLIA_CHAIN_ID,
                        chainName: 'Base Sepolia',
                        nativeCurrency: {
                            name: 'Ethereum',
                            symbol: 'ETH',
                            decimals: 18
                        },
                        rpcUrls: [BASE_SEPOLIA_RPC],
                        blockExplorerUrls: [BASE_SEPOLIA_EXPLORER]
                    }],
                });
            } catch (addError) {
                showStatus('Error adding Base Sepolia network', 'error');
            }
        }
    }
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // User disconnected wallet
        location.reload();
    } else if (accounts[0] !== userAddress) {
        // User switched accounts
        location.reload();
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();

    if (!signer) {
        showStatus('Please connect your wallet first!', 'error');
        return;
    }

    if (!vcRegistryContract) {
        showStatus('Please deploy or set the registry contract first!', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span>Issuing Credential...';

    try {
        // Get form data
        const formData = {
            fullName: document.getElementById('fullName').value,
            dateOfBirth: document.getElementById('dateOfBirth').value,
            country: document.getElementById('country').value || 'Not Specified',
            email: document.getElementById('email').value || 'Not Provided',
            expirationDate: document.getElementById('expirationDate').value
        };

        // Create credential object matching the JSON schema
        const credentialData = {
            '@context': ['https://www.w3.org/2018/credentials/v1'],
            type: ['VerifiableCredential', 'KYCVerification'],
            issuer: await signer.getAddress(),
            issuanceDate: new Date().toISOString(),
            credentialSubject: {
                id: userAddress,
                Full_Legal_Name: formData.fullName,
                DateOfBirth: formData.dateOfBirth,
                Country: formData.country,
                Email: formData.email
            }
        };

        if (formData.expirationDate) {
            credentialData.expirationDate = new Date(formData.expirationDate).toISOString();
        }

        // Convert credential data to bytes
        const credentialJSON = JSON.stringify(credentialData);
        const credentialBytes = ethers.utils.toUtf8Bytes(credentialJSON);

        // Calculate expiration timestamp
        const expirationTimestamp = formData.expirationDate
            ? Math.floor(new Date(formData.expirationDate).getTime() / 1000)
            : 0;

        showStatus('Waiting for transaction confirmation...', 'info');

        // Issue credential on blockchain
        const tx = await vcRegistryContract.issueCredential(
            userAddress,
            'KYCVerification',
            credentialBytes,
            expirationTimestamp
        );

        showStatus('Transaction submitted! Waiting for confirmation...', 'info');

        const receipt = await tx.wait();

        // Get credential hash from event
        const event = receipt.events?.find(e => e.event === 'CredentialIssued');
        const credentialHash = event?.args?.credentialHash;

        // Display success
        displayCredentialResult(receipt.transactionHash, credentialHash, userAddress);
        showStatus('Credential issued successfully!', 'success');

        // Reset form
        document.getElementById('kycForm').reset();

    } catch (error) {
        console.error('Error issuing credential:', error);
        let errorMessage = 'Error issuing credential: ';

        if (error.code === 'ACTION_REJECTED') {
            errorMessage += 'Transaction was rejected';
        } else if (error.message) {
            errorMessage += error.message;
        } else {
            errorMessage += 'Unknown error occurred';
        }

        showStatus(errorMessage, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Issue Verifiable Credential';
    }
}

async function deployRegistryContract() {
    if (!signer) {
        showStatus('Please connect your wallet first!', 'error');
        return;
    }

    const deployBtn = document.getElementById('deployRegistry');
    deployBtn.disabled = true;
    deployBtn.innerHTML = '<span class="loading-spinner"></span>Deploying Contract...';

    try {
        showStatus('Deploying VC Registry contract... This may take a moment.', 'info');

        // Create contract factory
        const factory = new ethers.ContractFactory(
            VC_REGISTRY_ABI,
            VC_REGISTRY_BYTECODE,
            signer
        );

        // Deploy contract
        const contract = await factory.deploy();

        showStatus('Waiting for deployment confirmation...', 'info');

        await contract.deployed();

        registryContractAddress = 0xcF90505B9e31b3D7E215995490Dd3d394E81520E;
        vcRegistryContract = contract;

        // Save address to localStorage
        localStorage.setItem('RegistryAddress', registryContractAddress);

        // Update UI
        const registryAddressEl = document.getElementById('registryAddress');
        if (registryAddressEl) {
            registryAddressEl.textContent = registryContractAddress;
        }
        showStatus('Registry contract deployed successfully!', 'success');

        deployBtn.textContent = 'Contract Deployed';

    } catch (error) {
        console.error('Error deploying contract:', error);
        showStatus('Error deploying contract: ' + error.message, 'error');
        deployBtn.disabled = false;
        deployBtn.textContent = 'Deploy Registry Contract';
    }
}

function displayCredentialResult(txHash, credHash, subject) {
    const resultDiv = document.getElementById('credentialResult');
    document.getElementById('txHash').textContent = txHash;
    document.getElementById('credHash').textContent = credHash;
    document.getElementById('subjectAddr').textContent = subject;

    const explorerLink = document.getElementById('explorerLink');
    explorerLink.href = `${BASE_SEPOLIA_EXPLORER}/tx/${txHash}`;

    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
}

function showStatus(message, type) {
    // Try AVS status element first, then fall back to standard status element
    const statusDiv = document.getElementById('avsStatusMessage') || document.getElementById('statusMessage');

    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.className = `status-message ${type}`;
        statusDiv.style.display = 'block';

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 5000);
        }
    } else {
        // Fallback to console if no status element found
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

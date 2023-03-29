# Hardhat Bridge Project

Bridge Frontend: https://github.com/ilchovski98/ERC20-bridge-frontend
Bridge Backend: https://github.com/ilchovski98/ERC20-bridge-backend

## About the project
The implementation of the bridge allows for the deployment and interaction on 3+ chains.

After the deposit of an ERC20 token, the user can claim a wrapped version of the token on any of the other chains. The bridge uses a lock/mint/burn/release mechanism where the original is transfered to the bridge and on another chain a wrapped version of the token is deployed/minted to the user address. If the wrapped ERC20 is transfered to a 3rd chain, the tokens will be burned and new will be minted on the destination chain.

The tokens will not be wrapped more than once and by returning the wrapped tokens on the source chain, the original ones can be released.

The bridge relies on a centralised entity (the deployer of the bridge contracts) to listen for the emited events and to provide the user with the needed signatures in order to execute the claim function (to mint new tokens or to release existing ones).

The gas for the transactions is paid by the user that interacts with the bridge. This includes the deployment of the wrapped token contracts if they are not already deployed.

The bridge supports standard ERC20 tokens through it's deposit() function. Before calling the deposit function the user must approve the bridge to transfer the tokens they want to deposit. This happens in two seperate transactions. ERC20 tokens that implement permits (EIP 2612) are also supported by calling the depositWithPermit() function, where the approval and the transfer are done in one transaction.

## Deploying Guide
1. Create .env file with the needed variables as in .env.example
2. Make sure that line 225 in contracts/Bridge.sol is uncommented (it is commented because tests are done on 1 chain at the moment)
3. Use the hardhat tasks "deploy-bridge" and "deploy-permitERC20" to deploy the bridge and some ERC20 tokens on the desired networks (use --help to identify what arguments each task needs)
4. Make sure to unpause the bridge contracts after deployment
5. Enjoy!

## Deployments on Sepolia
Bridge contract:
 - address: 0xF55D12e0fe91c157c3D389F134a46b2182D2F6Da
 - verify link: https://sepolia.etherscan.io/address/0xF55D12e0fe91c157c3D389F134a46b2182D2F6Da#code

Random Coin (permitERC20):
 - address: 0x9a7F208A777ed19233380959c4028c99886c5843
 - verify link: https://sepolia.etherscan.io/address/0x9a7F208A777ed19233380959c4028c99886c5843#code

Doge Coin (permitERC20):
 - address: 0x9b432836C67D4Bbe94a10EfB6Da0c9CEBA990a57
 - verify link: https://sepolia.etherscan.io/address/0x9b432836C67D4Bbe94a10EfB6Da0c9CEBA990a57#code

Cat Coin (permitERC20):
 - address: 0x45D3F76AD684cDfeA4eCbc9842d595d3e68dd01E
 - verify link: https://sepolia.etherscan.io/address/0x45D3F76AD684cDfeA4eCbc9842d595d3e68dd01E#code

## Deployments on Goerli
Bridge contract:
 - address: 0xc551F21DE4cd2C55Ea1B8B9eb8b541aaBE9766EF
 - verify link: https://goerli.etherscan.io/address/0xc551F21DE4cd2C55Ea1B8B9eb8b541aaBE9766EF#code

Dino Coin (permitERC20):
 - address: 0xBdb3eB1022F8Fa2d873aA0089C05a7A1b5004349
 - verify link: https://goerli.etherscan.io/address/0xBdb3eB1022F8Fa2d873aA0089C05a7A1b5004349#code

Bird Coin (permitERC20):
 - address: 0x4A5b2aB0129A8F6b8b0CDd615B78B9D29DB10B11
 - verify link: https://goerli.etherscan.io/address/0x4A5b2aB0129A8F6b8b0CDd615B78B9D29DB10B11#code

## Deployments on Mumbai
Bridge contract:
 - address: 0xe7cDb89b500B953348C1172C3828E611665263e9
 - https://mumbai.polygonscan.com/address/0xe7cDb89b500B953348C1172C3828E611665263e9
 - verify link: Couldn't verify the contract (Error: NomicLabsHardhatPluginError: Invalid API Key) - Seems that there is an issue on Etherscan's end https://github.com/smartcontractkit/full-blockchain-solidity-course-js/discussions/1214

Iron Man Coin (permitERC20):
 - address: 0xf878d95eC5b648D845bDA52984D56962965dEF98
 - https://mumbai.polygonscan.com/address/0xf878d95eC5b648D845bDA52984D56962965dEF98

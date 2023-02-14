const Web3 = require('web3');
const BlockchainServiceBase = require('../blockchain-service-base.js');
const { WEBSOCKET_PROVIDER_OPTIONS, BLOCKCHAINS } = require('../../../constants.js');

class BrowserBlockchainService extends BlockchainServiceBase {
    constructor(config = {}) {
        super(config);
        this.config = config;
    }

    getBlockchain(options) {
        const name = options.blockchain.name ?? this.config?.blockchain?.name;
        const rpc = options.blockchain.rpc ?? BLOCKCHAINS[name].rpc;
        const hubContract = options.blockchain.hubContract ?? BLOCKCHAINS[name].hubContract;

        return {
            name,
            rpc,
            hubContract,
        };
    }

    initializeWeb3(blockchainName, blockchainRpc) {
        if (typeof window.Web3 === 'undefined' || !window.Web3) {
            this.logger.error(
                'No web3 implementation injected, please inject your own Web3 implementation.',
            );
            return;
        }
        if (window.ethereum) {
            this[blockchainName].web3 = new window.Web3(window.ethereum);
        } else if (blockchainRpc.startsWith('ws')) {
            const provider = new window.Web3.providers.WebsocketProvider(
                blockchainRpc,
                WEBSOCKET_PROVIDER_OPTIONS,
            );
            this[blockchainName].web3 = new Web3(provider);
        } else {
            this[blockchainName].web3 = new window.Web3(blockchainRpc);
        }
    }

    async executeContractFunction(contractName, functionName, args, blockchain) {
        const contractInstance = await this.getContractInstance(
            blockchain.name,
            contractName,
            blockchain.rpc,
        );
        const tx = await this.prepareTransaction(contractInstance, functionName, args, {
            name: blockchain.name,
            publicKey: await this.getAccount(),
        });

        return contractInstance.methods[functionName](...args).send(tx);
    }

    async getAccount() {
        if (!this.account) {
            if (!window.ethereum) {
                throw Error('This operation can be performed only by using Metamask accounts.');
            }
            const accounts = await window.ethereum
                .request({
                    method: 'eth_requestAccounts',
                })
                .catch(() => this.logger.error('There was an error fetching your accounts'));

            [this.account] = accounts;
        }
        return this.account;
    }

    async decodeEventLogs(receipt, eventName) {
        return receipt.events[eventName].returnValues;
    }

    async transferAsset(tokenId, to, blockchain) {
        return this.executeContractFunction(
            'ContentAssetStorage',
            'transferFrom',
            [await this.getAccount(), to, tokenId],
            blockchain,
        );
    }
}
module.exports = BrowserBlockchainService;

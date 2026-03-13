require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    qfcTestnet: {
      url: "https://rpc.testnet.qfc.network",
      chainId: 9000,
      // accounts: set via env PRIVATE_KEY
    },
  },
};

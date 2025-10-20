# Universal Gift Card and Voucher Payment System

This project is a privacy-preserving universal gift card and voucher payment system powered by **Zama's Fully Homomorphic Encryption technology**. Users can buy or issue NFT gift cards that represent a specific value, all while ensuring the balance is encrypted with FHE. During transactions, merchants can only verify the amount using homomorphic operations, preventing any tracking of user spending history.

## The Problem We Solve

In a digital economy, privacy is becoming increasingly rare, especially when it comes to financial transactions. Consumers are often uncomfortable with sharing their spending history, and merchants may inadvertently compromise user privacy by requiring sensitive information for payments. Traditional gift card systems fail to offer a seamless, anonymous experience, exposing users to potential privacy breaches. Additionally, the inability to track or verify transactions without compromising user data limits the effectiveness of digital gift cards.

## How FHE Provides the Solution

Utilizing **Zama's Fully Homomorphic Encryption (FHE)** technology, our project addresses these privacy concerns head-on. By leveraging Zama's open-source libraries, such as **Concrete** and the **zama-fhe SDK**, our payment system allows transactions to be executed without revealing any information about the data itself. This ensures that users can enjoy a completely private payment experience while still allowing merchants to verify the payment amount securely through homomorphic operations. 

## Core Functionalities

- **FHE-encrypted Gift Card Balance:** All gift card balances are encrypted using Fully Homomorphic Encryption, ensuring maximum privacy.
- **Homomorphic Verification:** Merchants can verify the redemption amount without knowing the details of the user's card or spending history, enhancing privacy security.
- **Anonymous Transactions:** Users can utilize gift cards anonymously, making it a convenient payment option in the Web3 ecommerce landscape.
- **Marketing and Payment Innovation:** The project introduces a new way for Web3 businesses to engage consumers with secure and private payment solutions via NFT gift cards.

## Technology Stack

- **Zama FHE SDK** (Concrete, TFHE-rs)
- **Solidity** for smart contract development
- **Node.js** for backend functionalities
- **Hardhat/Foundry** for Ethereum development
- **IPFS** for decentralized storage of NFT data

## Directory Structure

Here's a breakdown of the project structure:

```
Gift_Card_Fhe/
├── contracts/
│   ├── Gift_Card_Fhe.sol
│   
├── scripts/
│   ├── deploy.js
│   
├── test/
│   ├── GiftCardFhe.test.js
│   
├── .env
├── hardhat.config.js
├── package.json
└── README.md
```

## Installation Guide

To set up the Universal Gift Card and Voucher Payment System, follow these steps:

1. Ensure you have **Node.js** installed on your machine.
2. Install **Hardhat** or **Foundry** as your Ethereum development framework.
3. Navigate to the project directory where the files are located.
4. Run the following command to install the required dependencies, including Zama's FHE libraries:

   ```bash
   npm install
   ```

**Note:** Please avoid using `git clone` or any URLs. Ensure the project files are present in your local directory.

## Build & Run Instructions

Once the installation is complete, you can build, test, and run your project with the following commands:

### Compile the Contracts

To compile the smart contracts, run:

```bash
npx hardhat compile
```

### Test the Contracts

To run tests to ensure everything is working as expected:

```bash
npx hardhat test
```

### Deploy the Contracts

To deploy the contracts onto the selected network:

```bash
npx hardhat run scripts/deploy.js --network <network-name>
```

Replace `<network-name>` with your chosen network for deployment.

## Acknowledgements

**Powered by Zama**: We extend our heartfelt gratitude to the Zama team for their pioneering work in Fully Homomorphic Encryption technology and their open-source tools. Your innovations make confidential blockchain applications possible, empowering developers to create secure and privacy-focused solutions. 

With our Universal Gift Card and Voucher Payment System, we are paving the way for a new era of secure, anonymous payments. Join us in revolutionizing the digital payment landscape!
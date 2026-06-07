# ProofSpend

ProofSpend is a React frontend for privately recording and verifying expense proofs with a Stellar Soroban smart contract.

The original receipt is not stored on-chain. The app only sends a SHA-256 hash of the receipt data to the contract, then the user keeps a receipt JSON file for later verification.

## Contract

```text
Network     : Stellar Mainnet
Contract ID : CCOSIY3DGKKTOVJKTCIK4PVY4XZ75GMOBI256WDQRDEPIANPGOMXDC3J
Interface   : contracts/proofspend.js
```

## Features

- Connect a Stellar wallet.
- Record an expense proof to the smart contract.
- Hash receipt data in the browser before sending it to the contract.
- Download the receipt record as a JSON file.
- Upload receipt JSON to verify a proof automatically.
- Show verification results in a modal with `Verified proof` or `Verification failed` status.
- Inspect proofs by Expense ID.
- View the list of proofs owned by the currently connected wallet.

## How It Works

1. The user connects a wallet.
2. The user fills in the expense data:
   - Invoice number
   - Vendor
   - Amount
   - Date
3. The frontend creates a receipt reference from the data.
4. The receipt reference is hashed with SHA-256.
5. The hash is sent to the smart contract through the `add_expense` method.
6. After the transaction succeeds, the user downloads the receipt JSON.
7. To verify a proof, the user uploads the receipt JSON.
8. The frontend recreates the hash from the JSON and calls `verify_expense`.
9. The verification result is displayed in a modal.

## Privacy Model

ProofSpend does not store invoice number, vendor, amount, or date on the blockchain.

Only the following data is stored on-chain:

- Expense ID
- Owner wallet
- Proof hash
- Timestamp

Because of this, users must keep their receipt JSON file. If the JSON file is lost and the user no longer has the original receipt data, the proof cannot be reconstructed for verification.

## Smart Contract Methods

The contract interface is available at `contracts/proofspend.js`.

Frontend-used methods:

```text
add_expense(owner, hash)
get_expense(id)
verify_expense(id, hash)
get_user_expenses(owner)
```

## Tech Stack

- React
- Vite
- Stellar Contracts Kit
- CSS

## Setup

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Preview the production build:

```bash
npm run preview
```

## Wallet

Use a Stellar wallet supported by `stellar-contracts-kit`, such as:

- Freighter: https://freighter.app
- Cyphras: https://cyphras.com
- Lobstr: https://lobstr.co

Make sure the wallet is set to Stellar Public/Mainnet and the account is funded with mainnet XLM.

## Project Structure

```text
frontend/
  contracts/
    proofspend.js
    proofspend.example.js
  public/
  src/
    App.jsx
    App.css
    index.css
    main.jsx
  package.json
  vite.config.js
```

## Receipt JSON

After a proof is successfully recorded, the frontend creates a JSON file containing:

```text
type
version
network
contractId
expenseId
owner
txHash
proofHash
receipt
createdAt
```

This file is used to verify the proof without re-entering the invoice number, vendor, amount, and date.

## Regenerate Contract Interface

If the smart contract is upgraded, regenerate the interface with `stellar-contracts-kit`.

Example:

```bash
npx sck generate --contract CCOSIY3DGKKTOVJKTCIK4PVY4XZ75GMOBI256WDQRDEPIANPGOMXDC3J --network mainnet --js
```

<div align="center">
  <h1>🧾 ProofSpend</h1>
  <p><strong>A privacy-focused expense proof verification system powered by Stellar Soroban.</strong></p>
  <img src="https://img.shields.io/badge/Network-Stellar%20Testnet-blue" alt="Stellar Testnet" />
  <img src="https://img.shields.io/badge/Soroban-Smart%20Contract-orange" alt="Stellar Soroban" />
  <img src="https://img.shields.io/badge/Frontend-React-61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Build-Vite-646CFF" alt="Vite" />

</div>

---
## 📌 Project Description

ProofSpend is an expense recording and proof verification application designed for organizations, communities, student associations, and internal teams that need a more transparent way to manage financial records.

The application can be used to record organizational expenses, activity budgets, cash spending, reimbursement records, or other financial transactions that require proof. Instead of only storing expense data in a regular document or spreadsheet, ProofSpend creates a verifiable proof from each record using a Stellar Soroban smart contract.

ProofSpend does not store the original receipt data on the blockchain. Information such as invoice number, vendor, amount, and date is processed directly in the browser and converted into a SHA-256 hash. The generated hash is then sent to the smart contract as an immutable proof of the expense record.

The original receipt data remains stored by the user in a JSON file. This file can be used later to verify whether the expense data still matches the proof recorded on-chain.

With this approach, ProofSpend helps organizations keep expense records more accountable while still protecting the privacy of the original transaction details.

---

## 🖼️ Screenshot

![Result](frontend/src/assets/result.png)

---

## 🔗 Contract

```text
Network     : Stellar Testnet
Contract ID : CA6ICDSUSPUT3WP4BX3CE3QKLJHVG5SE2LH5B6I77743WAO5GQ5BN55Y
Interface   : contracts/proofspend.js
```

---

## ✨ Key Features

* Connect Stellar wallet.
* Record expense proof to the smart contract.
* Hash receipt data in the browser before sending it to the contract.
* Download receipt record as a JSON file.
* Upload receipt JSON to automatically verify proof.
* Show verification result in a modal with `Verified proof` or `Verification failed` status.
* Inspect proof by Expense ID.
* View the list of proofs owned by the currently connected wallet.

---

## ⚙️ How It Works

1. The user connects a Stellar wallet.
2. The user fills in the expense data:

   * Invoice number
   * Vendor
   * Amount
   * Date
3. The frontend creates a receipt reference from the data.
4. The receipt reference is hashed using SHA-256.
5. The hash is sent to the smart contract through the `add_expense` method.
6. After the transaction succeeds, the user can download the receipt JSON.
7. To verify a proof, the user uploads the receipt JSON.
8. The frontend recreates the hash from the JSON file.
9. The frontend calls the `verify_expense` method.
10. The verification result is displayed in a modal.

---

## 🔐 Privacy Model

ProofSpend does not store invoice number, vendor, amount, or date on the blockchain.

Only the following data is stored on-chain:

* Expense ID
* Owner wallet
* Proof hash
* Timestamp

With this model, the original expense data remains on the user side. The blockchain is only used to store the proof hash for verification purposes.

Because of this, users must keep their receipt JSON file safe. If the JSON file is lost and the user no longer has the original receipt data, the proof cannot be reconstructed for verification.

---

## 🧩 Smart Contract Methods

The contract interface is available at:

```text
contracts/proofspend.js
```

Frontend-used methods:

```text
add_expense(owner, hash)
get_expense(id)
verify_expense(id, hash)
get_user_expenses(owner)
```

---

## 🛠️ Tech Stack

* React
* Vite
* Stellar Contracts Kit
* Stellar Soroban
* CSS

---

## 🚀 Installation and Running the Project

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

Run lint:

```bash
npm run lint
```

Preview the production build:

```bash
npm run preview
```

---

## 👛 Wallet

Use a Stellar wallet supported by `stellar-contracts-kit`, such as:

* Freighter: https://freighter.app
* Cyphras: https://cyphras.com
* Lobstr: https://lobstr.co

Make sure the wallet is available for Stellar Testnet.

---

## 📁 Project Structure

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

---

## 📄 Receipt JSON

After a proof is successfully recorded, the frontend generates a JSON file containing:

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

---

## 🔄 Regenerate Contract Interface

If the smart contract is upgraded, regenerate the interface using `stellar-contracts-kit`.

Example command:

```bash
npx sck generate --contract CA6ICDSUSPUT3WP4BX3CE3QKLJHVG5SE2LH5B6I77743WAO5GQ5BN55Y --network testnet --js
```

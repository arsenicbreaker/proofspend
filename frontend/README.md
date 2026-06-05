# ProofSpend

ProofSpend adalah frontend React untuk menyimpan dan memverifikasi bukti pengeluaran secara private menggunakan smart contract Stellar Soroban.

Receipt asli tidak disimpan di blockchain. Aplikasi hanya mengirim hash SHA-256 dari data receipt ke contract, lalu user menyimpan file receipt JSON untuk proses verifikasi di kemudian hari.

## Contract

```text
Network     : Stellar Testnet
Contract ID : CA6ICDSUSPUT3WP4BX3CE3QKLJHVG5SE2LH5B6I77743WAO5GQ5BN55Y
Interface   : contracts/proofspend.js
```

## Fitur

- Connect wallet Stellar.
- Record expense proof ke smart contract.
- Hash receipt di browser sebelum dikirim ke contract.
- Download receipt record dalam format JSON.
- Upload receipt JSON untuk verify proof otomatis.
- Modal hasil verifikasi dengan status `Verified proof` atau `Verification failed`.
- Inspect proof berdasarkan Expense ID.
- Lihat daftar proof milik wallet yang sedang connect.

## Cara Kerja

1. User connect wallet.
2. User isi data expense:
   - Invoice number
   - Vendor
   - Amount
   - Date
3. Frontend membuat receipt reference dari data tersebut.
4. Receipt reference di-hash dengan SHA-256.
5. Hash dikirim ke smart contract lewat method `add_expense`.
6. Setelah transaksi berhasil, user download receipt JSON.
7. Untuk verify, user upload receipt JSON.
8. Frontend recreate hash dari JSON dan memanggil `verify_expense`.
9. Hasil verification ditampilkan dalam modal.

## Privacy Model

ProofSpend tidak menyimpan invoice, vendor, amount, atau date di blockchain.

Yang disimpan on-chain hanya:

- Expense ID
- Owner wallet
- Proof hash
- Timestamp

Karena itu, user harus menyimpan receipt JSON. Kalau file JSON hilang dan user lupa data receipt aslinya, proof tidak bisa direkonstruksi untuk verifikasi.

## Smart Contract Methods

Contract interface tersedia di `contracts/proofspend.js`.

Method yang dipakai frontend:

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

Jalankan development server:

```bash
npm run dev
```

Build production:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Preview build:

```bash
npm run preview
```

## Wallet

Gunakan wallet Stellar yang didukung oleh `stellar-contracts-kit`, misalnya:

- Freighter: https://freighter.app
- Cyphras: https://cyphras.com
- Lobstr: https://lobstr.co

Pastikan wallet tersedia untuk Stellar testnet.

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

Setelah proof berhasil direcord, frontend membuat file JSON berisi:

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

File ini dipakai untuk verify proof tanpa perlu mengetik ulang invoice, vendor, amount, dan date.

## Regenerate Contract Interface

Jika smart contract di-upgrade, generate ulang interface dengan `stellar-contracts-kit`.

Contoh:

```bash
npx sck generate --contract CA6ICDSUSPUT3WP4BX3CE3QKLJHVG5SE2LH5B6I77743WAO5GQ5BN55Y --network testnet --js
```

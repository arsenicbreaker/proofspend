import { useMemo, useRef, useState } from 'react'
import {
  StellarContractsKit,
  isContractKitError,
} from 'stellar-contracts-kit'
import heroImg from './assets/hero.png'
import { CONTRACT_ID } from '../contracts/proofspend.js'
import './App.css'

const NETWORK = 'testnet'
const LOGO_SRC = '/favicon.svg'

function truncateAddress(address, chars = 5) {
  if (!address) return ''
  if (address.length <= chars * 2 + 3) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function createProofHash(value) {
  const data = new TextEncoder().encode(value.trim())
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(buffer)
}

function formatError(error) {
  if (isContractKitError(error)) return error.message
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

function createReceiptReference({ invoice, vendor, amount, date }) {
  return [
    `invoice:${invoice.trim()}`,
    `vendor:${vendor.trim()}`,
    `amount:${amount.trim()}`,
    `date:${date.trim()}`,
  ].join('|')
}

const emptyReceipt = {
  invoice: '',
  vendor: '',
  amount: '',
  date: '',
}

function createReceiptRecord({ expenseId, owner, txHash, proofHash, receipt }) {
  return {
    type: 'proofspend.receipt-record',
    version: 1,
    network: NETWORK,
    contractId: CONTRACT_ID,
    expenseId: String(expenseId),
    owner,
    txHash,
    proofHash,
    receipt: {
      invoice: receipt.invoice.trim(),
      vendor: receipt.vendor.trim(),
      amount: receipt.amount.trim(),
      date: receipt.date.trim(),
    },
    createdAt: new Date().toISOString(),
  }
}

function isValidReceiptRecord(record) {
  return (
    record &&
    record.type === 'proofspend.receipt-record' &&
    record.contractId === CONTRACT_ID &&
    record.network === NETWORK &&
    record.expenseId !== undefined &&
    record.receipt &&
    ['invoice', 'vendor', 'amount', 'date'].every(
      (key) => typeof record.receipt[key] === 'string' && record.receipt[key].trim(),
    )
  )
}

function App() {
  const kit = useMemo(() => new StellarContractsKit({ network: NETWORK }), [])
  const receiptFileRef = useRef(null)
  const [address, setAddress] = useState('')
  const [walletState, setWalletState] = useState('idle')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [expenseForm, setExpenseForm] = useState(emptyReceipt)
  const [lookupId, setLookupId] = useState('')
  const [userExpenses, setUserExpenses] = useState([])
  const [selectedProof, setSelectedProof] = useState(null)
  const [latestRecord, setLatestRecord] = useState(null)
  const [verificationResult, setVerificationResult] = useState(null)
  const [selectedReceiptFile, setSelectedReceiptFile] = useState('')
  const [loadingAction, setLoadingAction] = useState('')
  const connected = Boolean(address)

  async function getContract() {
    return kit.contract(CONTRACT_ID)
  }

  async function connectWallet() {
    setWalletState('connecting')
    setError('')
    setStatus('')

    try {
      const result = await kit.connect()
      setAddress(result.address)
      setStatus('Wallet connected on Stellar testnet.')
      await refreshUserExpenses(result.address)
    } catch (connectError) {
      setError(formatError(connectError))
    } finally {
      setWalletState('idle')
    }
  }

  async function disconnectWallet() {
    setError('')
    setStatus('')

    try {
      await kit.disconnect()
    } catch (disconnectError) {
      setError(formatError(disconnectError))
    } finally {
      setAddress('')
      setUserExpenses([])
      setSelectedProof(null)
      setLatestRecord(null)
      setVerificationResult(null)
      setSelectedReceiptFile('')
    }
  }

  async function refreshUserExpenses(owner = address) {
    if (!owner) return
    setLoadingAction('refresh')
    setError('')

    try {
      const contract = await getContract()
      const { result } = await contract.get_user_expenses.read(owner)
      setUserExpenses(result ?? [])
    } catch (refreshError) {
      setError(formatError(refreshError))
    } finally {
      setLoadingAction('')
    }
  }

  async function addExpense(event) {
    event.preventDefault()
    if (!connected) {
      setError('Connect a wallet before adding an expense proof.')
      return
    }

    setLoadingAction('add')
    setError('')
    setStatus('')

    try {
      const receipt = { ...expenseForm }
      const hash = await createProofHash(createReceiptReference(receipt))
      const contract = await getContract()
      const { result, txHash } = await contract.add_expense.invoke(address, hash)
      const record = createReceiptRecord({
        expenseId: result,
        owner: address,
        txHash,
        proofHash: bytesToHex(hash),
        receipt,
      })

      setLatestRecord(record)
      setStatus(`Expense proof #${result} recorded. Tx ${truncateAddress(txHash, 6)}`)
      setExpenseForm(emptyReceipt)
      await refreshUserExpenses(address)
    } catch (addError) {
      setError(formatError(addError))
    } finally {
      setLoadingAction('')
    }
  }

  function downloadReceiptRecord(record = latestRecord) {
    if (!record) return

    const file = new Blob([`${JSON.stringify(record, null, 2)}\n`], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(file)
    const link = document.createElement('a')

    link.href = url
    link.download = `proofspend-expense-${record.expenseId}.json`
    link.click()
    URL.revokeObjectURL(url)
    setStatus(`Receipt record #${record.expenseId} downloaded.`)
  }

  async function importReceiptRecord(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setSelectedReceiptFile(file.name)
    setError('')
    setStatus('')
    setVerificationResult(null)

    try {
      const record = JSON.parse(await file.text())
      if (!isValidReceiptRecord(record)) {
        throw new Error('Invalid ProofSpend receipt record for this contract.')
      }

      setLatestRecord(record)
      await verifyReceiptRecord(record)
    } catch (importError) {
      setVerificationResult({
        state: 'failed',
        title: 'Verification failed',
        message: formatError(importError),
      })
    }
  }

  async function verifyReceiptRecord(record) {
    setLoadingAction('verify')
    setError('')
    setStatus('')

    try {
      const hash = await createProofHash(createReceiptReference(record.receipt))
      const proofHash = bytesToHex(hash)
      const contract = await getContract()
      const { result } = await contract.verify_expense.read(Number(record.expenseId), hash)
      const { result: storedProof } = await contract.get_expense.read(Number(record.expenseId))
      const storedHash = storedProof?.hash ? bytesToHex(storedProof.hash) : ''

      setVerificationResult({
        state: result ? 'verified' : 'failed',
        title: result ? 'Verified proof' : 'Verification failed',
        message: result
          ? 'Receipt JSON matches the proof stored on-chain.'
          : 'Receipt JSON does not match the proof stored on-chain.',
        record,
        proofHash,
        storedHash,
      })
    } catch (verifyError) {
      setVerificationResult({
        state: 'failed',
        title: 'Verification failed',
        message: formatError(verifyError),
        record,
      })
    } finally {
      setLoadingAction('')
    }
  }

  async function lookupExpense(event) {
    event.preventDefault()
    setLoadingAction('lookup')
    setError('')
    setStatus('')
    setSelectedProof(null)

    try {
      const contract = await getContract()
      const { result } = await contract.get_expense.read(Number(lookupId))
      setSelectedProof(result)
      setStatus(result ? `Loaded expense #${lookupId}.` : 'No expense found for that ID.')
    } catch (lookupError) {
      setError(formatError(lookupError))
    } finally {
      setLoadingAction('')
    }
  }

  async function copyAddress() {
    if (!address) return
    await navigator.clipboard.writeText(address)
    setStatus('Wallet address copied.')
  }

  const expenseReady = Object.values(expenseForm).every((value) => value.trim())
  const canAdd = connected && expenseReady && loadingAction !== 'add'
  const canLookup = lookupId !== '' && loadingAction !== 'lookup'

  return (
    <main className="app-shell">
      <header className="topbar" aria-label="ProofSpend header">
        <a className="brand" href="/" aria-label="ProofSpend home">
          <span className="brand-mark" aria-hidden="true">
            <img src={LOGO_SRC} alt="" />
          </span>
          <span>ProofSpend</span>
        </a>

        <div className="wallet-actions" aria-live="polite">
          {connected ? (
            <>
              <button type="button" className="wallet-pill" onClick={copyAddress}>
                <span className="status-dot" aria-hidden="true"></span>
                <span>{truncateAddress(address)}</span>
              </button>
              <button type="button" className="ghost-button" onClick={disconnectWallet}>
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={connectWallet}
              disabled={walletState === 'connecting'}
            >
              {walletState === 'connecting' ? 'Connecting...' : 'Connect wallet'}
            </button>
          )}
        </div>
      </header>

      <section className="hero-section" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Soroban expense verification</p>
          <h1 id="hero-title">Proofs for every spend, without leaking the receipt.</h1>
          <p className="lede">
            Add a hashed expense proof, verify a receipt later, and inspect recorded
            proof IDs from the ProofSpend testnet contract.
          </p>
          <dl className="contract-strip" aria-label="Contract details">
            <div>
              <dt>Network</dt>
              <dd>{NETWORK}</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>{truncateAddress(CONTRACT_ID, 6)}</dd>
            </div>
          </dl>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <img src={heroImg} width="170" height="179" alt="" />
          <div className="proof-card proof-card-main">
            <span>Proof hash</span>
            <strong>SHA-256</strong>
          </div>
          <div className="proof-card proof-card-sub">
            <span>Status</span>
            <strong>Verifiable</strong>
          </div>
        </div>
      </section>

      <section className="notice-region" aria-live="polite" aria-atomic="true">
        {status ? <p className="notice success">{status}</p> : null}
        {error ? <p className="notice error">{error}</p> : null}
      </section>

      <section className="workspace" aria-label="ProofSpend actions">
        <form className="panel primary-panel" onSubmit={addExpense}>
          <div className="panel-heading">
            <p className="eyebrow">Write</p>
            <h2>Add expense proof</h2>
            <p>
              Fill the receipt fields. The browser combines and hashes them before
              sending the proof to the contract.
            </p>
          </div>

          <div className="receipt-grid">
            <div className="field">
              <label htmlFor="invoice-number">Invoice number</label>
              <input
                id="invoice-number"
                type="text"
                value={expenseForm.invoice}
                onChange={(event) =>
                  setExpenseForm((form) => ({ ...form, invoice: event.target.value }))
                }
                placeholder="INV-2048"
                autoComplete="off"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="vendor-name">Vendor</label>
              <input
                id="vendor-name"
                type="text"
                value={expenseForm.vendor}
                onChange={(event) =>
                  setExpenseForm((form) => ({ ...form, vendor: event.target.value }))
                }
                placeholder="Tokopedia"
                autoComplete="organization"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="expense-amount">Amount</label>
              <input
                id="expense-amount"
                type="text"
                inputMode="decimal"
                value={expenseForm.amount}
                onChange={(event) =>
                  setExpenseForm((form) => ({ ...form, amount: event.target.value }))
                }
                placeholder="250000 IDR"
                autoComplete="off"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="expense-date">Date</label>
              <input
                id="expense-date"
                type="date"
                value={expenseForm.date}
                onChange={(event) =>
                  setExpenseForm((form) => ({ ...form, date: event.target.value }))
                }
                required
              />
            </div>
          </div>

          <button type="submit" className="primary-button" disabled={!canAdd}>
            {loadingAction === 'add' ? 'Recording...' : 'Record proof'}
          </button>

          {latestRecord ? (
            <div className="download-record">
              <div>
                <strong>Receipt record ready</strong>
                <span>Save this JSON file so you can verify later.</span>
              </div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => downloadReceiptRecord()}
              >
                Download JSON
              </button>
            </div>
          ) : null}
        </form>

        <section className="panel read-panel" aria-labelledby="verify-proof-title">
          <div className="panel-heading compact">
            <p className="eyebrow">Read</p>
            <h2 id="verify-proof-title">Verify proof</h2>
            <p>Check a saved receipt record against the ProofSpend contract.</p>
          </div>

          <div className="upload-card">
            <input
              ref={receiptFileRef}
              id="receipt-record-file"
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={importReceiptRecord}
            />
            <button
              type="button"
              className={
                selectedReceiptFile ? 'upload-dropzone is-ready' : 'upload-dropzone'
              }
              onClick={() => receiptFileRef.current?.click()}
              disabled={loadingAction === 'verify'}
            >
              <span className="upload-icon" aria-hidden="true">
                {selectedReceiptFile ? (
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M12 16V4" />
                    <path d="m7 9 5-5 5 5" />
                    <path d="M5 20h14" />
                  </svg>
                )}
              </span>
              <span className="upload-copy">
                <strong>
                  {selectedReceiptFile
                    ? selectedReceiptFile
                    : loadingAction === 'verify'
                      ? 'Verifying receipt JSON'
                      : 'Upload receipt JSON'}
                </strong>
                <span>
                  {selectedReceiptFile ? 'Ready to verify' : 'Click to choose a .json file'}
                </span>
              </span>
            </button>
            <p>Upload a saved receipt JSON to verify its proof.</p>
          </div>
        </section>

        <form className="panel inspect-panel" onSubmit={lookupExpense}>
            <div className="panel-heading compact">
              <p className="eyebrow">Inspect</p>
              <h2>Lookup expense</h2>
            </div>

            <div className="inline-field">
              <label htmlFor="lookup-id">Expense ID</label>
              <input
                id="lookup-id"
                type="number"
                min="0"
                inputMode="numeric"
                value={lookupId}
                onChange={(event) => setLookupId(event.target.value)}
                required
              />
              <button type="submit" className="secondary-button" disabled={!canLookup}>
                {loadingAction === 'lookup' ? 'Loading...' : 'Lookup'}
              </button>
            </div>

            {selectedProof ? (
              <dl className="proof-details">
                <div>
                  <dt>ID</dt>
                  <dd>{String(selectedProof.id)}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd title={selectedProof.owner}>{truncateAddress(selectedProof.owner)}</dd>
                </div>
                <div>
                  <dt>Hash</dt>
                  <dd>{bytesToHex(selectedProof.hash).slice(0, 18)}...</dd>
                </div>
              </dl>
            ) : (
              <p className="empty-copy">Lookup an ID to see owner and hash metadata.</p>
            )}
        </form>

        <aside className="panel wallet-panel" aria-labelledby="wallet-panel-title">
          <div className="panel-heading compact">
            <p className="eyebrow">Wallet</p>
            <h2 id="wallet-panel-title">Your proofs</h2>
          </div>

          {connected ? (
            <>
              <p className="address-line" title={address}>
                {truncateAddress(address, 7)}
              </p>
              <button
                type="button"
                className="secondary-button full-width"
                onClick={() => refreshUserExpenses()}
                disabled={loadingAction === 'refresh'}
              >
                {loadingAction === 'refresh' ? 'Refreshing...' : 'Refresh proofs'}
              </button>
              {userExpenses.length > 0 ? (
                <ul className="proof-list" aria-label="Recorded proof IDs">
                  {userExpenses.map((expenseId) => (
                    <li key={String(expenseId)}>
                      <span>Expense</span>
                      <strong>#{String(expenseId)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="empty-copy">No proofs recorded for this wallet yet.</p>
              )}
            </>
          ) : (
            <div className="empty-state">
              <p>Connect a Stellar wallet to record and view your expense proofs.</p>
              <a href="https://freighter.app" target="_blank" rel="noreferrer">
                Install Freighter
              </a>
            </div>
          )}
        </aside>
      </section>

      {verificationResult ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setVerificationResult(null)
          }}
        >
          <section
            className="verification-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="verification-title"
          >
            <div className="modal-heading">
              <span
                className={
                  verificationResult.state === 'verified'
                    ? 'modal-status verified'
                    : 'modal-status failed'
                }
              >
                {verificationResult.state === 'verified' ? 'Verified' : 'Not Verified'}
              </span>
              <h2 id="verification-title">{verificationResult.title}</h2>
              <p>{verificationResult.message}</p>
            </div>

            {verificationResult.record ? (
              <dl className="verification-details">
                <div>
                  <dt>Expense ID</dt>
                  <dd>{verificationResult.record.expenseId}</dd>
                </div>
                <div>
                  <dt>Invoice Number</dt>
                  <dd>{verificationResult.record.receipt.invoice}</dd>
                </div>
                <div>
                  <dt>Vendor</dt>
                  <dd>{verificationResult.record.receipt.vendor}</dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{verificationResult.record.receipt.amount}</dd>
                </div>
                <div>
                  <dt>Date</dt>
                  <dd>{verificationResult.record.receipt.date}</dd>
                </div>
                <div>
                  <dt>Proof Hash</dt>
                  <dd>{verificationResult.proofHash ?? verificationResult.record.proofHash}</dd>
                </div>
                <div>
                  <dt>Onchain Hash</dt>
                  <dd>{verificationResult.storedHash || 'Not found'}</dd>
                </div>
                <div>
                  <dt>Tx Hash</dt>
                  <dd>{verificationResult.record.txHash || 'Not included'}</dd>
                </div>
                <div>
                  <dt>Contract</dt>
                  <dd>{verificationResult.record.contractId}</dd>
                </div>
              </dl>
            ) : null}

            <button
              type="button"
              className="primary-button modal-close"
              onClick={() => setVerificationResult(null)}
            >
              Close
            </button>
          </section>
        </div>
      ) : null}
    </main>
  )
}

export default App

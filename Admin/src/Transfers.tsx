import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

type Transfer = {
  transfer_id: string
  trip_id: string
  driver_id: string
  driver_name: string | null
  transfer_amount: number | string
  transfer_status: 'pending' | 'transferred' | 'failed' | 'reversed'
  stripe_transfer_id: string | null
  trip_status: string | null
  payment_status: string | null
  created_at: string
  transferred_at: string | null
  processing_started_at: string | null
}

type StatusFilter = 'all' | Transfer['transfer_status']

function formatMoney(value: number | string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value))
}

function formatDate(value: string | null) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString()
}

function TransferStatus({ status }: { status: Transfer['transfer_status'] }) {
  const labels: Record<Transfer['transfer_status'], string> = {
    pending: 'Pending',
    transferred: 'Transferred',
    failed: 'Failed',
    reversed: 'Reversed',
  }

  return (
    <span className={`transfer-status transfer-status-${status}`}>
      {labels[status]}
    </span>
  )
}

function isProcessingClaimActive(value: string | null) {
  if (!value) return false

  const startedAt = new Date(value).getTime()

  // Treat an invalid timestamp conservatively as an active claim.
  if (!Number.isFinite(startedAt)) return true

  return Date.now() - startedAt < 5 * 60 * 1000
}

function Transfers() {
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [retryingTripId, setRetryingTripId] = useState<string | null>(null)
  const [retryMessage, setRetryMessage] = useState('')  

  async function loadTransfers() {
    const { data, error } = await supabase.rpc('admin_get_transfers')

    if (error) {
      setError(`Could not load transfers: ${error.message}`)
      setLoading(false)
      return
    }

    setTransfers((data ?? []) as Transfer[])
    setError('')
    setLoading(false)
  }

  async function handleRetryTransfer(tripID: string) {
    setRetryingTripId(tripID)
    setRetryMessage('')
    setError('')

    const { data, error } = await supabase.functions.invoke(
      'transfer-trip-admin',
      {
        body: { tripID },
      },
    )

    if (error) {
      setRetryMessage(`Transfer retry failed: ${error.message}`)
    } else if (data?.error) {
      setRetryMessage(`Transfer retry failed: ${data.error}`)
    } else {
      setRetryMessage(
        data?.alreadyTransferred
          ? 'This transfer was already completed.'
          : 'Transfer completed successfully.',
      )
    }

    await loadTransfers()
    setRetryingTripId(null)
  }

  useEffect(() => {
    let cancelled = false

    void supabase.rpc('admin_get_transfers').then(({ data, error }) => {
      if (cancelled) return

      if (error) {
        setError(`Could not load transfers: ${error.message}`)
      } else {
        setTransfers((data ?? []) as Transfer[])
      }

      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const filteredTransfers = transfers.filter(
    (transfer) => filter === 'all' || transfer.transfer_status === filter,
  )

  const pendingCount = transfers.filter(
    (transfer) => transfer.transfer_status === 'pending',
  ).length

  const failedCount = transfers.filter(
    (transfer) => transfer.transfer_status === 'failed',
  ).length

  const transferredCount = transfers.filter(
    (transfer) => transfer.transfer_status === 'transferred',
  ).length

  const transferredTotal = transfers
    .filter((transfer) => transfer.transfer_status === 'transferred')
    .reduce(
      (total, transfer) => total + Number(transfer.transfer_amount),
      0,
    )

  return (
    <>
      <section className="welcome">
        <p className="eyebrow">PAYMENTS</p>
        <h1>Driver Transfers</h1>
        <p>Monitor transfers from Laster to driver Stripe accounts.</p>
      </section>

      <section className="summary-row transfer-summary">
        <div className="summary-card">
          <span>Pending transfers</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="summary-card">
          <span>Failed transfers</span>
          <strong>{failedCount}</strong>
        </div>
        <div className="summary-card">
          <span>Successfully transferred</span>
          <strong>{transferredCount}</strong>
        </div>
        <div className="summary-card">
          <span>Total transferred</span>
          <strong>{formatMoney(transferredTotal)}</strong>
        </div>
      </section>

      <section className="transfer-workspace">
        <div className="transfer-panel">
          <div className="transfer-panel-heading">
            <div>
              <h2>Transfer history</h2>
              <span>{filteredTransfers.length} records</span>
            </div>

            <div className="transfer-controls">
              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as StatusFilter)
                }
                aria-label="Filter transfers by status"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="transferred">Transferred</option>
                <option value="reversed">Reversed</option>
              </select>

              <button
                className="refresh-button"
                onClick={() => {
                setLoading(true)
                setError('')
                void loadTransfers()
                }}
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {error && <div className="transfer-error">{error}</div>}

          {retryMessage && (
            <div
              className={
                retryMessage.includes('successfully') ||
                retryMessage.includes('already completed')
                  ? 'transfer-success'
                  : 'transfer-error'
              }
            >
              {retryMessage}
            </div>
          )}          

          {loading ? (
            <p className="empty-state">Loading transfers...</p>
          ) : filteredTransfers.length === 0 ? (
            <p className="empty-state">
              {transfers.length === 0
                ? 'No transfers found.'
                : 'No transfers match this status.'}
            </p>
          ) : (
            <div className="transfer-table-wrapper">
              <table className="transfer-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Driver</th>
                    <th>Trip</th>
                    <th>Amount</th>
                    <th>Trip status</th>
                    <th>Created</th>
                    <th>Transferred</th>
                    <th>Stripe transfer ID</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransfers.map((transfer) => (
                    <tr key={transfer.transfer_id}>
                      <td>
                        <TransferStatus status={transfer.transfer_status} />
                        {transfer.processing_started_at && (
                          <span className="processing-note">
                            Processing claimed
                          </span>
                        )}
                      </td>
                      <td>
                        <strong>{transfer.driver_name || 'Unknown driver'}</strong>
                        <span className="table-subtext">
                          {transfer.driver_id}
                        </span>
                      </td>
                      <td>
                        <strong>{transfer.trip_id}</strong>
                        <span className="table-subtext">
                          Payment: {transfer.payment_status || '—'}
                        </span>
                      </td>
                      <td className="amount-cell">
                        {formatMoney(transfer.transfer_amount)}
                      </td>
                      <td>{transfer.trip_status || '—'}</td>
                      <td>{formatDate(transfer.created_at)}</td>
                      <td>{formatDate(transfer.transferred_at)}</td>
                      <td className="stripe-id">
                        {transfer.stripe_transfer_id || '—'}
                      </td>
                      <td>
                        {transfer.transfer_status === 'pending' ? (
                          <button
                            className="refresh-button"
                            onClick={() =>
                              void handleRetryTransfer(transfer.trip_id)
                            }
                            disabled={
                              retryingTripId !== null ||
                              isProcessingClaimActive(
                                transfer.processing_started_at,
                              )
                            }
                          >
                            {retryingTripId === transfer.trip_id
                              ? 'Retrying...'
                              : 'Retry'}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>                      
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  )
}

export default Transfers

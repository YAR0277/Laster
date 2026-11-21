import type { User } from '@supabase/supabase-js'
import { useEffect, useState, type SyntheticEvent } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import Transfers from './Transfers'

type AdminStatus = 'checking' | 'allowed' | 'denied' | 'error'

type Driver = {
  driver_id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  make: string
  model: string
  year: string
  license_number: string
  license_state: string
  date_of_birth: string
  insurance_policy: string
  insurance_company: string
  insurance_expiration_date: string
  license_expiration_date: string
  vin_number: string
  rating: number | null
  number_of_ratings: number
  number_of_trips: number
  is_available: boolean
  license_status: boolean
  insurance_status: boolean
  payout_status: boolean
  account_status: boolean
}

type DocumentType = 'license' | 'insurance'

function Status({ approved }: { approved: boolean }) {
  return (
    <span className={`status ${approved ? 'status-approved' : 'status-pending'}`}>
      {approved ? 'Approved' : 'Not approved'}
    </span>
  )
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value === null || value === undefined || value === '' ? '—' : value}</strong>
    </div>
  )
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [adminCheck, setAdminCheck] = useState<{
    userId: string
    status: AdminStatus
  } | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [driversLoading, setDriversLoading] = useState(true)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'drivers' | 'transfers'>('drivers')

  // Restore the browser session and listen for authentication changes.
  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return

      if (error) {
        setMessage(error.message)
      }

      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Verify administrator membership on the server.
  useEffect(() => {
    if (!user) return

    let cancelled = false

    async function verifyAdmin() {
      const { data, error } = await supabase.rpc('is_admin')

      if (cancelled) return

      if (error) {
        setAdminCheck({ userId: user!.id, status: 'error' })
        setMessage(`Administrator verification failed: ${error.message}`)
        await supabase.auth.signOut()
        return
      }

      if (data !== true) {
        setAdminCheck({ userId: user!.id, status: 'denied' })
        setMessage('This account is not authorized to access Laster Admin.')
        await supabase.auth.signOut()
        return
      }

      setAdminCheck({ userId: user!.id, status: 'allowed' })
      setMessage('')
    }

    void verifyAdmin()

    return () => {
      cancelled = true
    }
  }, [user])

  // Load driver records only after administrator access is confirmed.
  async function loadDrivers() {
    setDriversLoading(true)
    setMessage('')

    const { data, error } = await supabase.rpc('admin_get_drivers')

    if (error) {
      setMessage(`Could not load drivers: ${error.message}`)
      setDriversLoading(false)
      return
    }

    setDrivers((data ?? []) as Driver[])
    setDriversLoading(false)
  }

  useEffect(() => {
    if (
      !user ||
      adminCheck?.userId !== user.id ||
      adminCheck.status !== 'allowed'
    ) {
      return
    }

    let cancelled = false

    async function fetchDrivers() {
      const { data, error } = await supabase.rpc('admin_get_drivers')

      if (cancelled) return

      if (error) {
        setMessage(`Could not load drivers: ${error.message}`)
      } else {
        setDrivers((data ?? []) as Driver[])
      }

      setDriversLoading(false)
    }

    void fetchDrivers()

    return () => {
      cancelled = true
    }
  }, [user, adminCheck])

  async function handleStatusChange(
    driverId: string,
    document: DocumentType,
    approved: boolean,
  ) {
    const operation = `${driverId}:${document}`
    setUpdating(operation)
    setMessage('')

    const { error } = await supabase.rpc(
      'admin_set_driver_document_status',
      {
        p_driver_id: driverId,
        p_document: document,
        p_approved: approved,
      },
    )

    if (error) {
      setMessage(`Could not update ${document} status: ${error.message}`)
      setUpdating(null)
      return
    }

    await loadDrivers()
    setUpdating(null)
  }

  async function handleLogin(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault()

    setSubmitting(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setMessage(error.message)
    }

    setSubmitting(false)
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setMessage(error.message)
    }

    setPassword('')
    setEmail('')
    setDrivers([])
    setSelectedDriverId(null)
  }

  const filteredDrivers = drivers.filter((driver) => {
    const term = search.trim().toLowerCase()

    if (!term) return true

    return [
      driver.first_name,
      driver.last_name,
      driver.email,
      driver.phone,
      driver.make,
      driver.model,
    ].some((value) => value?.toLowerCase().includes(term))
  })

  const selectedDriver =
    filteredDrivers.find((driver) => driver.driver_id === selectedDriverId) ??
    filteredDrivers[0] ??
    null

  const approvedCount = drivers.filter(
    (driver) => driver.account_status,
  ).length

  const pendingCount = drivers.length - approvedCount

  if (authLoading) {
    return (
      <main className="page">
        <div className="loading">Loading Laster Admin...</div>
      </main>
    )
  }

  if (user && (
    adminCheck?.userId !== user.id ||
    adminCheck.status !== 'allowed'
  )) {
    return (
      <main className="page">
        <div className="loading">
          {adminCheck?.userId === user.id
            ? message || 'Access denied.'
            : 'Verifying administrator access...'}
        </div>
      </main>
    )
  }

  if (user && adminCheck?.userId === user.id && adminCheck.status === 'allowed') {
    return (
      <main className="dashboard">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">L</span>
            <span>Laster <strong>Admin</strong></span>
          </div>

          <div className="account">
            <span>{user.email}</span>
            <button className="secondary-button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </header>

        <nav className="admin-navigation">
          <button
            className={activeSection === 'drivers' ? 'active' : ''}
            onClick={() => setActiveSection('drivers')}
          >
            Driver Verification
          </button>

          <button
            className={activeSection === 'transfers' ? 'active' : ''}
            onClick={() => setActiveSection('transfers')}
          >
            Transfers
          </button>
        </nav>

        {activeSection === 'drivers' ? (
          <>
            <section className="welcome">
              <p className="eyebrow">ADMINISTRATION</p>
              <h1>Driver Verification</h1>
              <p>Review driver information and manage verification status.</p>
            </section>

            <section className="summary-row">
              <div className="summary-card">
                <span>Total drivers</span>
                <strong>{drivers.length}</strong>
              </div>
              <div className="summary-card">
                <span>Approved accounts</span>
                <strong>{approvedCount}</strong>
              </div>
              <div className="summary-card">
                <span>Not yet approved</span>
                <strong>{pendingCount}</strong>
              </div>
            </section>

            {message && <div className="dashboard-message">{message}</div>}

            <section className="driver-workspace">
              <aside className="driver-list-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Drivers</h2>
                    <span>{drivers.length} registered</span>
                  </div>
                  <button
                    className="refresh-button"
                    onClick={loadDrivers}
                    disabled={driversLoading}
                    title="Refresh driver list"
                  >
                    {driversLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>

                <input
                  className="driver-search"
                  type="search"
                  placeholder="Search drivers..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />

                {driversLoading ? (
                  <p className="empty-state">Loading drivers...</p>
                ) : filteredDrivers.length === 0 ? (
                  <p className="empty-state">
                    {drivers.length === 0
                      ? 'No drivers found.'
                      : 'No matching drivers.'}
                  </p>
                ) : (
                  <div className="driver-list">
                    {filteredDrivers.map((driver) => (
                      <button
                        key={driver.driver_id}
                        className={`driver-list-item ${
                          selectedDriver?.driver_id === driver.driver_id
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => setSelectedDriverId(driver.driver_id)}
                      >
                        <span className="driver-avatar">
                          {driver.first_name?.charAt(0)}
                          {driver.last_name?.charAt(0)}
                        </span>
                        <span className="driver-list-info">
                          <strong>{driver.first_name} {driver.last_name}</strong>
                          <span>{driver.make} {driver.model} ({driver.year})</span>
                        </span>
                        <span
                          className={`list-indicator ${
                            driver.account_status ? 'indicator-approved' : ''
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                )}
              </aside>

              <section className="driver-detail-panel">
                {!selectedDriver ? (
                  <div className="empty-detail">
                    <h2>Select a driver</h2>
                    <p>Choose a driver from the list to review their information.</p>
                  </div>
                ) : (
                  <>
                    <div className="detail-header">
                      <div>
                        <p className="eyebrow">DRIVER PROFILE</p>
                        <h2>
                          {selectedDriver.first_name} {selectedDriver.last_name}
                        </h2>
                        <p>{selectedDriver.email}</p>
                      </div>
                      <div className="account-status">
                        <span>Account status</span>
                        <Status approved={selectedDriver.account_status} />
                      </div>
                    </div>

                    <div className="detail-section">
                      <h3>Personal information</h3>
                      <div className="detail-grid">
                        <Detail label="First name" value={selectedDriver.first_name} />
                        <Detail label="Last name" value={selectedDriver.last_name} />
                        <Detail label="Email" value={selectedDriver.email} />
                        <Detail label="Phone" value={selectedDriver.phone} />
                        <Detail label="Date of birth" value={selectedDriver.date_of_birth} />
                      </div>
                    </div>

                    <div className="detail-section">
                      <h3>Vehicle information</h3>
                      <div className="detail-grid">
                        <Detail
                          label="Vehicle"
                          value={`${selectedDriver.year} ${selectedDriver.make} ${selectedDriver.model}`}
                        />
                        <Detail label="VIN" value={selectedDriver.vin_number} />
                        <Detail label="Trips completed" value={selectedDriver.number_of_trips} />
                        <Detail label="Rating" value={selectedDriver.rating} />
                        <Detail label="Availability" value={selectedDriver.is_available ? 'Available' : 'Unavailable'} />
                      </div>
                    </div>

                    <div className="detail-section verification-section">
                      <div className="verification-heading">
                        <h3>Driver's license</h3>
                        <Status approved={selectedDriver.license_status} />
                      </div>
                      <div className="detail-grid">
                        <Detail label="License number" value={selectedDriver.license_number} />
                        <Detail label="Issuing state" value={selectedDriver.license_state} />
                        <Detail label="Expiration date" value={selectedDriver.license_expiration_date} />
                      </div>
                      <div className="verification-actions">
                        <button
                          className="approve-button"
                          disabled={
                            updating !== null ||
                            selectedDriver.license_status
                          }
                          onClick={() =>
                            void handleStatusChange(
                              selectedDriver.driver_id,
                              'license',
                              true,
                            )
                          }
                        >
                          Approve license
                        </button>
                        <button
                          className="reject-button"
                          disabled={
                            updating !== null ||
                            !selectedDriver.license_status
                          }
                          onClick={() =>
                            void handleStatusChange(
                              selectedDriver.driver_id,
                              'license',
                              false,
                            )
                          }
                        >
                          Mark not approved
                        </button>
                      </div>
                    </div>

                    <div className="detail-section verification-section">
                      <div className="verification-heading">
                        <h3>Insurance information</h3>
                        <Status approved={selectedDriver.insurance_status} />
                      </div>
                      <div className="detail-grid">
                        <Detail label="Insurance company" value={selectedDriver.insurance_company} />
                        <Detail label="Policy number" value={selectedDriver.insurance_policy} />
                        <Detail label="Expiration date" value={selectedDriver.insurance_expiration_date} />
                      </div>
                      <div className="verification-actions">
                        <button
                          className="approve-button"
                          disabled={
                            updating !== null ||
                            selectedDriver.insurance_status
                          }
                          onClick={() =>
                            void handleStatusChange(
                              selectedDriver.driver_id,
                              'insurance',
                              true,
                            )
                          }
                        >
                          Approve insurance
                        </button>
                        <button
                          className="reject-button"
                          disabled={
                            updating !== null ||
                            !selectedDriver.insurance_status
                          }
                          onClick={() =>
                            void handleStatusChange(
                              selectedDriver.driver_id,
                              'insurance',
                              false,
                            )
                          }
                        >
                          Mark not approved
                        </button>
                      </div>
                    </div>

                    <div className="detail-section payout-status-section">
                      <h3>Payout verification status</h3>
                      <div className="status-row">
                        <span>Payout verification</span>
                        <Status approved={selectedDriver.payout_status} />
                      </div>
                      <p className="status-note">
                        Payout status is managed by Stripe. Overall account status
                        is calculated automatically from license, insurance, and
                        payout verification.
                      </p>
                    </div>
                  </>
                )}
              </section>
            </section>
          </>
        ) : (
          <Transfers />
        )}
      </main>
    )
  }

  return (
    <main className="page">
      <section className="login-card">
        <div className="brand login-brand">
          <span className="brand-mark">L</span>
          <span>Laster <strong>Admin</strong></span>
        </div>

        <div className="login-heading">
          <h1>Welcome back</h1>
          <p>Sign in to access the administration portal.</p>
        </div>

        <form onSubmit={handleLogin}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@laster.com"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter your password"
            required
          />

          {message && <p className="error-message">{message}</p>}

          <button
            className="primary-button"
            type="submit"
            disabled={submitting}
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="login-footer">
          Authorized administrators only
        </p>
      </section>
    </main>
  )
}

export default App

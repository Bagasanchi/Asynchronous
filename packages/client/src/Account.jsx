import React, { useState } from 'react'

export function Account({ username, submit, busy }) {
  const [mode, setMode] = useState(null)
  const [error, setError] = useState('')
  function open(next) {
    setMode(next)
    setError('')
  }
  async function send(action, values) {
    setError('')
    try {
      await submit(action, values)
      open(null)
    } catch (e) {
      setError(e.message)
    }
  }
  return (
    <section className="account" aria-label="Player account">
      {username ? (
        <div className="actions">
          <span>
            Signed in as <strong>{username}</strong>
          </span>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => send('logout', {})}
          >
            Log out
          </button>
        </div>
      ) : (
        <div className="actions">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => open('login')}
          >
            Log in
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => open('signup')}
          >
            Sign up
          </button>
        </div>
      )}
      {mode && !username && (
        <form
          key={mode}
          onSubmit={(e) => {
            e.preventDefault()
            const data = new FormData(e.currentTarget)
            send(mode, Object.fromEntries(data))
          }}
        >
          <h2>
            {mode === 'signup' ? 'Create an account' : 'Log in to your account'}
          </h2>
          <p>
            {mode === 'signup'
              ? 'Save your current seats and play on another device. Keep your username and password in a safe place.'
              : 'Open your saved matches. Guest matches on this browser will be available again when you log out.'}
          </p>
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              pattern="[a-zA-Z0-9_]{3,24}"
              title="3–24 letters, numbers or underscores"
              maxLength={24}
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              minLength={12}
              maxLength={128}
              required
            />
          </label>
          {mode === 'signup' && <p>Use at least 12 characters.</p>}
          <div className="actions">
            <button disabled={busy}>
              {mode === 'signup' ? 'Create account' : 'Continue'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => open(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}

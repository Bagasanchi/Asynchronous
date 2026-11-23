import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './solo.css'
import './table.css'

async function api(path, body) {
  const response = await fetch(
    '/api/' + path,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  )
  const result = await response.json()
  if (!response.ok) throw Error(result.error || 'Could not load the table.')
  return result
}
function label(m) {
  if (m.status === 'waiting') return 'Waiting for a friend'
  if (m.status === 'active')
    return m.seat === m.turnSeat ? 'Your turn' : 'Partner’s turn'
  return m.status === 'victory' ? 'Victory' : 'Defeat'
}
function Table({ route }) {
  const [, view, id] = /^#(match|join)\/([a-f0-9-]{36})$/.exec(route) || []
  const [lobby, setLobby] = useState(null),
    [match, setMatch] = useState(null)
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('')
  const [retry, setRetry] = useState(0)
  function accept(next) {
    setMatch((old) => (!old || next.revision >= old.revision ? next : old))
  }
  useEffect(() => {
    let active = true,
      pending = false
    async function refresh() {
      if (pending) return
      pending = true
      try {
        const session = await api('session')
        if (!active) return
        setLobby(session)
        if (view === 'match') {
          const next = await api('matches/' + id)
          if (active) accept(next)
        }
      } catch (e) {
        if (active) setError(e.message)
      } finally {
        pending = false
      }
    }
    refresh()
    const timer = setInterval(() => {
      if (!document.hidden) refresh()
    }, 8000)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [retry])
  async function act(fn) {
    if (busy) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(e.message)
      setRetry((x) => x + 1)
    } finally {
      setBusy(false)
    }
  }
  const createIds = React.useRef({})
  function create(mode) {
    return act(async () => {
      const requestId = (createIds.current[mode] ||= crypto.randomUUID())
      const m = await api('matches', { mode, requestId })
      location.hash = 'match/' + m.id
    })
  }
  function move(action, cardId) {
    return act(async () =>
      accept(
        await api('matches/' + id + '/move', {
          action,
          cardId,
          revision: match.revision,
        }),
      ),
    )
  }
  const invite = location.origin + '/#join/' + id
  async function togglePush() {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (lobby.subscribed) {
      await api('notifications', { subscription: null })
      if (sub) await sub.unsubscribe()
    } else {
      const key = Uint8Array.from(
        atob(lobby.pushKey.replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      )
      sub ||= await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      })
      await api('notifications', { subscription: sub })
    }
    setLobby(await api('session'))
  }
  const b = match?.board,
    playing = match?.status === 'active' && match.seat === match.turnSeat
  return (
    <main>
      <header>
        <h1>Asynchronous</h1>
        {view && <a href="#">Lobby</a>}
      </header>
      {error && (
        <p role="alert">
          {error}{' '}
          <button
            onClick={() => {
              setError('')
              setRetry((x) => x + 1)
            }}
          >
            Refresh
          </button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!lobby ? (
        <p>Loading your table…</p>
      ) : view === 'join' ? (
        <section className="arena">
          <small>Friend invitation</small>
          <h2>Take the second seat</h2>
          <p>
            You and a friend share a fighter. Return in this browser when it’s
            your turn.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                await api('matches/' + id + '/join', {})
                location.hash = 'match/' + id
              })
            }
          >
            Join match
          </button>
        </section>
      ) : !view ? (
        <>
          <section className="arena">
            <small>Cooperative card game</small>
            <h2>One fighter. Two players.</h2>
            <p>
              Take turns playing cards against the Cultist. Spend energy to
              attack or block, then hand the next turn to your friend. Your
              board is saved after every move.
            </p>
            <div className="actions">
              <button disabled={busy} onClick={() => create('duo')}>
                Invite a friend
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => create('solo')}
              >
                Play solo
              </button>
            </div>
          </section>
          <h2>Your matches</h2>
          {lobby.matches.length === 0 ? (
            <p>
              Start a match above. Return in this browser to pick up where you
              left off.
            </p>
          ) : (
            <ul className="matches">
              {lobby.matches.map((m) => (
                <li key={m.id}>
                  <a href={'#match/' + m.id}>
                    <b>{m.mode === 'duo' ? 'Co-op' : 'Solo'} · Cultist</b>
                    <span>
                      {label(m)} · {new Date(m.updated).toLocaleString()}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : !match ? (
        <p>Opening match…</p>
      ) : match.status === 'waiting' ? (
        <section className="arena">
          <small>Co-op encounter</small>
          <h2>Invite your partner</h2>
          <p>
            Send this private link to one friend. You take the first turn once
            they join.
          </p>
          <label>
            Invitation link
            <input readOnly value={invite} onFocus={(e) => e.target.select()} />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              act(async () => {
                await navigator.clipboard.writeText(invite)
                setNotice('Link copied.')
              })
            }
          >
            Copy invitation
          </button>
        </section>
      ) : (
        <>
          <section className="arena">
            <small>
              {match.mode === 'solo' ? 'Solo' : 'Co-op'} · Turn {b.turn} ·{' '}
              {label(match)}
            </small>
            <h2>{match.status === 'active' ? 'Cultist' : label(match)}</h2>
            {match.status === 'active' ? (
              <>
                <p>
                  {b.enemyHealth} health · Next move · {b.intent}
                </p>
                {b.buffs.map((buff) => (
                  <span className="buff" key={buff.type}>
                    {buff.type} {buff.stacks}
                  </span>
                ))}
              </>
            ) : (
              <p>
                {match.status === 'victory'
                  ? 'The Cultist falls. You won the encounter.'
                  : 'Your fighter fell in battle.'}{' '}
                <a href="#">Return to lobby</a>
              </p>
            )}
          </section>
          <div className="row">
            <h2>Ironclad</h2>
            {playing && (
              <button disabled={busy} onClick={() => move('end')}>
                End turn
              </button>
            )}
          </div>
          <p className="stats">
            {b.health} health · {b.block} block · {b.energy} energy
          </p>
          {match.status === 'active' && (
            <>
              <h3>Shared hand</h3>
              <div className="hand">
                {b.hand.map((card) => (
                  <button
                    key={card.id}
                    className={'card ' + card.type}
                    disabled={!playing || busy || card.cost > b.energy}
                    onClick={() => move('card', card.id)}
                  >
                    <small>
                      {card.type} · {card.cost} energy
                    </small>
                    <strong>{card.name}</strong>
                    <span>{card.description}</span>
                  </button>
                ))}
              </div>
              <p>
                Draw pile {b.deck} · Discard pile {b.discard}
              </p>
            </>
          )}
          <details>
            <summary>Combat log</summary>
            <ol>
              {b.log.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </details>
        </>
      )}
      {lobby?.pushKey &&
        'serviceWorker' in navigator &&
        'PushManager' in window && (
          <footer>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => act(togglePush)}
            >
              {lobby.subscribed ? 'Disable' : 'Enable'} turn notifications
            </button>
          </footer>
        )}
    </main>
  )
}
function App() {
  const [route, setRoute] = useState(location.hash)
  useEffect(() => {
    const update = () => setRoute(location.hash)
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return <Table key={route} route={route} />
}
createRoot(document.getElementById('root')).render(<App />)

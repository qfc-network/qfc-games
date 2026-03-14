import { portalGames, casinoGames, recentBets, riskLimits, walletSummary } from '../data'
import { getWalletSession, formatConnectedAt } from '../session'

function statusLabel(status: string): string {
  switch (status) {
    case 'live':
      return 'Live'
    case 'beta':
      return 'Beta'
    case 'staging':
      return 'Staging'
    default:
      return 'Coming Soon'
  }
}

function statusClass(status: string): string {
  switch (status) {
    case 'live':
      return 'status-live'
    case 'beta':
      return 'status-staging'
    case 'staging':
      return 'status-staging'
    default:
      return 'status-coming-soon'
  }
}

function resultClass(result: string): string {
  switch (result) {
    case 'win':
      return 'is-win'
    case 'loss':
      return 'is-loss'
    default:
      return 'is-pending'
  }
}

function formatPlayerCount(count: number): string {
  if (count === 0) return '--'
  if (count >= 1000) return (count / 1000).toFixed(1) + 'k'
  return count.toLocaleString()
}

function simulatePlayerCounts(): void {
  document.querySelectorAll('[data-player-count]').forEach((el) => {
    const base = parseInt((el as HTMLElement).dataset.playerCount || '0', 10)
    if (base === 0) return
    const drift = Math.floor(Math.random() * 40) - 20
    const current = Math.max(0, base + drift)
    el.textContent = formatPlayerCount(current) + ' online'
  })
}

export function renderHome(container: HTMLElement) {
  const session = getWalletSession()
  const totalPlayers = portalGames.reduce((sum, g) => sum + g.playerCount, 0)

  container.innerHTML = `
    <section class="hero-shell page-content">
      <div class="hero-copy">
        <span class="eyebrow">QFC Games Portal</span>
        <h1 class="hero-title">Four worlds, one wallet, endless play.</h1>
        <p class="hero-subtitle">
          Dungeon crawling, card battles, pet training, and office tycoon -- all connected through a
          shared wallet session, unified leaderboards, and cross-game rewards.
        </p>
        <div class="hero-actions">
          <a class="primary-cta" href="#games">Browse games</a>
          <a class="secondary-cta" href="#/leaderboard">Leaderboards</a>
          <a class="secondary-cta" href="#/news">Latest news</a>
        </div>
        <div class="portal-stats-row">
          <div class="portal-stat"><strong>${formatPlayerCount(totalPlayers)}</strong><span>players online</span></div>
          <div class="portal-stat"><strong>${portalGames.filter(g => g.status === 'live').length}</strong><span>games live</span></div>
          <div class="portal-stat"><strong>${portalGames.length}</strong><span>total titles</span></div>
        </div>
      </div>
      <aside class="session-card">
        <div class="session-card-header">
          <span>Wallet session</span>
          <span class="network-pill">QFC Testnet</span>
        </div>
        ${session ? `
          <div class="wallet-address">${session.address}</div>
          <div class="session-meta">Connected ${formatConnectedAt(session.connectedAt)}</div>
          <div class="wallet-stats-grid">
            <div><strong>${walletSummary.balance}</strong><span>Total balance</span></div>
            <div><strong>${walletSummary.available}</strong><span>Available</span></div>
            <div><strong>${walletSummary.pending}</strong><span>Pending settle</span></div>
          </div>
        ` : `
          <div class="empty-session-state">
            <strong>No wallet connected</strong>
            <p>Connect once and keep the same session across Dungeon, Cards, Pets, and Office.</p>
          </div>
        `}
      </aside>
    </section>

    <section id="games" class="page-content section-stack">
      <div class="section-head">
        <div>
          <span class="eyebrow">Game portal</span>
          <h2>Choose your game</h2>
        </div>
        <p class="section-copy">Jump into any title. Your wallet and progress follow you everywhere.</p>
      </div>
      <div class="games-grid portal-grid">
        ${portalGames.map((game) => `
          <article class="game-card portal-card" style="--accent: ${game.accent}">
            <div class="card-header">
              <span class="card-emoji">${game.emoji}</span>
              <span class="${statusClass(game.status)}" style="padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.08);text-transform:uppercase;letter-spacing:0.08em;font-size:0.74em">${statusLabel(game.status)}</span>
            </div>
            <h3>${game.name}</h3>
            <p class="card-tagline">${game.tagline}</p>
            <p class="card-desc">${game.desc}</p>
            <div class="game-metrics">
              <div><span>Genre</span><strong>${game.genre}</strong></div>
              <div><span>Players</span><strong class="player-count-value" data-player-count="${game.playerCount}">${formatPlayerCount(game.playerCount)}${game.playerCount > 0 ? ' online' : ''}</strong></div>
            </div>
            <div class="card-actions">
              <a class="play-btn" href="${game.href}">${game.status === 'coming-soon' ? 'Coming Soon' : 'Play ' + game.name.replace('QFC ', '')}</a>
              <span class="proof-hint">${game.genre}</span>
            </div>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="risk-banner page-content">
      <div>
        <span class="eyebrow">Platform controls</span>
        <h2>Testnet guardrails are active</h2>
        <p>Limits are shared across all games to reduce abuse and simplify operator controls.</p>
      </div>
      <div class="risk-grid">
        <div class="risk-pill"><span>Per bet</span><strong>${riskLimits.perBet}</strong></div>
        <div class="risk-pill"><span>Daily loss cap</span><strong>${riskLimits.dailyLoss}</strong></div>
        <div class="risk-pill"><span>Idle lock</span><strong>${riskLimits.sessionTimeout}</strong></div>
        <div class="risk-pill"><span>Throttle</span><strong>${riskLimits.throttle}</strong></div>
      </div>
    </section>

    <section class="page-content section-stack">
      <div class="section-head">
        <div>
          <span class="eyebrow">Casino tables</span>
          <h2>Quick-play casino</h2>
        </div>
        <p class="section-copy">Classic casino games with provable fairness.</p>
      </div>
      <div class="games-grid casino-grid">
        ${casinoGames.map((game) => `
          <article class="game-card casino-card" style="--accent: ${game.accent}">
            <div class="card-header">
              <span class="card-emoji">${game.emoji}</span>
              <span class="status-chip status-${game.status}">${statusLabel(game.status)}</span>
            </div>
            <h3>${game.name}</h3>
            <p class="card-desc">${game.desc}</p>
            <div class="game-metrics">
              <div><span>Min</span><strong>${game.minBet}</strong></div>
              <div><span>Max</span><strong>${game.maxBet}</strong></div>
              <div><span>RTP</span><strong>${game.rtp}</strong></div>
            </div>
            <div class="card-actions">
              <a class="play-btn" href="${game.href}">Open ${game.name}</a>
              <span class="proof-hint">Provable fairness enabled</span>
            </div>
          </article>
        `).join('')}
      </div>
    </section>

    <section class="page-content section-stack two-column-layout">
      <div>
        <div class="section-head compact">
          <div>
            <span class="eyebrow">Recent activity</span>
            <h2>Recent bets / history</h2>
          </div>
        </div>
        <div class="history-list">
          ${recentBets.map((bet) => `
            <div class="history-row">
              <div>
                <div class="history-game">${bet.game.toUpperCase()}</div>
                <div class="history-label">${bet.label}</div>
              </div>
              <div class="history-meta">
                <span>${bet.amount}</span>
                <strong class="${resultClass(bet.result)}">${bet.payout}</strong>
                <small>${bet.proof} · ${bet.time}</small>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div>
        <div class="section-head compact">
          <div>
            <span class="eyebrow">Portal architecture</span>
            <h2>Unified session rules</h2>
          </div>
        </div>
        <div class="info-panel">
          <ul>
            <li>Single wallet session persists across Dungeon, Cards, Pets, Office, and casino tables.</li>
            <li>Cross-game leaderboards aggregate performance from all titles.</li>
            <li>Achievements and rewards earned in one game can unlock perks in others.</li>
            <li>Risk controls and spending limits apply globally across the platform.</li>
          </ul>
        </div>
      </div>
    </section>
  `

  // Start live player count simulation
  const interval = setInterval(simulatePlayerCounts, 8000)

  // Cleanup interval when navigating away
  const observer = new MutationObserver(() => {
    if (!container.isConnected || !container.querySelector('.portal-grid')) {
      clearInterval(interval)
      observer.disconnect()
    }
  })
  observer.observe(document.getElementById('app')!, { childList: true })
}

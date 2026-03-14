import { casinoGames, recentBets, riskLimits, walletSummary } from '../data'
import { getWalletSession, formatConnectedAt } from '../session'

function statusLabel(status: string): string {
  switch (status) {
    case 'live':
      return 'Live'
    case 'staging':
      return 'Staging'
    default:
      return 'Coming Soon'
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

export function renderHome(container: HTMLElement) {
  const session = getWalletSession()

  container.innerHTML = `
    <section class="hero-shell page-content">
      <div class="hero-copy">
        <span class="eyebrow">QFC Casino MVP</span>
        <h1 class="hero-title">Crash, Dice, Roulette — one wallet session, one lobby.</h1>
        <p class="hero-subtitle">
          Unified entry for the casino MVP with shared wallet state, live table status, recent bet history,
          and built-in risk controls for testnet rollout.
        </p>
        <div class="hero-actions">
          <a class="primary-cta" href="#games">View tables</a>
          <a class="secondary-cta" href="#/profile">Wallet & profile</a>
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
            <p>Connect once and keep the same session while moving between Crash, Dice, and Roulette.</p>
          </div>
        `}
      </aside>
    </section>

    <section class="risk-banner page-content">
      <div>
        <span class="eyebrow">Risk banner</span>
        <h2>Testnet guardrails are active</h2>
        <p>Limits are shared across all casino games to reduce abuse and simplify operator controls.</p>
      </div>
      <div class="risk-grid">
        <div class="risk-pill"><span>Per bet</span><strong>${riskLimits.perBet}</strong></div>
        <div class="risk-pill"><span>Daily loss cap</span><strong>${riskLimits.dailyLoss}</strong></div>
        <div class="risk-pill"><span>Idle lock</span><strong>${riskLimits.sessionTimeout}</strong></div>
        <div class="risk-pill"><span>Throttle</span><strong>${riskLimits.throttle}</strong></div>
      </div>
    </section>

    <section id="games" class="page-content section-stack">
      <div class="section-head">
        <div>
          <span class="eyebrow">Casino lobby</span>
          <h2>Game status cards</h2>
        </div>
        <p class="section-copy">Unified navigation shell for the initial 3-game MVP.</p>
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
            <span class="eyebrow">Navigation flow</span>
            <h2>Unified session rules</h2>
          </div>
        </div>
        <div class="info-panel">
          <ul>
            <li>Single wallet session persists while switching between games.</li>
            <li>Risk controls and limits are shared across Crash, Dice, and Roulette.</li>
            <li>Recent bet history is visible from the lobby before entering a game.</li>
            <li>Fairness proof IDs are attached to each round for verification tooling.</li>
          </ul>
        </div>
      </div>
    </section>
  `
}

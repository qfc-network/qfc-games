import { recentBets, riskLimits, walletSummary } from '../data'
import { formatConnectedAt, getWalletSession } from '../session'

const achievements = [
  { icon: '🎯', name: 'Sharp Eye', desc: 'Win 3 Dice bets in a row', unlocked: true },
  { icon: '📈', name: 'Crash Landing', desc: 'Cash out above 3.00x', unlocked: true },
  { icon: '🎡', name: 'Wheel Whisperer', desc: 'Hit a straight Roulette bet', unlocked: false },
  { icon: '🛡️', name: 'Risk Aware', desc: 'Stay below daily loss cap for 7 sessions', unlocked: true },
  { icon: '🧪', name: 'Testnet Regular', desc: 'Play all MVP tables on testnet', unlocked: true },
  { icon: '🔍', name: 'Proof Checker', desc: 'Verify 10 rounds independently', unlocked: false },
]

export function renderProfile(container: HTMLElement) {
  const session = getWalletSession()

  if (!session) {
    container.innerHTML = `
      <div class="page-content center-content">
        <div class="connect-prompt">
          <div class="prompt-icon">🔗</div>
          <h2>Connect your wallet</h2>
          <p>One wallet session powers the entire casino lobby, profile, and recent bets history.</p>
        </div>
      </div>
    `
    return
  }

  container.innerHTML = `
    <div class="page-content">
      <h1 class="page-title">Wallet profile</h1>
      <div class="profile-header profile-shell">
        <div class="avatar">🪙</div>
        <div class="profile-info">
          <h2>${session.address}</h2>
          <span class="member-since">Connected ${formatConnectedAt(session.connectedAt)} · ${session.network}</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card"><div class="stat-value">${walletSummary.balance}</div><div class="stat-label">Wallet balance</div></div>
        <div class="stat-card"><div class="stat-value">${walletSummary.available}</div><div class="stat-label">Available</div></div>
        <div class="stat-card"><div class="stat-value">${walletSummary.pending}</div><div class="stat-label">Pending settlement</div></div>
        <div class="stat-card"><div class="stat-value">3</div><div class="stat-label">Tables unlocked</div></div>
      </div>

      <div class="two-column-layout profile-columns">
        <section>
          <h2 class="section-title">Shared limits</h2>
          <div class="info-panel">
            <ul>
              <li>Per-bet cap: <strong>${riskLimits.perBet}</strong></li>
              <li>Daily loss cap: <strong>${riskLimits.dailyLoss}</strong></li>
              <li>Idle auto-lock: <strong>${riskLimits.sessionTimeout}</strong></li>
              <li>Action throttle: <strong>${riskLimits.throttle}</strong></li>
            </ul>
          </div>
        </section>

        <section>
          <h2 class="section-title">Latest bet proofs</h2>
          <div class="history-list compact-history">
            ${recentBets.slice(0, 3).map((bet) => `
              <div class="history-row">
                <div>
                  <div class="history-game">${bet.game.toUpperCase()}</div>
                  <div class="history-label">${bet.label}</div>
                </div>
                <div class="history-meta">
                  <strong class="${bet.result === 'win' ? 'is-win' : bet.result === 'loss' ? 'is-loss' : 'is-pending'}">${bet.payout}</strong>
                  <small>${bet.proof}</small>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>

      <h2 class="section-title">Achievements <span class="achievement-count">${achievements.filter((a) => a.unlocked).length}/${achievements.length}</span></h2>
      <div class="achievements-grid">
        ${achievements.map((a) => `
          <div class="achievement ${a.unlocked ? 'unlocked' : 'locked'}">
            <div class="ach-icon">${a.icon}</div>
            <div class="ach-name">${a.name}</div>
            <div class="ach-desc">${a.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `
}

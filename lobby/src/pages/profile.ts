import { recentBets, riskLimits, walletSummary, portalGames, gameStats } from '../data'
import { formatConnectedAt, getWalletSession } from '../session'

const achievements = [
  { icon: '🏰', name: 'Dungeon Delver', desc: 'Reach floor 25 in QFC Dungeon', unlocked: true },
  { icon: '🃏', name: 'Card Master', desc: 'Win 50 ranked duels in QFC Cards', unlocked: true },
  { icon: '🐾', name: 'Pet Whisperer', desc: 'Breed 5 unique creatures', unlocked: true },
  { icon: '🎯', name: 'Sharp Eye', desc: 'Win 3 Dice bets in a row', unlocked: true },
  { icon: '📈', name: 'Crash Landing', desc: 'Cash out above 3.00x in Crash', unlocked: true },
  { icon: '🎡', name: 'Wheel Whisperer', desc: 'Hit a straight Roulette bet', unlocked: false },
  { icon: '🛡️', name: 'Risk Aware', desc: 'Stay below daily loss cap for 7 sessions', unlocked: true },
  { icon: '🧪', name: 'Cross-game Explorer', desc: 'Play all four portal games', unlocked: false },
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
          <p>One wallet session powers the entire game portal -- profile, stats, and achievements across all titles.</p>
        </div>
      </div>
    `
    return
  }

  const totalHours = Object.values(gameStats).reduce((s, g) => s + g.hours, 0)
  const totalPlayed = Object.values(gameStats).reduce((s, g) => s + g.played, 0)
  const totalWins = Object.values(gameStats).reduce((s, g) => s + g.wins, 0)

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
        <div class="stat-card"><div class="stat-value">${totalHours}h</div><div class="stat-label">Total play time</div></div>
        <div class="stat-card"><div class="stat-value">${totalPlayed}</div><div class="stat-label">Games played</div></div>
      </div>

      <h2 class="section-title">Game stats</h2>
      <div class="game-stats-grid">
        ${portalGames.map((game) => {
          const slug = game.slug
          let extraLabel = 'Status'
          let extraValue: string | number = '--'
          if (slug === 'dungeon') { extraLabel = 'Top floor'; extraValue = gameStats.dungeon.topFloor }
          else if (slug === 'cards') { extraLabel = 'Rank'; extraValue = gameStats.cards.rank }
          else if (slug === 'pets') { extraLabel = 'Creatures'; extraValue = gameStats.pets.creatures }
          else { extraLabel = 'Status'; extraValue = gameStats.office.rank }
          const stats = gameStats[slug]
          return `
            <div class="game-stat-card" style="--accent: ${game.accent}">
              <div class="game-stat-header">
                <span>${game.emoji} ${game.name.replace('QFC ', '')}</span>
              </div>
              <div class="game-stat-row">
                <div><span>Played</span><strong>${stats.played}</strong></div>
                <div><span>Wins</span><strong>${stats.wins}</strong></div>
                <div><span>Hours</span><strong>${stats.hours}</strong></div>
                <div><span>${extraLabel}</span><strong>${extraValue}</strong></div>
              </div>
            </div>
          `
        }).join('')}
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

      <div class="profile-summary-bar">
        <span>Win rate: <strong>${totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0}%</strong></span>
        <span>Pending: <strong>${walletSummary.pending}</strong></span>
        <span>Games unlocked: <strong>${portalGames.filter(g => g.status !== 'coming-soon').length}/${portalGames.length}</strong></span>
      </div>
    </div>
  `
}

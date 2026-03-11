const achievements = [
  { icon: '⚔️', name: 'First Blood', desc: 'Win your first battle', unlocked: true },
  { icon: '🏆', name: 'Champion', desc: 'Reach #1 on leaderboard', unlocked: true },
  { icon: '🐉', name: 'Dragon Tamer', desc: 'Raise a pet to max level', unlocked: true },
  { icon: '🃏', name: 'Card Collector', desc: 'Collect all 30 cards', unlocked: false },
  { icon: '💀', name: 'Dungeon Master', desc: 'Clear floor 10', unlocked: true },
  { icon: '🏢', name: 'Employee of the Month', desc: 'Work 100 hours', unlocked: false },
  { icon: '🔥', name: 'On Fire', desc: 'Win 5 games in a row', unlocked: true },
  { icon: '💎', name: 'Diamond Hands', desc: 'Hold 1000 QFC tokens', unlocked: false },
  { icon: '🌟', name: 'All-Star', desc: 'Play all 4 games', unlocked: true },
]

const stats = [
  { label: 'Games Played', value: '147' },
  { label: 'Total Score', value: '23,450' },
  { label: 'Win Rate', value: '68%' },
  { label: 'Time Played', value: '42h' },
]

export function renderProfile(container: HTMLElement) {
  const wallet = localStorage.getItem('qfc_wallet')

  if (!wallet) {
    container.innerHTML = `
      <div class="page-content center-content">
        <div class="connect-prompt">
          <div class="prompt-icon">🔗</div>
          <h2>Connect Your Wallet</h2>
          <p>Connect your wallet to view your game stats and achievements.</p>
        </div>
      </div>
    `
    return
  }

  container.innerHTML = `
    <div class="page-content">
      <h1 class="page-title">Profile</h1>
      <div class="profile-header">
        <div class="avatar">🎮</div>
        <div class="profile-info">
          <h2>${wallet}</h2>
          <span class="member-since">Member since Mar 2026</span>
        </div>
      </div>
      <div class="stats-grid">
        ${stats.map(s => `
          <div class="stat-card">
            <div class="stat-value">${s.value}</div>
            <div class="stat-label">${s.label}</div>
          </div>
        `).join('')}
      </div>
      <h2 class="section-title">Achievements <span class="achievement-count">${achievements.filter(a => a.unlocked).length}/${achievements.length}</span></h2>
      <div class="achievements-grid">
        ${achievements.map(a => `
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

import { casinoGames } from '../data'

const gameNames = ['All', ...casinoGames.map((g) => g.name)] as const
const gameColors: Record<string, string> = Object.fromEntries(casinoGames.map((g) => [g.name, g.accent]))

function randomAddr(): string {
  const hex = Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
  return '0x' + hex.slice(0, 6) + '...' + hex.slice(-4)
}

function randomDate(): string {
  const d = new Date(Date.now() - Math.random() * 7 * 86400000)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

interface Entry {
  rank: number
  player: string
  game: string
  pnl: number
  streak: string
  time: string
}

function generateData(): Entry[] {
  const entries: Entry[] = []
  for (let i = 0; i < 18; i++) {
    const game = casinoGames[Math.floor(Math.random() * casinoGames.length)]
    entries.push({
      rank: 0,
      player: randomAddr(),
      game: game.name,
      pnl: Math.floor(Math.random() * 18000) - 2000,
      streak: `${Math.floor(Math.random() * 8) + 1} wins`,
      time: randomDate(),
    })
  }
  entries.sort((a, b) => b.pnl - a.pnl)
  entries.forEach((e, i) => (e.rank = i + 1))
  return entries
}

const allData = generateData()

export function renderLeaderboard(container: HTMLElement) {
  let filter = 'All'

  function render() {
    const filtered = filter === 'All' ? allData : allData.filter((e) => e.game === filter)

    container.innerHTML = `
      <div class="page-content">
        <h1 class="page-title">Casino leaderboard</h1>
        <p class="section-copy leaderboard-copy">Cross-game ranking for the MVP lobby. Wallet session stays shared while users move between tables.</p>
        <div class="filters">
          ${gameNames.map((g) => `
            <button class="filter-btn ${filter === g ? 'active' : ''}" data-game="${g}"
              style="${filter === g && g !== 'All' ? `background: ${gameColors[g]}22; border-color: ${gameColors[g]}; color: ${gameColors[g]}` : ''}"
            >${g}</button>
          `).join('')}
        </div>
        <div class="table-wrap">
          <table class="lb-table">
            <thead>
              <tr><th>Rank</th><th>Player</th><th>Game</th><th>Net PnL</th><th>Hot streak</th><th>Last active</th></tr>
            </thead>
            <tbody>
              ${filtered.map((e) => `
                <tr>
                  <td class="rank">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : '#' + e.rank}</td>
                  <td class="addr">${e.player}</td>
                  <td><span class="game-badge" style="color: ${gameColors[e.game]}">${e.game}</span></td>
                  <td class="score ${e.pnl >= 0 ? 'is-win' : 'is-loss'}">${e.pnl >= 0 ? '+' : ''}${e.pnl.toLocaleString()} QFC</td>
                  <td>${e.streak}</td>
                  <td class="time">${e.time}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        filter = (btn as HTMLElement).dataset.game || 'All'
        render()
      })
    })
  }

  render()
}

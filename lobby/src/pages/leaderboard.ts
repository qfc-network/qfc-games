const gameNames = ['Virtual Office', 'AI Dungeon', 'AI Cards', 'AI Pets'] as const
const gameColors: Record<string, string> = {
  'Virtual Office': '#2ed573',
  'AI Dungeon': '#54a0ff',
  'AI Cards': '#a29bfe',
  'AI Pets': '#ffa502',
}

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
  score: number
  time: string
}

function generateData(): Entry[] {
  const entries: Entry[] = []
  for (let i = 0; i < 20; i++) {
    entries.push({
      rank: 0,
      player: randomAddr(),
      game: gameNames[Math.floor(Math.random() * gameNames.length)],
      score: Math.floor(Math.random() * 9000) + 1000,
      time: randomDate(),
    })
  }
  entries.sort((a, b) => b.score - a.score)
  entries.forEach((e, i) => (e.rank = i + 1))
  return entries
}

const allData = generateData()

export function renderLeaderboard(container: HTMLElement) {
  let filter = 'All'

  function render() {
    const filtered = filter === 'All' ? allData : allData.filter(e => e.game === filter)

    container.innerHTML = `
      <div class="page-content">
        <h1 class="page-title">Leaderboard</h1>
        <div class="filters">
          ${['All', ...gameNames].map(g => `
            <button class="filter-btn ${filter === g ? 'active' : ''}" data-game="${g}"
              style="${filter === g && g !== 'All' ? `background: ${gameColors[g]}22; border-color: ${gameColors[g]}; color: ${gameColors[g]}` : ''}"
            >${g}</button>
          `).join('')}
        </div>
        <div class="table-wrap">
          <table class="lb-table">
            <thead>
              <tr><th>Rank</th><th>Player</th><th>Game</th><th>Score</th><th>Time</th></tr>
            </thead>
            <tbody>
              ${filtered.map(e => `
                <tr>
                  <td class="rank">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : '#' + e.rank}</td>
                  <td class="addr">${e.player}</td>
                  <td><span class="game-badge" style="color: ${gameColors[e.game]}">${e.game}</span></td>
                  <td class="score">${e.score.toLocaleString()}</td>
                  <td class="time">${e.time}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filter = (btn as HTMLElement).dataset.game!
        render()
      })
    })
  }

  render()
}

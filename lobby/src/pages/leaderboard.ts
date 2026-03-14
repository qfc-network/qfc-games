import { portalGames, casinoGames } from '../data'

const allGameNames = [
  'All',
  ...portalGames.map((g) => g.name.replace('QFC ', '')),
  ...casinoGames.map((g) => g.name),
] as const

const gameColors: Record<string, string> = {
  ...Object.fromEntries(portalGames.map((g) => [g.name.replace('QFC ', ''), g.accent])),
  ...Object.fromEntries(casinoGames.map((g) => [g.name, g.accent])),
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
  metric: string
  streak: string
  time: string
}

function generateData(): Entry[] {
  const entries: Entry[] = []
  const sources = [
    ...portalGames.map((g) => ({
      name: g.name.replace('QFC ', ''),
      metrics: g.slug === 'dungeon' ? ['Floor reached', 'Bosses slain', 'Loot value']
        : g.slug === 'cards' ? ['Wins', 'Elo rating', 'Cards collected']
        : g.slug === 'pets' ? ['Arena wins', 'Creatures bred', 'Training score']
        : ['Revenue', 'Employees', 'Expansions'],
    })),
    ...casinoGames.map((g) => ({
      name: g.name,
      metrics: ['Net PnL'],
    })),
  ]

  for (let i = 0; i < 24; i++) {
    const source = sources[Math.floor(Math.random() * sources.length)]
    const metric = source.metrics[Math.floor(Math.random() * source.metrics.length)]
    entries.push({
      rank: 0,
      player: randomAddr(),
      game: source.name,
      score: metric === 'Elo rating'
        ? 1200 + Math.floor(Math.random() * 800)
        : Math.floor(Math.random() * 18000) - 2000,
      metric,
      streak: `${Math.floor(Math.random() * 12) + 1} wins`,
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
    const filtered = filter === 'All' ? allData : allData.filter((e) => e.game === filter)

    container.innerHTML = `
      <div class="page-content">
        <h1 class="page-title">Cross-game leaderboard</h1>
        <p class="section-copy leaderboard-copy">
          Aggregated rankings across all QFC titles. Dungeon explorers, card duelists, pet trainers,
          and casino players compete on a single board.
        </p>
        <div class="filters">
          ${allGameNames.map((g) => `
            <button class="filter-btn ${filter === g ? 'active' : ''}" data-game="${g}"
              style="${filter === g && g !== 'All' ? `background: ${gameColors[g]}22; border-color: ${gameColors[g]}; color: ${gameColors[g]}` : ''}"
            >${g}</button>
          `).join('')}
        </div>
        <div class="table-wrap">
          <table class="lb-table">
            <thead>
              <tr><th>Rank</th><th>Player</th><th>Game</th><th>Score</th><th>Metric</th><th>Streak</th><th>Last active</th></tr>
            </thead>
            <tbody>
              ${filtered.map((e) => `
                <tr>
                  <td class="rank">${e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : '#' + e.rank}</td>
                  <td class="addr">${e.player}</td>
                  <td><span class="game-badge" style="color: ${gameColors[e.game] || '#9ea5ff'}">${e.game}</span></td>
                  <td class="score ${e.score >= 0 ? 'is-win' : 'is-loss'}">${e.score >= 0 ? '+' : ''}${e.score.toLocaleString()}</td>
                  <td class="metric-label">${e.metric}</td>
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

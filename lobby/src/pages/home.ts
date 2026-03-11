interface Game {
  emoji: string
  name: string
  genre: string
  desc: string
  port: number
  color: string
  btnText: string
}

const games: Game[] = [
  {
    emoji: '🏢',
    name: 'Virtual Office',
    genre: 'Work-to-Earn',
    desc: 'The world\'s first on-chain AI Agent virtual office. 12 team members work, chat, and collaborate in real-time.',
    port: 3210,
    color: '#2ed573',
    btnText: 'Enter Office',
  },
  {
    emoji: '🎲',
    name: 'AI Dungeon',
    genre: 'Roguelike',
    desc: 'Roguelike dungeon crawler with procedural levels, monsters, and loot. Every run is unique. Permadeath.',
    port: 3240,
    color: '#54a0ff',
    btnText: 'Enter Dungeon',
  },
  {
    emoji: '🃏',
    name: 'AI Cards',
    genre: 'Strategy Card Game',
    desc: 'Strategy card game with 30 AI-generated cards across 5 elements. Build your deck and battle PvP or vs AI.',
    port: 3220,
    color: '#a29bfe',
    btnText: 'Play Cards',
  },
  {
    emoji: '🐾',
    name: 'AI Pets',
    genre: 'Virtual Pets',
    desc: 'Adopt, raise, and battle AI-powered virtual pets. Each pet has unique personality, stats, and can chat with you!',
    port: 3230,
    color: '#ffa502',
    btnText: 'Adopt Pet',
  },
]

function randomPlayers(): number {
  return Math.floor(Math.random() * 20) + 1
}

export function renderHome(container: HTMLElement) {
  const counts = games.map(() => randomPlayers())
  const total = counts.reduce((a, b) => a + b, 0)

  container.innerHTML = `
    <div class="banner">
      <span class="pulse"></span>
      <strong>${total}</strong> players online across ${games.length} games
    </div>
    <div class="games-grid">
      ${games.map((g, i) => `
        <div class="game-card" style="--accent: ${g.color}" onclick="window.open('http://localhost:${g.port}', '_blank')">
          <div class="card-header">
            <span class="card-emoji">${g.emoji}</span>
            <span class="player-count"><span class="dot"></span>${counts[i]} online</span>
          </div>
          <h2>${g.name}</h2>
          <span class="genre-tag" style="border-color: ${g.color}; color: ${g.color}">${g.genre}</span>
          <p class="card-desc">${g.desc}</p>
          <a class="play-btn" href="http://localhost:${g.port}" target="_blank" onclick="event.stopPropagation()">${g.btnText}</a>
        </div>
      `).join('')}
    </div>
  `
}

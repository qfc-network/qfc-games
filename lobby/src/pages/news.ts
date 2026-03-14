import { newsItems, portalGames, type NewsItem } from '../data'

const tagColors: Record<NewsItem['tag'], string> = {
  update: '#6c5ce7',
  event: '#feca57',
  patch: '#2ed573',
  announcement: '#ff7a59',
}

const gameColors: Record<string, string> = {
  ...Object.fromEntries(portalGames.map((g) => [g.slug, g.accent])),
  platform: '#9ea5ff',
}

const gameLabels: Record<string, string> = {
  dungeon: 'Dungeon',
  cards: 'Cards',
  pets: 'Pets',
  office: 'Office',
  platform: 'Platform',
}

const filterOptions = ['All', 'dungeon', 'cards', 'pets', 'office', 'platform'] as const

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return formatDate(iso)
}

export function renderNews(container: HTMLElement) {
  let filter: string = 'All'

  function render() {
    const filtered = filter === 'All'
      ? newsItems
      : newsItems.filter((n) => n.game === filter)

    container.innerHTML = `
      <div class="page-content">
        <h1 class="page-title">Game updates</h1>
        <p class="section-copy leaderboard-copy">
          Latest news, patches, events, and announcements from across the QFC game portal.
        </p>
        <div class="filters">
          ${filterOptions.map((opt) => {
            const label = opt === 'All' ? 'All' : gameLabels[opt] || opt
            const color = opt !== 'All' ? gameColors[opt] : ''
            return `
              <button class="filter-btn ${filter === opt ? 'active' : ''}" data-game="${opt}"
                style="${filter === opt && opt !== 'All' ? `background: ${color}22; border-color: ${color}; color: ${color}` : ''}"
              >${label}</button>
            `
          }).join('')}
        </div>
        <div class="news-feed">
          ${filtered.length === 0 ? `
            <div class="news-empty">No updates for this filter yet.</div>
          ` : filtered.map((item) => `
            <article class="news-card">
              <div class="news-card-top">
                <span class="news-tag" style="background: ${tagColors[item.tag]}22; color: ${tagColors[item.tag]}; border-color: ${tagColors[item.tag]}44">${item.tag}</span>
                <span class="news-game-badge" style="color: ${gameColors[item.game] || '#9ea5ff'}">${gameLabels[item.game] || item.game}</span>
                <span class="news-date">${relativeDate(item.date)}</span>
              </div>
              <h3 class="news-title">${item.title}</h3>
              <p class="news-summary">${item.summary}</p>
              <div class="news-card-bottom">
                <span class="news-date-full">${formatDate(item.date)}</span>
              </div>
            </article>
          `).join('')}
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

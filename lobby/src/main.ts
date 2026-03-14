import './styles.css'
import { renderHome } from './pages/home'
import { renderLeaderboard } from './pages/leaderboard'
import { renderProfile } from './pages/profile'
import { renderNews } from './pages/news'
import { clearWalletSession, createWalletSession, getWalletSession } from './session'

const app = document.getElementById('app')!

function renderWalletButton() {
  const btn = document.getElementById('wallet-btn') as HTMLButtonElement | null
  if (!btn) return

  const session = getWalletSession()
  if (session) {
    btn.textContent = session.address
    btn.classList.add('connected')
  } else {
    btn.textContent = 'Connect Wallet'
    btn.classList.remove('connected')
  }
}

function navigate() {
  const hash = window.location.hash.slice(1) || '/'
  app.innerHTML = ''

  const header = document.createElement('header')
  header.className = 'site-header'
  header.innerHTML = `
    <a href="#/" class="logo">🎮 QFC Games</a>
    <nav>
      <a href="#/" class="${hash === '/' ? 'active' : ''}">Lobby</a>
      <a href="#/leaderboard" class="${hash === '/leaderboard' ? 'active' : ''}">Leaderboard</a>
      <a href="#/news" class="${hash === '/news' ? 'active' : ''}">News</a>
      <a href="#/profile" class="${hash === '/profile' ? 'active' : ''}">Profile</a>
    </nav>
    <button class="wallet-btn" id="wallet-btn">Connect Wallet</button>
  `
  app.appendChild(header)

  const main = document.createElement('main')
  app.appendChild(main)

  switch (hash) {
    case '/leaderboard':
      renderLeaderboard(main)
      break
    case '/news':
      renderNews(main)
      break
    case '/profile':
      renderProfile(main)
      break
    default:
      renderHome(main)
  }

  renderWalletButton()

  document.getElementById('wallet-btn')?.addEventListener('click', () => {
    if (getWalletSession()) {
      clearWalletSession()
    } else {
      createWalletSession()
    }

    renderWalletButton()

    if (window.location.hash === '#/profile') {
      renderProfile(main)
    }
    if (window.location.hash === '#/' || window.location.hash === '') {
      renderHome(main)
    }
  })
}

window.addEventListener('hashchange', navigate)
navigate()

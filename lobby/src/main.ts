import './styles.css'
import { renderHome } from './pages/home'
import { renderLeaderboard } from './pages/leaderboard'
import { renderProfile } from './pages/profile'

const app = document.getElementById('app')!

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
    case '/profile':
      renderProfile(main)
      break
    default:
      renderHome(main)
  }

  document.getElementById('wallet-btn')!.addEventListener('click', () => {
    const btn = document.getElementById('wallet-btn')!
    if (btn.classList.contains('connected')) {
      btn.textContent = 'Connect Wallet'
      btn.classList.remove('connected')
      localStorage.removeItem('qfc_wallet')
    } else {
      const addr = '0x' + Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('') + '...'
      btn.textContent = addr
      btn.classList.add('connected')
      localStorage.setItem('qfc_wallet', addr)
    }
    if (hash === '/profile') {
      renderProfile(main)
    }
  })

  const saved = localStorage.getItem('qfc_wallet')
  if (saved) {
    const btn = document.getElementById('wallet-btn')!
    btn.textContent = saved
    btn.classList.add('connected')
  }
}

window.addEventListener('hashchange', navigate)
navigate()

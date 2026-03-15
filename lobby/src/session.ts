export interface WalletSession {
  address: string
  connectedAt: string
  network: 'QFC Testnet'
}

const SESSION_KEY = 'qfc_wallet_session'
const QFC_CHAIN_ID = '0x2328' // 9000

export async function connectWallet(): Promise<WalletSession | null> {
  const ethereum = (window as any).ethereum
  if (!ethereum) {
    alert('Please install MetaMask to connect your wallet.')
    return null
  }

  try {
    const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' })
    if (!accounts || accounts.length === 0) return null

    // Switch to QFC Testnet
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: QFC_CHAIN_ID }],
      })
    } catch (switchErr: any) {
      // Chain not added — add it
      if (switchErr.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: QFC_CHAIN_ID,
            chainName: 'QFC Testnet',
            nativeCurrency: { name: 'QFC', symbol: 'QFC', decimals: 18 },
            rpcUrls: ['https://rpc.testnet.qfc.network'],
            blockExplorerUrls: ['https://explorer.testnet.qfc.network'],
          }],
        })
      } else {
        throw switchErr
      }
    }

    const address = accounts[0]
    const session: WalletSession = {
      address,
      connectedAt: new Date().toISOString(),
      network: 'QFC Testnet',
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  } catch (err: any) {
    console.error('Wallet connection failed:', err)
    return null
  }
}

export function getWalletSession(): WalletSession | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as WalletSession
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function clearWalletSession() {
  localStorage.removeItem(SESSION_KEY)
}

export function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function formatConnectedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Listen for account/chain changes
if ((window as any).ethereum) {
  (window as any).ethereum.on('accountsChanged', (accounts: string[]) => {
    if (accounts.length === 0) {
      clearWalletSession()
    } else {
      const session = getWalletSession()
      if (session) {
        session.address = accounts[0]
        localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      }
    }
    window.location.reload()
  })

  ;(window as any).ethereum.on('chainChanged', () => {
    window.location.reload()
  })
}

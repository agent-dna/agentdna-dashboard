import type { NFTChainData, MetricCard } from '../types'
import './AgentInfoDashboard.css'


interface AgentInfoDashboardProps {
  onBackToDashboard: () => void
  onSearchAgent: (id: string) => void
  searchValue: string
  onSearchChange: (value: string) => void
  chainData: NFTChainData[] | null
  isLoading: boolean
}

const AgentInfoDashboard = ({
  onBackToDashboard,
  onSearchAgent,
  searchValue,
  onSearchChange,
  chainData,
  isLoading,
}: AgentInfoDashboardProps) => {
  const metrics: MetricCard[] = [
    { label: 'Total Interactions', value: '1,234' },
    { label: 'Malcious Interactions ', value: '12', color: '#ff6c89' },
    { label: 'Genuine Interactions', value: '8', color: '#ffc557' },
  ]

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchValue.trim()) {
      onSearchAgent(searchValue.trim())
    }
  }

  return (
    <div className="agent-info-dashboard">
      {/* Header */}
      <header className="agent-info-header">
        <button className="dashboard-btn" onClick={onBackToDashboard}>
          dashboard
        </button>
        <div className="agent-info-title">
          <h1>Agent Info</h1>
          <form className="agent-search-form" onSubmit={handleSearchSubmit}>
            <input
              type="text"
              placeholder="Search Agent"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="agent-search-input"
            />
          </form>
        </div>
        <div className="user-info">
          <span>user : user@email</span>
        </div>
      </header>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        {metrics.map((metric, index) => (
          <div key={index} className="metric-card">
            <div className="metric-label">{metric.label}</div>
            <div className="metric-value" style={{ color: metric.color }}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {/* Transaction List */}
      <div className="transaction-list-section">
        <h2 className="transaction-list-title">Interaction History</h2>
        {isLoading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#45ffe8' }}>
            Loading Interactions ...
          </div>
        ) : !chainData || chainData.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
            No Interactions available.
          </div>
        ) : (
          <div className="transaction-queue">
            {chainData.map((data, index) => {
              const isIntrusion =
                /password|hack|intrusion|share|leak|attack|phish/i.test(data.NFTData ?? '') ||
                /intrusion|hack|phish/i.test(data.TransactionID ?? '')
              const cardClass = isIntrusion ? 'transaction-card intrusion' : 'transaction-card genuine'
              const badgeText = isIntrusion ? 'Intrusion detected' : 'Genuine'

              return (
                <div key={index} className={cardClass}>
                  <div className="card-badge">{badgeText}</div>
                  <div className="card-content">
                    <div className="card-field">
                      <span className="field-label">Original Message :</span>
                      <span className="field-value">{data.NFTData || 'Not provided'}</span>
                    </div>
                    <div className="card-field">
                      <span className="field-label">Received Message :</span>
                      <span className="field-value">{data.BlockId || 'Not provided'}</span>
                    </div>
                    <div className="card-field">
                      <span className="field-label">Response :</span>
                      <span className="field-value">{data.TransactionID || 'Not provided'}</span>
                    </div>
                    <div className="card-field">
                      <span className="field-label">Reason :</span>
                      <span className="field-value">{data.NFTOwner || 'Not provided'}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default AgentInfoDashboard
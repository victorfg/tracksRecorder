import { RecordScreen } from './components/RecordScreen'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Tracks Recorder</h1>
      </header>
      <main className="app-main">
        <RecordScreen />
      </main>
    </div>
  )
}

export default App

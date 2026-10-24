import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Camera from './pages/Camera.jsx'
import Receiver from './pages/Receiver.jsx'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/receiver" element={<Receiver />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

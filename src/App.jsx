import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Camera from './pages/Camera.jsx'
import Receiver from './pages/Receiver.jsx'
import Check from './pages/Check.jsx'
import Rate from './pages/Rate.jsx'
import HomeDemo from './pages/HomeDemo.jsx'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/receiver" element={<Receiver />} />
        <Route path="/check" element={<Check />} />
        <Route path="/rate" element={<Rate />} />
        <Route path="/demo" element={<HomeDemo />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

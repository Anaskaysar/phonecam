import { useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Camera from './pages/Camera.jsx'
import Receiver from './pages/Receiver.jsx'
import Check from './pages/Check.jsx'
import Rate from './pages/Rate.jsx'
import Report from './pages/Report.jsx'
import HomeDemo from './pages/HomeDemo.jsx'

// An unknown app address (#/admin, #/login…) goes to the same path without the #,
// where the Worker serves the Halloween 404 page (worker/notfound.js).
function Lost() {
  const { pathname } = useLocation()
  useEffect(() => {
    const path = pathname.replace(/^\/+/, '').replace(/[^\w./-]/g, '').slice(0, 80)
    window.location.replace(`/${path || '404'}`)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/camera" element={<Camera />} />
        <Route path="/receiver" element={<Receiver />} />
        <Route path="/check" element={<Check />} />
        <Route path="/rate" element={<Rate />} />
        <Route path="/report" element={<Report />} />
        <Route path="/demo" element={<HomeDemo />} />
        <Route path="*" element={<Lost />} />
      </Routes>
    </HashRouter>
  )
}

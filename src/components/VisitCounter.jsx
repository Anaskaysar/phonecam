import { useEffect, useMemo, useRef, useState } from 'react'
import { VISITS_EVENT, checkIn, loadVisits } from '../lib/visits.js'

/*
  "Around the world": how many people have opened PhoneCam, where from,
  in the last 24 hours, and right now. Real numbers from /api/visits only.
  Colors come from the page (--accent, --ink, --raise...), so it follows
  the home page's color editions and the black-and-white mode.
*/

const POLL_MS = 30000
const SHOWN = 6

const TABS = [
  ['all', 'All time'],
  ['day', '24 hours'],
  ['live', 'Live now']
]

const CAPTIONS = {
  all: 'People have opened PhoneCam.',
  day: 'People opened PhoneCam in the last 24 hours.',
  live: 'People are on PhoneCam right now.'
}

let regionNames
function countryName(code) {
  try {
    regionNames ||= new Intl.DisplayNames(['en'], { type: 'region' })
    return regionNames.of(code) || code
  } catch {
    return code
  }
}

function pick(data, range) {
  if (!data) return { total: 0, countries: [] }
  if (range === 'all') return { total: data.total, countries: data.countries }
  return data[range] || { total: 0, countries: [] }
}

// Same flag images as the About page. Shows the two-letter code if one fails to load.
function Flag({ code }) {
  const [failed, setFailed] = useState(false)
  const lower = code.toLowerCase()
  return (
    <span className="vc-badge" aria-hidden="true">
      {failed
        ? code
        : <img src={`https://flagcdn.com/w40/${lower}.png`} srcSet={`https://flagcdn.com/w80/${lower}.png 2x`} alt="" width="28" height="20" loading="lazy" onError={() => setFailed(true)} />}
    </span>
  )
}

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function VisitCounter() {
  const [data, setData] = useState(null)
  const [range, setRange] = useState('all')
  const [shown, setShown] = useState(0)
  const [hover, setHover] = useState(null)
  const [flash, setFlash] = useState(null)
  const [expand, setExpand] = useState(false)
  const previous = useRef(null)
  const flashTimer = useRef()

  // Take new numbers, and light up a country that just went up.
  const take = useRef()
  take.current = (next) => {
    if (!next) return
    const before = previous.current
    if (before) {
      const old = Object.fromEntries(before.countries.map((row) => [row.code, row.count]))
      const grown = next.countries.find((row) => row.count > (old[row.code] || 0))
      if (grown) {
        setFlash(grown.code)
        clearTimeout(flashTimer.current)
        flashTimer.current = setTimeout(() => setFlash(null), 1400)
      }
    }
    previous.current = next
    setData(next)
  }

  useEffect(() => {
    // This component checks in for the tab, so help.js doesn't do it twice.
    window.__pcLiveOwner = true
    let stopped = false
    const tick = async () => {
      if (document.visibilityState === 'hidden') return
      const next = (await checkIn()) || (await loadVisits())
      if (!stopped) take.current(next)
    }
    tick()
    const timer = setInterval(tick, POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    const onCounted = (event) => take.current(event.detail)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(VISITS_EVENT, onCounted)
    return () => {
      stopped = true
      window.__pcLiveOwner = false
      clearInterval(timer)
      clearTimeout(flashTimer.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(VISITS_EVENT, onCounted)
    }
  }, [])

  const current = pick(data, range)
  const target = current.total

  // Count up to the number. Straight to it when motion is reduced.
  useEffect(() => {
    if (reducedMotion()) { setShown(target); return undefined }
    const timer = setInterval(() => {
      setShown((now) => {
        if (now === target) { clearInterval(timer); return now }
        const gap = target - now
        return now + Math.sign(gap) * Math.max(1, Math.ceil(Math.abs(gap) / 6))
      })
    }, 40)
    return () => clearInterval(timer)
  }, [target])

  const rows = useMemo(
    () => current.countries.filter((row) => row.count > 0).map((row) => ({ ...row, name: countryName(row.code) })),
    [current.countries]
  )

  // Nothing to show until the counter answers, and no made-up numbers if it doesn't.
  if (!data) return null

  const max = rows[0]?.count || 1
  const visible = expand ? rows : rows.slice(0, SHOWN)
  const hovered = rows.find((row) => row.code === hover)
  const hours = Array.isArray(data.hours) ? data.hours : []
  const peak = Math.max(1, ...hours)
  const share = (count) => (target ? Math.round((count / target) * 100) : 0)

  return (
    <section className="lp-section" aria-labelledby="vc-title">
      <div className="vc">
        <aside className="vc-left">
          <p className="vc-eyebrow" id="vc-title">
            <span className="vc-dot" aria-hidden="true"><i className="vc-ping" /><i /></span>
            Around the world
          </p>
          <p className="vc-count" aria-live="polite" aria-atomic="true">{shown.toLocaleString('en-US')}</p>
          <p className="vc-caption">{CAPTIONS[range]}</p>

          <div className="vc-tabs" role="group" aria-label="Time range">
            {TABS.map(([id, label]) => (
              <button key={id} type="button" aria-pressed={range === id} onClick={() => { setRange(id); setHover(null); setExpand(false) }}>
                {label}
              </button>
            ))}
          </div>

          <p className="vc-hover" aria-live="polite">
            {hovered
              ? `${hovered.name}: ${hovered.count} of ${target} (${share(hovered.count)}%)`
              : rows.length ? 'Hover or tap a country for details.' : ''}
          </p>
        </aside>

        <div className="vc-right">
          <header>
            <strong>Top countries</strong>
            <span>{rows.length} {rows.length === 1 ? 'country' : 'countries'}</span>
          </header>

          {rows.length ? (
            <ul className="vc-rows">
              {visible.map((row) => {
                const state = flash === row.code ? ' is-flash' : hover === row.code ? ' is-hover' : ''
                return (
                  <li
                    key={row.code}
                    className={`vc-row${state}`}
                    tabIndex={0}
                    onMouseEnter={() => setHover(row.code)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(row.code)}
                    onBlur={() => setHover(null)}
                    onClick={() => setHover(row.code)}
                  >
                    <Flag code={row.code} />
                    <span className="vc-name">{row.name}</span>
                    <span className="vc-track" aria-hidden="true">
                      <span style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
                    </span>
                    <span className="vc-n">{row.count}</span>
                    <span className="vc-pct">{share(row.count)}%</span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="vc-empty">{range === 'live' ? 'Nobody else is here right now.' : 'No visitors in this range yet.'}</p>
          )}

          {rows.length > SHOWN ? (
            <button type="button" className="vc-more" onClick={() => setExpand(!expand)}>
              {expand ? 'Show fewer' : `Show all ${rows.length} countries`}
            </button>
          ) : null}

          {hours.some((count) => count > 0) ? (
            <footer>
              <div><span>New visitors per hour, last 24 hours</span><span>Peak {peak}/hr</span></div>
              <div className="vc-bars" role="img" aria-label={`New visitors per hour over the last 24 hours. Peak ${peak} in an hour.`}>
                {hours.map((count, index) => (
                  <span key={index} className={index === hours.length - 1 ? 'is-now' : ''} style={{ height: Math.max(3, (count / peak) * 48) }} />
                ))}
              </div>
            </footer>
          ) : null}
        </div>
      </div>
    </section>
  )
}

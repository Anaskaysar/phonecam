import { useId } from 'react'

const STAR = 'M12 2.8l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 16.8l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'

/* Read-only stars. value can be fractional (4.6 fills four and a bit). */
export function StarRow({ value, size = 18, label }) {
  // Each row needs its own gradient ids, or every row on the page copies the first row's fill.
  const uid = useId().replace(/:/g, '')
  const rounded = Math.round(value * 2) / 2
  return (
    <span className="stars" role="img" aria-label={label || `${value} out of 5 stars`} style={{ '--star': `${size}px` }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = rounded >= n ? 1 : rounded >= n - 0.5 ? 0.5 : 0
        return (
          <svg key={n} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={`half-${uid}-${n}`}>
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="transparent" />
              </linearGradient>
            </defs>
            <path d={STAR} fill={`url(#half-${uid}-${n})`} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        )
      })}
    </span>
  )
}

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

/* Pick 1 to 5 stars. Works with a mouse, touch, and arrow keys (it is a radio group). */
export function StarPicker({ value, onChange }) {
  return (
    <div className="star-picker" role="radiogroup" aria-label="Your rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className={value >= n ? 'on' : ''}>
          <input
            type="radio"
            name="rating"
            value={n}
            checked={value === n}
            onChange={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}, ${WORDS[n]}`}
          />
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={STAR} />
          </svg>
        </label>
      ))}
      <span className="star-word" aria-hidden="true">{WORDS[value] || 'Tap a star'}</span>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StarRow } from './Stars.jsx'
import { loadFeedback } from '../lib/feedback.js'

/* Real ratings and approved comments from /api/feedback. Hidden until the API is set up. */
export default function Testimonials() {
  const [data, setData] = useState(undefined)

  useEffect(() => {
    let alive = true
    loadFeedback().then((result) => {
      if (alive) setData(result)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!data) return null

  return (
    <section className="lp-section" aria-labelledby="ratings">
      <p className="lp-label">Ratings</p>
      <div className="rating-head">
        <h2 id="ratings" className="lp-title">What people say.</h2>
        {data.count > 0 ? (
          <div className="rating-summary">
            <strong>{data.average.toFixed(1)}</strong>
            <StarRow value={data.average} size={20} />
            <span>{data.count} rating{data.count === 1 ? '' : 's'}</span>
          </div>
        ) : null}
      </div>

      {data.testimonials.length ? (
        <div className="quotes">
          {data.testimonials.map((item, index) => (
            <figure className="quote" key={`${item.date}-${index}`}>
              <StarRow value={item.rating} size={15} />
              <blockquote>{item.comment}</blockquote>
              <figcaption>{item.name} · {item.date}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="lp-empty">{data.count > 0 ? 'No written reviews yet.' : 'No ratings yet.'} Tried PhoneCam? Tell us how it went.</p>
      )}

      <div className="row-actions rating-cta">
        <Link className="lp-cta primary" to="/rate">Rate PhoneCam</Link>
      </div>
    </section>
  )
}

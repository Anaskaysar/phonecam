export default function Status({ text, state = '', className = '' }) {
  return (
    <p className={`status ${className}`.trim()} role="status">
      <span className={state ? `dot ${state}` : 'dot'} aria-hidden="true" />
      <span>{text}</span>
    </p>
  )
}

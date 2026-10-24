import { THEMES, useTheme } from '../lib/theme.js'

export default function ThemePicker({ label = 'Color', compact = false }) {
  const [theme, setTheme] = useTheme()
  return (
    <div className={compact ? 'theme-picker compact' : 'theme-picker'} role="radiogroup" aria-label={label}>
      {compact ? null : <span className="theme-label">{label}</span>}
      <div className="swatches">
        {THEMES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={theme === item.id}
            aria-label={item.name}
            title={item.name}
            className={theme === item.id ? 'swatch on' : 'swatch'}
            style={{ '--swatch': item.accent }}
            onClick={() => setTheme(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

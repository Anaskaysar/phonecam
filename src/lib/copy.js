export async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const field = document.createElement('textarea')
    field.value = value
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.left = '-9999px'
    document.body.appendChild(field)
    field.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      ok = false
    }
    field.remove()
    return ok
  }
}

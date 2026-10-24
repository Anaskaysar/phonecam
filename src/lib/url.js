export function hashUrl(path, origin) {
  const url = new URL(origin || window.location.href)
  const here = new URL(window.location.href)
  url.pathname = here.pathname
  url.search = ''
  url.hash = path.startsWith('/') ? path : `/${path}`
  return `${url.origin}${url.pathname}${url.hash}`
}

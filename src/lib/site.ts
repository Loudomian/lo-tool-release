export function href(path = '') {
  return (
    import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
  )
}

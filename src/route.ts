export type Route = 'editor' | 'rules' | 'report' | 'styleguide'

export function routeFromHash(hash: string): Route {
  if (hash === '#/rules') return 'rules'
  if (hash === '#/report') return 'report'
  if (hash === '#/styleguide') return 'styleguide'
  return 'editor'
}

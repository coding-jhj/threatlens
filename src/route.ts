export type Route = 'editor' | 'rules' | 'report' | 'eval' | 'styleguide'

export function routeFromHash(hash: string): Route {
  if (hash === '#/rules') return 'rules'
  if (hash === '#/report') return 'report'
  if (hash === '#/eval') return 'eval'
  if (hash === '#/styleguide') return 'styleguide'
  return 'editor'
}

export type Route = 'editor' | 'rules' | 'styleguide'

export function routeFromHash(hash: string): Route {
  if (hash === '#/rules') return 'rules'
  if (hash === '#/styleguide') return 'styleguide'
  return 'editor'
}

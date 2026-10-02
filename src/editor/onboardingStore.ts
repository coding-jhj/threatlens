export const ONBOARDED_KEY = 'threatlens.onboarded.v1'

export const hasOnboarded = (): boolean => {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1'
  } catch {
    return false
  }
}
export const markOnboarded = (): void => {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1')
  } catch {
    /* 저장이 막힌 브라우저에서는 안내가 다시 뜰 뿐이다 */
  }
}

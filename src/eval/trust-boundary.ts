import { build, type Sample } from '../samples/samples'

/**
 * 평가 전용 구조: 외주 업체가 회사 밖에서 설비 제어에 원격으로 닿는 경우.
 * SAMPLES(마법사·예시 메뉴에 쓰는 5종)에는 넣지 않는다 — "예시 5종" 완성 기준(plan.md)과
 * e2e 테스트(e2e/samples.spec.ts)가 그 개수에 고정되어 있기 때문이다. 신뢰 경계 규칙
 * (R-35~37, R-39)이 예시 5종에서 전혀 발동하지 않아 평가하지 못했던 자리를 메우는 용도로만
 * EvalPage/evaluate.test.tsx에서 SAMPLES와 함께 추가로 평가한다.
 */
export const TRUST_BOUNDARY_SAMPLE: Sample = {
  id: 'vendor-remote-control',
  title: '외주 업체 원격 설비 제어 (평가 전용)',
  description: '사외 유지보수 업체가 원격으로 센서값을 보고 제어 API를 호출해 설비를 조정하는 AI. 사람 승인 단계가 없다.',
  graph: build(
    [
      ['vendor', 'external_party', ['zone.outside']],
      ['web', 'web_page'],
      ['ai', 'ai_agent', ['data.sensitive']],
      ['api', 'ext_api'],
      ['ctrl', 'control_api'],
      ['plc', 'plc'],
    ],
    [
      ['vendor', 'ai'],
      ['web', 'ai'],
      ['ai', 'api'],
      ['ai', 'ctrl'],
      ['ctrl', 'plc'],
    ],
  ),
}

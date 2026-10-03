# ThreatLens (AI 위협 지도)

AI 서비스 구조를 그리면 공격 경로를 **규칙 기반**으로 찾아 주는 무료 브라우저 도구입니다. 서버·AI 호출·로그인 없음. 입력한 구조는 브라우저 밖으로 나가지 않습니다.

> 이 도구의 규칙·시나리오·점수는 AI가 작성했고 **사람 전문가 검수 전**입니다. HAZOP·LOPA·SIL 판정·IEC 61511 절차·변경관리(MOC)를 대체하지 않습니다. 자세한 한계는 [docs/limits.md](docs/limits.md).

## 기능
- **질문 8개 마법사**: 답하면 구조도가 자동 생성됩니다 (256개 조합 전수 검사).
- **캔버스 편집기**: 부품 20개·속성 18개(사외 영역·신뢰 경계 포함)를 끌어 놓고 화살표로 연결.
- **규칙 40개** (R-01~R-40): OWASP LLM 2025, MITRE ATLAS, MITRE ATT&CK ICS, CISA, IEC 61511 근거 표기. 범주: 프롬프트 주입 6 · 데이터 유출 9 · 도구 오남용 12 · 저장·로그 5 · 화학·공정 8.
- **점수와 행동 계획**: AI 노드별 `100×(1−Π(1−위험))`, 전체는 최댓값. 난이도 반영 추천 5단계, 적용 시 점수 변화 미리보기.
- **위협 카드**: 원인 → AI가 하는 일 → 결과 3줄 시나리오, 위험 마름모(hazard diamond), 캔버스 경로 번호 배지.
- **구조 점검**: 입력 없는 AI, 끊긴 부품, 닿지 않는 도구, 뒤집힌 화살표 경고.
- **보고서 v2**: 표제란 + 구조 도면 SVG + 요약 + 행동 계획 표, A4 인쇄(PDF), Markdown 내보내기.
- **공유·저장**: 링크·파일로 구조 저장/열기.
- **평가 페이지**: 정답표 대비 재현율 공개 ("평가표" 화면).

## 수치 (정직하게)
| 항목 | 값 |
|---|---|
| 정답표 v1 (29건) | 느슨 22/29 = 76%, 엄격 16/29 = 55% |
| 정답표 v2 (36건) | 느슨 27/36 = 75%, 엄격 21/36 = 58% |
| 경고 적중 | 37/44 = 84% (정답표 밖 경고 7건은 "정답표 확장 필요") |
| 예시 5종 점수 | 문서 Q&A 30 · 고객지원봇 67 · 코드 에이전트 69 · 메일 비서 55 · 공정 비서 54 |
| 시험 | vitest 800 + Playwright 76 |

경계 규칙(R-35~37, R-39)은 예시 5종에서 발동하지 않아 평가하지 못했습니다. 상세: [docs/eval/results.md](docs/eval/results.md).

## 개발
```bash
npm install
npm run dev      # 개발 서버
npm run lint     # oxlint
npm test         # vitest
npm run build    # tsc -b && vite build
npm run e2e      # Playwright
```
Playwright를 시스템 Chromium으로 돌릴 때: `PW_CHROMIUM=/path/to/chromium npm run e2e`.

## 배포
GitHub Actions(`.github/workflows/deploy.yml`)가 `main` 푸시 때 시험 후 GitHub Pages로 배포합니다. 주소는 저장소 Settings → Pages에서 확인합니다.

## 문서
- [docs/upgrade-plan.md](docs/upgrade-plan.md): 업그레이드 계획 G0~G8, F1~F4
- [docs/rules.md](docs/rules.md): 규칙 40개와 근거
- [docs/scoring.md](docs/scoring.md): 점수 계산·가정값
- [docs/limits.md](docs/limits.md): 한계, 민감도, G6·G7 이후 새 한계
- [docs/eval/](docs/eval): 정답표, 평가 결과, 블라인드 재판정, 기준 구조
- [docs/user-test/](docs/user-test): 5인 사용성 테스트 스크립트·기록표 (`node scripts/summarize-usertest.mjs 기록표.csv`)
- [docs/g2-action-plan.md](docs/g2-action-plan.md), [g3](docs/g3-scenario-and-diamond.md), [g4](docs/g4-wizard.md): 단계별 설계 메모

## 기술
React 19 · Vite · TypeScript · React Flow 12 · vitest · Playwright · oxlint

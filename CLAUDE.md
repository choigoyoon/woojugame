# CLAUDE.md — 블록 점프 월드: 별빛특급 구출 작전 개발 헌장

이 문서는 저장소에서 작업하는 AI 에이전트와 개발자가 반드시 지켜야 하는 **핵심 설계 원칙, 아키텍처 경계, 빌드·검증 규칙**을 정의합니다. 전체 설계와 단계별 로드맵은 [`PLAN.md`](file:///C:/Users/woojupapa/.gemini/antigravity/scratch/woojugame/PLAN.md)를 단일 진실 공급원(Single Source of Truth)으로 삼습니다.

---

## 1. 절대 설계 원칙 (Doubt-Driven & Game-First 80:20)

1. **항상 의심하고 검증하라 (`이게 맞나? 더 나은 건 없나?`)**:
   - 기능을 추가하거나 수정할 때마다 *"아이가 이걸 재미있는 게임으로 느낄까, 아니면 학교 숙제로 느낄까?"*, *"색깔만 보고 찍게 만드는 스포일러는 없나?"*, *"UI가 겹치거나 가짜 완료가 뜨지 않나?"* 를 스스로 반문하고 검증한다.
2. **게임의 재미 80% : 인지 부스터 20%**:
   - 조작의 손맛, 레고 브릭 조립의 시각적 성취감, 별빛특급 구출 스토리가 중심(80%)이다. 판단·기억·수량·언어 요소는 플레이 흐름을 끊지 않는 인게임 부스터·단서(20%)로만 작동해야 한다.
3. **금지어 및 훈계 노출 절대 금지**:
   - 화면·코드·문구 어디에도 `'교육'`, `'훈련'`, `'집중력'`, `'치료'`, `'학습'`, `'선생님 말씀'` 등의 단어를 노출하지 않는다 (`scripts/build-pwa.mjs` 및 `tests/harbor.test.js`가 자동 검사함).
4. **외부 에셋 제로 (100% Procedural Canvas 2D & Web Audio API)**:
   - 외부 이미지(`.png`, `.jpg`), 외부 사운드(`.mp3`, `.wav`), 외부 런타임 라이브러리를 사용하지 않는다. 모든 그래픽은 Canvas 2D 절차적 렌더링(`js/material.js`, `js/art.js`, `js/harbor-art.js`)으로, 모든 사운드는 Web Audio API(`js/sound.js`)로 합성한다.

---

## 2. 기술 가드레일 (모바일 9:16 & 60fps)

- **해상도 및 안전 영역**: 논리 캔버스 `720×1280` (9:16 FIT). 상단·하단 `max(48px, env(safe-area-inset-*))` 안전 영역 안쪽에 모든 터치 버튼을 배치한다.
- **오터치 방지 (`800ms`)**: 모드 전환 직후 800ms 동안 홈/뒤로가기 버튼을 비활성화해 빠른 연타 중 실수로 로비로 나가는 현상을 막는다.
- **고정 물리 스텝 (`5ms`) & 프레임 클램프 (`50ms`)**: `requestAnimationFrame` 루프에서 `dt`를 최대 50ms로 클램프하고, 시뮬레이션은 5ms 고정 타임스텝으로 실행해 주사율(60Hz/120Hz)과 무관하게 동일한 물리 결과를 보장한다.
- **별빛특급 4파츠 엄격 판정 (`trainParts`)**:
  - `loco`(배틀), `beacon`(계단 등대 완주), `coach`(러너 객차 도킹), `reactor`(광장 엔진 납품) 4개 파츠와 배틀 3라운드 클리어가 **모두 충족될 때만** `complete === true`가 된다. 단일 모드 클리어나 브레이크 1회 성공만으로 전체 완료를 띄워서는 안 된다.

---

## 3. 모듈 구조 및 책임 경계

```text
index.html                  # 단일 진입점 (9:16 캔버스 + 접근성 라이브 영역)
manifest.json / sw.js       # 오프라인 PWA 매니페스트 및 자동 생성 서비스 워커
css/style.css               # 반응형 뷰포트, 안전 영역, 터치 액션 제어
js/
├── main.js                 # 앱 상태 머신 (lobby/shop/center/stairs/runner/plaza/battle), 입력 라우팅
├── constants.js            # 캔버스 규격, 물리 상수, 테마 팔레트, 상점 코스튬·무기 테이블
├── profile.js              # ProfileStorage v4 (스키마 검증, 마이그레이션, 섀도 백업, 스타/진행도)
├── perf.js                 # AdaptiveQualityGovernor (high/medium/low 자동 품질 조절 및 FPS 계측)
├── sound.js                # Web Audio API 절차적 효과음·배경음 합성기
├── material.js             # 오프스크린 3D 레고 스터드 블록, 구름, 나무, 스파크 스프라이트 캐시
├── art.js                  # 레고 미니피겨(머리 스터드, C자 집게손, 2관절 팔다리), 골드 스터드 코인
├── harbor-art.js           # 별빛특급 4파츠(trainParts), 레고 기차·객차, 삐코(picoToy), 코코(cocoToy)
├── lobby.js                # 3구역 무겹침 히어로 선반(아바타/작전현황/기차도크) & 2×2 작전 카드
├── center.js               # 레고 커스텀 조립 공방(Shop) & 보호자 센터(2초 롱프레스 + 곱셈 게이트)
├── game.js                 # [작전 2: 블록 계단 점프] 시뮬레이션 코어
├── scenarios.js            # [작전 2] 등대 다리 현장 판단 시나리오 데이터
├── renderer.js             # [작전 2] 계단, 구름 등대, 고도 게이지, 2관절 점프 렌더러
├── puzzle-renderer.js      # [작전 2] 갈라진 구름 다리 선택 이벤트 렌더러
├── runner.js               # [작전 3: 슈퍼 블록 런] 폭주 객차 추격 시뮬레이션 코어
├── word-data.js            # [작전 3] 행동 단서 및 어휘 브릭 데이터
├── plaza.js                # [작전 4: 블록 광장 심부름] 엔진 코어 부품 수거 시뮬레이션 코어
├── plaza-data.js           # [작전 4] 엔진 부품 도면 및 광장 작업대 배치 데이터
├── adventure-renderer.js   # [작전 3 & 4] 러너·광장 통합 렌더러
├── battle.js               # [작전 1: 다리 배틀 런] 2선로 분대·보스전 시뮬레이션 코어
└── battle-renderer.js      # [작전 1] 3종 레고 보스 크레인, 잠금 볼트 HUD, 탄종별 발사체 렌더러
```

---

## 4. 개발 및 검증 워크플로우

코드를 수정한 뒤에는 반드시 아래 순서로 빌드와 테스트를 통과시켜야 합니다.

```bash
# 1. 서비스 워커(sw.js) SHA-256 에셋 해시 갱신 및 정적 금지어/구문 검증
npm run build

# 2. 115개 이상 Node.js 헤드리스 단위/시뮬레이션 테스트 실행
npm test

# 3. 로컬 정적 서버 실행 (기본 포트 3000)
npm run dev
```

- **주의사항**: `js/`, `css/`, `index.html`, `manifest.json`, `assets/` 파일을 수정하면 해시가 바뀌므로 커밋 전 반드시 `npm run build`를 실행해 갱신된 `sw.js`를 함께 커밋해야 `tests/pwa.test.js`가 통과합니다.

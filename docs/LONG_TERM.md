# 저장 안전성(L0) 및 챕터 2~4 장기 확장 명세서 (`docs/LONG_TERM.md`)

> 본 문서는 [`PLAN.md`](file:///C:/Users/woojupapa/.gemini/antigravity/scratch/woojugame/PLAN.md)의 **Phase 4(중단 이어하기 및 연령 설정)** 와 **Phase 5(챕터 2~4 캠페인 확장)** 를 구현하기 위한 기술 명세서입니다.

---

## 1. 저장 안전성 및 중단 이어하기 (`L0-A / L0-B / L0-C`)

모바일 웹 환경에서는 아이가 플레이 도중 홈 화면으로 나가거나 브라우저 탭이 메모리에서 내려가는 일이 자주 발생합니다. 내 스타와 기차 조립 상태는 물론, 진행 중이던 작전 상태까지 안전하게 보호해야 합니다.

### 1.1 `L0-A`: 원자적 프로필 저장 및 섀도 백업 (구현 완료 — `js/profile.js`)
- **주 저장 키**: `block_jump_profile_v4`
- **섀도 백업 키**: `block_jump_profile_v4__backup`
- **손상 격리 키**: `block_jump_profile_v4__corrupt_backup`
- **동작 규칙**:
  1. `save()` 호출 시 현재 정상 데이터를 `__backup`에 먼저 복사한 뒤 주 저장 키를 갱신한다.
  2. `load()` 호출 시 주 저장 키의 JSON 파싱 또는 스키마 검증(`validateCandidate`)이 실패하면, 손상된 원문을 `__corrupt_backup`에 보존하고 `__backup`에서 즉시 복구한다 (`status: 'recovered-backup'`).

### 1.2 `L0-B & L0-C`: 진행 중 작전 체크포인트 (`activeRun`, Phase 4 구현)
작전 도중 의미 있는 진행 시점마다 `profile.data.activeRun`에 경량 스냅샷(1KB 미만)을 기록합니다.

```js
// profile.data.activeRun 스키마 명세
activeRun: {
  mode: 'battle' | 'stairs' | 'runner' | 'plaza',
  updatedAt: 1732520000000,
  state: {
    // mode === 'battle': { roundIndex, squadSize, weaponType, starsEarned }
    // mode === 'stairs': { count, score, combo }
    // mode === 'runner': { distanceLeft, score, coins, boostCharge }
    // mode === 'plaza':  { targetIds, bagIds, deliveredIds, round }
  }
}
```

- **체크포인트 기록 시점**:
  - 배틀: 보급 게이트 통과 시점 및 보스전 진입 시점
  - 계단: 10층 단위 브레이크 통과 시점 및 다리 이벤트 통과 시점
  - 러너: 20% 구간 통과 시점 및 코코 단서 달성 시점
  - 광장: 부품을 가방에 담거나 기차 도크에 부분 납품한 시점
  - 공통: `visibilitychange` (`hidden`) 및 `pagehide` 이벤트 발생 시 즉시 플러시
- **체크포인트 해제 시점**:
  - 해당 작전이 결과 화면(`Victory` / `Result`)에 도달해 최종 스타와 파츠가 프로필에 반영되면 `activeRun = null`로 초기화한다.

---

## 2. 데이터 드리븐 4챕터 월드 확장 아키텍처 (Phase 5)

챕터 2~4를 추가할 때 `js/battle.js`, `js/game.js`, `js/runner.js`, `js/plaza.js` 시뮬레이션 코어를 복사해서 새 파일을 만들지 않습니다. **하나의 4모드 시뮬레이션 엔진 위에 챕터별 테마·보스·시나리오·부품 테이블만 교체**하여 확장합니다.

### 2.1 챕터 정의 테이블 구조 (`CHAPTERS`)

| 챕터 ID | 이름 | 배경 팔레트 & 랜드마크 | 4대 파츠 조립 목표 | 보스 3종 구성 |
| :--- | :--- | :--- | :--- | :--- |
| **`ch1_harbor`** | **하늘 항구** (현재 구현) | 푸른 하늘 항구 & 구름 등대 | 별빛특급 기관차·등대 신호기·객차·엔진 코어 | 철통 집게 / 쌍둥이 자석 / 항구 수호 거인 |
| **`ch2_factory`** | **구름 공장** | 노을빛 증기 파이프 & 거대 시계 굴뚝 | 구름 증기차 보일러·압력 밸브·석탄차·터빈 코어 | 증기 프레스 / 회전 톱니 크레인 / 공장장 볼트 메카 |
| **`ch3_jungle`** | **장난감 정글** | 에메랄드 브릭 숲 & 태엽 폭포 | 정글 탐험열차 기관차·나침반 안테나·탐험 객차·태엽 코어 | 덩굴 집게 거미 / 쌍둥이 부메랑 / 정글 수호 골렘 |
| **`ch4_station`** | **별빛 역** | 오로라 밤하늘 & 별빛 중앙 시계탑 | 은하수 특급 본체·별빛 안테나·침대 객차·초신성 코어 | 중력 자석 크레인 / 프리즘 레이저 / 루프의 은하 거인 |

### 2.2 성능 및 메모리 예산 유지 규칙
- 챕터가 늘어나도 한 번에 메모리에 올리는 오프스크린 타일 캐시(`js/material.js`)는 **현재 활성 챕터의 팔레트 세트로 한정**하여 모바일 브라우저 메모리 사용량을 50MB 미만으로 유지한다.
- 외부 이미지·오디오 에셋 제로 원칙을 모든 챕터에서 동일하게 유지해 초기 로딩 용량(JS 전체 < 300KB)과 오프라인 PWA 즉시 구동 속도를 보장한다.

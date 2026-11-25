# 🚂 블록 점프 월드: 별빛특급 구출 작전 (WoojuGame)

> **레고 브릭 장난감을 조립하고 조종해 악당 집게 크레인에게 붙잡힌 '별빛특급' 기차의 4대 핵심 파츠를 되찾아 합체시키는 9:16 모바일 아케이드 액션 게임**
>
> - **실시간 플레이 (GitHub Pages)**: [https://choigoyoon.github.io/woojugame/](https://choigoyoon.github.io/woojugame/)
> - **마스터 설계 및 개발 계획서**: [`PLAN.md`](file:///C:/Users/woojupapa/.gemini/antigravity/scratch/woojugame/PLAN.md)
> - **개발 헌장 및 모듈 가이드**: [`CLAUDE.md`](file:///C:/Users/woojupapa/.gemini/antigravity/scratch/woojugame/CLAUDE.md)

---

## 1. 게임 소개 및 핵심 루프

**블록 점프 월드: 별빛특급 구출 작전**은 7~11세 아이가 스스로 계속하고 싶어지는 **직관적인 아케이드 액션(80%)** 안에 **순간 판단·단서 기억·수량 비교·행동 선택 부스터(20%)** 를 자연스럽게 녹여낸 순수 웹 기반(Zero-Asset Canvas 2D & Web Audio) 게임입니다.

### 🌟 별빛특급 4대 파츠 합체 메타 루프
하늘 항구에서 뿔뿔이 흩어진 별빛특급을 완성하려면 4가지 구출 작전을 수행해야 합니다. 각 작전을 클리어할 때마다 **로비 우측 도크에 있는 내 기차에 실제 레고 부품이 하나씩 조립**되고, 다른 작전의 배경(구름 등대 서치라이트 등)도 함께 살아납니다.

| 작전명 | 구출 파츠 | 핵심 액션 (80%) | 전술 부스터 (20%) |
| :--- | :--- | :--- | :--- |
| **작전 1: 다리 배틀 런** | 🚂 **기관차 본체 (`loco`)** & 화물칸 3량 | 2선로 이동, 동료 분대 일제 사격, 3종 거대 레고 보스 크레인 잠금 볼트(`🔩`) 파괴 | 좌/우 보급 게이트(`+N`, `×N`, 특수 무기) 순간 수량 비교 및 선로 선택 |
| **작전 2: 블록 계단 점프** | 🚨 **구름 등대 신호기 (`beacon`)** | 방향 전환(`Turn`) & 등반(`Climb`) 2버튼 리듬 액션으로 구름 등대 등반 | 10층 정지 신호 브레이크 타이밍 & 갈라진 구름 다리 현장 단서 판단 |
| **작전 3: 슈퍼 블록 런** | 🚃 **별빛 객차 (`coach`)** | 1단·2단 공중제비 점프, 3코인 포물선 가이드 질주, 폭주 객차 추격 도킹 | 코코가 외치는 지붕 위 행동 단서 포착 및 황금 질주 부스터 발동 |
| **작전 4: 블록 광장 심부름** | ⚡ **엔진 코어 (`reactor`)** | 항구 광장 작업대 4방향 탐색 및 코코의 기차 도크로 부품 운반 | 출발 전 삐코의 엔진 부품 3종 도면 기억 및 현장 근접 이름표 대조 |

---

## 2. 주요 기술적 특징

- **100% 절차적 레고 브릭 그래픽 & 2관절 모션**:
  - 외부 이미지 파일 없이 `Canvas 2D` 오프스크린 프리베이킹(`js/material.js`)으로 3D 원통형 레고 스터드 블록을 렌더링합니다.
  - 캐릭터는 머리 스터드, C자 집게손, **2관절(무릎·팔꿈치) 굴곡**, 비대칭 보폭, 속도 피치, 착지 스쿼시, 망토·날개 2차 잔상 물리로 생동감 있게 움직입니다.
- **무겹침 3구역 로비 & 조립 공방**:
  - 로비 상단 히어로 선반을 **좌측 아바타 포디움 / 중앙 작전 현황 보드 / 우측 기차 조립 도크(클리핑 적용)** 로 분리해 화면 겹침을 원천 차단했습니다.
  - **레고 조립 공방(`js/center.js`)** 에서 작전으로 모은 골드 스터드(스타)로 모자·망토·날개·제트팩과 4종 무기(새총·물총·버블건·불꽃 완드)를 조립할 수 있습니다.
- **원자적 저장 안전성 (`ProfileStorage v4`) & 오프라인 PWA**:
  - 저장 시 스키마 검증과 섀도 백업(`__backup`)을 수행해 브라우저 강제 종료 시에도 진행도와 스타를 안전하게 복구합니다.
  - SHA-256 에셋 매니페스트 기반 Service Worker(`sw.js`)로 오프라인에서도 즉시 실행됩니다.
- **적응형 60fps 품질 제어 (`AdaptiveQualityGovernor`)**:
  - 프레임 시간을 실시간 계측해 저사양 모바일 기기에서도 `high → medium → low` 이펙트 밀도를 자동 조절하여 60fps를 방어합니다.

---

## 3. 문서 아키텍처

- [`PLAN.md`](file:///C:/Users/woojupapa/.gemini/antigravity/scratch/woojugame/PLAN.md): **마스터 설계 및 개발 계획서** (지울 것/수정할 것/새로 만들 것 정리, 4대 작전 명세, 기술 아키텍처, Phase 1~5 로드맵)
- [`CLAUDE.md`](file:///C:/Users/woojupapa/.gemini/antigravity/scratch/woojugame/CLAUDE.md): **개발 헌장 및 가드레일** (모듈 책임, 금기 규칙, 빌드/검증 명령)
- [`docs/STORY.md`](file:///C:/Users/woojupapa/.gemini/antigravity/scratch/woojugame/docs/STORY.md): **스토리·세계관·캐릭터 바이블** (하늘 항구~별빛 역 4챕터 구조 및 삐코·코코·볼트 대사 가이드)
- [`docs/AGE_DESIGN.md`](file:///C:/Users/woojupapa/.gemini/antigravity/scratch/woojugame/docs/AGE_DESIGN.md): **7~11세 연령별 밸런스 설계서** (연령 프리셋 및 6축 난이도 매트릭스)
- [`docs/LONG_TERM.md`](file:///C:/Users/woojupapa/.gemini/antigravity/scratch/woojugame/docs/LONG_TERM.md): **저장 복구(L0) 및 챕터 2~4 장기 확장 명세서**

---

## 4. 로컬 실행 및 검증 방법

### 요구 사항
- Node.js 20 이상 (외부 npm 패키지 설치 없이 순수 Node 내장 모듈로 빌드·테스트·서버 구동)

### 실행 명령
```bash
# 로컬 개발 서버 실행 (http://localhost:3000)
npm run dev

# PWA 서비스 워커 해시 빌드 및 정적 무결성 검사
npm run build

# 전체 단위·시뮬레이션 테스트 실행 (115+ tests)
npm test
```

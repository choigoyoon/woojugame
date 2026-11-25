export const SCENARIOS = Object.freeze([
  { id: 'teacher', speech: '삐코가 등대 다리 설계도를 펼쳤어! 어떻게 조립할까?', situation: 'teacher', choices: ['listen', 'comic'], answer: 'listen', labels: ['설계도 보고 브릭 맞추기', '엉뚱한 블록 어지럽히기'] },
  { id: 'bell', speech: '구름 등대 경보 벨이 울렸어! 어디로 갈까?', situation: 'bell', choices: ['desk', 'run'], answer: 'desk', labels: ['등대 신호 레버 당기기', '위험한 난간 끝으로 뛰기'] },
  { id: 'rain', speech: '등대 다리에 비구름 폭풍이 몰아쳐! 무엇을 켤까?', situation: 'rain', choices: ['umbrella', 'fan'], answer: 'umbrella', labels: ['방수 돔 우산 펼치기', '비구름 프로펠러 틀기'] },
  { id: 'friend', speech: '코코가 구름 발판에서 미끄러졌어! 어떻게 할까?', situation: 'friend', choices: ['help', 'leave'], answer: 'help', labels: ['집게손으로 코코 잡아주기', '혼자 먼저 건너가기'] },
]);

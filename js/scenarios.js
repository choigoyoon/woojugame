export const SCENARIOS = Object.freeze([
  { id: 'teacher', speech: '선생님이 칠판 앞에 계셔. 어떻게 할까?', situation: 'teacher', choices: ['listen', 'comic'], answer: 'listen', labels: ['책을 덮고 선생님 보기', '만화책 펼치기'] },
  { id: 'bell', speech: '수업 종이 울렸어. 어디로 갈까?', situation: 'bell', choices: ['desk', 'run'], answer: 'desk', labels: ['자리에 앉기', '복도로 달려가기'] },
  { id: 'rain', speech: '비가 주룩주룩 내려. 무엇을 쓸까?', situation: 'rain', choices: ['umbrella', 'fan'], answer: 'umbrella', labels: ['우산 쓰기', '선풍기 켜기'] },
  { id: 'friend', speech: '친구가 넘어졌어. 어떻게 할까?', situation: 'friend', choices: ['help', 'leave'], answer: 'help', labels: ['손잡고 일으켜 주기', '지나쳐 가기'] },
]);

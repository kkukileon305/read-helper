<script lang="ts">
  const prompts = [
    "Svelte 5로 중국어 리딩 헬퍼를 만들어줘. Google Gemini 2.5 flash API를 이용해서 어려운 단어를 뽑고, 주음부호와 뜻을 알려줘. Supabase를 연동해줘.",
    "사이드바(보관함) 레이아웃 추가 (PC에서는 화면을 밀어내는 분할화면, 모바일에서는 슬라이드바 구조).",
    "로컬 스토리지에 데이터를 저장하고, 사용자가 구글 로그인 시 DB로 자동 마이그레이션(동기화) 처리를 해줘.",
    "전체적인 테마를 글래스모피즘 기반의 깔끔한 화이트 테마로 변경하고, 사이드바 드래그 리사이징 기능을 추가해줘.",
    "모바일 환경 반응형 최적화(메뉴 버튼 겹침 해결 등)를 적용해줘.",
    "입력 지연(디바운스) 방식 대신 '문장 분석하기' 제출(submit) 버튼으로 변경해 불필요한 API 토큰 낭비를 막아줘.",
    "비로그인 상태에서 로컬스토리지에 저장된 문장이 로그인 후 DB로 들어갈 때 중복되는 건 필터링하여 삽입되도록 해줘.",
    "h1 텍스트 줄이고, 메뉴 버튼 정렬, 모바일 화면 이메일 숨김 및 비로그인 시 구글 로그인 버튼을 하얀 배경 앱 모티브 디자인으로 변경해줘.",
    "PWA를 설정하고 앱 설치(<Download/>) 버튼을 인터페이스에 추가해줘. 단, `standalone` 앱으로 이미 접속된 상태라면 해당 설치 버튼을 안 보이게 숨기도록 분기 처리해줘.",
    "웹사이트 파비콘(favicon)과 PWA 앱 아이콘을, 보라색 배경에 '蘇'라는 흰색 한자 텍스트가 정중앙에 위치한 독자적인 SVG 파일로 제작해 연동해줘.",
    "앱 설치 버튼을 헤더에서 화면 콘텐츠 메인 가장 아래쪽(Footer 느낌)으로 옮겨주고, 화면 스크롤 시 보관함 버튼이 다른 글자들처럼 자연스럽게 위로 올라갈 수 있도록(position absolute) 변경해줘.",
    "사용자가 문장 입력 후, 버튼을 누르고 데이터를 기다리거나 분석에 성공하면 뒤의 큰 텍스트 입력창 자체를 숨겨줘. 실패(Error) 시에만 입력창을 다시 띄워줘.",
    "분석 성공 직후 숨겨진 텍스트 상자를 다시 열어 새로운 문장을 입력하거나 수정할 수 있는 <새 문장 입력 / 수정하기> 토글 버튼을 결과창 안에 만들어줘.",
    "보관함 수동 저장 버튼을 완전히 삭제하고, 분석이 완료되는 것과 동시에 백그라운드 모듈이 '사용자가 묻지 않아도 자동으로 결과값을 저장'하게 텍스트-기반 오토 세이브를 구현해줘.",
    "메뉴 문구였던 '보관함'이라는 단어들을 '최근기록'으로 바꾸고, 기존 햄버거 형태(Menu) 아이콘 대신 시계 형태 역사(History) 모양 아이콘으로 탈바꿈해줘.",
    "Uncaught Svelte error: each_key_duplicate 에러가 발생해. 문장 내에 똑같은 어려운 단어(약, 約ㄩㄝ)가 두 번 이상 파싱돼서 Svelte {#each} 루프를 터트리는데, $derived.by 셋방식 중복 회피를 짜줘.",
    "Vercel 환경 배포를 대비하여, Supabase의 OAuth 리다이렉트 URL 콜백을 `import.meta.env.DEV`에 의거하여 로컬 환경일 땐 localhost:5173, 배포 모드일 땐 실서버 도메인으로 분기 연결 처리해줘.",
    "내가 여기서 이 프로젝트를 기획하며 AI와 주고받았던 프롬프트 내역(History)들을 요약해 `/prompt` 페이지를 하나 새로 만들어줘. 단, 메인 앱 페이지에서는 절대 이 곳으로 이동할 수 있는 바로가기 버튼을 달면 안 돼!",
  ];
</script>

<svelte:head>
  <title>프롬프트 기록 - 중국어 읽기 도우미</title>
</svelte:head>

<div class="prompt-page">
  <div class="glass container">
    <h1>📝 Read-Helper: 대화형 AI 프롬프트 기록</h1>
    <p class="subtitle">
      이 중국어 리딩 헬퍼 서비스가 기획, 구현, 최적화되기까지 개발 AI와 나눴던
      요청 사항 요약본입니다.
    </p>

    <ul class="prompt-list">
      {#each prompts as prompt, index}
        <li class="prompt-item">
          <div class="prompt-number">{index + 1}</div>
          <div class="prompt-text">{prompt}</div>
        </li>
      {/each}
    </ul>
  </div>
</div>

<style>
  /* Base theme usage from global variables assuming global css is active */
  .prompt-page {
    min-height: 100vh;
    padding: 3rem 1.5rem;
    display: flex;
    justify-content: center;
  }

  .container {
    width: 100%;
    max-width: 800px;
    padding: 3rem;
    border-radius: 20px;
    border: 1px solid var(--border-color);
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: var(--text-main);
    font-weight: 800;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 1.1rem;
    margin-bottom: 2.5rem;
  }

  .prompt-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .prompt-item {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
    padding: 1.25rem;
    border-radius: 12px;
    background: rgba(0, 0, 0, 0.02);
    border: 1px solid rgba(0, 0, 0, 0.05);
    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease;
  }

  .prompt-item:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
  }

  .prompt-number {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    background: var(--accent);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-weight: bold;
    font-size: 0.9rem;
  }

  .prompt-text {
    flex: 1;
    font-size: 1.05rem;
    color: var(--text-main);
    line-height: 1.5;
    padding-top: 0.2rem;
    word-break: keep-all;
  }
</style>

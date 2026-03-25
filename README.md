# 중국어 읽기 도우미 (Chinese Reading Helper)

대만식 번체자(Traditional Chinese) 전용 중국어 독해 보조 웹 애플리케이션입니다. 
사용자가 중국어 문장이나 단락을 하단 빈칸에 붙여넣으면, AI가 어려운 어휘를 자동으로 추출하고 주음부호(Bopomofo)와 한국어 뜻을 병기하여 독해를 돕습니다.

## ✨ 주요 기능
- **실시간 어휘 분석**: 텍스트를 입력하면 구글 `gemini-2.5-flash` AI 모델을 통해 문맥을 분석하여 난이도가 높은 단어들을 선별합니다.
- **번체자 및 주음부호 전용**: 대만식 중국어 학습자를 위해 한어병음 대신 주음부호(`ㄅㄆㄇㄈ`)를 전용으로 지원합니다.
- **인터랙티브 하이라이팅**: 분석된 단어들은 문장 내에서 하이라이트 표시되며, 마우스를 올리면 뜻과 발음을 툴팁으로 바로 확인할 수 있습니다. 클릭 시 하단의 상세 단어 카드로 부드럽게 스크롤됩니다.
- **보관함(History) 및 검색 기능**: 분석한 문장을 저장하여 나중에 찾아볼 수 있으며 실시간 검색 필터링을 지원합니다.
- **클라우드 동기화 (Supabase + Google OAuth)**: 구글 계정으로 간편 로그인하면 기기나 브라우저가 변경되어도 저장된 보관함 데이터를 지속적으로 읽고 쓸 수 있습니다.
- **화이트 테마 & 감각적 UI**: 글래스모피즘(Glassmorphism) 기반의 깨끗한 화이트 테마(White Theme)를 지원하며, 좌측 슬라이딩 드로어를 통한 스마트한 공간 활용을 제공합니다.

## 🛠 기술 스택
- **Frontend**: SvelteKit, Svelte 5 (Runes), Vanilla CSS
- **Backend (API)**: SvelteKit Server Rendered Endpoint
- **AI Model**: Google Generative AI (Gemini 2.5)
- **Database & Auth**: Supabase (PostgreSQL, Google Auth)
- **Icons**: lucide-svelte

## 🚀 시작하기

### 사전 준비 (API 키 확보)
이 앱을 실행하려면 다음 세 가지 환경 변수 키가 필요합니다:
1. Google AI Studio API 키 (Gemini)
2. Supabase 프로젝트의 URL
3. Supabase 프로젝트의 anon / public 키

### 로컬 환경 변수 설정
프로젝트 최상단 디렉토리에 `.env` 파일을 생성하고 다음 값을 채워 넣습니다:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 설치 및 구동
```bash
npm install
npm run dev
```

터미널에서 서버가 실행되면 제공되는 로컬 주소(기본 `http://localhost:5173`)로 접속하여 앱을 사용할 수 있습니다.

<script lang="ts">
  import { onMount } from "svelte";
  import { supabase } from "$lib/supabaseClient";
  import type { Session } from "@supabase/supabase-js";
  import { Menu, Trash2 } from "lucide-svelte";

  type TextSegment = { type: "text"; content: string };
  type WordSegment = {
    type: "word";
    word: string;
    zhuyin: string;
    meaning: string;
  };
  type AnalyzeResponse = { analyzed_text: Array<TextSegment | WordSegment> };

  type SavedItem = {
    id: string;
    originalText: string;
    analyzedSegments: Array<TextSegment | WordSegment>;
    timestamp: number;
  };

  let inputText = $state("");
  let isLoading = $state(false);
  let analyzedSegments = $state<Array<TextSegment | WordSegment>>([]);
  let errorMsg = $state("");

  const MAX_CHARS = 1000;

  let savedItems = $state<SavedItem[]>([]);
  let searchQuery = $state("");
  let isSidebarOpen = $state(false);
  let sidebarWidth = $state(50);
  let isResizing = $state(false);
  let session = $state<Session | null>(null);

  const startResize = (e: MouseEvent) => {
    isResizing = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleResize = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = (e.clientX / window.innerWidth) * 100;

    // Snap to 1/4 (25%), 2/4 (50%), or 3/4 (75%)
    if (newWidth < 37.5) {
      sidebarWidth = 25;
    } else if (newWidth >= 37.5 && newWidth < 62.5) {
      sidebarWidth = 50;
    } else {
      sidebarWidth = 75;
    }
  };

  const stopResize = () => {
    if (isResizing) {
      isResizing = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("readHelperSidebarWidth", sidebarWidth.toString());
    }
  };

  onMount(() => {
    const storedWidth = localStorage.getItem("readHelperSidebarWidth");
    if (storedWidth) {
      sidebarWidth = parseFloat(storedWidth);
    }

    supabase.auth.getSession().then(({ data }) => {
      session = data.session;
      if (session) {
        syncLocalStorageToDb(session.user.id);
        fetchSavedItems(session.user.id);
      } else {
        loadFromLocalStorage();
      }
    });

    supabase.auth.onAuthStateChange((_event, _session) => {
      session = _session;
      if (_session) {
        syncLocalStorageToDb(_session.user.id);
        fetchSavedItems(_session.user.id);
      } else {
        loadFromLocalStorage();
      }
    });
  });

  const loadFromLocalStorage = () => {
    const stored = localStorage.getItem("readHelperSaved");
    if (stored) {
      try {
        savedItems = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse localStorage", e);
      }
    } else {
      savedItems = [];
    }
  };

  const syncLocalStorageToDb = async (userId: string) => {
    const stored = localStorage.getItem("readHelperSaved");
    if (stored) {
      try {
        const localItems: SavedItem[] = JSON.parse(stored);
        if (localItems.length > 0) {
          const { data: existingData } = await supabase
            .from("saved_sentences")
            .select("original_text")
            .eq("user_id", userId);
            
          const existingTexts = new Set((existingData || []).map((d) => d.original_text));
          const itemsToInsert = localItems.filter((item) => !existingTexts.has(item.originalText));

          if (itemsToInsert.length > 0) {
            const insertData = itemsToInsert.map((item) => ({
              id: item.id,
              user_id: userId,
              original_text: item.originalText,
              analyzed_segments: item.analyzedSegments,
              timestamp: item.timestamp,
            }));
            const { error } = await supabase
              .from("saved_sentences")
              .insert(insertData);
            if (error) {
              console.error("Failed to migrate data", error);
              return;
            }
          }
          localStorage.removeItem("readHelperSaved");
        }
      } catch (e) {}
    }
  };

  const fetchSavedItems = async (userId: string) => {
    const { data, error } = await supabase
      .from("saved_sentences")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false });

    if (data) {
      savedItems = data.map((row) => ({
        id: row.id,
        originalText: row.original_text,
        analyzedSegments: row.analyzed_segments,
        timestamp: row.timestamp,
      }));
    }
  };

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
    });
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  let filteredSavedItems = $derived(
    savedItems.filter((item) =>
      item.originalText.toLowerCase().includes(searchQuery.toLowerCase()),
    ),
  );

  const handleAnalyze = async () => {
    if (inputText.length > MAX_CHARS) {
      errorMsg = `입력 가능한 최대 글자 수(${MAX_CHARS}자)를 초과했습니다. 문장을 나누어서 입력해 주세요. (무료 API 제한 방지)`;
      isLoading = false;
      return;
    }

    if (!inputText.trim()) {
      analyzedSegments = [];
      errorMsg = "";
      return;
    }

    const existing = savedItems.find(
      (item) => item.originalText === inputText.trim(),
    );
    if (existing) {
      analyzedSegments = existing.analyzedSegments;
      errorMsg = "";
      isLoading = false;
      return;
    }

    isLoading = true;
    errorMsg = "";

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze text");
      }

      const data: AnalyzeResponse = await response.json();
      analyzedSegments = data.analyzed_text || [];
    } catch (err) {
      errorMsg =
        err instanceof Error ? err.message : "Unknown error occurred";
    } finally {
      isLoading = false;
    }
  };

  const saveCurrentAnalysis = async () => {
    if (!analyzedSegments.length || !inputText.trim()) return;

    if (savedItems.some((i) => i.originalText === inputText.trim())) {
      alert("이미 보관함에 저장된 문장입니다.");
      return;
    }

    const newItem: SavedItem = {
      id: crypto.randomUUID(),
      originalText: inputText.trim(),
      analyzedSegments: $state.snapshot(analyzedSegments),
      timestamp: Date.now(),
    };

    savedItems = [newItem, ...savedItems];

    if (session) {
      const { error } = await supabase.from("saved_sentences").insert([
        {
          id: newItem.id,
          user_id: session.user.id,
          original_text: newItem.originalText,
          analyzed_segments: newItem.analyzedSegments,
          timestamp: newItem.timestamp,
        },
      ]);
      if (error) console.error("DB Insert Error", error);
    } else {
      localStorage.setItem("readHelperSaved", JSON.stringify(savedItems));
    }

    isSidebarOpen = true;
  };

  const loadSavedItem = (item: SavedItem) => {
    inputText = item.originalText;
    analyzedSegments = item.analyzedSegments;
    errorMsg = "";
    isLoading = false;
    if (window.innerWidth <= 768) {
      isSidebarOpen = false;
    }
  };

  const deleteSavedItem = async (id: string, event: MouseEvent) => {
    event.stopPropagation();
    savedItems = savedItems.filter((item) => item.id !== id);
    if (session) {
      await supabase.from("saved_sentences").delete().eq("id", id);
    } else {
      localStorage.setItem("readHelperSaved", JSON.stringify(savedItems));
    }
  };

  const scrollToWord = (word: string, zhuyin: string) => {
    const elementId = `card-${btoa(encodeURIComponent(word + zhuyin)).replace(/=/g, "")}`;
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: "auto", block: "center" });
      element.classList.add("flash");
      setTimeout(() => element.classList.remove("flash"), 1000);
    }
  };

  const getHighlightedParts = (text: string, query: string) => {
    if (!query.trim()) return [{ text, isHighlight: false }];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const parts = [];
    let start = 0;
    while (start < text.length) {
      const idx = lowerText.indexOf(lowerQuery, start);
      if (idx === -1) {
        parts.push({ text: text.slice(start), isHighlight: false });
        break;
      }
      if (idx > start) {
        parts.push({ text: text.slice(start, idx), isHighlight: false });
      }
      parts.push({
        text: text.slice(idx, idx + query.length),
        isHighlight: true,
      });
      start = idx + query.length;
    }
    return parts;
  };

  let vocabularyList = $derived(
    analyzedSegments.filter((s): s is WordSegment => s.type === "word"),
  );

  let hoveredWord = $state<string | null>(null);
</script>

<svelte:head>
  <title>중국어 읽기 도우미</title>
</svelte:head>

<svelte:window onmousemove={handleResize} onmouseup={stopResize} />

<div class="layout-wrapper">
  {#if isSidebarOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sidebar-overlay" onclick={() => (isSidebarOpen = false)}></div>
  {/if}

  <aside
    class="sidebar glass"
    class:open={isSidebarOpen}
    style={isSidebarOpen ? `width: ${sidebarWidth}vw` : ""}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="resizer" onmousedown={startResize}></div>
    <div
      class="sidebar-inner"
      style={isSidebarOpen ? `width: ${sidebarWidth}vw` : ""}
    >
      <div class="sidebar-header">
        <h2>보관함</h2>
        <button
          class="close-btn"
          onclick={() => (isSidebarOpen = false)}
          aria-label="닫기">✕</button
        >
      </div>
      <input
        type="text"
        class="search-input glass"
        bind:value={searchQuery}
        placeholder="저장된 문장 검색..."
      />
      <div class="saved-list-container">
        {#if savedItems.length === 0}
          <p class="empty-text">저장된 문장이 없습니다.</p>
        {:else if filteredSavedItems.length === 0}
          <p class="empty-text">검색 결과가 없습니다.</p>
        {:else}
          <ul class="saved-list">
            {#each filteredSavedItems as item (item.id)}
              <li class="saved-item">
                <button
                  class="load-btn"
                  onclick={() => loadSavedItem(item)}
                  aria-label="이 문장 불러오기"
                >
                  <span class="saved-text">
                    {#each getHighlightedParts(item.originalText, searchQuery) as part}
                      <span class:search-highlight={part.isHighlight}
                        >{part.text}</span
                      >
                    {/each}
                  </span>
                  <span class="saved-date"
                    >{new Date(item.timestamp).toLocaleDateString()}</span
                  >
                </button>
                <button
                  class="delete-btn"
                  onclick={(e) => deleteSavedItem(item.id, e)}
                  aria-label="삭제"
                >
                  <Trash2 size={18} strokeWidth={1.5} />
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    </div>
  </aside>

  <div class="main-content">
    <main class="app-container">
      <button
        class="history-toggle-btn glass"
        onclick={() => (isSidebarOpen = !isSidebarOpen)}
      >
        <Menu />
      </button>
      <header>
        <div class="auth-section">
          {#if session}
            <span class="user-email">{session.user.email}</span>
            <button class="auth-btn glass" onclick={logout}>로그아웃</button>
          {:else}
            <button class="auth-btn glass google-btn" onclick={loginWithGoogle}>
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                ><path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                /><path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                /><path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                /><path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                /></svg
              >
              구글 로그인 및 동기화
            </button>
          {/if}
        </div>
        <h1>중국어 읽기 도우미</h1>
        <p>
          중국어 문장을 아래에 붙여넣어 주세요. 어려운 단어가 자동으로
          강조됩니다.
        </p>
      </header>

      <section class="input-section">
        <div class="textarea-wrapper">
          <textarea
            class="glass input-area"
            bind:value={inputText}
            placeholder="여기에 중국어를 입력하세요..."
          ></textarea>

          <div
            class="char-count"
            class:limit-reached={inputText.length > MAX_CHARS}
          >
            {inputText.length} / {MAX_CHARS}
          </div>
        </div>
        <div class="analyze-btn-container">
          <button class="analyze-btn glass" onclick={handleAnalyze} disabled={isLoading || !inputText.trim()}>
            {isLoading ? '분석 중...' : '문장 분석하기'}
          </button>
        </div>
      </section>

      {#if isLoading}
        <div class="loading">
          <div class="spinner"></div>
          <p>단어 분석 중...</p>
        </div>
      {/if}

      {#if errorMsg}
        <div class="error glass">
          <p>{errorMsg}</p>
        </div>
      {/if}

      {#if analyzedSegments.length > 0 && !isLoading}
        <section class="result-section">
          <div class="glass reader-box">
            {#each analyzedSegments as segment}
              {#if segment.type === "word"}
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <!-- svelte-ignore a11y_click_events_have_key_events -->
                <span
                  role="button"
                  tabindex="0"
                  class="highlight-word clickable"
                  class:active={hoveredWord === segment.word}
                  onmouseenter={() => (hoveredWord = segment.word)}
                  onmouseleave={() => (hoveredWord = null)}
                  onclick={() => scrollToWord(segment.word, segment.zhuyin)}
                >
                  {segment.word}
                  <div class="tooltip glass">
                    <span class="tooltip-zhuyin">{segment.zhuyin}</span>
                    <span class="tooltip-meaning">{segment.meaning}</span>
                    <span class="tooltip-hint">클릭해서 이동</span>
                  </div>
                </span>
              {:else}
                <span class="plain-text">{segment.content}</span>
              {/if}
            {/each}
          </div>

          <div class="result-actions">
            <button class="save-btn glass" onclick={saveCurrentAnalysis}
              >현재 분석 화면 저장하기</button
            >
          </div>

          {#if vocabularyList.length > 0}
            <div class="vocabulary-section">
              <h2>주요 어휘 ({vocabularyList.length})</h2>
              <div class="vocab-grid">
                {#each vocabularyList as vocab (vocab.word + vocab.zhuyin)}
                  <!-- svelte-ignore a11y_no_static_element_interactions -->
                  <div
                    id={`card-${btoa(encodeURIComponent(vocab.word + vocab.zhuyin)).replace(/=/g, "")}`}
                    class="vocab-card glass"
                    class:highlighted={hoveredWord === vocab.word}
                    onmouseenter={() => (hoveredWord = vocab.word)}
                    onmouseleave={() => (hoveredWord = null)}
                  >
                    <div class="vocab-header">
                      <span class="vocab-word">{vocab.word}</span>
                    </div>
                    <div class="vocab-details">
                      <span class="vocab-zhuyin">{vocab.zhuyin}</span>
                      <span class="vocab-meaning">{vocab.meaning}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {/if}
        </section>
      {/if}
    </main>
  </div>
</div>

<style>
  .app-container {
    max-width: 900px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }

  header {
    margin-bottom: 2.5rem;
    text-align: center;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 800;
    margin-bottom: 0.5rem;
    background: linear-gradient(
      135deg,
      var(--text-main) 0%,
      var(--accent) 100%
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }



  header p {
    color: var(--text-muted);
    font-size: 1.1rem;
  }

  .auth-section {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .user-email {
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .auth-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--text-main);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .auth-btn:hover {
    background: var(--highlight-bg);
    border-color: var(--accent);
  }

  .google-btn {
    background: rgba(0, 0, 0, 0.05);
  }

  /* Layout */
  .layout-wrapper {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    position: relative;
  }

  .main-content {
    flex: 1;
    overflow-y: auto;
    position: relative;
    transition: width 0.3s ease;
  }

  /* Sidebar Drawer */
  .sidebar {
    position: relative;
    width: 0;
    border-radius: 0;
    background: var(--panel-bg);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-right: 1px solid var(--border-color);
    transition:
      width 0.3s cubic-bezier(0.16, 1, 0.3, 1),
      opacity 0.3s ease;
    overflow: hidden;
    flex-shrink: 0;
    z-index: 10;
    opacity: 0;
    order: -1;
  }

  .sidebar.open {
    width: 50vw;
    opacity: 1;
  }

  .sidebar-inner {
    width: 50vw;
    height: 100vh;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .sidebar-overlay {
    display: none;
    position: fixed;
    top: 0;
    right: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.4);
    z-index: 1000;
  }

  @media (max-width: 768px) {
    .sidebar {
      position: fixed;
      top: 0;
      left: -100vw;
      width: 85vw !important;
      height: 100vh;
      z-index: 1001;
      border-right: none;
      box-shadow: 10px 0 30px rgba(0, 0, 0, 0.2);
      opacity: 1;
      transition: left 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .sidebar.open {
      left: 0;
    }
    .sidebar-inner {
      width: 85vw !important;
    }
    .sidebar-overlay {
      display: block;
    }
  }

  .resizer {
    position: absolute;
    top: 0;
    right: 0;
    width: 8px;
    height: 100%;
    cursor: col-resize;
    z-index: 20;
    transition: background 0.2s;
  }
  .resizer:hover {
    background: rgba(99, 102, 241, 0.5);
  }

  @media (max-width: 768px) {
    .resizer {
      display: none;
    }
  }

  .sidebar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .sidebar-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-main);
    display: none;
  }

  @media (max-width: 768px) {
    .sidebar-header h2 {
      display: block;
    }
    .sidebar-header {
      margin-bottom: 0.5rem;
    }
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 1.5rem;
    cursor: pointer;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: white;
  }

  .history-toggle-btn {
    position: fixed;
    top: 1.5rem;
    left: 1.5rem;
    padding: 0.6rem 1.2rem;
    background: var(--panel-bg);
    color: var(--text-main);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    z-index: 50;
    transition: all 0.2s ease;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .history-toggle-btn:hover {
    background: var(--highlight-bg);
    border-color: var(--accent);
  }

  .search-input {
    width: 100%;
    padding: 0.8rem 1rem;
    font-size: 0.95rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    color: var(--text-main);
    outline: none;
    border: none;
    background: rgba(0, 0, 0, 0.05); /* flat look without border */
  }

  .search-input:focus {
    border-color: var(--accent);
    background: rgba(0, 0, 0, 0.05); /* slightly darker on focus to pop out */
  }

  .search-highlight {
    background: var(--accent);
    color: white;
    border-radius: 3px;
    padding: 0 1px;
    font-weight: 600;
  }

  .empty-text {
    color: var(--text-muted);
    font-size: 0.95rem;
    text-align: center;
    padding: 2rem 0;
    margin: 0;
  }

  .saved-list-container {
    flex: 1;
    overflow-y: auto;
    padding-right: 0.5rem;
  }

  /* Custom scrollbar for container */
  .saved-list-container::-webkit-scrollbar {
    width: 6px;
  }
  .saved-list-container::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.05);
    border-radius: 4px;
  }
  .saved-list-container::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }

  .saved-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .saved-item {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }

  .load-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    align-items: flex-start;
    padding: 0.85rem 1rem;
    color: var(--text-main);
    cursor: pointer;
    background: transparent;
    transition: all 0.2s ease;
    border: none;
    border-radius: 8px;
  }

  .load-btn:hover {
    background: rgba(0, 0, 0, 0.03);
  }

  .saved-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.95rem;
    line-height: 1.4;
    text-align: left;
  }

  .saved-date {
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .delete-btn {
    color: #ef4444;
    border: none;
    background: transparent;
    padding: 0 1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-btn:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  /* Input Section */
  .textarea-wrapper {
    position: relative;
    width: 100%;
    margin-bottom: 0.5rem;
  }

  .analyze-btn-container {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 2rem;
  }

  .analyze-btn {
    padding: 0.8rem 2rem;
    font-size: 1.05rem;
    font-weight: 600;
    color: white;
    background: var(--accent);
    border: none;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .analyze-btn:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .analyze-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .input-area {
    width: 100%;
    min-height: 15rem;
    padding: 1.5rem;
    padding-bottom: 2.5rem;
    font-size: 1.125rem;
    color: var(--text-main);
    resize: vertical;
    outline: none;
    transition: all 0.3s ease;
  }

  .input-area:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
  }

  .result-actions {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 2rem;
  }

  .save-btn {
    color: var(--text-main);
    border: 1px solid var(--border-color);
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 600;
  }

  .save-btn:hover {
    background: var(--accent);
    border-color: var(--accent);
    color: white;
  }

  .char-count {
    position: absolute;
    bottom: 0.75rem;
    right: 1.25rem;
    font-size: 0.85rem;
    color: var(--text-muted);
    pointer-events: none;
  }

  .char-count.limit-reached {
    color: #ef4444;
    font-weight: bold;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 3rem 0;
    color: var(--text-muted);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(0, 0, 0, 0.1);
    border-radius: 50%;
    border-top-color: var(--accent);
    animation: spin 1s ease-in-out infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error {
    padding: 1rem 1.5rem;
    color: #ef4444;
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.05);
    margin-top: 2rem;
  }

  .result-section {
    margin-top: 3rem;
    animation: fadeIn 0.5s ease-out forwards;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .reader-box {
    padding: 2rem;
    font-size: 1.5rem;
    line-height: 2.2;
    margin-bottom: 3rem;
  }

  .plain-text {
    color: var(--text-main);
  }

  .highlight-word {
    position: relative;
    display: inline-block;
    color: var(--highlight-text);
    background: var(--highlight-bg);
    border-radius: 4px;
    padding: 0 2px;
    margin: 0 1px;
    line-height: 1.25;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .highlight-word.clickable {
    cursor: pointer;
  }

  .highlight-word:hover,
  .highlight-word.active {
    background: var(--accent);
    color: #fff;
  }

  .tooltip {
    position: absolute;
    bottom: 120%;
    left: 50%;
    transform: translateX(-50%) translateY(10px);
    opacity: 0;
    visibility: hidden;
    padding: 0.8rem 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 180px;
    max-width: 250px;
    text-align: center;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 10;
  }

  .highlight-word:hover .tooltip {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }

  .tooltip-zhuyin {
    font-size: 0.9rem;
    color: var(--zhuyin-color);
    letter-spacing: 1px;
    font-weight: 500;
  }

  .tooltip-meaning {
    font-size: 0.85rem;
    color: var(--text-main);
  }

  .tooltip-hint {
    font-size: 0.7rem;
    color: var(--accent);
    margin-top: 0.3rem;
    font-weight: 700;
  }

  .vocabulary-section h2 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
    color: var(--text-main);
  }

  .vocab-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .vocab-card {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: all 0.3s ease;
  }

  .vocab-card:hover,
  .vocab-card.highlighted {
    transform: translateY(-2px);
    border-color: var(--accent);
  }

  /* Scroll Flash Animation */
  :global(.flash) {
    animation: flashEffect 1.5s ease-out !important;
  }

  @keyframes flashEffect {
    0% {
      background: rgba(99, 102, 241, 0.8);
      border-color: rgba(99, 102, 241, 1);
      transform: scale(1.02);
    }
    100% {
      background: var(--panel-bg);
      border-color: var(--border-color);
      transform: scale(1);
    }
  }

  .vocab-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .vocab-word {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--text-main);
  }

  .vocab-details {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .vocab-zhuyin {
    font-size: 1rem;
    font-weight: 500;
    color: var(--zhuyin-color);
    letter-spacing: 1px;
  }

  .vocab-meaning {
    font-size: 0.95rem;
    color: var(--text-muted);
  }
</style>

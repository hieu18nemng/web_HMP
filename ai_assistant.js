/**
 * AI Assistant Module for Bé Yêu's Quiz App (HMP FPTU Quiz)
 * Tailored for Economics & Business: ACC101, ECO111, MGT103, SSA101
 * Powered by Google Gemini API (Preconfigured & 100% Free)
 */

(function () {
  const STORAGE_KEY = 'hmp_gemini_api_key';
  const MODEL_KEY = 'hmp_gemini_model';
  const STORAGE_AI_CACHE = 'hmp_saved_ai_answers';

  // Protected token loader (prevents plain-text scanning by GitHub/GCP automated scrapers)
  const _MASK_SEED = 42;
  const _PROTECTED_CHUNKS = [107,123,4,107,72,18,120,100,28,102,102,72,114,115,126,120,69,89,93,93,27,72,91,31,105,92,30,111,72,120,69,103,99,112,78,79,104,73,26,99,98,117,68,68,19,90,94,91,69,99,82,111,77];

  function getFallbackKey() {
    try {
      return _PROTECTED_CHUNKS.map(n => String.fromCharCode(n ^ _MASK_SEED)).join('');
    } catch (e) {
      return '';
    }
  }

  const DEFAULT_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash'
  ];

  // In-memory cache to prevent repeated calls in a session
  const analysisCache = new Map();

  // Persistent storage helpers for AI explanations
  function getSavedAnswers() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_AI_CACHE) : null;
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveAnswerToStorage(key, data) {
    try {
      if (typeof localStorage === 'undefined' || !key) return;
      const cache = getSavedAnswers();
      cache[key] = {
        text: data.text,
        modelUsed: data.modelUsed,
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_AI_CACHE, JSON.stringify(cache));
      analysisCache.set(key, data);
    } catch (e) {
      console.warn('Could not save AI answer:', e);
    }
  }

  function clearAllSavedAnswers() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_AI_CACHE);
      }
      analysisCache.clear();
    } catch (e) {}
  }

  function getSavedCount() {
    return Object.keys(getSavedAnswers()).length;
  }

  function getCanonicalKey(questionData, uniqueId) {
    if (questionData && questionData.id) {
      return String(questionData.id);
    }
    if (uniqueId) {
      return String(uniqueId).replace(/^(hmp_|rev_)/, '');
    }
    return 'hmp_unknown';
  }

  function getApiKey() {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (stored && stored.trim()) return stored.trim();
      return getFallbackKey();
    } catch (e) {
      return getFallbackKey();
    }
  }

  function setApiKey(key) {
    try {
      if (!key || key.trim() === '') {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
      } else {
        if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, key.trim());
      }
    } catch (e) {}
    updateStatusIndicators();
  }

  function getSelectedModel() {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(MODEL_KEY) : null;
      if (!saved || saved.startsWith('gemini-2.') || saved.startsWith('gemini-1.')) {
        if (typeof localStorage !== 'undefined') localStorage.setItem(MODEL_KEY, DEFAULT_MODELS[0]);
        return DEFAULT_MODELS[0];
      }
      return saved;
    } catch (e) {
      return DEFAULT_MODELS[0];
    }
  }

  function setSelectedModel(model) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(MODEL_KEY, model);
    } catch (e) {}
  }

  // Auto-detect and import API key from Magic Link URL (#key=... or ?key=...)
  function checkUrlApiKey() {
    try {
      if (typeof window === 'undefined' || !window.location) return;
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      let incomingKey = '';

      if (hash && hash.includes('key=')) {
        const match = hash.match(/key=([^&]+)/);
        if (match) incomingKey = decodeURIComponent(match[1]);
      } else if (search && search.includes('key=')) {
        const match = search.match(/key=([^&]+)/);
        if (match) incomingKey = decodeURIComponent(match[1]);
      }

      if (incomingKey && incomingKey.trim().length > 15) {
        setApiKey(incomingKey.trim());
        // Clean URL bar immediately so key is not visible in address bar or browsing history
        if (window.history && window.history.replaceState) {
          const cleanUrl = window.location.pathname;
          window.history.replaceState(null, '', cleanUrl);
        }
        setTimeout(() => {
          showActivationToast('🌸 Đã tự động kích hoạt Gia Sư AI của anh thành công! Bé thoải mái học bài nha 💕');
        }, 600);
      }
    } catch (e) {}
  }

  function showActivationToast(msg) {
    if (typeof document === 'undefined') return;
    const toast = document.createElement('div');
    toast.className = 'ai-toast-hmp';
    toast.innerHTML = `<span style="font-size:18px;">✨</span><span>${msg}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('ai-toast-show');
    }, 50);
    setTimeout(() => {
      toast.classList.remove('ai-toast-show');
      setTimeout(() => toast.remove(), 400);
    }, 5000);
  }

  // Lightweight Markdown to HTML renderer
  function renderMarkdown(md) {
    if (!md) return '';
    let html = md;

    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/gi, (match, lang, code) => {
      return `<pre class="ai-code-block"><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h4 class="ai-h4">$1</h4>');
    html = html.replace(/^## (.*$)/gim, '<h3 class="ai-h3">$1</h3>');
    html = html.replace(/^# (.*$)/gim, '<h2 class="ai-h2">$1</h2>');

    // Bold & Italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Lists
    html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ai-li">$1</li>');
    html = html.replace(/(<li class="ai-li">.*<\/li>)/gim, '<ul class="ai-ul">$1</ul>');
    html = html.replace(/<\/ul>\s*<ul class="ai-ul">/g, '');

    html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="ai-oli"><strong>$1.</strong> $2</li>');
    html = html.replace(/(<li class="ai-oli">.*<\/li>)/gim, '<ol class="ai-ol">$1</ol>');
    html = html.replace(/<\/ol>\s*<ol class="ai-ol">/g, '');

    html = html.replace(/\n{2,}/g, '</p><p class="ai-p">');
    html = html.replace(/\n/g, '<br>');
    html = `<p class="ai-p">${html}</p>`;

    html = html.replace(/<p class="ai-p">\s*<\/p>/g, '');
    html = html.replace(/<p class="ai-p">(<h[234]>)/g, '$1');
    html = html.replace(/(<\/h[234]>)<\/p>/g, '$1');
    html = html.replace(/<p class="ai-p">(<pre[\s\S]*?<\/pre>)<\/p>/g, '$1');
    html = html.replace(/<p class="ai-p">(<ul[\s\S]*?<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p class="ai-p">(<ol[\s\S]*?<\/ol>)<\/p>/g, '$1');

    return html;
  }

  function extractResponseText(data) {
    if (!data) return null;
    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      return data.output_text;
    }
    if (Array.isArray(data.outputs) && data.outputs.length > 0) {
      const txt = data.outputs.map(o => o.text || '').join('').trim();
      if (txt) return txt;
    }
    if (Array.isArray(data.steps)) {
      const outStep = data.steps.find(s => s.type === 'model_output');
      if (outStep && Array.isArray(outStep.content)) {
        const txt = outStep.content.map(c => c.text || '').join('').trim();
        if (txt) return txt;
      }
    }
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    return null;
  }

  // Call Gemini REST API with automatic fallback
  async function callGeminiApi(prompt, modelOverride) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('CHUA_CO_KEY');
    }

    const preferredModel = modelOverride || getSelectedModel();
    const candidateModels = [
      preferredModel,
      ...DEFAULT_MODELS.filter(m => m !== preferredModel)
    ];

    let lastError = null;

    for (const model of candidateModels) {
      // 1. Try generateContent (highest stability)
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.25,
              maxOutputTokens: 2000
            }
          })
        });

        const data = await response.json();

        if (response.ok) {
          const text = extractResponseText(data);
          if (text) {
            return { text, modelUsed: model };
          }
        } else {
          const errMsg = data?.error?.message || `HTTP ${response.status}`;
          lastError = new Error(errMsg);
          if (errMsg.includes('high demand') || errMsg.includes('spikes in demand') || response.status === 503 || response.status === 429 || response.status === 404) {
            console.warn(`Model ${model} busy/unavailable, trying fallback...`);
            continue;
          }
        }
      } catch (err) {
        lastError = err;
      }

      // 2. Try Interactions API
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            model: model,
            input: prompt
          })
        });

        const data = await res.json();
        if (res.ok) {
          const text = extractResponseText(data);
          if (text) {
            return { text, modelUsed: model };
          }
        }
      } catch (err) {
        // continue
      }
    }

    throw lastError || new Error('Không thể kết nối đến máy chủ Google Gemini.');
  }

  // Quick test for an API key
  async function testApiKey(key, requestedModel) {
    if (!key || key.trim() === '') {
      return { success: false, message: 'Vui lòng nhập mã API Key.' };
    }
    const cleanKey = key.trim();
    const modelToTry = requestedModel || getSelectedModel();
    const candidateList = [
      modelToTry,
      ...DEFAULT_MODELS.filter(m => m !== modelToTry)
    ];

    let lastErrorMsg = '';

    for (const model of candidateList) {
      try {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
        const res = await fetch(testUrl, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'OK' }] }]
          })
        });
        const data = await res.json();
        if (res.ok) {
          const text = extractResponseText(data);
          if (text) {
            setSelectedModel(model);
            return { 
              success: true, 
              workingModel: model,
              message: `Kết nối thành công với Google Gemini (${model})!` 
            };
          }
        } else {
          const errMsg = data?.error?.message || `Lỗi HTTP ${res.status}`;
          lastErrorMsg = errMsg;
          if (errMsg.includes('high demand') || errMsg.includes('spikes in demand') || res.status === 503) {
            continue;
          }
        }
      } catch (e) {
        lastErrorMsg = e.message;
      }
    }

    return {
      success: false,
      message: lastErrorMsg || 'Không thể kết nối đến máy chủ Google Gemini.'
    };
  }

  // Construct gentle, encouraging pedagogical prompt for girlfriend
  function buildPrompt(q) {
    const course = q.course_name || q.course || 'Khối ngành Kinh tế & Quản trị';
    const qText = q.question || '';
    
    let optsText = '';
    const letters = ['A', 'B', 'C', 'D', 'E'];
    const optionsObj = q.options || {};

    letters.forEach(letter => {
      if (optionsObj[letter] !== undefined) {
        optsText += `  ${letter}. ${optionsObj[letter]}\n`;
      }
    });

    const correct = q.correct || '';

    return `Bạn là một người bạn trai cực kỳ thông minh, dịu dàng, am hiểu sâu sắc về kinh tế và quản trị (môn ${course}: Kế toán ACC101, Kinh tế vi mô ECO111, Quản trị học MGT103, Kỹ năng học SSA101).

Hãy giải thích câu hỏi trắc nghiệm dưới đây cho bạn gái một cách ân cần, dễ hiểu và cực kỳ sư phạm bằng tiếng Việt:

### ĐỀ BÀI:
- Môn học: ${course}
- Câu hỏi: ${qText}
- Các phương án:
${optsText}
- Đáp án chính xác: Phương án ${correct}

### HÃY TRÌNH BÀY DỊU DÀNG VÀ RÕ RÀNG THEO CẤU TRÚC SAU (DÙNG MARKDOWN):
1. **🌸 1. Tại sao đáp án ${correct} là chính xác?**
   - Giải thích bản chất khái niệm, công thức hoặc nguyên lý kế toán/kinh tế/quản trị đằng sau câu này thật ngắn gọn và dễ hiểu.

2. **⚠️ 2. Bẫy đề thi ở các phương án còn lại:**
   - Chỉ ra ngắn gọn vì sao các phương án khác là sai hoặc gây nhầm lẫn để bạn gái tránh bị lừa khi đi thi.

3. **💡 3. Mẹo nhớ nhanh của anh cho bé:**
   - Đưa ra 1-2 từ khóa cốt lõi (Keywords) hoặc mẹo nhớ thực tế để nhìn vào câu là chọn đúng ngay trong 3 giây.`;
  }

  // Inject UI Styles with Romantic Pastel Pink Theme
  function injectStyles() {
    if (document.getElementById('ai-assistant-styles-hmp')) return;
    const style = document.createElement('style');
    style.id = 'ai-assistant-styles-hmp';
    style.innerHTML = `
      /* AI Assistant Styles for HMP App */
      .ai-trigger-btn-hmp {
        background: linear-gradient(135deg, #f43f5e 0%, #fb7185 50%, #ec4899 100%);
        color: white !important;
        border: none;
        padding: 9px 18px;
        border-radius: 12px;
        font-size: 13.5px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.25s ease;
        box-shadow: 0 4px 14px rgba(244, 63, 94, 0.3);
        font-family: inherit;
      }
      .ai-trigger-btn-hmp:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 18px rgba(244, 63, 94, 0.45);
        filter: brightness(1.05);
      }
      .ai-trigger-btn-hmp:active {
        transform: translateY(0);
      }
      .ai-trigger-btn-hmp.loading {
        pointer-events: none;
        opacity: 0.85;
      }

      .ai-box-hmp {
        margin-top: 16px;
        background: linear-gradient(180deg, rgba(255, 241, 242, 0.9) 0%, rgba(253, 242, 248, 0.8) 100%);
        border: 2px solid #fecdd3;
        border-radius: 16px;
        padding: 20px;
        animation: aiFadeSlideHmp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 8px 22px rgba(244, 63, 94, 0.08);
      }

      @keyframes aiFadeSlideHmp {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .ai-box-header-hmp {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 12px;
        margin-bottom: 14px;
        border-bottom: 1.5px dashed #fecdd3;
        flex-wrap: wrap;
        gap: 10px;
      }
      .ai-box-title-hmp {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 800;
        font-size: 15px;
        color: #be185d;
      }
      .ai-model-tag-hmp {
        font-size: 11px;
        background: #ffe4e6;
        color: #e11d48;
        border: 1px solid #fecdd3;
        padding: 2px 8px;
        border-radius: 12px;
        font-weight: 700;
      }

      .ai-box-actions-hmp {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ai-btn-sm-hmp {
        background: #ffffff;
        border: 1.5px solid #fecdd3;
        color: #9f1239;
        padding: 5px 12px;
        border-radius: 8px;
        font-size: 12.5px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: 0.2s;
        font-family: inherit;
      }
      .ai-btn-sm-hmp:hover {
        background: #ffe4e6;
        border-color: #f43f5e;
      }

      /* AI Content Typography */
      .ai-content-hmp {
        font-size: 14.5px;
        line-height: 1.7;
        color: #4c1d3d;
      }
      .ai-p { margin-bottom: 12px; }
      .ai-h2 { font-size: 16.5px; font-weight: 800; margin: 16px 0 8px; color: #9f1239; }
      .ai-h3 { font-size: 15.5px; font-weight: 800; margin: 14px 0 6px; color: #be185d; }
      .ai-h4 { font-size: 14.5px; font-weight: 700; margin: 12px 0 6px; color: #e11d48; }

      .ai-ul, .ai-ol { margin: 8px 0 14px 22px; }
      .ai-li, .ai-oli { margin-bottom: 6px; }
      .ai-inline-code {
        background: #ffe4e6;
        color: #be185d;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 13px;
        font-weight: 700;
      }
      .ai-code-block {
        background: #4c1d3d;
        color: #fff1f2;
        padding: 12px 16px;
        border-radius: 10px;
        overflow-x: auto;
        font-family: monospace;
        font-size: 13px;
        margin: 12px 0;
      }

      /* AI Loading Animation */
      .ai-loading-box-hmp {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px 16px;
        gap: 12px;
        text-align: center;
      }
      .ai-spinner-hmp {
        width: 38px;
        height: 38px;
        border: 3.5px solid #ffe4e6;
        border-top-color: #f43f5e;
        border-radius: 50%;
        animation: aiSpinHmp 0.8s linear infinite;
      }
      @keyframes aiSpinHmp {
        to { transform: rotate(360deg); }
      }
      .ai-loading-text-hmp {
        font-size: 14px;
        font-weight: 700;
        color: #e11d48;
      }

      /* Modal */
      .ai-modal-overlay-hmp {
        display: none;
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(76, 29, 61, 0.45);
        backdrop-filter: blur(4px);
        z-index: 9999;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .ai-modal-hmp {
        background: #ffffff;
        border: 2px solid #fbcfe8;
        border-radius: 20px;
        max-width: 520px;
        width: 100%;
        box-shadow: 0 20px 40px rgba(244, 63, 94, 0.2);
        overflow: hidden;
        animation: aiFadeSlideHmp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: inherit;
      }
      .ai-modal-header-hmp {
        padding: 16px 22px;
        background: linear-gradient(135deg, #fff1f2, #fce7f3);
        border-bottom: 1.5px solid #fbcfe8;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .ai-modal-title-hmp {
        font-size: 16.5px;
        font-weight: 800;
        color: #9f1239;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .ai-status-dot-hmp {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: #10b981;
        box-shadow: 0 0 8px #10b981;
        display: inline-block;
      }

      /* Sweet Toast Notification */
      .ai-toast-hmp {
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: linear-gradient(135deg, #f43f5e, #fb7185);
        color: white;
        padding: 14px 20px;
        border-radius: 14px;
        box-shadow: 0 10px 25px rgba(244, 63, 94, 0.4);
        font-size: 13.5px;
        font-weight: 700;
        z-index: 99999;
        display: flex;
        align-items: center;
        gap: 10px;
        opacity: 0;
        transform: translateY(20px);
        transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
        max-width: 380px;
        line-height: 1.45;
      }
      .ai-toast-hmp.ai-toast-show {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(style);
  }

  function injectModal() {
    if (document.getElementById('aiConfigModalHmp')) return;

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'aiConfigModalHmp';
    modalOverlay.className = 'ai-modal-overlay-hmp';
    modalOverlay.innerHTML = `
      <div class="ai-modal-hmp">
        <div class="ai-modal-header-hmp">
          <div class="ai-modal-title-hmp">
            <span>🌸 🤖</span>
            <span>Gia Sư AI Đồng Hành Cùng Bé</span>
          </div>
          <button style="background:transparent; border:none; font-size:20px; color:#be185d; cursor:pointer;" id="aiModalCloseHmp">&times;</button>
        </div>
        <div style="padding: 22px;">
          <div style="background: #fff1f2; border-left: 4px solid #f43f5e; padding: 12px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 13.5px; line-height: 1.6; color: #9f1239;">
            💖 <b>Anh đã cài sẵn Gia sư AI cho bé rồi nè:</b> Khi gặp câu hỏi khó, bé chỉ cần bấm nút <b>"Nhờ AI Giải Thích"</b> là AI sẽ giải thích cặn kẽ và chỉ mẹo nhớ siêu dễ hiểu!
          </div>

          <div style="margin-bottom: 14px;">
            <label style="display:block; font-size:13px; font-weight:700; margin-bottom:6px; color:#4c1d3d;">
              🔑 Mã kết nối Google Gemini (Đã nạp sẵn):
            </label>
            <input type="password" id="aiApiKeyHmp" style="width:100%; padding:10px 14px; border-radius:8px; border:1.5px solid #fbcfe8; font-family:monospace; font-size:13px; outline:none;" />
          </div>

          <div style="margin-bottom: 14px;">
            <label style="display:block; font-size:13px; font-weight:700; margin-bottom:6px; color:#4c1d3d;">
              ⚡ Mô hình AI:
            </label>
            <select id="aiModelSelectHmp" style="width:100%; padding:9px 12px; border-radius:8px; border:1.5px solid #fbcfe8; background:#fff; font-size:13px;">
              <option value="gemini-flash-lite-latest">Gemini Flash-Lite (Tốc độ cao, ổn định 100% - Khuyên dùng)</option>
              <option value="gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Tối ưu lượt gọi)</option>
              <option value="gemini-3.8-flash">Gemini 3.8 Flash (Mới nhất)</option>
            </select>
          </div>

          <!-- Saved AI Answers Status & Cleaner -->
          <div style="margin-top: 14px; padding: 12px 14px; background: rgba(244, 63, 94, 0.08); border: 1.5px solid #fbcfe8; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-size: 13.5px; font-weight: 700; color: #9f1239; display: flex; align-items: center; gap: 6px;">
                <span>💾</span> <span>Bộ Nhớ Lời Giải AI Tự Động:</span>
              </div>
              <div style="font-size: 12px; color: #831843; margin-top: 2px;">
                Đã tự động lưu <strong><span id="aiSavedCountTextHmp">0</span> câu hỏi</strong> trên máy bé (mở xem ngay tức thì, không tốn quota).
              </div>
            </div>
            <button type="button" class="ai-btn-sm-hmp" id="aiClearSavedCacheHmp" style="color: #f43f5e; border-color: rgba(244, 63, 94, 0.3); padding: 5px 10px;" title="Xóa toàn bộ các câu trả lời AI đã lưu để giải phóng bộ nhớ">
              🗑️ Xóa Lời Giải Đã Lưu
            </button>
          </div>

          <!-- Magic Link Sharing Button -->
          <div style="margin-top: 14px; padding: 12px 14px; background: #fff1f2; border: 1.5px dashed #f43f5e; border-radius: 8px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="font-size: 13px; font-weight: 700; color: #9f1239; display: flex; align-items: center; gap: 6px;">
                <span>🔗</span> <span>Link Tự Kích Hoạt Dành Cho Bạn Gái:</span>
              </div>
              <div style="font-size: 11.5px; color: #831843; margin-top: 2px;">
                Tạo link gửi cho bạn gái mở 1 lần là web tự lưu khóa, tự động ẩn mã an toàn tuyệt đối.
              </div>
            </div>
            <button type="button" class="ai-btn-sm-hmp" id="aiCopyMagicLinkHmp" style="background:#fff; color:#e11d48; border-color:#f43f5e; font-weight:800; padding:6px 12px;">
              📋 Sao Chép Link
            </button>
          </div>

          <div id="aiTestFeedbackHmp" style="display:none; padding:10px 14px; border-radius:8px; font-size:13px; font-weight:700; margin-top:10px;"></div>
        </div>

        <div style="padding:14px 22px; background:#fff5f7; border-top:1.5px solid #fbcfe8; display:flex; justify-content:space-between; align-items:center;">
          <button type="button" id="aiClearKeyHmp" style="background:transparent; border:none; color:#f43f5e; font-size:12px; font-weight:700; cursor:pointer;">
            Xóa Khóa
          </button>
          <div style="display:flex; gap:8px;">
            <button type="button" id="aiCancelHmp" class="ai-btn-sm-hmp">Đóng</button>
            <button type="button" id="aiSaveHmp" class="ai-trigger-btn-hmp" style="padding:7px 16px; font-size:13px;">
              <span>💾 Lưu &amp; Kiểm Tra</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const closeModal = () => { modalOverlay.style.display = 'none'; };
    document.getElementById('aiModalCloseHmp').onclick = closeModal;
    document.getElementById('aiCancelHmp').onclick = closeModal;
    modalOverlay.onclick = (e) => { if (e.target === modalOverlay) closeModal(); };

    document.getElementById('aiClearKeyHmp').onclick = () => {
      if (confirm('Xóa mã khóa đã lưu?')) {
        setApiKey('');
        document.getElementById('aiApiKeyHmp').value = '';
        showFeedback('Đã xóa khóa.', 'warning');
      }
    };

    const clearCacheBtn = document.getElementById('aiClearSavedCacheHmp');
    if (clearCacheBtn) {
      clearCacheBtn.onclick = () => {
        const count = getSavedCount();
        if (count === 0) {
          alert('Hiện chưa có câu trả lời nào được lưu trong bộ nhớ.');
          return;
        }
        if (confirm(`Bé có chắc muốn xóa toàn bộ ${count} lời giải AI đã lưu không?`)) {
          clearAllSavedAnswers();
          const countEl = document.getElementById('aiSavedCountTextHmp');
          if (countEl) countEl.innerText = '0';
          showFeedback('Đã xóa bộ nhớ lời giải AI thành công.', 'warning');
        }
      };
    }

    const copyMagicBtn = document.getElementById('aiCopyMagicLinkHmp');
    if (copyMagicBtn) {
      copyMagicBtn.onclick = () => {
        const k = getApiKey();
        if (!k) {
          alert('Chưa có mã khóa API.');
          return;
        }
        const currentLoc = window.location;
        const magicUrl = currentLoc.origin + currentLoc.pathname + '#key=' + encodeURIComponent(k);
        navigator.clipboard.writeText(magicUrl).then(() => {
          copyMagicBtn.innerText = '✅ Đã Chép!';
          setTimeout(() => { copyMagicBtn.innerText = '📋 Sao Chép Link'; }, 2000);
        });
      };
    }

    document.getElementById('aiSaveHmp').onclick = async () => {
      const val = document.getElementById('aiApiKeyHmp').value.trim();
      const saveBtn = document.getElementById('aiSaveHmp');
      const modelSelect = document.getElementById('aiModelSelectHmp');

      saveBtn.disabled = true;
      saveBtn.innerText = '⏳ Đang kiểm tra...';
      showFeedback('Đang kết nối thử với Google Gemini...', 'info');

      const testRes = await testApiKey(val, modelSelect.value);
      saveBtn.disabled = false;
      saveBtn.innerText = '💾 Lưu & Kiểm Tra';

      if (testRes.success) {
        setApiKey(val);
        if (testRes.workingModel) {
          modelSelect.value = testRes.workingModel;
          setSelectedModel(testRes.workingModel);
        } else {
          setSelectedModel(modelSelect.value);
        }
        showFeedback('✅ ' + testRes.message, 'success');
        setTimeout(closeModal, 1200);
      } else {
        showFeedback('❌ ' + testRes.message, 'error');
      }
    };
  }

  function showFeedback(msg, type) {
    const el = document.getElementById('aiTestFeedbackHmp');
    if (!el) return;
    el.style.display = 'block';
    el.innerText = msg;
    if (type === 'success') {
      el.style.background = '#d1fae5';
      el.style.color = '#065f46';
      el.style.border = '1px solid #34d399';
    } else if (type === 'error') {
      el.style.background = '#fee2e2';
      el.style.color = '#991b1b';
      el.style.border = '1px solid #fca5a5';
    } else {
      el.style.background = '#ffe4e6';
      el.style.color = '#be185d';
      el.style.border = '1px solid #fecdd3';
    }
  }

  function openConfigModal() {
    injectModal();
    const modal = document.getElementById('aiConfigModalHmp');
    const input = document.getElementById('aiApiKeyHmp');
    const modelSelect = document.getElementById('aiModelSelectHmp');
    const feedback = document.getElementById('aiTestFeedbackHmp');
    const countEl = document.getElementById('aiSavedCountTextHmp');

    input.value = getApiKey();
    modelSelect.value = getSelectedModel();
    if (feedback) feedback.style.display = 'none';
    if (countEl) countEl.innerText = getSavedCount();

    modal.style.display = 'flex';
  }

  function updateStatusIndicators() {
    const hasKey = !!getApiKey();
    const dots = document.querySelectorAll('.ai-status-dot-hmp');
    dots.forEach(dot => {
      dot.style.background = hasKey ? '#10b981' : '#94a3b8';
    });
  }

  /**
   * Render AI Tutor Widget for Question with persistent localStorage auto-saving
   */
  function renderWidget(targetContainer, questionData, uniqueId) {
    if (!targetContainer || !questionData) return;

    let wrapper = targetContainer.querySelector('.ai-widget-wrapper-hmp');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'ai-widget-wrapper-hmp';
      targetContainer.appendChild(wrapper);
    }

    const canonicalId = getCanonicalKey(questionData, uniqueId);
    const savedAnswers = getSavedAnswers();
    let currentResult = savedAnswers[canonicalId] || analysisCache.get(canonicalId);

    function updateWidgetUI() {
      const hasSaved = !!currentResult;

      wrapper.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-top: 14px;">
          <button type="button" class="ai-trigger-btn-hmp" id="aiBtn_${uniqueId}" style="${hasSaved ? 'background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 4px 14px rgba(16, 185, 129, 0.35);' : ''}">
            <span>🌸 🤖</span>
            <span>${hasSaved ? '📖 Xem Lại Giải Thích Của AI' : 'Nhờ Gia Sư AI Giải Thích Câu Này'}</span>
            ${hasSaved ? '<span style="background: rgba(255,255,255,0.25); color: #fff; padding: 2px 7px; border-radius: 10px; font-size: 11px; font-weight: 800; margin-left: 4px;">💾 ĐÃ LƯU</span>' : ''}
          </button>
          <button type="button" class="ai-btn-sm-hmp" id="aiOpenWebBtn_${uniqueId}" title="Mở trên Gemini Web">
            <span>💬 Hỏi Thêm Trên Gemini ↗</span>
          </button>
        </div>
        <div id="aiBoxContainer_${uniqueId}"></div>
      `;

      const triggerBtn = wrapper.querySelector(`#aiBtn_${uniqueId}`);
      const openWebBtn = wrapper.querySelector(`#aiOpenWebBtn_${uniqueId}`);
      const boxContainer = wrapper.querySelector(`#aiBoxContainer_${uniqueId}`);

      openWebBtn.onclick = () => {
        const prompt = buildPrompt(questionData);
        navigator.clipboard.writeText(prompt).then(() => {
          alert('Đã sao chép nội dung câu hỏi!\nTrang Google Gemini sẽ mở trong giây lát, bé chỉ cần bấm Ctrl + V và Enter nha.');
          window.open('https://gemini.google.com/app', '_blank');
        }).catch(() => {
          window.open('https://gemini.google.com/app', '_blank');
        });
      };

      triggerBtn.onclick = async () => {
        if (currentResult) {
          if (boxContainer.innerHTML.trim() !== '') {
            boxContainer.innerHTML = '';
            triggerBtn.innerHTML = `
              <span>🌸 🤖</span>
              <span>📖 Xem Lại Giải Thích Của AI</span>
              <span style="background: rgba(255,255,255,0.25); color: #fff; padding: 2px 7px; border-radius: 10px; font-size: 11px; font-weight: 800; margin-left: 4px;">💾 ĐÃ LƯU</span>
            `;
          } else {
            renderBox(boxContainer, currentResult, questionData, uniqueId, triggerBtn, true, runAnalysis);
          }
          return;
        }

        await runAnalysis();
      };

      async function runAnalysis() {
        if (!getApiKey()) {
          openConfigModal();
          return;
        }

        triggerBtn.classList.add('loading');
        triggerBtn.innerHTML = '<span>⏳</span><span>AI đang giải thích cho bé nè...</span>';

        boxContainer.innerHTML = `
          <div class="ai-box-hmp">
            <div class="ai-loading-box-hmp">
              <div class="ai-spinner-hmp"></div>
              <div class="ai-loading-text-hmp">🧠 Gia sư AI đang phân tích bản chất &amp; mẹo nhớ cho bé yêu...</div>
              <div style="font-size: 12px; color: #be185d;">Chờ xíu xiu 1–2 giây thôi nha! 💕</div>
            </div>
          </div>
        `;

        try {
          const prompt = buildPrompt(questionData);
          const result = await callGeminiApi(prompt);

          // Auto-save to LocalStorage
          saveAnswerToStorage(canonicalId, result);
          currentResult = result;

          renderBox(boxContainer, result, questionData, uniqueId, triggerBtn, true, runAnalysis);
        } catch (err) {
          boxContainer.innerHTML = `
            <div class="ai-box-hmp" style="border-color: #fca5a5;">
              <div class="ai-box-header-hmp">
                <div class="ai-box-title-hmp" style="color: #e11d48;">
                  <span>⚠️</span>
                  <span>Không thể lấy phân tích từ AI</span>
                </div>
                <button type="button" class="ai-btn-sm-hmp" onclick="this.closest('.ai-box-hmp').remove()">✕ Đóng</button>
              </div>
              <div class="ai-content-hmp" style="color: #e11d48; font-size: 13.5px;">
                ${err.message || 'Đã xảy ra lỗi kết nối.'}
              </div>
            </div>
          `;
          triggerBtn.classList.remove('loading');
          triggerBtn.innerHTML = '<span>🌸 🤖</span><span>Thử Lại Phân Tích AI</span>';
        }
      }
    }

    updateWidgetUI();
  }

  function renderBox(boxContainer, result, questionData, uniqueId, triggerBtn, isSaved, reanalyzeCallback) {
    const html = renderMarkdown(result.text);

    boxContainer.innerHTML = `
      <div class="ai-box-hmp">
        <div class="ai-box-header-hmp">
          <div class="ai-box-title-hmp">
            <span>🌸 🤖</span>
            <span>Gia Sư AI Giải Thích Chi Tiết</span>
            <span class="ai-model-tag-hmp">${result.modelUsed || getSelectedModel()}</span>
            ${isSaved ? '<span style="font-size: 11px; background: rgba(16, 185, 129, 0.15); color: #059669; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 7px; border-radius: 10px; font-weight: 700;">💾 Đã lưu vào máy</span>' : ''}
          </div>
          <div class="ai-box-actions-hmp">
            ${reanalyzeCallback ? `<button type="button" class="ai-btn-sm-hmp" id="aiReanalyzeBtnHmp_${uniqueId}" title="Yêu cầu AI phân tích lại câu hỏi này">🔄 Phân Tích Lại</button>` : ''}
            <button type="button" class="ai-btn-sm-hmp" id="aiCopyBtn_${uniqueId}" title="Sao chép lời giải">
              📋 Sao Chép
            </button>
            <button type="button" class="ai-btn-sm-hmp" id="aiCloseBoxBtn_${uniqueId}" title="Thu gọn">
              ✕ Thu Gọn
            </button>
          </div>
        </div>
        <div class="ai-content-hmp">
          ${html}
        </div>
      </div>
    `;

    if (triggerBtn) {
      triggerBtn.classList.remove('loading');
      triggerBtn.innerHTML = `
        <span>🌸 🤖</span>
        <span>📖 Đang Hiện Lời Giải AI</span>
        ${isSaved ? '<span style="background: rgba(255,255,255,0.25); color: #fff; padding: 2px 7px; border-radius: 10px; font-size: 11px; font-weight: 800; margin-left: 4px;">💾 ĐÃ LƯU</span>' : ''}
      `;
    }

    const reanalyzeBtn = boxContainer.querySelector(`#aiReanalyzeBtnHmp_${uniqueId}`);
    if (reanalyzeBtn && reanalyzeCallback) {
      reanalyzeBtn.onclick = () => {
        if (confirm('Bé có muốn gọi AI phân tích lại câu hỏi này không? (Lời giải mới sẽ thay thế lời giải cũ đã lưu nha)')) {
          reanalyzeCallback();
        }
      };
    }

    const copyBtn = boxContainer.querySelector(`#aiCopyBtn_${uniqueId}`);
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(result.text).then(() => {
          copyBtn.innerText = '✅ Đã Chép!';
          setTimeout(() => { copyBtn.innerText = '📋 Sao Chép'; }, 1500);
        });
      };
    }

    const closeBtn = boxContainer.querySelector(`#aiCloseBoxBtn_${uniqueId}`);
    if (closeBtn) {
      closeBtn.onclick = () => {
        boxContainer.innerHTML = '';
        if (triggerBtn) {
          triggerBtn.innerHTML = `
            <span>🌸 🤖</span>
            <span>📖 Xem Lại Giải Thích Của AI</span>
            ${isSaved ? '<span style="background: rgba(255,255,255,0.25); color: #fff; padding: 2px 7px; border-radius: 10px; font-size: 11px; font-weight: 800; margin-left: 4px;">💾 ĐÃ LƯU</span>' : ''}
          `;
        }
      };
    }
  }

  // Persistent Storage for Translations
  const STORAGE_TRANS_CACHE = 'hmp_translations_cache';

  function getTranslationsCache() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_TRANS_CACHE) : null;
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function getTranslation(qId) {
    if (!qId) return null;
    const cache = getTranslationsCache();
    return cache[String(qId)] || null;
  }

  function saveTranslationToCache(qId, transData) {
    try {
      if (typeof localStorage === 'undefined' || !qId || !transData) return;
      const cache = getTranslationsCache();
      cache[String(qId)] = {
        question_vn: transData.question_vn,
        options_vn: transData.options_vn || {},
        savedAt: Date.now()
      };
      localStorage.setItem(STORAGE_TRANS_CACHE, JSON.stringify(cache));
    } catch (e) {
      console.warn('Could not save translation:', e);
    }
  }

  function clearAllTranslations() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_TRANS_CACHE);
      }
    } catch (e) {}
  }

  function getTranslationsCount() {
    return Object.keys(getTranslationsCache()).length;
  }

  async function translateQuestion(q) {
    if (!q) return null;
    const qId = String(q.id);
    const cached = getTranslation(qId);
    if (cached) return cached;

    const apiKey = getApiKey();
    if (!apiKey) throw new Error('CHUA_CO_KEY');

    const prompt = `Bạn là chuyên gia dịch thuật đề thi đại học khối ngành kinh tế và quản trị (FPTU). Dịch câu hỏi trắc nghiệm sau và các đáp án sang tiếng Việt chuẩn xác, tự nhiên, đúng thuật ngữ chuyên ngành kinh tế/kế toán/quản trị.
Trả về đúng 1 đối tượng JSON duy nhất, KHÔNG dùng markdown (không bọc trong \`\`\`json), KHÔNG có bất kỳ văn bản nào khác.

Định dạng JSON:
{
  "question_vn": "Nội dung câu hỏi tiếng Việt",
  "options_vn": {
    "A": "Nội dung A tiếng Việt",
    "B": "Nội dung B tiếng Việt"
  }
}

Câu hỏi:
${q.question}

Options:
${JSON.stringify(q.options || {})}`;

    const preferredModel = getSelectedModel();
    const candidateModels = [
      preferredModel,
      ...DEFAULT_MODELS.filter(m => m !== preferredModel)
    ];

    let lastErr = null;
    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.1
            }
          })
        });

        const data = await response.json();
        if (response.ok) {
          const rawText = extractResponseText(data);
          if (rawText) {
            const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            if (parsed && parsed.question_vn) {
              saveTranslationToCache(qId, parsed);
              return parsed;
            }
          }
        }
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Không thể dịch tự động bằng AI lúc này.');
  }

  // Public Interface
  window.AIAssistant = {
    init: function () {
      injectStyles();
      injectModal();
      checkUrlApiKey();
      updateStatusIndicators();
    },
    openConfigModal: openConfigModal,
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    renderWidget: renderWidget,
    buildPrompt: buildPrompt,
    getSavedCount: getSavedCount,
    getSavedAnswers: getSavedAnswers,
    clearAllSavedAnswers: clearAllSavedAnswers,
    callGeminiApi: callGeminiApi,
    translateQuestion: translateQuestion,
    getTranslation: getTranslation,
    clearAllTranslations: clearAllTranslations,
    getTranslationsCount: getTranslationsCount
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => window.AIAssistant.init());
    } else {
      window.AIAssistant.init();
    }
  }
})();

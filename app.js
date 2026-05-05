'use strict';

/* ── CONSTANTS ── */
var GROQ_API    = 'https://api.groq.com/openai/v1';
var STT_MODEL   = 'whisper-large-v3';
var LLM_MODEL   = 'qwen/qwen3-32b';
var STORAGE_KEY = 'speakup_groq_key';
var ROLE_KEY    = 'speakup_role';
var LANG_KEY    = 'speakup_stt_lang';

var ROLES = {
  none: {
    label: '自由對話', icon: '', desc: '', context: '', opening: null,
  },
  clerk: {
    label: '店員', icon: '🛍', desc: '購物情境 — 你是顧客，AI 是店員',
    context: 'You are a friendly shop assistant in a clothing/general store. The user is a customer. Stay in character. Help them find what they need.',
    opening: 'Welcome! How can I help you today? Are you looking for something specific?',
  },
  doctor: {
    label: '醫生', icon: '🩺', desc: '看診情境 — 你是病人，AI 是醫生',
    context: "You are a friendly doctor (Dr. Smith) in a clinic. The user is a patient. Stay in character. Ask about their symptoms and guide the consultation.",
    opening: "Good morning! I'm Dr. Smith. What seems to be the problem today?",
  },
  police: {
    label: '警察', icon: '👮', desc: '協助情境 — 你是民眾，AI 是警察',
    context: 'You are a helpful police officer. The user is a member of the public who may need directions or assistance. Stay in character and be friendly.',
    opening: 'Hello there! Is everything alright? How can I assist you today?',
  },
};

function buildSystemPrompt(roleKey) {
  var role = ROLES[roleKey] || ROLES.none;
  var base = 'You are an enthusiastic and friendly English conversation coach helping users practice spoken English.';
  var roleCtx = role.context ? '\n\nROLE CONTEXT: ' + role.context : '';
  return base + roleCtx + '\n\nDo NOT output any <think> tags. Reply ONLY with a raw JSON object, no markdown, no extra text.\n\nJSON format:\n{"reply":"<English response>","correction":"<corrected sentence or empty>","zh_explanation":"<Chinese explanation or empty>","suggest_retry":false}\n\nRules:\n1. Correct English -> reply naturally in character, extend conversation.\n2. Chinese input -> zh_explanation teaches English phrase, ask them to try.\n3. Confused ("I don\'t understand","What?","什麼","聽不懂") -> zh_explanation explains in Chinese, repeat question.\n4. Off-topic -> zh_explanation guides back.\n5. Grammar mistake -> correction field has fix; reply warmly.\n6. Short replies (1-3 sentences). Always end with a follow-up question.\n7. Be encouraging and patient.';
}

/* ── STORAGE ── */
function saveApiKey(key) {
  try { localStorage.setItem(STORAGE_KEY, key); } catch(_) {
    var exp = new Date(Date.now() + 365*86400*1000).toUTCString();
    document.cookie = STORAGE_KEY+'='+encodeURIComponent(key)+';expires='+exp+';path=/;SameSite=Strict';
  }
}
function loadApiKey() {
  try { var v = localStorage.getItem(STORAGE_KEY); if (v) return v; } catch(_) {}
  var m = document.cookie.split(';').find(function(c){return c.trim().startsWith(STORAGE_KEY+'=');});
  return m ? decodeURIComponent(m.split('=')[1].trim()) : '';
}
function loadRole() {
  try { return localStorage.getItem(ROLE_KEY) || 'none'; } catch(_) { return 'none'; }
}

/* ── MAIN ── */
document.addEventListener('DOMContentLoaded', function() {

  /* DOM */
  var btnRecord    = document.getElementById('btn-record');
  var recordIcon   = document.getElementById('record-icon');
  var btnClear     = document.getElementById('btn-clear');
  var chatInner    = document.getElementById('chat-inner');
  var chatArea     = document.getElementById('chat-area');
  var statusDot    = document.getElementById('status-dot');
  var statusText   = document.getElementById('status-text');
  var apiKeyInput  = document.getElementById('api-key-input');
  var btnSaveKey   = document.getElementById('btn-save');
  var saveMsg      = document.getElementById('save-msg');
  var toggleVis    = document.getElementById('toggle-vis');
  var roleSelect   = document.getElementById('role-select');
  var btnLang      = document.getElementById('btn-lang');
  var scenarioBar  = document.getElementById('scenario-bar');
  var scenarioIcon = document.getElementById('scenario-icon');
  var scenarioText = document.getElementById('scenario-text');

  /* STATE */
  var mediaRecorder     = null;
  var audioChunks       = [];
  var isRecording       = false;
  var isProcessing      = false;
  var conversationEnded = false;
  var chatHistory       = [];
  var currentRole       = 'none';
  var sttLang           = 'en';
  var typingCounter     = 0;
  var toastTimer        = null;

  /* ── NAV ── */
  function switchToTab(name) {
    document.querySelectorAll('.nav-tab').forEach(function(t){t.classList.remove('active');});
    document.querySelectorAll('.page').forEach(function(p){p.classList.remove('active');});
    var t = document.querySelector('.nav-tab[data-page="'+name+'"]');
    var p = document.getElementById('page-'+name);
    if (t) t.classList.add('active');
    if (p) p.classList.add('active');
  }

  document.querySelectorAll('.nav-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var prev = document.querySelector('.nav-tab.active');
      var prevPage = prev ? prev.dataset.page : null;
      switchToTab(tab.dataset.page);
      // Play opening line when first switching to practice tab
      if (tab.dataset.page === 'practice' && prevPage !== 'practice') {
        var role = ROLES[currentRole];
        if (role && role.opening && chatHistory.length === 1 && chatHistory[0].role === 'assistant') {
          var openingBubble = chatInner.querySelector('.msg.ai .msg-bubble');
          setTimeout(function() { speakText(role.opening, openingBubble); }, 300);
        }
      }
    });
  });

  /* ── SCENARIO BAR ── */
  function updateScenarioBar(roleKey) {
    var role = ROLES[roleKey] || ROLES.none;
    if (!role.desc) {
      scenarioBar.style.display = 'none';
    } else {
      scenarioIcon.textContent = role.icon;
      scenarioText.textContent = role.label + '  |  ' + role.desc;
      scenarioBar.style.display = 'flex';
    }
  }

  function resetChat() {
    chatHistory = [];
    conversationEnded = false;
    window.speechSynthesis.cancel();
    chatInner.innerHTML = '<div class="welcome-msg"><div class="welcome-icon">🎙</div>'
      + '<h2>準備好了嗎？</h2>'
      + '<p>按下錄音鈕，開口說英文吧！<br/>AI 會即時糾正、陪你對話。</p></div>';
    setStatus('idle', '點擊麥克風開始錄音');
  }

  function applyRole(roleKey) {
    currentRole = roleKey || 'none';
    updateScenarioBar(currentRole);
    resetChat();
    var role = ROLES[currentRole];
    if (role && role.opening) {
      chatHistory.push({ role: 'assistant', content: role.opening });
      var parsed = { reply: role.opening, correction: '', zh_explanation: '', suggest_retry: false };
      var bubbleEl = addAIMessage(parsed);
      attachTTSButton(bubbleEl, role.opening);
      // Don't auto-play here — will play when user switches to practice tab
      scrollToBottom();
    }
  }

  /* ── SETTINGS ── */
  var storedKey  = loadApiKey();
  var storedRole = loadRole();
  if (storedKey)  apiKeyInput.value  = storedKey;
  if (storedRole) roleSelect.value   = storedRole;

  toggleVis.addEventListener('click', function() {
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
  });

  btnSaveKey.addEventListener('click', function() {
    var key = apiKeyInput.value.trim();
    if (!key) { showSaveMsg('請輸入 API Key', 'err'); return; }
    if (!key.startsWith('gsk_')) { showSaveMsg('Key 格式似乎不正確', 'err'); return; }
    saveApiKey(key);
    showSaveMsg('已儲存 ✓', 'ok');
  });

  roleSelect.addEventListener('change', function() {
    var roleKey = roleSelect.value;
    try { localStorage.setItem(ROLE_KEY, roleKey); } catch(_) {}
    applyRole(roleKey);
  });

  // Init lang from storage
  try { sttLang = localStorage.getItem(LANG_KEY) || 'en'; } catch(_) { sttLang = 'en'; }
  btnLang.textContent = sttLang === 'zh' ? '中' : 'EN';
  if (sttLang === 'zh') btnLang.classList.add('zh');

  btnLang.addEventListener('click', function() {
    sttLang = sttLang === 'en' ? 'zh' : 'en';
    try { localStorage.setItem(LANG_KEY, sttLang); } catch(_) {}
    btnLang.textContent = sttLang === 'zh' ? '中' : 'EN';
    btnLang.classList.toggle('zh', sttLang === 'zh');
  });

  function showSaveMsg(text, type) {
    saveMsg.textContent = text;
    saveMsg.className = 'save-msg show ' + type;
    setTimeout(function(){ saveMsg.className = 'save-msg'; }, 2500);
  }

  /* ── STATUS ── */
  function setStatus(state, text) {
    statusDot.className    = 'status-dot ' + state;
    statusText.textContent = text;
  }

  /* ── RECORDING ── */
  btnRecord.addEventListener('click', function() {
    if (isProcessing) return;
    if (conversationEnded) { showToast('對話已結束，請清除後重新開始'); return; }
    if (!isRecording) { startRecording(); } else { stopRecording(); }
  });

  function startRecording() {
    var isSecure = location.protocol === 'https:'
      || location.hostname === 'localhost'
      || location.hostname === '127.0.0.1';
    if (!isSecure) {
      addSystemMessage('需要 HTTPS 或 localhost 才能使用麥克風。\n本機測試：python -m http.server 8080\n然後開啟 http://localhost:8080');
      setStatus('error', '需要 HTTPS 環境');
      return;
    }
    var key = loadApiKey().trim();
    if (!key) { showToast('請先在設定頁面儲存 API Key'); switchToTab('settings'); return; }

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function(stream) {
        audioChunks = [];
        var mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
        else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';

        mediaRecorder = new MediaRecorder(stream, { mimeType: mimeType });
        mediaRecorder.addEventListener('dataavailable', function(e) {
          if (e.data && e.data.size > 0) audioChunks.push(e.data);
        });
        mediaRecorder.addEventListener('stop', function() {
          stream.getTracks().forEach(function(t){ t.stop(); });
          onRecordingStop();
        });
        mediaRecorder.start(100);
        isRecording = true;
        btnRecord.classList.add('recording');
        recordIcon.textContent = '⏹';
        setStatus('rec', '錄音中… 再按一次停止');
      })
      .catch(function(err) {
        var msg = '無法取得麥克風';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') msg = '麥克風權限被拒絕，請在瀏覽器允許麥克風存取';
        else if (err.name === 'NotFoundError') msg = '找不到麥克風裝置';
        setStatus('error', msg);
        showToast(msg);
      });
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      btnRecord.classList.remove('recording');
      recordIcon.textContent = '🎙️';
      setStatus('loading', '辨識語音中…');
    }
  }

  function onRecordingStop() {
    if (!audioChunks.length) { setStatus('idle', '沒有錄到聲音，請再試一次'); return; }
    var mimeType = mediaRecorder.mimeType || 'audio/webm';
    var ext  = mimeType.includes('mp4') ? 'm4a' : 'webm';
    var blob = new Blob(audioChunks, { type: mimeType });
    transcribeAudio(blob, ext)
      .then(function(transcript) {
        if (!transcript || !transcript.trim()) { setStatus('idle', '沒有辨識到語音，請再試一次'); return; }
        processUserInput(transcript.trim());
      })
      .catch(function(err) { handleApiError(err, '語音辨識失敗'); });
  }

  /* ── PROCESS INPUT ── */
  function processUserInput(userText) {
    isProcessing = true;
    addMessage('user', userText);
    chatHistory.push({ role: 'user', content: userText });
    var typingId = addTypingIndicator();
    setStatus('loading', 'AI 思考中…');

    callLLM(chatHistory)
      .then(function(raw) {
        removeTypingIndicator(typingId);
        var noThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        var clean   = noThink.replace(/```json|```/gi, '').trim();
        var parsed;
        try { parsed = JSON.parse(clean); }
        catch(_) { parsed = { reply: noThink || raw, correction: '', zh_explanation: '', suggest_retry: false }; }

        chatHistory.push({ role: 'assistant', content: parsed.reply || '' });
        var bubbleEl = addAIMessage(parsed);

        if (parsed.reply) {
          attachTTSButton(bubbleEl, parsed.reply);
          setTimeout(function() { speakText(parsed.reply, bubbleEl); }, 100);
          setStatus('ok', 'AI 回應完成');
        }
        scrollToBottom();
      })
      .catch(function(err) {
        removeTypingIndicator(typingId);
        var isLimit = handleApiError(err, 'AI 回應失敗');
        if (isLimit) { conversationEnded = true; addSystemMessage('API 額度已達上限，對話結束。請清除後重試。'); }
      })
      .finally(function() {
        isProcessing = false;
        setStatus('idle', '點擊麥克風開始錄音');
        scrollToBottom();
      });
  }

  /* ── GROQ API ── */
  function transcribeAudio(blob, ext) {
    var key  = loadApiKey().trim();
    var form = new FormData();
    form.append('file', blob, 'recording.' + ext);
    form.append('model', STT_MODEL);
    form.append('response_format', 'json');
    if (sttLang) form.append('language', sttLang); // set by EN/中 toggle
    return fetch(GROQ_API + '/audio/transcriptions', {
      method: 'POST', headers: { 'Authorization': 'Bearer ' + key }, body: form,
    }).then(function(res) {
      if (!res.ok) return res.json().catch(function(){return{};}).then(function(e){
        var err = new Error(e.error&&e.error.message?e.error.message:'STT HTTP '+res.status);
        err.status = res.status; throw err;
      });
      return res.json().then(function(d){ return d.text || ''; });
    });
  }

  function callLLM(history) {
    var key = loadApiKey().trim();
    var historyClean = history.map(function(msg, i) {
      return (msg.role === 'user' && i === history.length - 1)
        ? { role: msg.role, content: msg.content + ' /no_think' }
        : msg;
    });
    var messages = [{ role: 'system', content: buildSystemPrompt(currentRole) }].concat(historyClean);
    return fetch(GROQ_API + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: LLM_MODEL, messages: messages, max_tokens: 512, temperature: 0.8 }),
    }).then(function(res) {
      if (!res.ok) return res.json().catch(function(){return{};}).then(function(e){
        var err = new Error(e.error&&e.error.message?e.error.message:'LLM HTTP '+res.status);
        err.status = res.status; throw err;
      });
      return res.json().then(function(d){ return (d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||''; });
    });
  }

  /* ── WEB SPEECH TTS ── */
  function getEnglishVoice() {
    var voices = window.speechSynthesis.getVoices();
    var enUS = voices.find(function(v){ return v.lang === 'en-US'; });
    if (enUS) return enUS;
    return voices.find(function(v){ return v.lang.startsWith('en'); }) || null;
  }

  function speakText(text, bubbleEl) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var utt   = new SpeechSynthesisUtterance(text);
    utt.lang  = 'en-US';
    utt.rate  = 0.92;
    utt.pitch = 1.05;
    var voice = getEnglishVoice();
    if (voice) utt.voice = voice;
    var btn = bubbleEl ? bubbleEl.querySelector('.tts-btn') : null;
    if (btn) { btn.classList.add('playing'); btn.innerHTML = '⏸ 停止播放'; }
    utt.onend = function() { if (btn) { btn.classList.remove('playing'); btn.innerHTML = '▶ 播放語音'; } };
    utt.onerror = function() { if (btn) { btn.classList.remove('playing'); btn.innerHTML = '▶ 播放語音'; } };
    setTimeout(function(){ window.speechSynthesis.speak(utt); }, 50);
  }

  function attachTTSButton(bubbleEl, text) {
    var btn = document.createElement('button');
    btn.className = 'tts-btn';
    btn.innerHTML = '▶ 播放語音';
    btn.addEventListener('click', function() {
      if (btn.classList.contains('playing')) {
        window.speechSynthesis.cancel();
        btn.classList.remove('playing'); btn.innerHTML = '▶ 播放語音';
        return;
      }
      document.querySelectorAll('.tts-btn.playing').forEach(function(b){
        b.classList.remove('playing'); b.innerHTML = '▶ 播放語音';
      });
      speakText(text, bubbleEl);
    });
    bubbleEl.appendChild(btn);
  }

  /* ── CHAT UI ── */
  function removeWelcome() {
    var w = chatInner.querySelector('.welcome-msg');
    if (w) w.remove();
  }

  function addMessage(role, text) {
    removeWelcome();
    var wrap   = document.createElement('div'); wrap.className = 'msg ' + role;
    var label  = document.createElement('div'); label.className = 'msg-role'; label.textContent = role === 'user' ? '你' : 'AI';
    var bubble = document.createElement('div'); bubble.className = 'msg-bubble'; bubble.textContent = text;
    wrap.appendChild(label); wrap.appendChild(bubble);
    chatInner.appendChild(wrap); scrollToBottom();
    return bubble;
  }

  function addAIMessage(parsed) {
    removeWelcome();
    var wrap   = document.createElement('div'); wrap.className = 'msg ai';
    var label  = document.createElement('div'); label.className = 'msg-role'; label.textContent = 'AI Coach';
    var bubble = document.createElement('div'); bubble.className = 'msg-bubble';

    if (parsed.reply) {
      var p = document.createElement('p'); p.textContent = parsed.reply; bubble.appendChild(p);
    }
    if (parsed.zh_explanation) bubble.appendChild(makeBlock('💡 解說', parsed.zh_explanation, false));
    if (parsed.correction)     bubble.appendChild(makeBlock('✏️ 建議說法', parsed.correction, true));

    wrap.appendChild(label); wrap.appendChild(bubble);
    chatInner.appendChild(wrap); scrollToBottom();
    return bubble;
  }

  function makeBlock(labelText, content, isCode) {
    var block = document.createElement('div'); block.className = 'correction-block';
    var lbl   = document.createElement('div'); lbl.className = 'correction-label'; lbl.textContent = labelText;
    var body  = document.createElement('div');
    if (isCode) body.className = 'correction-correct';
    body.textContent = content;
    block.appendChild(lbl); block.appendChild(body);
    return block;
  }

  function addSystemMessage(text) {
    removeWelcome();
    var wrap   = document.createElement('div'); wrap.className = 'msg msg-system';
    var bubble = document.createElement('div'); bubble.className = 'msg-bubble';
    text.split('\n').forEach(function(line, i, arr) {
      bubble.appendChild(document.createTextNode(line));
      if (i < arr.length - 1) bubble.appendChild(document.createElement('br'));
    });
    wrap.appendChild(bubble); chatInner.appendChild(wrap); scrollToBottom();
  }

  function addTypingIndicator() {
    removeWelcome();
    var id = 'typing-' + (++typingCounter);
    var wrap = document.createElement('div'); wrap.className = 'msg ai'; wrap.id = id;
    var label = document.createElement('div'); label.className = 'msg-role'; label.textContent = 'AI Coach';
    var bubble = document.createElement('div'); bubble.className = 'msg-bubble typing-bubble';
    bubble.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
    wrap.appendChild(label); wrap.appendChild(bubble);
    chatInner.appendChild(wrap); scrollToBottom();
    return id;
  }

  function removeTypingIndicator(id) {
    var el = document.getElementById(id); if (el) el.remove();
  }

  function scrollToBottom() {
    setTimeout(function(){ chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' }); }, 50);
  }

  /* ── CLEAR ── */
  btnClear.addEventListener('click', function() {
    resetChat();
    // Re-apply role opening if role is set
    var role = ROLES[currentRole];
    if (role && role.opening) {
      chatHistory.push({ role: 'assistant', content: role.opening });
      var parsed = { reply: role.opening, correction: '', zh_explanation: '', suggest_retry: false };
      var bubbleEl = addAIMessage(parsed);
      attachTTSButton(bubbleEl, role.opening);
      setTimeout(function() { speakText(role.opening, bubbleEl); }, 200);
      scrollToBottom();
    }
  });

  /* ── ERROR HANDLING ── */
  function handleApiError(err, fallbackMsg) {
    console.error(err);
    var msg    = err && err.message ? err.message : '';
    var status = err && err.status  ? err.status  : 0;
    var isLimit = status === 429 || /rate.?limit|quota|exceeded|too.?many/i.test(msg);
    if (status === 401 || /invalid.?api.?key|unauthorized/i.test(msg)) {
      setStatus('error', 'API Key 無效'); showToast('API Key 無效，請前往設定頁面更新'); switchToTab('settings'); return false;
    }
    if (isLimit) { setStatus('error', 'API 額度已達上限'); return true; }
    setStatus('error', fallbackMsg);
    showToast(fallbackMsg + '：' + msg.slice(0, 60));
    return false;
  }

  /* ── TOAST ── */
  function showToast(msg) {
    var toast = document.querySelector('.toast');
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.classList.remove('show'); }, 3000);
  }

  /* ── INIT ── */
  var isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isSecure) {
    addSystemMessage('目前以 file:// 開啟，麥克風無法使用。\n請部署到 GitHub Pages，或本機執行：\npython -m http.server 8080\n然後開啟 http://localhost:8080');
  }

  // Restore saved role
  applyRole(storedRole);

  if (!loadApiKey()) { showToast('歡迎！請先設定你的 Groq API Key'); }

}); // end DOMContentLoaded

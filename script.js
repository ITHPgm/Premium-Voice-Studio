   const textInput = document.getElementById('textInput');
    const voiceSelect = document.getElementById('voiceSelect');
    const rate = document.getElementById('rate');
    const pitch = document.getElementById('pitch');
    const volume = document.getElementById('volume');
    const rateValue = document.getElementById('rateValue');
    const pitchValue = document.getElementById('pitchValue');
    const volumeValue = document.getElementById('volumeValue');
    const charCount = document.getElementById('charCount');
    const chunkCount = document.getElementById('chunkCount');
    const chunkPreview = document.getElementById('chunkPreview');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    const speechState = document.getElementById('speechState');
    const voiceCount = document.getElementById('voiceCount');
    const bgModeSelect = document.getElementById('bgModeSelect');
    const djModeSelect = document.getElementById('djModeSelect');
    const djIntensity = document.getElementById('djIntensity');
    const musicVolume = document.getElementById('musicVolume');
    const musicList = document.getElementById('musicList');
    const musicVolumeValue = document.getElementById('musicVolumeValue');
    const djIntensityValue = document.getElementById('djIntensityValue');

    const speakBtn = document.getElementById('speakBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resumeBtn = document.getElementById('resumeBtn');
    const stopBtn = document.getElementById('stopBtn');
    const loadSampleBtn = document.getElementById('loadSampleBtn');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const refreshVoicesBtn = document.getElementById('refreshVoicesBtn');
    const downloadPresetBtn = document.getElementById('downloadPresetBtn');
    const djStartBtn = document.getElementById('djStartBtn');

    let voices = [];
    let currentUtterance = null;
    let currentChunkIndex = 0;
    let chunks = [];
    let isStopped = false;
    let bgInterval = null;
    let bgOsc = null;
    let bgGain = null;
    let bgAudioCtx = null;
    let isDjPreview = false;

    function updateStats() {
      const text = textInput.value || '';
      charCount.textContent = text.length.toLocaleString();
      chunks = splitIntoChunks(text, 220);
      chunkCount.textContent = chunks.length.toLocaleString();
      chunkPreview.textContent = chunks.length ? `First chunk preview: ${chunks[0].slice(0, 120)}${chunks[0].length > 120 ? '…' : ''}` : 'No chunks yet. Paste text to begin.';
    }

    function splitIntoChunks(text, maxLength = 220) {
      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (!cleaned) return [];
      const sentences = cleaned.match(/[^.!?]+[.!?]*|[^.!?]+$/g) || [cleaned];
      const result = [];
      let current = '';

      for (const sentence of sentences) {
        const s = sentence.trim();
        if (!s) continue;
        if ((current + ' ' + s).trim().length <= maxLength) {
          current = (current + ' ' + s).trim();
        } else {
          if (current) result.push(current);
          if (s.length <= maxLength) {
            current = s;
          } else {
            const pieces = s.match(new RegExp(`.{1,${maxLength}}(\\s|$)`, 'g')) || [s];
            for (const piece of pieces) {
              const p = piece.trim();
              if (p) result.push(p);
            }
            current = '';
          }
        }
      }

      if (current) result.push(current);
      return result;
    }

    function populateVoices() {
      voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
      const preferredOrder = voices
        .map((v, i) => ({ v, i }))
        .sort((a, b) => {
          const aKey = `${a.v.default ? 0 : 1}-${a.v.lang}-${a.v.name}`;
          const bKey = `${b.v.default ? 0 : 1}-${b.v.lang}-${b.v.name}`;
          return aKey.localeCompare(bKey);
        });

      voiceSelect.innerHTML = '';
      preferredOrder.forEach(({ v, i }) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${v.name} — ${v.lang}${v.default ? ' (default)' : ''}`;
        voiceSelect.appendChild(option);
      });
      voiceCount.textContent = voices.length.toLocaleString();
    }

    function setState(state) {
      speechState.textContent = state;
    }

    function stopBackground() {
      if (bgInterval) {
        clearInterval(bgInterval);
        bgInterval = null;
      }
      if (bgOsc && bgGain && bgAudioCtx) {
        try { bgOsc.stop(); } catch (e) {}
        bgOsc = null;
        bgGain = null;
      }
      if (bgAudioCtx && bgAudioCtx.state !== 'closed') {
        try { bgAudioCtx.close(); } catch (e) {}
      }
      bgAudioCtx = null;
    }

    function stopSpeech() {
      isStopped = true;
      window.speechSynthesis.cancel();
      currentUtterance = null;
      currentChunkIndex = 0;
      progressBar.style.width = '0%';
      progressText.textContent = 'Stopped';
      setState('Stopped');
      stopBackground();
    }

    function startBackgroundMusic(mode = bgModeSelect.value, intensity = parseFloat(djIntensity.value)) {
      stopBackground();
      if (mode === 'none') return;

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      bgAudioCtx = new AudioContextClass();
      bgGain = bgAudioCtx.createGain();
      bgGain.gain.value = parseFloat(musicVolume.value) * (mode === 'club' ? 1 : 0.9);
      bgGain.connect(bgAudioCtx.destination);

      const makeTone = (freq, wave = 'sine', delay = 0, duration = 1.2, vol = 0.04) => {
        const osc = bgAudioCtx.createOscillator();
        const gain = bgAudioCtx.createGain();
        osc.type = wave;
        osc.frequency.value = freq;
        gain.gain.value = vol * intensity;
        osc.connect(gain);
        gain.connect(bgGain);
        osc.start(bgAudioCtx.currentTime + delay);
        osc.stop(bgAudioCtx.currentTime + delay + duration);
        osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} };
      };

      if (mode === 'ambient') {
        makeTone(220, 'sine', 0, 3.4, 0.05);
        makeTone(277, 'triangle', 0.6, 3.4, 0.04);
        makeTone(330, 'sine', 1.2, 3.4, 0.03);
      } else if (mode === 'lofi') {
        bgInterval = setInterval(() => {
          makeTone(196, 'triangle', 0, 0.9, 0.06);
          makeTone(247, 'triangle', 0.25, 0.9, 0.05);
          makeTone(294, 'triangle', 0.5, 0.9, 0.04);
        }, 900);
      } else if (mode === 'club') {
        bgInterval = setInterval(() => {
          makeTone(110, 'sawtooth', 0, 0.12, 0.08);
          makeTone(220, 'sawtooth', 0.12, 0.12, 0.05);
          makeTone(440, 'square', 0.24, 0.12, 0.03);
        }, 260);
      } else if (mode === 'cinematic') {
        makeTone(147, 'sine', 0, 4, 0.05);
        makeTone(196, 'sine', 0.8, 4, 0.04);
        makeTone(247, 'triangle', 1.6, 4, 0.03);
      }
    }

    function speakChunk(index) {
      if (isStopped) return;
      if (index >= chunks.length) {
        currentUtterance = null;
        currentChunkIndex = 0;
        progressBar.style.width = '100%';
        progressText.textContent = 'Completed';
        setState('Completed');
        stopBackground();
        return;
      }

      const text = chunks[index];
      const utterance = new SpeechSynthesisUtterance(text);
      const selectedVoice = voices[Number(voiceSelect.value)] || voices.find(v => v.default) || voices[0];
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = parseFloat(rate.value);
      utterance.pitch = parseFloat(pitch.value);
      utterance.volume = parseFloat(volume.value);

      currentUtterance = utterance;
      currentChunkIndex = index;
      progressText.textContent = `Speaking chunk ${index + 1} of ${chunks.length}`;
      setState(isDjPreview ? 'DJ preview' : 'Speaking');
      progressBar.style.width = `${Math.max(2, ((index) / chunks.length) * 100)}%`;

      if (index === 0) {
        startBackgroundMusic(bgModeSelect.value, parseFloat(djIntensity.value));
      }

      utterance.onend = () => {
        if (isStopped) return;
        progressBar.style.width = `${((index + 1) / chunks.length) * 100}%`;
        speakChunk(index + 1);
      };

      utterance.onerror = () => {
        if (isStopped) return;
        setState('Voice error — moving to next chunk');
        speakChunk(index + 1);
      };

      window.speechSynthesis.speak(utterance);
    }

    function setBgActive(mode) {
      bgModeSelect.value = mode;
      document.querySelectorAll('.music-item').forEach(item => {
        item.classList.toggle('active', item.dataset.mode === mode);
      });
    }

    speakBtn.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (!text) {
        alert('Please enter some text first.');
        return;
      }

      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      isStopped = false;
      isDjPreview = false;
      updateStats();
      setState('Preparing speech...');
      speakChunk(0);
    });

    pauseBtn.addEventListener('click', () => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        setState('Paused');
        progressText.textContent = `Paused at chunk ${currentChunkIndex + 1}`;
      }
    });

    resumeBtn.addEventListener('click', () => {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        setState('Resumed');
        progressText.textContent = `Speaking chunk ${currentChunkIndex + 1} of ${chunks.length}`;
      }
    });

    stopBtn.addEventListener('click', stopSpeech);

    loadSampleBtn.addEventListener('click', () => {
      textInput.value = `Welcome to the premium text to speech studio. This editor supports long text, voice selection, background music, and DJ-style playback. You can paste articles, tutorials, scripts, blog posts, or full chapters. The app automatically splits long content into smaller chunks so playback remains stable and clean.`;
      updateStats();
    });

    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(textInput.value || '');
        setState('Text copied to clipboard');
      } catch (e) {
        alert('Copy failed in this browser.');
      }
    });

    clearBtn.addEventListener('click', () => {
      textInput.value = '';
      updateStats();
      stopSpeech();
      progressText.textContent = 'Ready';
      setState('Idle');
    });

    refreshVoicesBtn.addEventListener('click', populateVoices);

    [rate, pitch, volume].forEach((input) => {
      input.addEventListener('input', () => {
        rateValue.textContent = `${parseFloat(rate.value).toFixed(2)}x`;
        pitchValue.textContent = parseFloat(pitch.value).toFixed(2);
        volumeValue.textContent = `${Math.round(parseFloat(volume.value) * 100)}%`;
      });
    });

    musicVolume.addEventListener('input', () => {
      musicVolumeValue.textContent = `${Math.round(parseFloat(musicVolume.value) * 100)}%`;
      if (bgGain) bgGain.gain.value = parseFloat(musicVolume.value);
    });

    djIntensity.addEventListener('input', () => {
      djIntensityValue.textContent = `${Math.round(parseFloat(djIntensity.value) * 100)}%`;
    });

    bgModeSelect.addEventListener('change', () => {
      setBgActive(bgModeSelect.value);
    });

    musicList.addEventListener('click', (e) => {
      const item = e.target.closest('.music-item');
      if (!item) return;
      setBgActive(item.dataset.mode);
    });

    djModeSelect.addEventListener('change', () => {
      const mode = djModeSelect.value;
      if (mode === 'off') {
        bgModeSelect.value = 'none';
        djStartBtn.innerHTML = '<i class="fa-solid fa-record-vinyl"></i> DJ mode preview';
      } else if (mode === 'announce') {
        bgModeSelect.value = 'ambient';
        djStartBtn.innerHTML = '<i class="fa-solid fa-record-vinyl"></i> DJ announcer mode';
      } else if (mode === 'hype') {
        bgModeSelect.value = 'club';
        djStartBtn.innerHTML = '<i class="fa-solid fa-record-vinyl"></i> DJ hype mode';
      } else if (mode === 'radio') {
        bgModeSelect.value = 'lofi';
        djStartBtn.innerHTML = '<i class="fa-solid fa-record-vinyl"></i> DJ radio mode';
      }
      setBgActive(bgModeSelect.value);
    });

    djStartBtn.addEventListener('click', () => {
      const text = textInput.value.trim();
      if (!text) {
        alert('Please enter some text first.');
        return;
      }
      if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      isStopped = false;
      isDjPreview = true;
      updateStats();
      setState('DJ preview running');
      if (djModeSelect.value === 'off') {
        bgModeSelect.value = 'club';
      }
      speakChunk(0);
    });

    downloadPresetBtn.addEventListener('click', () => {
      const session = {
        text: textInput.value,
        voiceIndex: voiceSelect.value,
        rate: rate.value,
        pitch: pitch.value,
        volume: volume.value,
        backgroundMode: bgModeSelect.value,
        backgroundVolume: musicVolume.value,
        djMode: djModeSelect.value,
        djIntensity: djIntensity.value,
        timestamp: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tts-session-preset.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setState('Session preset downloaded');
    });

    if ('speechSynthesis' in window) {
      populateVoices();
      window.speechSynthesis.onvoiceschanged = populateVoices;
    } else {
      voiceSelect.innerHTML = '<option>Speech synthesis not supported</option>';
      voiceCount.textContent = '0';
      speakBtn.disabled = true;
      pauseBtn.disabled = true;
      resumeBtn.disabled = true;
      stopBtn.disabled = true;
      setState('Web Speech API not supported');
    }

    updateStats();
    rateValue.textContent = `${parseFloat(rate.value).toFixed(2)}x`;
    pitchValue.textContent = parseFloat(pitch.value).toFixed(2);
    volumeValue.textContent = `${Math.round(parseFloat(volume.value) * 100)}%`;
    musicVolumeValue.textContent = `${Math.round(parseFloat(musicVolume.value) * 100)}%`;
    djIntensityValue.textContent = `${Math.round(parseFloat(djIntensity.value) * 100)}%`;
    setBgActive('none');

/*
 * Android WebView 用ポリフィル。
 * WebView には Web Speech API（speechSynthesis / SpeechRecognition）が無いので、
 * ネイティブ（CNSNative）に橋渡しして同じ形の API を用意する。
 * CNS 側のコードはブラウザと同じまま動く。
 */
(function () {
  if (typeof window === 'undefined' || !window.CNSNative) return;
  if (window.__cnsPolyfillInstalled) return;
  window.__cnsPolyfillInstalled = true;
  var native = window.CNSNative;

  /* ---------- 読み上げ（speechSynthesis） ---------- */
  var utterances = {};
  var nextId = 1;

  function Utterance(text) {
    this.text = text == null ? '' : String(text);
    this.lang = 'ja-JP';
    this.rate = 1;
    this.pitch = 1;
    this.volume = 1;
    this.voice = null;
    this.onstart = null;
    this.onend = null;
    this.onerror = null;
    this.onpause = null;
    this.onresume = null;
    this.onboundary = null;
    this.onmark = null;
    this._id = nextId++;
  }
  Utterance.prototype.addEventListener = function (type, fn) { this['on' + type] = fn; };
  Utterance.prototype.removeEventListener = function (type) { this['on' + type] = null; };

  function fire(u, type, extra) {
    var handler = u['on' + type];
    if (typeof handler !== 'function') return;
    var ev = { type: type, utterance: u, charIndex: 0, elapsedTime: 0, name: '' };
    if (extra) for (var k in extra) ev[k] = extra[k];
    try { handler.call(u, ev); } catch (e) { console.warn('utterance handler failed', e); }
  }

  function hasPending() { for (var k in utterances) return true; return false; }

  var voices = [{ voiceURI: 'android-ja-JP', name: 'Android 日本語', lang: 'ja-JP', localService: true, 'default': true }];
  var synth = {
    speaking: false,
    pending: false,
    paused: false,
    onvoiceschanged: null,
    speak: function (u) {
      if (!u || typeof u._id !== 'number') return;
      utterances[u._id] = u;
      synth.speaking = true;
      try {
        native.speak(u._id, u.text, Number(u.rate) || 1, Number(u.pitch) || 1, Number(u.volume) || 1);
      } catch (e) {
        delete utterances[u._id];
        synth.speaking = hasPending();
        fire(u, 'error', { error: 'synthesis-failed' });
      }
    },
    cancel: function () {
      try { native.stopSpeaking(); } catch (e) { /* ignore */ }
      var pending = utterances;
      utterances = {};
      synth.speaking = false;
      for (var k in pending) fire(pending[k], 'end');
    },
    pause: function () { /* 未対応 */ },
    resume: function () { /* 未対応 */ },
    getVoices: function () { return voices.slice(); },
    addEventListener: function () { /* voiceschanged は起きない */ },
    removeEventListener: function () { /* ignore */ },
  };

  window.__cnsTts = {
    onStart: function (id) { var u = utterances[id]; if (u) fire(u, 'start'); },
    onEnd: function (id, error) {
      var u = utterances[id];
      if (!u) return;
      delete utterances[id];
      synth.speaking = hasPending();
      if (error) fire(u, 'error', { error: error }); else fire(u, 'end');
    },
  };

  try {
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true, writable: true });
  } catch (e) {
    window.speechSynthesis = synth;
  }
  window.SpeechSynthesisUtterance = Utterance;

  /* ---------- 音声認識（SpeechRecognition） ---------- */
  var current = null;

  function Recognition() {
    this.lang = 'ja-JP';
    this.continuous = false;
    this.interimResults = false;
    this.maxAlternatives = 1;
    this.onstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
    this.onaudiostart = null;
    this.onaudioend = null;
    this.onspeechstart = null;
    this.onspeechend = null;
    this.onnomatch = null;
  }
  Recognition.prototype.addEventListener = function (type, fn) { this['on' + type] = fn; };
  Recognition.prototype.removeEventListener = function (type) { this['on' + type] = null; };
  Recognition.prototype.start = function () {
    if (current && current !== this) { try { native.stopRecognition(); } catch (e) { /* ignore */ } }
    current = this;
    native.startRecognition(this.lang || 'ja-JP', !!this.continuous, !!this.interimResults);
    callR(this, 'start', {});
  };
  Recognition.prototype.stop = function () { if (current === this) { try { native.stopRecognition(); } catch (e) { /* ignore */ } } };
  Recognition.prototype.abort = Recognition.prototype.stop;

  function callR(r, type, ev) {
    var handler = r['on' + type];
    if (typeof handler !== 'function') return;
    ev.type = type;
    try { handler.call(r, ev); } catch (e) { console.warn('recognition handler failed', e); }
  }

  function makeResults(transcript, isFinal) {
    var alt = { transcript: transcript, confidence: 0.9 };
    var result = [alt];
    result.isFinal = !!isFinal;
    result.item = function () { return alt; };
    var list = [result];
    list.item = function () { return result; };
    return list;
  }

  window.__cnsStt = {
    onResult: function (transcript, isFinal) {
      var r = current;
      if (!r) return;
      callR(r, 'result', { results: makeResults(transcript, isFinal), resultIndex: 0 });
    },
    onError: function (code) {
      var r = current;
      if (!r) return;
      callR(r, 'error', { error: code || 'aborted', message: code || '' });
    },
    onEnd: function () {
      var r = current;
      if (!r) return;
      current = null;
      callR(r, 'end', {});
    },
  };

  window.SpeechRecognition = Recognition;
  window.webkitSpeechRecognition = Recognition;
})();

// AudioManager: toca efeitos sonoros (SFX) e a música de fundo (BGM) via Web
// Audio API. Dois canais de volume independentes (SFX e música), cada um com
// seu próprio GainNode — mutar/ajustar um não afeta o outro. Mesma filosofia
// de IMG/loadImage em engine.js (dicionário de assets carregado no import do
// módulo), mas pra áudio: decode roda assim que o preload é chamado, sem
// esperar gesto do usuário — só play()/a música de fato soar exige o
// contexto desbloqueado.

const MAX_VOICES_PER_SOUND = 4; // evita um som martelado (ex.: pulo) empilhar infinito
const MAX_VOICES_TOTAL = 12;    // teto geral, cobre picos de eventos simultâneos

class AudioManager {
  constructor() {
    this.ctx = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.buffers = {};             // key -> AudioBuffer decodificado (sfx e música juntos)
    this.status = {};              // key -> 'loading' | 'loaded' | 'error'
    this.activeVoices = new Map(); // key -> Set<AudioBufferSourceNode> (só sfx)
    this.totalVoices = 0;
    this.sfxVolume = 1;
    this.musicVolume = 1;
    this.unlocked = false;
    this.musicSource = null;
    this.musicKey = null;
    this._autoplayMusicKey = null; // faixa que deve tocar assim que carregar + desbloquear
  }

  // Cria o AudioContext (lazy — só na primeira chamada real). Chamar de novo
  // é seguro, não recria nada.
  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.ctx.destination);
  }

  // Chamado num gesto real do usuário (clique/tecla) pra sair do estado
  // 'suspended' imposto pela autoplay policy. Sem isso, nada soa.
  unlock() {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.unlocked = true;
    this._tryAutoplayMusic();
  }

  // Decodifica um mapa { chave: urlImportada } — mesmo formato de `assets`
  // em assets.js. Roda assim que chamado, não precisa esperar gesto do
  // usuário (decode não é bloqueado por autoplay policy, só a reprodução é).
  // Serve tanto pra SFX quanto pra música — é só um dicionário de buffers.
  preload(soundMap) {
    this.init();
    for (const key in soundMap) {
      this.status[key] = 'loading';
      this._loadOne(key, soundMap[key]);
    }
  }

  async _loadOne(key, source) {
    try {
      const res = await fetch(source);
      const arrayBuffer = await res.arrayBuffer();
      this.buffers[key] = await this.ctx.decodeAudioData(arrayBuffer);
      this.status[key] = 'loaded';
      this._tryAutoplayMusic();
    } catch (err) {
      this.status[key] = 'error';
      console.error('Falha ao carregar o som:', key, source, err);
    }
  }

  // Toca um efeito sonoro já carregado. opts: { volume = 1 }. Ignora
  // silenciosamente se o volume de SFX está zerado, o contexto ainda não
  // foi desbloqueado, o som não terminou de carregar, ou o limite de vozes
  // foi atingido — nunca lança erro em pleno gameplay por causa de áudio.
  play(key, opts = {}) {
    if (this.sfxVolume <= 0 || !this.unlocked || !this.ctx) return;
    const buffer = this.buffers[key];
    if (!buffer) return; // ainda carregando, ou chave errada

    if (this.totalVoices >= MAX_VOICES_TOTAL) return;
    const voices = this.activeVoices.get(key) || new Set();
    if (voices.size >= MAX_VOICES_PER_SOUND) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.value = opts.volume ?? 1;
    source.connect(gain).connect(this.sfxGain);

    voices.add(source);
    this.activeVoices.set(key, voices);
    this.totalVoices++;
    source.onended = () => {
      voices.delete(source);
      this.totalVoices--;
    };
    source.start(0);
  }

  // Marca uma faixa pra tocar em loop assim que ela carregar E o áudio for
  // desbloqueado (o que vier depois — ordem imprevisível) — é assim que a
  // música começa a tocar "antes de iniciar a fase", já no menu, no primeiro
  // gesto do usuário. Chamar de novo com uma chave diferente troca a faixa
  // em execução (ex.: menu -> fases normais -> fase do chefão) — só não faz
  // nada se a faixa pedida já for a que está tocando.
  playMusicWhenReady(key) {
    this._autoplayMusicKey = key;
    this._tryAutoplayMusic();
  }
  _tryAutoplayMusic() {
    const key = this._autoplayMusicKey;
    if (!key || !this.unlocked || !this.buffers[key]) return;
    if (this.musicKey === key && this.musicSource) return; // já é a faixa certa
    this._startMusic(key);
  }
  _startMusic(key) {
    const buffer = this.buffers[key];
    if (!buffer || !this.ctx) return;
    this.stopMusic();
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start(0);
    this.musicSource = source;
    this.musicKey = key;
  }
  stopMusic() {
    if (!this.musicSource) return;
    try { this.musicSource.stop(); } catch (err) { /* já parada, ignora */ }
    try { this.musicSource.disconnect(); } catch (err) { /* já desconectada, ignora */ }
    this.musicSource = null;
  }

  // Volume 0-1 por canal — independentes. Corta/ajusta o gain sem parar as
  // vozes já tocando (evita clique/estalo de stop() abrupto).
  setSfxVolume(v) {
    this.sfxVolume = v;
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }
  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.musicGain) this.musicGain.gain.value = v;
  }
}

export const audioManager = new AudioManager();

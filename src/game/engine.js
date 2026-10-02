import { assets, sfxAssets, musicAssets } from './assets.js';
import { audioManager } from './audio.js';
import { CloudDragonBoss, BOSS_MAX_HP } from './boss.js';

const IMG = {};
const IMG_CHROMA = {};
const IMG_STATUS = {};

// Assets cujo PNG veio com fundo sólido (sem canal alfa) em vez de
// transparente. Pra eles, geramos uma versão recortada (cor de fundo virando
// transparente) e desenhamos essa versão, revelando o cenário real atrás.
const CHROMA_KEY_KEYS = new Set(['cachoeira']);

function chromaKeyToCanvas(image, tolerance = 40) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const cctx = canvas.getContext('2d');
  cctx.drawImage(image, 0, 0);
  const data = cctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  // amostra a cor de fundo no canto superior-esquerdo (fora da silhueta)
  const bgR = px[0], bgG = px[1], bgB = px[2];
  for (let i = 0; i < px.length; i += 4) {
    const dr = px[i] - bgR, dg = px[i + 1] - bgG, db = px[i + 2] - bgB;
    if (Math.sqrt(dr * dr + dg * dg + db * db) <= tolerance) px[i + 3] = 0;
  }
  cctx.putImageData(data, 0, 0);
  return canvas;
}

function loadImage(key, source) {
  const image = new Image();
  IMG_STATUS[key] = { state: 'loading', source };
  image.onload = () => {
    IMG_STATUS[key] = { state: 'loaded', source, width: image.naturalWidth, height: image.naturalHeight };
    if (CHROMA_KEY_KEYS.has(key)) IMG_CHROMA[key] = chromaKeyToCanvas(image);
  };
  image.onerror = () => {
    IMG_STATUS[key] = { state: 'error', source };
    console.error('Falha ao carregar o asset:', source);
  };
  image.src = source;
  IMG[key] = image;
}

for (const key in assets) {
  loadImage(key, assets[key]);
}

// Pré-carrega os efeitos sonoros e a música de fundo (decodifica os buffers
// já de cara — isso não é bloqueado pela autoplay policy do navegador, só a
// reprodução em si é).
audioManager.preload(sfxAssets);
audioManager.preload(musicAssets);
// Toca em loop assim que carregar + o áudio for desbloqueado — começa a
// tocar já no menu, antes do jogador escolher/iniciar uma fase.
audioManager.playMusicWhenReady('bgm_fases');
// AudioContext nasce 'suspended' até um gesto real do usuário. O jogo abre
// direto no menu (nenhuma ação possível antes de clicar/apertar uma tecla),
// então um listener global (uma vez só) já cobre qualquer entrada — sem
// precisar de um botão dedicado "ativar som".
document.addEventListener('pointerdown', () => audioManager.unlock(), { once: true });
document.addEventListener('keydown', () => audioManager.unlock(), { once: true });

const canvas = document.getElementById('game');
const gameWrap = document.getElementById('gameWrap');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const W = 800, H = 300, GROUND_Y = H - 40;

const hud = document.getElementById('hud');
const levelLabel = document.getElementById('levelLabel');
const distDisplay = document.getElementById('distDisplay');
const progressBarInner = document.getElementById('progressBarInner');
const levelSelectOverlay = document.getElementById('levelSelect');
const pathSvg = document.getElementById('pathSvg');
const pathSvgWrap = document.getElementById('pathSvgWrap');
const endOverlay = document.getElementById('endOverlay');
const endTitle = document.getElementById('endTitle');
const endStars = document.getElementById('endStars');
const endText = document.getElementById('endText');
const retryBtn = document.getElementById('retryBtn');
const mapBtn = document.getElementById('mapBtn');
const pagePrevBtn = document.getElementById('pagePrev');
const pageNextBtn = document.getElementById('pageNext');
const playBtn = document.getElementById('playBtn');
const sfxBtn = document.getElementById('sfxBtn');
const musicBtn = document.getElementById('musicBtn');
const hammerHud = document.getElementById('hammerHud');
hammerHud.innerHTML = `<img src="${assets.martelo}" class="hammer-hud-icon" alt="">`;
const hammerPickupOverlay = document.getElementById('hammerPickupOverlay');
const hammerPickupOkBtn = document.getElementById('hammerPickupOkBtn');
const bossHud = document.getElementById('bossHud');
const bossHpPips = document.getElementById('bossHpPips');
for (let i = 0; i < BOSS_MAX_HP; i++) {
  const pip = document.createElement('div');
  pip.className = 'pip';
  bossHpPips.appendChild(pip);
}
function updateBossHud() {
  if (!bossHpPips) return;
  const hp = boss ? boss.hp : BOSS_MAX_HP;
  bossHpPips.querySelectorAll('.pip').forEach((pip, i) => pip.classList.toggle('lost', i >= hp));
}

levelSelectOverlay.style.backgroundImage = `url(${assets.fundo_menu})`;

const LEVELS = [
  { id: 1, goal: 550, baseSpeed: 6, maxSpeed: 12, unlocked: true, completed: false, stars: 0 },
  { id: 2, goal: 1200, baseSpeed: 6, maxSpeed: 10, unlocked: false, completed: false, stars: 0, hasPlatforms: true },
  // hasHammerPickup: perto do fim da fase, o martelo aparece flutuando do
  // lado da bandeira — coletar (obrigatório, não dá pra terminar a fase sem
  // passar por ele) destrava a habilidade PRA SEMPRE (ver hammerUnlocked,
  // persistido em localStorage), não só nesta fase. Ver spawnHammerPickup.
  { id: 3, goal: 2000, baseSpeed: 8, maxSpeed: 16, unlocked: false, completed: false, stars: 0, hasSpikeFields: true, hasHammerPickup: true },
  { id: 4, goal: 2800, baseSpeed: 9, maxSpeed: 18, unlocked: false, completed: false, stars: 0, hasFlyers: true },
  { id: 5, goal: 3400, baseSpeed: 10, maxSpeed: 20, unlocked: false, completed: false, stars: 0, hasFlyers: true },
  // Fase Final (chefão): sem spawner de obstáculos comuns — o cenário rola
  // pra dar ambientação, mas a única ameaça é o Dragão das Nuvens
  // (CloudDragonBoss, ver boss.js). "goal" não é usado como meta de
  // distância aqui; a fase termina quando o chefe é derrotado.
  { id: 6, goal: 9999, baseSpeed: 7, maxSpeed: 7, unlocked: false, completed: false, stars: 0, isBoss: true },
];
const PROGRESS_STORAGE_KEY = 'potato-run-progress';
const PROGRESS_VERSION = 1;

// Item coletável (martelo, ver Fase 3 / hasHammerPickup): uma vez pego,
// destrava a habilidade PRA SEMPRE — não é mais uma propriedade estática de
// nível como antes (LEVELS[n].hasHammer), é progresso persistido igual
// desbloqueio/conclusão de fase.
let hammerUnlocked = false;

// Salva somente metadados permanentes; o estado da partida nunca vai para o armazenamento.
function saveProgress() {
  try {
    const progress = {
      version: PROGRESS_VERSION,
      hammerUnlocked,
      levels: LEVELS.map(level => ({
        id: level.id,
        unlocked: level.unlocked === true,
        completed: level.completed === true,
        stars: Number.isInteger(level.stars) ? Math.max(0, Math.min(3, level.stars)) : 0
      }))
    };
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.warn('Nao foi possivel salvar o progresso.', error);
  }
}
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) || 'null');
    if (saved && saved.version === PROGRESS_VERSION && Array.isArray(saved.levels)) {
      saved.levels.forEach(savedLevel => {
        const level = LEVELS.find(item => item.id === savedLevel.id);
        if (level) {
          level.unlocked = savedLevel.unlocked === true;
          level.completed = savedLevel.completed === true;
          level.stars = Number.isInteger(savedLevel.stars) ? Math.max(0, Math.min(3, savedLevel.stars)) : 0;
        }
      });
      hammerUnlocked = saved.hammerUnlocked === true;
    }
    LEVELS[0].unlocked = true;
  } catch (error) {
    console.warn('Nao foi possivel carregar o progresso.', error);
  }
}

// Volume por canal (SFX e música), independentes — 4 níveis (0 = mudo, 3 =
// máximo). Fora de uma corrida (menu, tela de fim de fase), clicar CICLA os
// níveis — dá pra subir e descer o volume com o mesmo botão. Durante o jogo
// (state === 'playing'), clicar só alterna mudo/não-mudo, guardando o nível
// anterior pra restaurar — sem ciclo no meio da corrida.
const VOLUME_STEPS = [0, 1 / 3, 2 / 3, 1];
const VOLUME_ICONS = {
  sfx: ['🔇', '🔈', '🔉', '🔊'],
  music: ['🔇', '🎵', '🎵', '🎵'],
};
const SFX_VOL_STORAGE_KEY = 'potato-run-sfx-vol';
const MUSIC_VOL_STORAGE_KEY = 'potato-run-music-vol';

function loadVolIndex(storageKey) {
  try {
    const v = parseInt(localStorage.getItem(storageKey), 10);
    return Number.isInteger(v) && v >= 0 && v < VOLUME_STEPS.length ? v : VOLUME_STEPS.length - 1;
  } catch (error) {
    return VOLUME_STEPS.length - 1;
  }
}
function saveVolIndex(storageKey, index) {
  try {
    localStorage.setItem(storageKey, String(index));
  } catch (error) {
    console.warn('Nao foi possivel salvar a preferencia de volume.', error);
  }
}
function setupVolumeButton(channel, btn, storageKey, setVolume) {
  let index = loadVolIndex(storageKey);
  let lastNonZero = index || VOLUME_STEPS.length - 1;

  function apply() {
    setVolume(VOLUME_STEPS[index]);
    btn.textContent = VOLUME_ICONS[channel][index];
    btn.classList.toggle('muted', index === 0);
    btn.classList.remove('vol-0', 'vol-1', 'vol-2', 'vol-3');
    btn.classList.add('vol-' + index);
  }
  apply();

  btn.addEventListener('click', () => {
    if (state === 'playing') {
      // em plena corrida: só liga/desliga, não cicla o nível
      if (index > 0) { lastNonZero = index; index = 0; }
      else { index = lastNonZero; }
    } else {
      // fora da corrida (menu, fim de fase): cicla os níveis de volume
      index = (index + 1) % VOLUME_STEPS.length;
      if (index > 0) lastNonZero = index;
    }
    apply();
    saveVolIndex(storageKey, index);
  });
}
setupVolumeButton('sfx', sfxBtn, SFX_VOL_STORAGE_KEY, v => audioManager.setSfxVolume(v));
setupVolumeButton('music', musicBtn, MUSIC_VOL_STORAGE_KEY, v => audioManager.setMusicVolume(v));

// ---- Mod menu (easter egg) ----
// 15 cliques no sprite decorativo do menu (dentro de uma janela de tempo,
// senão o contador zera) abrem uma caixa de senha; acertando "admin-cadu"
// destrava o painel de cheats. O desbloqueio (não os cheats em si, que
// resetam a cada sessão) fica salvo, então da próxima vez os cliques já
// abrem o painel direto, sem pedir a senha de novo.
const MOD_UNLOCK_STORAGE_KEY = 'potato-run-mod-unlocked';
const MOD_PASSWORD = 'admin-cadu';
const MOD_CLICKS_REQUIRED = 15;
const MOD_CLICK_WINDOW_MS = 2500;

function loadModUnlocked() {
  try { return localStorage.getItem(MOD_UNLOCK_STORAGE_KEY) === '1'; } catch (error) { return false; }
}
function saveModUnlocked() {
  try { localStorage.setItem(MOD_UNLOCK_STORAGE_KEY, '1'); } catch (error) { /* ignora */ }
}
let modUnlocked = loadModUnlocked();
// Estado dos cheats em si — de propósito não persiste: cada sessão começa "limpa".
const modState = { godMode: false, hammerUnlock: false, infiniteHammer: false, speedMult: 1 };

const modPasswordOverlay = document.getElementById('modPasswordOverlay');
const modPasswordInput = document.getElementById('modPasswordInput');
const modPasswordSubmit = document.getElementById('modPasswordSubmit');
const modPasswordCancel = document.getElementById('modPasswordCancel');
const modPasswordError = document.getElementById('modPasswordError');
const modMenuOverlay = document.getElementById('modMenuOverlay');
const menuVignetteEl = document.getElementById('menuVignette');
menuVignetteEl.style.pointerEvents = 'auto'; // decorativo por padrão (CSS: pointer-events none) — reativa só aqui

let modClickCount = 0;
let modClickTimer = null;
menuVignetteEl.addEventListener('click', () => {
  if (state !== 'menu') return;
  modClickCount++;
  clearTimeout(modClickTimer);
  modClickTimer = setTimeout(() => { modClickCount = 0; }, MOD_CLICK_WINDOW_MS);
  if (modClickCount >= MOD_CLICKS_REQUIRED) {
    modClickCount = 0;
    clearTimeout(modClickTimer);
    if (modUnlocked) openModMenu(); else openModPasswordPrompt();
  }
});

function openModPasswordPrompt() {
  modPasswordInput.value = '';
  modPasswordError.textContent = '';
  modPasswordOverlay.classList.remove('hidden');
  modPasswordInput.focus();
}
function closeModPasswordPrompt() {
  modPasswordOverlay.classList.add('hidden');
}
function submitModPassword() {
  if (modPasswordInput.value === MOD_PASSWORD) {
    modUnlocked = true;
    saveModUnlocked();
    closeModPasswordPrompt();
    openModMenu();
  } else {
    modPasswordError.textContent = 'Senha incorreta.';
    modPasswordInput.value = '';
    modPasswordInput.focus();
  }
}
modPasswordSubmit.addEventListener('click', submitModPassword);
modPasswordCancel.addEventListener('click', closeModPasswordPrompt);
modPasswordInput.addEventListener('keydown', e => {
  // impede que Enter/Espaço vazem pro listener global de teclado (ex.: pular)
  e.stopPropagation();
  if (e.code === 'Enter') submitModPassword();
  else if (e.code === 'Escape') closeModPasswordPrompt();
});

function openModMenu() {
  document.getElementById('modGodMode').checked = modState.godMode;
  document.getElementById('modHammerUnlock').checked = modState.hammerUnlock;
  document.getElementById('modInfiniteHammer').checked = modState.infiniteHammer;
  document.getElementById('modSpeedMult').value = String(modState.speedMult);
  document.getElementById('modSpeedMultVal').textContent = modState.speedMult.toFixed(1) + 'x';
  modMenuOverlay.classList.remove('hidden');
}
document.getElementById('modMenuClose').addEventListener('click', () => modMenuOverlay.classList.add('hidden'));
document.getElementById('modGodMode').addEventListener('change', e => { modState.godMode = e.target.checked; });
document.getElementById('modHammerUnlock').addEventListener('change', e => { modState.hammerUnlock = e.target.checked; });
document.getElementById('modInfiniteHammer').addEventListener('change', e => { modState.infiniteHammer = e.target.checked; });
document.getElementById('modSpeedMult').addEventListener('input', e => {
  modState.speedMult = parseFloat(e.target.value);
  document.getElementById('modSpeedMultVal').textContent = modState.speedMult.toFixed(1) + 'x';
});
document.getElementById('modUnlockAll').addEventListener('click', () => {
  LEVELS.forEach(l => { l.unlocked = true; });
  saveProgress();
  if (state === 'menu') renderLevelSelect();
});

let currentLevel = null;
let boss = null; // instância de CloudDragonBoss — só existe durante a Fase Final (currentLevel.isBoss)
let bossDefeatEnding = false; // true durante a desaceleração final, entre o 6º acerto e a tela de vitória
let hammerPickupState = null; // { collected } — só existe na Fase 3 antes do martelo ser destravado (ver startLevel/spawnHammerPickup)
let state = 'menu', distance = 0, speed = 6;
// Velocidade real de rolagem do mundo neste quadro (obstáculos, chão,
// parallax, distância) — deriva de `speed` (o ritmo "oficial" da fase, que
// sobe com a distância) modulada pela posição horizontal do jogador. Ver
// cálculo em loop().
let scrollSpeed = 6;
let obstacles = [], nextSpawnIn = 260;
// Terreno especial da fase 2: buracos (sem apoio) e plataformas flutuantes
// (apoio elevado). Blocos-placeholder simples; recebem sprite depois.
let terrain = [];
// Bandeira de chegada: surge da direita perto da meta e o jogador precisa alcançá-la
let flagX = null;
const FLAG_H = 96;                       // altura de exibição da bandeira
const FLAG_LEAD = 90;                    // metros antes da meta em que a bandeira aparece
let groundOffset = 0, skyOffset = 0, farOffset = 0;

// ---- Personagem: caixa de exibição FIXA (todos os quadros usam o mesmo tamanho) ----
const CHAR_BOX_W = 121, CHAR_BOX_H = 128;
const CHAR_DISP_H = 62;                                   // altura fixa na tela
const CHAR_DISP_W = Math.round(CHAR_DISP_H * CHAR_BOX_W / CHAR_BOX_H);
// Hitbox = área útil dentro da caixa (a arte tem folga nas laterais)
const HIT_INSET_X = Math.round(CHAR_DISP_W * 0.26);
const HIT_INSET_TOP = Math.round(CHAR_DISP_H * 0.10);
const HIT_INSET_BOT = Math.round(CHAR_DISP_H * 0.04);

const ANIM = {
  correr: { frames: ['correr_0', 'correr_1', 'correr_2', 'correr_3', 'correr_4'], fps: 20, loop: true },
  pular: { frames: ['pular_0', 'pular_1', 'pular_2'], fps: 12, loop: false },
  cair: { frames: ['cair_0', 'cair_1', 'cair_2', 'cair_3'], fps: 10, loop: false },
  aterrissar: { frames: ['aterrissar_3', 'aterrissar_2', 'aterrissar_1', 'aterrissar_0'], fps: 16, loop: false },
};
let animState = 'correr', animFrame = 0, animTimer = 0, landTimer = 0;

function setAnim(n) { if (animState === n) return; animState = n; animFrame = 0; animTimer = 0; }
function updateAnim(dt) {
  const a = ANIM[animState]; animTimer += dt; const fd = 1 / a.fps;
  while (animTimer >= fd) {
    animTimer -= fd;
    if (animFrame < a.frames.length - 1) animFrame++;
    else if (a.loop) animFrame = 0;
  }
}
function getAnimImg() {
  const a = ANIM[animState];
  return IMG[a.frames[Math.min(animFrame, a.frames.length - 1)]];
}

// ---- Movimentação horizontal (inércia/fricção) ----
const PLAYER_X_MIN = 40, PLAYER_X_MAX = 350, PLAYER_X_START = 60;
const MOVE_ACCEL = 0.6;        // aceleração horizontal no chão (px/quadro²)
const MOVE_ACCEL_AIR = 0.32;   // air-control: mais fraco que no chão, ajuste fino da aterrissagem
const MOVE_MAX_VX = 5.2;       // velocidade horizontal máxima
const MOVE_FRICTION = 0.82;    // decaimento multiplicativo quando nenhuma tecla está pressionada

// ---- Pulo variável (tap = baixo, hold = alto) ----
const JUMP_CUT_FACTOR = 0.45;  // ao soltar cedo, corta o impulso vertical restante

// ---- Scroll dinâmico do mundo, modulado pela posição do jogador na tela ----
// Avançar (perto de PLAYER_X_MAX) acelera levemente a progressão da fase;
// recuar (perto de PLAYER_X_MIN) desacelera o cenário, dando margem
// estratégica pra reagir — mas nunca abaixo do piso, então a fase nunca trava.
// Efeito propositalmente pequeno: recuar não pode virar uma forma fácil de
// "baixar a dificuldade" segurando a tecla pra trás o jogo inteiro.
const SCROLL_EDGE_BIAS = 0.08;
const SCROLL_MIN_FACTOR = 0.85;

// Teclas de movimento horizontal atualmente pressionadas
const heldKeys = new Set();

const player = {
  x: PLAYER_X_START, y: 0,
  w: CHAR_DISP_W, h: CHAR_DISP_H,
  standH: CHAR_DISP_H, crouchH: Math.round(CHAR_DISP_H * 0.6),
  vx: 0, facing: 1,
  vy: 0, gravity: 0.72, jumpForce: -13.5,
  grounded: true, isCrouching: false, jumpCut: false,
  onPlatform: null,     // bloco de plataforma em que o jogador está apoiado (ou null = chão normal)
  dying: false, dyingElapsed: 0, // caiu num abismo: continua caindo visualmente antes do game over
  // colidiu com um obstáculo: sai girando e encolhendo, arremessado longe
  launched: false, launchVX: 0, launchVY: 0, launchRotation: 0, launchScale: 1, launchElapsed: 0,
  // ataque de martelo (fase 5+): hammerAttackT null = sem golpe ativo; um
  // número = tempo decorrido desde que o golpe começou. hammerCooldown =
  // segundos restantes até poder atacar de novo.
  hammerAttackT: null, hammerCooldown: 0,
};
// Tempo de queda visível dentro do abismo antes do game over aparecer, e uma
// margem de segurança (bem abaixo da tela) caso o cronômetro nunca dispare.
const FALL_DEATH_DELAY = 0.55;
// Duração da animação de "arremesso" ao bater num obstáculo, velocidade do
// giro (em voltas completas ao longo da animação) e o impulso inicial.
const LAUNCH_DEATH_DELAY = 0.85;
const LAUNCH_SPINS = 3;
const LAUNCH_VY_INITIAL = -9;
const LAUNCH_VX_INITIAL = -3.2;

function resetPlayer() {
  player.h = player.standH; player.w = CHAR_DISP_W;
  player.x = PLAYER_X_START; player.vx = 0; player.facing = 1;
  player.y = GROUND_Y - player.h;
  player.vy = 0; player.grounded = true; player.isCrouching = false; player.jumpCut = false;
  player.onPlatform = null;
  player.dying = false; player.dyingElapsed = 0;
  player.launched = false; player.launchVX = 0; player.launchVY = 0;
  player.launchRotation = 0; player.launchScale = 1; player.launchElapsed = 0;
  player.hammerAttackT = null; player.hammerCooldown = 0;
  landTimer = 0; setAnim('correr'); animFrame = 0;
}
function jump() {
  if (state !== 'playing') return;
  if (player.grounded && !player.isCrouching) {
    player.vy = player.jumpForce; player.grounded = false; player.jumpCut = false; setAnim('pular');
    audioManager.play('player_pulo');
  }
}
// Corta o impulso do pulo se o botão for solto durante a subida — solto logo
// no início = arco curto (pulo baixo); segurado até perto do ápice = pulo
// praticamente inalterado (pulo longo/alto). O resto da máquina de estados
// (pular -> cair -> aterrissar) já reflete a diferença de duração sozinho.
function releaseJump() {
  if (!player.grounded && !player.jumpCut && player.vy < 0) {
    player.vy *= JUMP_CUT_FACTOR;
    player.jumpCut = true;
  }
}
// Movimentação horizontal com aceleração/atrito (inércia) e air-control
// reduzido; limita a posição aos limites da tela definidos para o jogador.
function updateHorizontal(dt) {
  const frameScale = dt * 60;
  const accel = player.grounded ? MOVE_ACCEL : MOVE_ACCEL_AIR;
  const right = heldKeys.has('right'), left = heldKeys.has('left');
  if (right && !left) {
    player.vx = Math.min(MOVE_MAX_VX, player.vx + accel * frameScale);
  } else if (left && !right) {
    player.vx = Math.max(-MOVE_MAX_VX, player.vx - accel * frameScale);
  } else {
    player.vx *= Math.pow(MOVE_FRICTION, frameScale);
    if (Math.abs(player.vx) < 0.03) player.vx = 0;
  }
  // Olha pra trás só enquanto a tecla de recuar está pressionada; solta =
  // volta a olhar pra frente na hora, mesmo se ainda houver inércia residual
  // freando (por atrito) na direção contrária.
  player.facing = left ? -1 : 1;
  player.x += player.vx * frameScale;
  if (player.x < PLAYER_X_MIN) { player.x = PLAYER_X_MIN; player.vx = 0; }
  else if (player.x > PLAYER_X_MAX) { player.x = PLAYER_X_MAX; player.vx = 0; }
}
function setCrouch(v) {
  if (state !== 'playing' || !player.grounded) return;
  if (player.isCrouching === v) return;
  audioManager.play(v ? 'player_agachar' : 'player_levantar');
  player.isCrouching = v;
  const bottom = player.y + player.h;
  player.h = v ? player.crouchH : player.standH;
  player.w = Math.round(player.h * CHAR_BOX_W / CHAR_BOX_H);
  player.y = bottom - player.h;
}
// Colidiu com um obstáculo: em vez de congelar na hora, sai arremessado —
// pequeno impulso pra cima/pra trás, giro contínuo e encolhe até sumir.
function startLaunchDeath() {
  audioManager.play('player_morte_impacto');
  player.launched = true;
  player.launchVX = LAUNCH_VX_INITIAL;
  player.launchVY = LAUNCH_VY_INITIAL;
  player.launchRotation = 0;
  player.launchScale = 1;
  player.launchElapsed = 0;
}
function updatePlayer(dt) {
  const frameScale = dt * 60;

  if (player.launched) {
    player.launchVY += player.gravity * frameScale;
    player.y += player.launchVY * frameScale;
    player.x += player.launchVX * frameScale;
    player.launchRotation += (LAUNCH_SPINS * Math.PI * 2 / LAUNCH_DEATH_DELAY) * dt;
    player.launchElapsed += dt;
    const p = Math.min(1, player.launchElapsed / LAUNCH_DEATH_DELAY);
    player.launchScale = 1 - p; // encolhe até sumir
    if (player.launchElapsed >= LAUNCH_DEATH_DELAY) {
      endGame(false);
    }
    return;
  }

  if (player.dying) {
    // caiu num abismo: a queda continua de verdade (sem travar em GROUND_Y)
    // por um instante antes do game over, em vez de terminar a partida na
    // hora exata em que tocaria o chão. Reaproveita a mesma updateHorizontal
    // da queda normal (mesma física de ar/inércia), não uma versão à parte.
    player.vy += player.gravity * frameScale;
    player.y += player.vy * frameScale;
    updateHorizontal(dt);
    updateAnim(dt);
    player.dyingElapsed += dt;
    if (player.dyingElapsed >= FALL_DEATH_DELAY || player.y > H + 40) {
      endGame(false);
    }
    return;
  }

  updateHorizontal(dt);
  const hazard = getActiveHazardAt(player.x, player.x + player.w);

  if (player.grounded) {
    // ainda apoiado no mesmo lugar (plataforma em que pousou, ou chão normal)?
    // Checa também o tipo (não só a referência) porque uma ponte quebrada
    // muda de 'plataforma' pra 'buraco' embaixo do jogador quando rompe.
    const stillOnPlatform = player.onPlatform && hazard === player.onPlatform && hazard.type === 'plataforma';
    const stillOnGround = !player.onPlatform && !(hazard && hazard.type === 'buraco');
    if (!stillOnPlatform && !stillOnGround) {
      // saiu da plataforma (ela terminou) ou surgiu um buraco embaixo: começa a cair
      player.grounded = false;
      player.onPlatform = null;
      setAnim('cair');
    }
  }

  if (!player.grounded) {
    player.vy += player.gravity * frameScale; player.y += player.vy * frameScale;
    if (player.vy < 0) { if (animState !== 'pular') setAnim('pular'); }
    else { if (animState !== 'cair') setAnim('cair'); }

    if (player.vy >= 0 && hazard && hazard.type === 'plataforma' && player.y + player.h >= hazard.topY) {
      // pousou em cima do bloco da plataforma
      player.y = hazard.topY - player.h; player.vy = 0; player.grounded = true;
      player.onPlatform = hazard;
      setAnim('aterrissar'); landTimer = 0.22; audioManager.play('player_aterrissar');
    } else if (player.y >= GROUND_Y - player.h) {
      if (hazard && hazard.type === 'buraco' && !modState.godMode) {
        // não pulou a tempo: começa a cair de verdade dentro do abismo — o
        // game over só chega depois da queda visível (ver player.dying acima)
        player.dying = true;
        player.dyingElapsed = 0;
        setAnim('cair');
        return;
      }
      player.y = GROUND_Y - player.h; player.vy = 0; player.grounded = true;
      player.onPlatform = null;
      setAnim('aterrissar'); landTimer = 0.22; audioManager.play('player_aterrissar');
    }
  } else if (landTimer > 0) {
    landTimer -= dt;
    if (landTimer <= 0) setAnim('correr');
  }
  updateAnim(dt);
}
function getPlayerHitbox() {
  const scale = player.h / player.standH;
  return {
    x: player.x + HIT_INSET_X * scale,
    y: player.y + HIT_INSET_TOP * scale,
    w: player.w - 2 * HIT_INSET_X * scale,
    h: player.h - (HIT_INSET_TOP + HIT_INSET_BOT) * scale,
  };
}
function drawPlayer() {
  const img = getAnimImg();
  const dx = Math.round(player.x), dy = Math.round(player.y);
  if (player.launched) {
    // arremessado: gira em torno do próprio centro e encolhe até sumir
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
      ctx.rotate(player.launchRotation);
      ctx.scale(player.launchScale, player.launchScale);
      ctx.drawImage(img, -player.w / 2, -player.h / 2, player.w, player.h);
      ctx.restore();
    }
    return;
  }
  if (img && img.complete && img.naturalWidth > 0) {
    if (player.facing < 0) {
      // sem sprite dedicado pra correr de costas: espelha o quadro atual
      ctx.save();
      ctx.translate(dx + player.w, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, player.w, player.h);
      ctx.restore();
    } else {
      ctx.drawImage(img, dx, dy, player.w, player.h);
    }
  } else {
    ctx.fillStyle = '#8b5a2b'; ctx.fillRect(dx, dy, player.w, player.h);
  }
}

const OBS_DEFS = {
  pedraGrande: { key: 'pedra_grande', dispH: 42, aspect: 407 / 246, ground: true },
  pedraPequena: { key: 'pedra_pequena', dispH: 30, aspect: 407 / 246, ground: true },
  cogumelo: { key: 'cogumelo', dispH: 34, aspect: 54 / 59, ground: true },
  espinho: { key: 'espinho', dispH: 30, aspect: 65 / 47, ground: true },
  galho: { key: 'galho', dispH: 30, aspect: 65 / 47, ground: true },
  galho2: { key: 'galho_2', dispH: 30, aspect: 65 / 47, ground: true },
};
const GROUND_TYPES = ['pedraGrande', 'pedraPequena', 'cogumelo', 'espinho', 'galho', 'galho2'];

function spawnObstacle() {
  const type = GROUND_TYPES[Math.floor(Math.random() * GROUND_TYPES.length)];
  const d = OBS_DEFS[type], h = d.dispH, w = h * d.aspect;
  const y = d.ground ? GROUND_Y - h : [GROUND_Y - 30, GROUND_Y - 62, GROUND_Y - 96][Math.floor(Math.random() * 3)];
  obstacles.push({ x: W + 20, y, w, h, type, imgKey: d.key, flap: Math.random() * 10 });
  return w;
}

// ---- Sapo Saltador: inimigo com pulo "enganoso" ----
// Ele fica a maior parte do tempo parado no chão e, num ciclo regular, dá um
// pulo vertical alto (sempre mais alto que o pulo do próprio jogador). A
// hitbox acompanha a posição atual do sapo o tempo todo — no chão ou no ar —
// então um encontro direto machuca em qualquer momento do ciclo; o "blefe" é
// só o jogador achar que consegue prever/evitar o pulo, não uma imunidade.
// Tamanho base 25% maior que o desenho original do sprite
const SAPO_DISP_W = Math.round(32 * 1.25), SAPO_DISP_H = Math.round(36 * 1.25);
const SAPO_CYCLE = 1.5;       // duração total do ciclo (chão + pulo), em segundos
const SAPO_GROUND_T = 0.85;   // quanto tempo do ciclo ele passa parado no chão
const SAPO_AIR_T = SAPO_CYCLE - SAPO_GROUND_T;
// Altura máxima que o jogador alcança no próprio pulo (v²/2g), calculada a
// partir da física real do personagem — o pulo do sapo tem que superar isso
// sempre, senão o "blefe" perderia a graça.
const PLAYER_JUMP_APEX = (player.jumpForce * player.jumpForce) / (2 * player.gravity);
const SAPO_HOP_MIN = PLAYER_JUMP_APEX * 1.1;  // sempre um pouco acima do pulo do jogador
const SAPO_HOP_MAX = PLAYER_JUMP_APEX * 1.5;  // variação aleatória de altura

// Dado o tempo decorrido dentro do ciclo e a altura do pulo dessa instância,
// devolve o quadro de animação, se está com apoio no chão (hitbox ativa) e o
// deslocamento vertical do pulo.
function sapoPoseAt(t, hopH) {
  if (t < SAPO_GROUND_T) return { frame: 'sapo_chao', grounded: true, yOffset: 0 };
  const p = Math.min(1, (t - SAPO_GROUND_T) / SAPO_AIR_T);
  const yOffset = hopH * Math.sin(p * Math.PI); // sobe e desce suave, 0 nas pontas
  const frame = p < 0.2 ? 'sapo_pulando' : p < 0.6 ? 'sapo_topo' : 'sapo_queda';
  return { frame, grounded: false, yOffset };
}

function spawnSapo() {
  obstacles.push({
    x: W + 20,
    y: GROUND_Y - SAPO_DISP_H,
    w: SAPO_DISP_W,
    h: SAPO_DISP_H,
    type: 'sapo',
    imgKey: 'sapo_chao',
    isSapo: true,
    sapoT: Math.random() * SAPO_CYCLE, // fase inicial aleatória, pra não sincronizar vários sapos
    sapoHopH: SAPO_HOP_MIN + Math.random() * (SAPO_HOP_MAX - SAPO_HOP_MIN), // altura do pulo, sorteada por sapo
    collidable: true,
  });
  return SAPO_DISP_W;
}

// ---- Fantasma voador (fase 4): inimigo aéreo com TRÊS faixas de altura ----
// Entra voando da direita pra esquerda, na direção do jogador (mesmo sistema
// de scroll dos outros obstáculos — nasce em W+20 e anda com scrollSpeed).
// "baixo" cruza a faixa em que o jogador fica mesmo agachado (crouchH=37) —
// só um pulo desvia. "médio" fica acima da faixa agachada mas dentro da
// faixa em pé (standH=62) — agachar OU pular desviam. "alto" fica acima da
// cabeça do jogador em pé, mas dentro do alcance de até o menor pulo — quem
// pular é atingido; a única saída é passar por baixo correndo (ou agachado).
// As três alturas têm visual parecido, então o jogador precisa reagir à
// altura real de cada uma, não decorar um padrão — decisão rápida de
// verdade. Sprite: ciclo de 4 quadros (fantasma-1..4) fazendo o fantasma
// flutuar/pulsar.
const FLYER_DISP_W = Math.round(30 * 1.15), FLYER_H = Math.round(28 * 1.15); // +15% de tamanho
const FLYER_LOW_Y = GROUND_Y - 19;   // exige pulo (cruza até agachado)
const FLYER_MID_Y = GROUND_Y - 55;   // agachar OU pular desviam
const FLYER_HIGH_Y = GROUND_Y - 80;  // NÃO pular — passa por baixo correndo/agachado
const FLYER_LANE_Y = { baixo: FLYER_LOW_Y, medio: FLYER_MID_Y, alto: FLYER_HIGH_Y };
const FLYER_LANES = ['baixo', 'medio', 'alto'];
const FLYER_BOB_AMPLITUDE = 5;       // leve oscilação senoidal vertical (voo)
const FLYER_BOB_SPEED = 4;           // rad/s da oscilação
const FLYER_FLAP_FPS = 8;            // quadros/seg do ciclo de flutuação
// Velocidade própria do voo, somada ao scrollSpeed do cenário — sem isso ele
// andava exatamente junto com o chão/paisagem, parecendo "colado" no mundo
// em vez de voando ativamente em direção ao jogador.
const FLYER_EXTRA_SPEED = 3.5;
// Distância (em px de tela) a partir da qual o aviso sonoro de aproximação
// dispara — bem antes do fantasma chegar perto do jogador, já que ele soma
// scrollSpeed + FLYER_EXTRA_SPEED e fecha essa distância rápido.
const FLYER_WARN_DISTANCE = 220;

function spawnFlyerAt(startX) {
  const lane = FLYER_LANES[Math.floor(Math.random() * FLYER_LANES.length)];
  const baseY = FLYER_LANE_Y[lane];
  obstacles.push({
    x: startX,
    y: baseY - FLYER_H / 2,
    w: FLYER_DISP_W, h: FLYER_H,
    type: 'fantasma',
    isFlyer: true,
    lane,
    baseY,
    flapT: Math.random() * 4, // fase inicial aleatória, pra não sincronizar vários
    collidable: true,
  });
  return FLYER_DISP_W;
}
function spawnFlyer() {
  return spawnFlyerAt(W + 20);
}
// Combo "obstáculo terrestre + voador logo em seguida": obriga o jogador a
// já estar pensando no próximo desvio assim que pousa do primeiro pulo. A
// folga entre os dois (~0,35-0,5s reais) é maior que o tempo no ar de um
// pulo curto (~0,28s), então sempre sobra uma janela de reação — nunca é um
// "pulo às cegas", o voador já está visível na tela antes do jogador
// terminar de lidar com o obstáculo terrestre.
function spawnGroundThenFlyer() {
  const w1 = spawnObstacle();
  const gapSeconds = 0.35 + Math.random() * 0.15;
  // usa a velocidade real de fechamento do voador (scroll + extra própria),
  // senão a folga em segundos ficaria menor na prática do que o calculado
  const gapPx = gapSeconds * (scrollSpeed + FLYER_EXTRA_SPEED) * 60;
  spawnFlyerAt(W + 20 + w1 + gapPx);
  return w1 + gapPx + FLYER_DISP_W;
}

// Variação "ondulante": em vez de ficar fixo numa faixa (só com um leve
// flutuar), esse fantasma sobe e desce o tempo todo numa curva senoidal de
// verdade — amplitude grande o bastante pra cruzar da faixa baixa até a alta
// e voltar (amplitude A abaixo/acima do centro, período T = 2π/WAVE_SPEED,
// igual ao gráfico seno clássico). O jogador precisa ler em que ponto da
// onda ele está bem na hora que cruza a posição do jogador, não só decidir
// uma vez qual é a "faixa" dele.
const WAVE_CENTER_Y = FLYER_MID_Y;
const WAVE_AMPLITUDE = 36;  // pico a pico ~72px: cobre de perto do baixo até perto do alto
const WAVE_SPEED = 10;      // rad/s — período ≈0,63s, ~1-1.5 ciclos completos ao atravessar a tela

function spawnFlyerWaveAt(startX) {
  obstacles.push({
    x: startX,
    y: WAVE_CENTER_Y - FLYER_H / 2,
    w: FLYER_DISP_W, h: FLYER_H,
    type: 'fantasma',
    isFlyer: true,
    isWave: true,
    waveT: Math.random() * Math.PI * 2, // fase inicial aleatória, pra não sincronizar vários
    flapT: Math.random() * 4,
    collidable: true,
  });
  return FLYER_DISP_W;
}
function spawnFlyerWave() {
  return spawnFlyerWaveAt(W + 20);
}
function drawFlyer(o) {
  const frame = Math.floor(o.flapT * FLYER_FLAP_FPS) % 4;
  const img = IMG['fantasma_' + (frame + 1)];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(img, Math.round(o.x), Math.round(o.y), Math.ceil(o.w), Math.ceil(o.h));
  } else {
    ctx.fillStyle = '#e8a6c9'; ctx.fillRect(o.x, o.y, o.w, o.h);
  }
}

// ---- Terreno especial (fase 2): buracos no chão ----
// Todo buraco agora é "grande": largo o bastante pra exigir o pulo LONGO
// (segurar o botão até perto do ápice, ~225-375px de alcance na faixa de
// velocidade da fase 2) — um pulo curto (toque rápido, ~90-200px) não
// atravessa, então soltar cedo ou não pular de fato faz o personagem cair.
// Faixa aproximada, ajustável. Não existe mais a variante pequena.
const BIG_PIT_MIN_W = 190, BIG_PIT_MAX_W = 230;

function spawnBigPit() {
  const w = BIG_PIT_MIN_W + Math.random() * (BIG_PIT_MAX_W - BIG_PIT_MIN_W);
  // variedade visual: às vezes cachoeira, às vezes uma ponte já rompida nas
  // pontas — mesma exigência mecânica (pulo longo), só muda a arte do buraco
  const visual = Math.random() < 0.5 ? 'cachoeira' : 'ponte_quebrada';
  terrain.push({ x: W + 20, w, type: 'buraco', visual });
  return w;
}
// Ponte segura: trecho de chão 100% seguro (mesmo apoio da ilha da
// travessia — topo no nível do GROUND_Y), só que sem nenhum risco de queda
// ao redor. É puramente uma variação visual do chão normal, decorativa.
const BRIDGE_MIN_W = 150, BRIDGE_MAX_W = 220;
function spawnSafeBridge() {
  const w = BRIDGE_MIN_W + Math.random() * (BRIDGE_MAX_W - BRIDGE_MIN_W);
  terrain.push({ x: W + 20, w, topY: GROUND_Y, type: 'plataforma' });
  return w;
}

// Ponte quebrada: parece idêntica à ponte segura (mesmo apoio, só com umas
// rachaduras sutis nas tábuas pra quem prestar atenção) — mas depois de um
// instante com o jogador em cima, ela cede: vira um 'buraco' de verdade e o
// jogador cai, revelando o abismo com o mesmo efeito de espelho do céu.
const BROKEN_BRIDGE_MIN_W = 150, BROKEN_BRIDGE_MAX_W = 200;
const BRIDGE_COLLAPSE_DELAY = 0.32; // segundos parado em cima antes de romper
function spawnBrokenBridge() {
  const w = BROKEN_BRIDGE_MIN_W + Math.random() * (BROKEN_BRIDGE_MAX_W - BROKEN_BRIDGE_MIN_W);
  terrain.push({ x: W + 20, w, topY: GROUND_Y, type: 'plataforma', trap: true, standTimer: 0 });
  return w;
}

// Campo de buracos (fase 3+): uma sequência de vãos PEQUENOS intercalados
// com faixas seguras de pouso, dimensionados em SEGUNDOS (não pixels fixos)
// e convertidos pra pixels pela velocidade atual no instante do spawn.
//
// Por quê em segundos: um pulo curto mínimo (toque rápido) tem duração no ar
// de ~0,28s (fixa, definida só por jumpForce/gravidade/corte — não muda com
// a velocidade da fase). Se o vão/faixa fossem uma largura fixa em pixels,
// em velocidades altas eles passariam voando em bem menos tempo que isso, e
// o pulo carregava o personagem direto por cima da faixa segura, aterrissando
// já dentro do próximo buraco (era exatamente o bug reportado: "mesmo
// pisando na base ainda cai"). Em segundos, a proporção real-time não muda:
// - vão: ~0,08-0,12s de travessia — bem menor que o pulo mínimo, sempre
//   trivialmente pulável.
// - faixa segura: ~0,40-0,55s — maior que o pulo mínimo (~0,28s), então
//   sempre sobra uma janela real de reação depois de pousar antes do
//   próximo vão chegar.
// E como a duração TOTAL do campo (em segundos) é sempre bem maior que o
// tempo no ar do pulo longo (~0,625s, também fixo), um pulo só segurado
// nunca cobre o campo inteiro — tem que ritmar vários pulos curtos.
const SPIKE_GAP_TIME_MIN = 0.08, SPIKE_GAP_TIME_MAX = 0.12;
const SPIKE_SAFE_TIME_MIN = 0.40, SPIKE_SAFE_TIME_MAX = 0.55;
const SPIKE_COUNT_MIN = 4, SPIKE_COUNT_MAX = 5;
function spawnSpikeField() {
  const count = SPIKE_COUNT_MIN + Math.floor(Math.random() * (SPIKE_COUNT_MAX - SPIKE_COUNT_MIN + 1));
  const pxPerSecond = scrollSpeed * 60;
  const startX = W + 20;
  let x = startX;
  for (let i = 0; i < count; i++) {
    const gapW = (SPIKE_GAP_TIME_MIN + Math.random() * (SPIKE_GAP_TIME_MAX - SPIKE_GAP_TIME_MIN)) * pxPerSecond;
    // sem sprite (nem cachoeira, nem ponte quebrada) — só o vão com o efeito
    // de espelho revelando o abismo, igual à ponte-armadilha depois que cede
    terrain.push({ x, w: gapW, type: 'buraco', visual: 'espelho' });
    x += gapW;
    if (i < count - 1) {
      const safeW = (SPIKE_SAFE_TIME_MIN + Math.random() * (SPIKE_SAFE_TIME_MAX - SPIKE_SAFE_TIME_MIN)) * pxPerSecond;
      x += safeW;
    }
  }
  return x - startX;
}

function updateTerrain(dt) {
  const frameScale = dt * 60;
  for (let i = terrain.length - 1; i >= 0; i--) {
    const t = terrain[i]; t.x -= scrollSpeed * frameScale;
    if (t.trap && t.type === 'plataforma' && player.onPlatform === t) {
      t.standTimer += dt;
      if (t.standTimer >= BRIDGE_COLLAPSE_DELAY) {
        t.type = 'buraco';
        t.collapsed = true; // pro desenho usar o espelho do fundo, não a cachoeira
      }
    }
    if (t.x + t.w < -10) terrain.splice(i, 1);
  }
}
// Retorna o bloco de terreno (buraco ou plataforma) que atualmente cruza a
// faixa horizontal [px1,px2], ou null se não houver nenhum ali. Quando a
// caixa do jogador é mais larga que o vão ao lado da ilha, buraco e
// plataforma podem se sobrepor à mesma faixa por alguns quadros durante a
// transição — nesse caso a plataforma (apoio sólido) sempre vence, senão o
// pouso na borda da ilha era lido como queda no abismo.
function getActiveHazardAt(px1, px2) {
  let fallback = null;
  for (const t of terrain) {
    if (t.x < px2 && t.x + t.w > px1) {
      if (t.type === 'plataforma') return t;
      if (!fallback) fallback = t;
    }
  }
  return fallback;
}

// Log opcional pra validar os spawns da fase 4 no console sem poluir o jogo
// normal — ative manualmente (DEBUG_LEVEL4 = true) durante o desenvolvimento.
const DEBUG_LEVEL4 = false;

function spawnNextFeature() {
  if (currentLevel.hasPlatforms) {
    const roll = Math.random();
    if (roll < 0.50) return spawnObstacle();
    if (roll < 0.65) return spawnSapo();
    if (roll < 0.85) return spawnBigPit();
    if (roll < 0.93) return spawnSafeBridge();
    return spawnBrokenBridge();
  }
  if (currentLevel.hasSpikeFields) {
    const roll = Math.random();
    if (roll < 0.50) return spawnObstacle();
    if (roll < 0.65) return spawnSapo();
    if (roll < 0.85) return spawnSpikeField();
    return spawnSafeBridge();
  }
  if (currentLevel.hasFlyers) {
    // Fase 4: intercala TUDO que já existe (chão, sapo, buraco grande, campo
    // de espinhos, ponte segura) com o novo voador — incluindo o combo
    // "obstáculo terrestre + voador logo depois", que é quem garante o
    // padrão "pulo seguido de esquiva rápida" pedido no design da fase.
    const roll = Math.random();
    let picked, kind;
    if (roll < 0.22) { picked = spawnObstacle(); kind = 'obstaculo'; }
    else if (roll < 0.37) { picked = spawnSapo(); kind = 'sapo'; }
    else if (roll < 0.51) { picked = spawnFlyer(); kind = 'voador'; }
    else if (roll < 0.61) { picked = spawnFlyerWave(); kind = 'voador_onda'; }
    else if (roll < 0.75) { picked = spawnBigPit(); kind = 'buraco_grande'; }
    else if (roll < 0.87) { picked = spawnSpikeField(); kind = 'campo_buracos'; }
    else if (roll < 0.95) { picked = spawnSafeBridge(); kind = 'ponte_segura'; }
    else { picked = spawnGroundThenFlyer(); kind = 'combo_chao_voador'; }
    if (DEBUG_LEVEL4) console.debug('[fase4 spawn]', kind, 'largura=' + Math.round(picked), 'dist=' + Math.round(distance) + 'm');
    return picked;
  }
  const roll = Math.random();
  if (roll < 0.7) return spawnObstacle();
  if (roll < 0.9) return spawnSapo();
  return spawnSafeBridge();
}

function updateObstacles(dt) {
  const frameScale = dt * 60;
  // nextSpawnIn é medido em pixels de mundo (não em quadros), pra que a folga
  // reservada depois de cada spawn escale com o tamanho real do que nasceu —
  // essencial pra travessias largas (vão+ilha+vão) não ficarem coladas/sobrepostas
  // com o próximo obstáculo, o que corrompia a detecção de colisão.
  nextSpawnIn -= scrollSpeed * frameScale;
  if (nextSpawnIn <= 0) {
    const featureWidth = spawnNextFeature();
    // Folga em SEGUNDOS (convertida pra pixels pela velocidade atual), não em
    // pixels fixos — assim a frequência real não dispara conforme o jogo
    // acelera; o intervalo entre obstáculos fica sempre parecido no relógio.
    const hasComplexTerrain = currentLevel.hasPlatforms || currentLevel.hasSpikeFields || currentLevel.hasFlyers;
    const minGapSeconds = hasComplexTerrain ? 1.3 : 0.9;
    const maxGapSeconds = hasComplexTerrain ? 2.2 : 1.6;
    const pxPerSecond = scrollSpeed * 60;
    const minGap = minGapSeconds * pxPerSecond;
    const maxGap = maxGapSeconds * pxPerSecond;
    nextSpawnIn = featureWidth + minGap + Math.random() * (maxGap - minGap);
  }
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i]; o.x -= scrollSpeed * frameScale;
    if (o.isSapo) {
      o.sapoT = (o.sapoT + dt) % SAPO_CYCLE;
      const pose = sapoPoseAt(o.sapoT, o.sapoHopH);
      o.imgKey = pose.frame;
      o.y = (GROUND_Y - SAPO_DISP_H) - pose.yOffset;
      // hitbox sempre ativa (chão ou ar) — acompanha o sapo durante todo o pulo
    } else if (o.isFlyer) {
      // velocidade própria de voo, além do scroll — dá a sensação de que ele
      // está voando ativamente em direção ao jogador, não só "boiando" junto
      // com o cenário como um obstáculo parado no chão
      o.x -= FLYER_EXTRA_SPEED * frameScale;
      o.flapT += dt;
      if (o.isWave) {
        // curva senoidal de verdade: sobe e desce continuamente entre as
        // faixas, em vez de flutuar em torno de uma altura fixa
        o.waveT += dt;
        o.y = WAVE_CENTER_Y - o.h / 2 + Math.sin(o.waveT * WAVE_SPEED) * WAVE_AMPLITUDE;
      } else {
        o.y = o.baseY - o.h / 2 + Math.sin(o.flapT * FLYER_BOB_SPEED) * FLYER_BOB_AMPLITUDE;
      }
      // aviso sonoro de aproximação: dispara uma única vez por fantasma,
      // quando a borda dele entra na janela de distância até o jogador
      const dist = o.x - (player.x + player.w);
      if (!o.warned && dist < FLYER_WARN_DISTANCE && dist > -50) {
        audioManager.play('fantasma_aproximando');
        o.warned = true;
      }
    }
    if (o.x + o.w < -10) obstacles.splice(i, 1);
  }
  updateTerrain(dt);
}
function drawObstacles() {
  obstacles.forEach(o => {
    if (o.isFlyer) { drawFlyer(o); return; }
    const img = IMG[o.imgKey];
    const dy = o.y;
    if (img && img.complete && img.naturalWidth > 0) ctx.drawImage(img, Math.round(o.x), Math.round(dy), Math.ceil(o.w), Math.ceil(o.h));
    else { ctx.fillStyle = '#7d6386'; ctx.fillRect(o.x, dy, o.w, o.h); }
  });
}
function drawBrokenPlank(t) {
  // ponte segura / ponte-armadilha (ainda intacta): mesmo efeito de espelho
  // usado nas fendas/buracos (paintSceneryStrip) abrindo a "janela" pro
  // abismo por baixo, em vez da grama normal que era pintada ali por
  // drawGroundTile() — a ponte passa a parecer que cruza um vão de verdade,
  // não um trecho decorativo sobre o chão sólido.
  paintSceneryStrip(t.x, t.w);

  const img = IMG.ponte_segura;
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const OVERHANG = 14;
  const dw = t.w * 1.18 + OVERHANG * 2;
  const dh = dw * (img.naturalHeight / img.naturalWidth);
  const dx = t.x - (dw - t.w) / 2; // excedente centralizado nas duas pontas
  // a passarela fica a ~40% da altura da imagem (ropes acima, pedra
  // pendurada abaixo) — alinha essa faixa com a linha do chão (topY)
  const dy = t.topY - dh * 0.4;
  ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.ceil(dw), Math.ceil(dh));

  if (t.trap) {
    // pista sutil de que essa é a versão que quebra: rachaduras no tabuado
    const deckY = t.topY - 4;
    ctx.save();
    ctx.strokeStyle = 'rgba(40, 20, 10, 0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const cx = t.x + t.w * (0.22 + i * 0.28);
      ctx.beginPath();
      ctx.moveTo(cx - 5, deckY - 6);
      ctx.lineTo(cx + 3, deckY);
      ctx.lineTo(cx - 3, deckY + 6);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawBrokenBridgeGap(t) {
  // buraco grande com a ponte já rompida nas pontas: usa a "tecnologia de
  // espelho" (paintSceneryStrip) pra revelar o abismo atrás das pontas
  // quebradas, em vez de recortar o fundo da própria imagem como a cachoeira.
  paintSceneryStrip(t.x, t.w);
  const img = IMG.ponte_quebrada;
  if (img && img.complete && img.naturalWidth > 0) {
    const overlap = 4;
    const dw = t.w + overlap * 2;
    const dh = dw * (img.naturalHeight / img.naturalWidth);
    const dx = t.x - overlap;
    // o topo das duas pontas rochosas fica a ~40% da altura da imagem —
    // alinha essa faixa com a linha do chão
    const dy = GROUND_Y - dh * 0.4;
    ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.ceil(dw), Math.ceil(dh));
  }
}

function drawTerrain() {
  terrain.forEach(t => {
    if (t.type === 'buraco') {
      if (t.collapsed) {
        // ponte-armadilha que acabou de ceder: sem cachoeira aqui — revela o
        // abismo com o mesmo efeito de espelho do céu/montanhas usado nos
        // buracos normais, só que sem a queda-d'água (ela nunca teve uma).
        paintSceneryStrip(t.x, t.w);
        return;
      }
      if (t.visual === 'ponte_quebrada') {
        drawBrokenBridgeGap(t);
        return;
      }
      if (t.visual === 'espelho') {
        // vão sem sprite nenhum — só o efeito de espelho revelando o abismo
        paintSceneryStrip(t.x, t.w);
        return;
      }
      // buraco: cachoeira com o fundo já recortado (ver chromaKeyToCanvas),
      // deixando o cenário real (céu/montanhas) aparecer atrás dela. Só cai
      // pro retângulo escuro enquanto a imagem ainda está carregando.
      const overlap = 1;
      const dx = Math.round(t.x) - overlap;
      const dw = Math.ceil(t.w) + overlap * 2;
      const img = IMG.cachoeira;
      const drawable = IMG_CHROMA.cachoeira;
      if (img && img.complete && img.naturalWidth > 0 && drawable) {
        // ocupa o nível do chão, com uma pequena protuberância do topo acima da linha do solo
        const PROTRUSION = 14;
        const dyImg = GROUND_Y - PROTRUSION;
        const dhImg = (H - GROUND_Y) + PROTRUSION;
        ctx.drawImage(drawable, dx, dyImg, dw, dhImg);
      } else {
        ctx.fillStyle = '#2b1f33';
        ctx.fillRect(dx, GROUND_Y, dw, H - GROUND_Y);
      }
    } else {
      drawBrokenPlank(t);
    }
  });
}
function checkCollision() {
  const p = getPlayerHitbox();
  for (const o of obstacles) {
    if (o.collidable === false) continue; // ex.: sapo no ar, pulo é só visual
    const ox = o.x + 3, oy = o.y + 3, ow = o.w - 6, oh = o.h - 6;
    if (p.x < ox + ow && p.x + p.w > ox && p.y < oy + oh && p.y + p.h > oy) return true;
  }
  // Fase do chefão: sem obstaculos[] normais, o perigo vem dos ataques do
  // Dragão das Nuvens (pétalas/esfera/rugido/investida) — ver boss.js.
  if (currentLevel.isBoss && boss) {
    for (const hz of boss.getDamageHazards()) {
      if (p.x < hz.x + hz.w && p.x + p.w > hz.x && p.y < hz.y + hz.h && p.y + p.h > hz.y) return true;
    }
  }
  return false;
}

// ---- Ataque de martelo (fase 5+): destrói obstáculos e inimigos ----
// Golpe em arco de cima pra baixo, na direção que o jogador está olhando
// (player.facing). A hitbox só fica "viva" numa janela curta no meio da
// animação (o instante do impacto do arco), não durante o swing inteiro.
const HAMMER_COOLDOWN = 6;          // segundos de recarga
const HAMMER_SWING_DURATION = 0.35; // duração total da animação, em segundos
const HAMMER_HIT_START = 0.12;      // fração do swing em que a hitbox liga (liga cedo, cobre quase todo o golpe)
const HAMMER_HIT_END = 1;           // fração do swing em que a hitbox desliga
const HAMMER_REACH = 130;           // alcance horizontal à frente do jogador — bem generoso, acerta qualquer coisa próxima
const HAMMER_HIT_W = 90;
// cobre chão e as três faixas de altura do fantasma (baixo/médio/alto)
const HAMMER_HIT_TOP = GROUND_Y - 130;

// Disponível se coletado de verdade (Fase 3) OU via cheat dedicado do mod
// menu ("Liberar martelo") — separado de propósito do cheat de cooldown
// ("Martelo sem cooldown"/modState.infiniteHammer): um libera o uso, o
// outro só zera a recarga; nenhum implica o outro.
function hammerIsAvailable() { return hammerUnlocked || modState.hammerUnlock; }

function triggerHammer() {
  if (state !== 'playing' || !hammerIsAvailable()) return;
  if (player.dying || player.launched) return;
  if (!modState.infiniteHammer && (player.hammerAttackT !== null || player.hammerCooldown > 0)) return;
  player.hammerAttackT = 0;
  player.hammerCooldown = modState.infiniteHammer ? 0 : HAMMER_COOLDOWN;
  audioManager.play('player_martelo');
}

// Retorna a hitbox ativa do martelo nesse instante, ou null se não há golpe
// em andamento ou se ainda não chegou/já passou a janela de impacto.
function getHammerHitbox() {
  if (player.hammerAttackT === null) return null;
  const frac = player.hammerAttackT / HAMMER_SWING_DURATION;
  if (frac < HAMMER_HIT_START || frac > HAMMER_HIT_END) return null;
  const cx = player.facing >= 0 ? player.x + player.w : player.x;
  const x = player.facing >= 0 ? cx : cx - HAMMER_REACH;
  return { x, y: HAMMER_HIT_TOP, w: HAMMER_REACH + HAMMER_HIT_W / 2, h: GROUND_Y - HAMMER_HIT_TOP };
}

// Roda ANTES de checkCollision() no loop — se o martelo destruir um
// obstáculo nesse quadro, ele já não existe mais quando a colisão do corpo
// do jogador for checada, então o golpe tem prioridade de fato, não só na
// ordem de leitura do código.
function updateHammerCombat(dt) {
  if (player.hammerAttackT !== null) {
    player.hammerAttackT += dt;
    if (player.hammerAttackT >= HAMMER_SWING_DURATION) player.hammerAttackT = null;
  }
  if (player.hammerCooldown > 0) player.hammerCooldown = Math.max(0, player.hammerCooldown - dt);

  const hb = getHammerHitbox();
  if (!hb) return;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (o.hammerImmune) continue; // nada no jogo usa isso hoje, mas deixa a porta aberta
    if (hb.x < o.x + o.w && hb.x + hb.w > o.x && hb.y < o.y + o.h && hb.y + hb.h > o.y) {
      spawnDestroyEffect(o.x + o.w / 2, o.y + o.h / 2);
      audioManager.play('obstaculo_destruido');
      obstacles.splice(i, 1);
    }
  }

  if (currentLevel.isBoss && boss) updateBossHammerInteraction(hb);
}

// Conecta a hitbox do martelo (hb, já calculada acima) ao chefe: primeiro
// testa contra os hazards destrutíveis (pétalas/esfera — destruir um deles
// só gera uma reação leve, sem tirar HP), depois contra a hitbox vulnerável
// do corpo (essa sim tira HP, só existe durante a janela de fadiga).
function updateBossHammerInteraction(hb) {
  for (const hz of boss.getHazards()) {
    if (!hz.destructible) continue;
    if (hb.x < hz.x + hz.w && hb.x + hb.w > hz.x && hb.y < hz.y + hz.h && hb.y + hb.h > hz.y) {
      boss.destroyHazard(hz.id);
      spawnDestroyEffect(hz.x + hz.w / 2, hz.y + hz.h / 2);
      audioManager.play('obstaculo_destruido');
    }
  }
  const vulnHb = boss.getVulnerableHitbox();
  if (vulnHb && hb.x < vulnHb.x + vulnHb.w && hb.x + hb.w > vulnHb.x && hb.y < vulnHb.y + vulnHb.h && hb.y + hb.h > vulnHb.y) {
    if (boss.takeHit()) {
      spawnDestroyEffect(vulnHb.x + vulnHb.w / 2, vulnHb.y + vulnHb.h / 2);
      screenShakeMag = 9; screenShakeT = 0.3; // impacto maior que um obstáculo comum
      audioManager.play('obstaculo_destruido');
      updateBossHud();
    }
  }
}

// ---- Partículas + screen shake: só feedback de impacto, sem gameplay ----
let particles = [];
let screenShakeT = 0, screenShakeMag = 0;

function spawnDestroyEffect(cx, cy) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5,
      life: 0.35 + Math.random() * 0.15,
      maxLife: 0.5,
      size: 3 + Math.random() * 3,
      color: Math.random() < 0.5 ? '#f490b2' : '#fdf0e6',
    });
  }
  screenShakeT = 0.18;
  screenShakeMag = 5;
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 0.25; // gravidade leve
    p.x += p.vx; p.y += p.vy;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
  if (screenShakeT > 0) screenShakeT = Math.max(0, screenShakeT - dt);
}
function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  });
  ctx.globalAlpha = 1;
}
// Deslocamento aleatório aplicado ao canvas inteiro enquanto o shake dura —
// chamado uma vez por quadro antes de desenhar, some sozinho com o decaimento.
function getScreenShakeOffset() {
  if (screenShakeT <= 0) return { x: 0, y: 0 };
  const mag = screenShakeMag * (screenShakeT / 0.18);
  return { x: (Math.random() * 2 - 1) * mag, y: (Math.random() * 2 - 1) * mag };
}

// Sprite oficial (src/assets/jogador/weapon/martelo.png): a cabeça fica perto
// do canto superior-esquerdo do PNG e o cabo desce na diagonal até a "pega"
// perto do canto inferior-direito. As frações abaixo localizam esses dois
// pontos dentro da imagem — servem pra (a) ancorar a pega bem na mão do
// jogador (o pivô do swing) e (b) calcular a rotação extra que deixa o cabo
// "reto pra baixo" quando o ângulo do golpe é 0, já que a arte não nasce
// alinhada ao eixo vertical.
const HAMMER_IMG_HAND = { x: 0.72, y: 0.80 };
const HAMMER_IMG_HEAD = { x: 0.05, y: 0.03 };
const HAMMER_DISPLAY_LEN = 100; // comprimento desenhado (pega -> ponta da cabeça), em px

function drawHammer() {
  if (player.hammerAttackT === null) return;
  const img = IMG.martelo;
  if (!img || !img.complete || !img.naturalWidth) return;
  const frac = Math.min(1, player.hammerAttackT / HAMMER_SWING_DURATION);
  // Arco completo de 180°: começa com a cabeça erguida (reto pra cima) e
  // termina reto pra baixo, girando inteiramente pelo lado da frente do
  // personagem (nunca cruza pro lado das costas) — visto de baixo é um
  // golpe tipo "12 horas -> 3 horas -> 6 horas" no relógio.
  const angle = (-180 + frac * 180) * Math.PI / 180;
  const pivotX = player.facing >= 0 ? player.x + player.w * 0.85 : player.x + player.w * 0.15;
  const pivotY = player.y + player.h * 0.35;

  const handX = HAMMER_IMG_HAND.x * img.naturalWidth, handY = HAMMER_IMG_HAND.y * img.naturalHeight;
  const headX = HAMMER_IMG_HEAD.x * img.naturalWidth, headY = HAMMER_IMG_HEAD.y * img.naturalHeight;
  // vetor mão -> cabeça, na imagem original (sem rotação)
  const handToHeadX = headX - handX, handToHeadY = headY - handY;
  const rawLen = Math.hypot(handToHeadX, handToHeadY);
  const scale = HAMMER_DISPLAY_LEN / rawLen;
  const drawW = img.naturalWidth * scale, drawH = img.naturalHeight * scale;
  const anchorX = HAMMER_IMG_HAND.x * drawW, anchorY = HAMMER_IMG_HAND.y * drawH;
  // rotação que alinha mão->cabeça pra apontar "reto pra baixo" (pose base,
  // ângulo de golpe 0) — resolvendo R(correction) * (handToHead) = (0, +len)
  const correction = Math.atan2(handToHeadX, handToHeadY);

  ctx.save();
  ctx.translate(pivotX, pivotY);
  if (player.facing < 0) ctx.scale(-1, 1); // mesma técnica de drawPlayer() pra espelhar olhando pra esquerda
  ctx.rotate(angle + correction);
  ctx.drawImage(img, -anchorX, -anchorY, drawW, drawH);
  ctx.restore();
}

// Sincroniza o HUD circular do martelo: preenchimento "relógio de pizza" via
// custom property --cd-pct (consumida pelo conic-gradient no CSS) e um pulso
// visual de "pronto" (.ready) disparado uma única vez na transição
// cooldown -> pronto.
function updateHammerHud() {
  if (!hammerHud) return;
  // dinâmico (não só no início da fase): o martelo pode ser destravado NO
  // MEIO da Fase 3, então o ícone precisa aparecer ali mesmo, sem esperar
  // a próxima fase começar.
  hammerHud.classList.toggle('hidden', !hammerIsAvailable());
  if (!hammerIsAvailable()) return;
  const pct = Math.max(0, Math.min(1, player.hammerCooldown / HAMMER_COOLDOWN)) * 100;
  hammerHud.style.setProperty('--cd-pct', String(pct));
  const ready = player.hammerCooldown <= 0;
  if (ready && !hammerHud.dataset.wasReady) {
    hammerHud.classList.add('ready');
    setTimeout(() => hammerHud.classList.remove('ready'), 600);
  }
  hammerHud.dataset.wasReady = ready ? '1' : '';
}

// ---- Objetos de cenário desenhados por cima do fundo ----
function drawFlag() {
  if (flagX === null) return;
  const img = IMG.bandeira;
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const h = FLAG_H;
  const w = Math.round(h * img.naturalWidth / img.naturalHeight);
  // base do mastro apoiada na linha do chão
  ctx.drawImage(img, Math.round(flagX), Math.round(GROUND_Y - h + 4), w, h);
}

// ---- Martelo coletável (Fase 3): flutua do lado da bandeira, obrigatório
// coletar pra terminar a fase (o jogador tem que passar por essa faixa de
// qualquer jeito pra alcançar o mastro). Some pra sempre depois de coletado
// — ver hammerUnlocked, persistido em localStorage.
const HAMMER_PICKUP_W = 40, HAMMER_PICKUP_H = 40;
const HAMMER_PICKUP_OFFSET_X = 56; // à esquerda da bandeira

function hammerPickupPos() {
  const t = hammerPickupState.t || 0;
  return {
    x: flagX - HAMMER_PICKUP_OFFSET_X,
    y: GROUND_Y - FLAG_H * 0.72 + Math.sin(t * 3) * 6, // flutua suavemente
  };
}

function updateHammerPickup(dt) {
  if (!hammerPickupState || hammerPickupState.collected || flagX === null) return;
  hammerPickupState.t = (hammerPickupState.t || 0) + dt;
  const pos = hammerPickupPos();
  const p = getPlayerHitbox();
  if (p.x < pos.x + HAMMER_PICKUP_W && p.x + p.w > pos.x && p.y < pos.y + HAMMER_PICKUP_H && p.y + p.h > pos.y) {
    hammerPickupState.collected = true;
    hammerUnlocked = true;
    saveProgress();
    audioManager.play('player_martelo');
    // pausa o jogo (mesmo truque de state !== 'playing' usado no menu/fim de
    // fase — o loop() continua desenhando o último quadro, só para de
    // atualizar) e mostra o diálogo explicando a habilidade nova.
    state = 'itempickup';
    hammerPickupOverlay.classList.remove('hidden');
  }
}

function drawHammerPickup(ctx) {
  if (!hammerPickupState || hammerPickupState.collected || flagX === null) return;
  const pos = hammerPickupPos();
  const cx = pos.x + HAMMER_PICKUP_W / 2, cy = pos.y + HAMMER_PICKUP_H / 2;
  const pulse = 0.7 + Math.sin((hammerPickupState.t || 0) * 4) * 0.3;

  ctx.save();
  // glow rosa atrás do item
  const glowR = HAMMER_PICKUP_W * 1.1;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
  grad.addColorStop(0, `rgba(244,144,178,${(0.55 * pulse).toFixed(3)})`);
  grad.addColorStop(1, 'rgba(244,144,178,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fill();

  const img = IMG.martelo;
  if (img && img.complete && img.naturalWidth) {
    const w = HAMMER_PICKUP_W, h = w * (img.naturalHeight / img.naturalWidth);
    ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  }
  ctx.restore();
}

hammerPickupOkBtn.addEventListener('click', () => {
  audioManager.play('ui_clique');
  hammerPickupOverlay.classList.add('hidden');
  state = 'playing'; // retoma o jogo de onde parou (loop() nunca deixou de desenhar o quadro congelado)
});

// ---- Cenário com sprites de referência (céu, montanhas, árvores, nuvens) ----
// Todas as camadas usam as imagens fornecidas; nenhuma delas é desenhada via
// formas geométricas. O tiling horizontal do céu e das montanhas usa offset
// contínuo (sem arredondamento abrupto) para não deixar costura visível.

function drawTiledLayer(key, dispBottom, dispH, offset, opacity) {
  const img = IMG[key];
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const dispW = dispH * (img.naturalWidth / img.naturalHeight);
  const dispY = dispBottom - dispH;
  const off = offset % dispW;
  let x = -off;
  if (x > 0) x -= dispW;
  ctx.save();
  if (opacity !== undefined) ctx.globalAlpha = opacity;
  while (x < W) {
    ctx.drawImage(img, x, dispY, dispW + 1, dispH);
    x += dispW;
  }
  ctx.restore();
}

// Árvores/vegetação: sprites soltos no fundo, em ordem e espaçamento
// aleatórios (nunca a mesma sequência), claramente atrás da pista onde os
// obstáculos aparecem — mais devagar, mais afastados e ligeiramente
// transparentes para não serem confundidos com obstáculos.
const TREE_ROW_PERIOD = 900;
const TREE_MIN_GAP = 140;
const TREE_MAX_GAP = 340;
const TREE_SCENERY_ALPHA = 0.88;
const SCENERY_CONFIG = {
  treeTypes: [
    { key: 'arvore_rosa_grande', h: 66 },
    { key: 'arbusto', h: 38 },
    { key: 'arvore_conifera', h: 58 },
    { key: 'arvore_rosa_pequena', h: 46 }
  ],
  clouds: [
    { key: 'nuvem_1', y: 0.14, speedFactor: 0.35, period: 900, dx: 0, h: 60 },
    { key: 'nuvem_2', y: 0.34, speedFactor: 0.55, period: 760, dx: 420, h: 42 },
    { key: 'nuvem_3', y: 0.10, speedFactor: 0.45, period: 1000, dx: 680, h: 48 },
    { key: 'nuvem_4', y: 0.42, speedFactor: 0.6, period: 640, dx: 180, h: 38 },
    { key: 'nuvem_5', y: 0.24, speedFactor: 0.7, period: 520, dx: 340, h: 30 }
  ]
};

function getTreeRowSeeds(rowIndex) {
  let seed = Math.abs(rowIndex * 7919 + 104729);
  const random = () => {
    seed = (seed * 48271) % 2147483647;
    return seed / 2147483647;
  };
  const seeds = [];
  let dx = 40 + random() * 80;
  while (dx < TREE_ROW_PERIOD) {
    // tipo sorteado a cada planta: nunca a mesma sequência se repetindo
    const type = SCENERY_CONFIG.treeTypes[Math.floor(random() * SCENERY_CONFIG.treeTypes.length)];
    seeds.push({ ...type, dx });
    dx += TREE_MIN_GAP + random() * (TREE_MAX_GAP - TREE_MIN_GAP);
  }
  return seeds;
}

function drawTreeRow(offset) {
  const off = offset % TREE_ROW_PERIOD;
  let baseX = -off;
  if (baseX > 0) baseX -= TREE_ROW_PERIOD;
  const firstRow = Math.floor(offset / TREE_ROW_PERIOD) - 1;
  let rowIndex = firstRow;
  ctx.save();
  ctx.globalAlpha = TREE_SCENERY_ALPHA;
  while (baseX < W) {
    for (const seed of getTreeRowSeeds(rowIndex)) {
      const img = IMG[seed.key];
      if (!img || !img.complete || img.naturalWidth === 0) continue;
      const h = seed.h;
      const w = h * (img.naturalWidth / img.naturalHeight);
      const x = baseX + seed.dx;
      if (x + w < 0 || x > W) continue;
      // base encostada na linha do chão, sem gap (evita efeito de flutuar)
      ctx.drawImage(img, x, GROUND_Y - h + 3, w, h);
    }
    baseX += TREE_ROW_PERIOD;
    rowIndex++;
  }
  ctx.restore();
}

// Nuvens soltas: cada uma se move em velocidade e altura próprias, dando
// mais profundidade do que uma faixa única de céu.
function drawLooseClouds(offset) {
  for (const c of SCENERY_CONFIG.clouds) {
    const img = IMG[c.key];
    if (!img || !img.complete || img.naturalWidth === 0) continue;
    const w = c.h * (img.naturalWidth / img.naturalHeight);
    const off = (offset * c.speedFactor + c.dx) % c.period;
    let x = -off;
    if (x > 0) x -= c.period;
    const y = GROUND_Y * c.y;
    while (x < W) {
      ctx.drawImage(img, x, y, w, c.h);
      x += c.period;
    }
  }
}

// Wash de fundo cobrindo 100% do canvas: garante que NUNCA haja área
// "cortada"/sem cor acima ou entre as camadas, não importa a altura delas.
function drawSkyWash() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  skyGrad.addColorStop(0, '#6fa8f0');
  skyGrad.addColorStop(0.45, '#a7c4f2');
  skyGrad.addColorStop(0.75, '#e3c9ea');
  skyGrad.addColorStop(1, '#fbe4d8');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, GROUND_Y);
  // abaixo da linha do horizonte (onde normalmente entra o chão), continua
  // com a cor mais quente do fim do degradê — usado pra "reabrir" o cenário
  // real numa faixa onde algo (como a ponte segura) substitui o chão sólido
  ctx.fillStyle = '#fbe4d8';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
}

// Céu + montanhas: as duas camadas de fundo distante, com a base encostada
// na linha do chão. São as únicas espelhadas em paintSceneryStrip (ver
// abaixo) pra preencher a profundidade de um vão com "o final" da própria
// arte de fundo, em vez de uma cor lisa.
function drawSkyAndMountains() {
  // céu ao fundo (mais lento) cobrindo toda a largura, sem costura
  drawTiledLayer('ceu', GROUND_Y, GROUND_Y * 0.62, skyOffset * 0.3);
  // fundo composto com montanhas e ilhas, deslocando-se mais lentamente
  drawTiledLayer('montanhas', GROUND_Y, GROUND_Y * 0.78, farOffset * 0.35);
}

// Camadas de fundo "no ar" (céu, montanhas, nuvens) — sem vegetação, que é
// ancorada no chão e não deve aparecer flutuando sobre um abismo.
function drawBackgroundLayers() {
  drawSkyAndMountains();
  // nuvens soltas com movimento independente, por cima do fundo
  drawLooseClouds(skyOffset);
}

function drawSceneryLayers() {
  drawBackgroundLayers();
  // vegetação de fundo, mais devagar que o chão para reforçar a profundidade
  // e não ser confundida com os obstáculos (que andam na velocidade cheia)
  drawTreeRow(groundOffset * 0.5);
}

// Repinta o cenário real só numa faixa vertical estreita [x, x+w) — usado
// pra "abrir uma janela" de volta pro fundo numa zona onde o chão sólido
// normal não deve aparecer (ex.: sob a ponte segura ou a cachoeira, que tem
// vãos vazados e não tem imagem de fundo própria).
// Acima da linha do chão: céu/montanhas/nuvens normais. Abaixo dela (a
// profundidade do vão): espelha o mesmo céu/montanhas verticalmente, pra
// parecer uma continuação da própria arte de fundo, não um corte pra cor lisa.
function paintSceneryStrip(x, w) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(Math.round(x), 0, Math.ceil(w), H);
  ctx.clip();
  drawSkyWash();
  drawBackgroundLayers();
  ctx.save();
  ctx.translate(0, 2 * GROUND_Y);
  ctx.scale(1, -1);
  drawSkyAndMountains();
  ctx.restore();
  ctx.restore();
}

function drawGroundTile() {
  const img = IMG.chao;
  const dispH = H - GROUND_Y;
  if (!img.complete || img.naturalWidth === 0) { ctx.fillStyle = '#7d6386'; ctx.fillRect(0, GROUND_Y, W, dispH); return; }
  const dispW = Math.ceil(img.naturalWidth * (dispH / img.naturalHeight));
  // Mirror (ping-pong) tiling: espelha tiles alternados horizontalmente.
  // Isso garante que a borda de cada tile sempre encontra sua própria borda
  // espelhada, eliminando qualquer costura visível mesmo que a textura
  // original não seja perfeitamente repetível.
  const total = Math.floor(groundOffset);
  let tileIndex = Math.floor(total / dispW);
  let x = -(total - tileIndex * dispW);
  while (x < W) {
    ctx.save();
    if (((tileIndex % 2) + 2) % 2 === 1) {
      ctx.translate(x + dispW, GROUND_Y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -1, 0, dispW + 1, dispH);
    } else {
      ctx.drawImage(img, x, GROUND_Y, dispW + 1, dispH);
    }
    ctx.restore();
    x += dispW;
    tileIndex++;
  }
}

const BOSS_SCROLL_DECEL = 14; // px/s (em unidades de scrollSpeed) — desaceleração do cenário na derrota do chefe

// Fase do chefão: sem spawner de obstáculos comuns e sem meta de distância
// — o cenário só rola pra dar ambientação, e a única fonte de perigo/HUD é
// o CloudDragonBoss (boss.js). Isolado do ramo normal do loop() pra não
// misturar os dois modelos de fase (rolar-até-a-bandeira vs. combate).
function updateBossLevel(dt, frameScale) {
  if (boss.state === 'defeated') {
    // desacelera o cenário até parar enquanto o chefe recua/some da tela
    scrollSpeed = Math.max(0, scrollSpeed - BOSS_SCROLL_DECEL * dt);
    speed = scrollSpeed;
  } else {
    scrollSpeed = currentLevel.baseSpeed;
  }
  groundOffset += scrollSpeed * frameScale; skyOffset += scrollSpeed * 0.05 * frameScale; farOffset += scrollSpeed * 0.15 * frameScale;

  boss.update(dt, {
    playerX: player.x,
    playerRight: player.x + player.w,
    playerJumping: !player.grounded && player.vy < 0,
    playerCrouching: player.isCrouching,
  });
  updateBossHud();

  if (boss.state === 'defeated') {
    if (boss.isDefeatSequenceDone() && !bossDefeatEnding) {
      bossDefeatEnding = true;
      endGame(true);
    }
    return;
  }

  // roda ANTES da colisão do corpo, mesma prioridade do martelo sobre obstáculos comuns
  updateHammerCombat(dt);
  if (checkCollision() && !modState.godMode) startLaunchDeath();
}

let lastTime = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05); lastTime = ts;
  if (state === 'playing') {
    const frameScale = dt * 60;
    updatePlayer(dt);
    // Enquanto o personagem está morrendo (caindo num abismo ou arremessado
    // por um obstáculo), o resto do mundo congela — só essa animação
    // continua, pra dar foco total a esse instante em vez de o cenário
    // seguir rolando por baixo.
    if (!player.dying && !player.launched) {
      if (currentLevel.isBoss) {
        updateBossLevel(dt, frameScale);
      } else {
        // Scroll do mundo modulado pela posição horizontal do jogador na tela:
        // perto do limite direito (avançou) acelera um pouco a progressão; perto
        // do limite esquerdo (recuou) desacelera o cenário, dando margem
        // estratégica. Nunca abaixo do piso, então a fase nunca trava de vez.
        const xNorm = (player.x - PLAYER_X_MIN) / (PLAYER_X_MAX - PLAYER_X_MIN); // 0..1
        const xBias = (xNorm - 0.5) * 2; // -1 (recuado) .. +1 (avançado)
        scrollSpeed = Math.max(speed * SCROLL_MIN_FACTOR, speed * (1 + SCROLL_EDGE_BIAS * xBias));
        updateObstacles(dt);
        groundOffset += scrollSpeed * frameScale; skyOffset += scrollSpeed * 0.05 * frameScale; farOffset += scrollSpeed * 0.15 * frameScale;
        distance += scrollSpeed * 0.05 * frameScale;
        speed = Math.min(currentLevel.maxSpeed, currentLevel.baseSpeed + distance / 150) * modState.speedMult;
        progressBarInner.style.width = Math.min(100, (distance / currentLevel.goal) * 100) + '%';
        distDisplay.textContent = Math.floor(distance) + ' M / ' + currentLevel.goal + ' M';
        // roda ANTES da colisão do corpo: um obstáculo destruído pelo martelo
        // nesse quadro já não existe mais quando checkCollision() olhar pra
        // ele — o golpe tem prioridade de verdade, não só na ordem de leitura.
        updateHammerCombat(dt);
        if (checkCollision() && !modState.godMode) { startLaunchDeath(); }
        else {
          // Bandeira surge da borda direita quando falta pouco para a meta
          if (flagX === null && distance >= currentLevel.goal - FLAG_LEAD) flagX = W + 40;
          if (flagX !== null) {
            flagX -= scrollSpeed * frameScale;
            // para de gerar obstáculos assim que a bandeira aparece (trecho final limpo)
            nextSpawnIn = 9999;
            updateHammerPickup(dt); // martelo coletável (Fase 3) flutuando do lado da bandeira
            // fase concluída quando a personagem alcança o mastro — só chega
            // aqui se ainda estiver em 'playing' (updateHammerPickup pode ter
            // pausado o jogo neste mesmo quadro pra abrir o diálogo de coleta)
            if (state === 'playing' && flagX + 20 <= player.x + player.w / 2) { endGame(true); }
          }
        }
      }
    }
    // partículas continuam animando mesmo durante a queda/arremesso (efeito
    // de um golpe anterior não deve travar de repente)
    updateParticles(dt);
    updateHammerHud();
  }
  ctx.clearRect(0, 0, W, H);
  const shake = getScreenShakeOffset();
  ctx.save();
  ctx.translate(shake.x, shake.y);
  drawSkyWash();
  drawSceneryLayers();
  drawGroundTile();
  drawTerrain();
  drawFlag();
  drawHammerPickup(ctx);
  // `boss` só é diferente de null durante a Fase Final — checar só ele evita
  // tocar em `currentLevel` aqui, que é null enquanto o jogo está no menu
  // (este bloco de desenho roda em todos os estados, não só em 'playing').
  if (boss) boss.draw(ctx);
  drawObstacles();
  drawPlayer();
  drawHammer();
  drawParticles();
  ctx.restore();
  requestAnimationFrame(loop);
}

function startLevel(l) {
  if (!l.unlocked) return;
  audioManager.play('ui_iniciar_fase');
  audioManager.playMusicWhenReady(l.isBoss ? 'bgm_boss' : 'bgm_fases');
  currentLevel = l; distance = 0; speed = l.baseSpeed; scrollSpeed = l.baseSpeed;
  // ~1.8s de folga inicial antes do primeiro obstáculo, na velocidade de partida da fase
  obstacles = []; terrain = []; nextSpawnIn = l.baseSpeed * 60 * 1.8; flagX = null;
  groundOffset = skyOffset = farOffset = 0;
  resetPlayer();
  boss = l.isBoss ? new CloudDragonBoss({ canvasW: W, canvasH: H, groundY: GROUND_Y, images: IMG }) : null;
  bossDefeatEnding = false;
  levelLabel.textContent = 'FASE ' + l.id;
  progressBarInner.style.width = '0%';
  distDisplay.textContent = l.isBoss ? '' : '0 M / ' + l.goal + ' M';
  levelSelectOverlay.classList.add('hidden');
  gameWrap.classList.remove('on-menu');
  endOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
  if (hammerHud) {
    hammerHud.classList.toggle('hidden', !hammerIsAvailable()); // updateHammerHud() mantém isso atualizado quadro a quadro
    hammerHud.style.setProperty('--cd-pct', '0');
    hammerHud.dataset.wasReady = '';
  }
  hammerPickupState = (l.hasHammerPickup && !hammerUnlocked) ? { collected: false } : null;
  if (bossHud) {
    bossHud.classList.toggle('hidden', !l.isBoss);
    updateBossHud();
  }
  state = 'playing';
}
function endGame(won) {
  state = won ? 'levelcomplete' : 'gameover';
  hud.classList.add('hidden');
  if (won) {
    audioManager.play('sfx_vitoria');
    currentLevel.completed = true; currentLevel.stars = 3;
    const n = LEVELS.findIndex(l => l.id === currentLevel.id) + 1;
    if (n < LEVELS.length) LEVELS[n].unlocked = true;
    saveProgress();
    if (currentLevel.isBoss) {
      endTitle.textContent = 'VITÓRIA!';
      endText.textContent = 'Você derrotou o Dragão das Nuvens!';
    } else {
      endTitle.textContent = 'FASE CONCLUÍDA!';
      endText.textContent = 'Você percorreu ' + currentLevel.goal + ' m!';
    }
    endStars.textContent = '★★★';
    retryBtn.textContent = n < LEVELS.length ? 'PRÓXIMA FASE' : 'JOGAR NOVAMENTE';
  } else {
    // som de derrota distinto do impacto que já tocou em startLaunchDeath()
    // (quando a morte foi por colisão) — evita soar como eco do mesmo golpe
    audioManager.play('sfx_derrota');
    endTitle.textContent = 'GAME OVER';
    endStars.textContent = '';
    endText.textContent = currentLevel.isBoss
      ? 'O Dragão das Nuvens venceu desta vez...'
      : 'Distância: ' + Math.floor(distance) + ' m de ' + currentLevel.goal + ' m';
    retryBtn.textContent = 'TENTAR NOVAMENTE';
  }
  endOverlay.classList.remove('hidden');
}
function retryOrAdvance() {
  if (state === 'levelcomplete') {
    const n = LEVELS.findIndex(l => l.id === currentLevel.id) + 1;
    if (n < LEVELS.length) { startLevel(LEVELS[n]); return; }
  }
  startLevel(currentLevel);
}
retryBtn.addEventListener('click', retryOrAdvance);
mapBtn.addEventListener('click', () => {
  audioManager.play('ui_clique');
  audioManager.playMusicWhenReady('bgm_fases'); // sai do chefão -> volta a trilha normal do menu/fases
  endOverlay.classList.add('hidden'); hud.classList.add('hidden');
  state = 'menu'; renderLevelSelect(); levelSelectOverlay.classList.remove('hidden');
  gameWrap.classList.add('on-menu');
});

// ---- Seletor de fases em roleta (carrossel horizontal) ----
// A fase no centro da tela é a destacada/selecionada; as setas rosas (que já
// existiam pro seletor antigo) giram o carrossel pra esquerda/direita. Os
// elementos de cada fase são criados UMA VEZ e reaproveitados — só a posição
// (left) e as classes mudam a cada giro — assim a transição de CSS em `left`
// consegue animar suavemente em vez de "teleportar" (recriar o elemento do
// zero pula a transição, já que não há um valor anterior pra animar a partir).
let carouselIndex = 0;
const levelNodeEls = new Map(); // lvl.id -> elemento persistente

function rotateCarousel(delta) {
  const n = LEVELS.length;
  carouselIndex = ((carouselIndex + delta) % n + n) % n; // circular (roleta de verdade)
  renderLevelSelect();
  audioManager.play('ui_girar');
}
pagePrevBtn.addEventListener('click', () => rotateCarousel(-1));
pageNextBtn.addEventListener('click', () => rotateCarousel(1));

function ensureLevelNodeEl(lvl, index) {
  let n = levelNodeEls.get(lvl.id);
  if (n) return n;
  n = document.createElement('div');
  n.className = 'level-node';
  n.innerHTML = `
    <div class="node-stars"></div>
    <span class="corner-flower cf-tl">🌸</span>
    <span class="corner-flower cf-tr">🌸</span>
    <div class="card-face"></div>
    <div class="ribbon-tag"></div>
  `;
  n.addEventListener('click', () => {
    const i = LEVELS.indexOf(lvl);
    if (i === carouselIndex) {
      // já é a fase central: um segundo clique/toque nela inicia a fase
      if (lvl.unlocked) startLevel(lvl);
    } else {
      // clicar numa vizinha traz ela pro centro (girando pro lado mais curto)
      const n2 = LEVELS.length;
      let d = ((i - carouselIndex) % n2 + n2) % n2;
      if (d > n2 / 2) d -= n2;
      rotateCarousel(d);
    }
  });
  levelNodeEls.set(lvl.id, n);
  pathSvgWrap.appendChild(n);
  return n;
}

function renderLevelSelect() {
  const wW = pathSvgWrap.clientWidth || 760, wH = pathSvgWrap.clientHeight || 220;
  const n = LEVELS.length;
  carouselIndex = ((carouselIndex % n) + n) % n;
  const centerX = wW * 0.5, centerY = wH * 0.42; // centralizado; um pouco acima do meio, sobra espaço pro botão JOGAR embaixo
  const gap = Math.max(60, Math.min(110, wW * 0.2));

  pathSvg.innerHTML = '';

  LEVELS.forEach((lvl, i) => {
    // distância circular mais curta até o centro — garante que girar "por
    // trás" (do último pro primeiro) deslize pro lado certo, não teleporte
    let delta = ((i - carouselIndex) % n + n) % n;
    if (delta > n / 2) delta -= n;
    const isCenter = delta === 0;

    const el = ensureLevelNodeEl(lvl, i);
    el.className = 'level-node ' + (lvl.completed ? 'completed' : lvl.unlocked ? 'unlocked' : 'locked')
      + (isCenter ? ' carousel-center' : ' carousel-side');
    if (isCenter && lvl.unlocked && !lvl.completed) el.classList.add('pulse');
    el.style.left = (centerX + delta * gap) + 'px';
    el.style.top = centerY + 'px';

    el.querySelector('.node-stars').innerHTML = lvl.completed
      ? `${'★'.repeat(lvl.stars)}${'☆'.repeat(3 - lvl.stars)}` : '';
    el.querySelector('.card-face').innerHTML = lvl.unlocked
      ? '<img src="' + IMG.correr_0.src + '" style="width:34px;height:auto;image-rendering:pixelated;">'
      : '🔒';
    el.querySelector('.ribbon-tag').innerHTML = lvl.unlocked
      ? `1-${lvl.id}<span class="tag-goal">${lvl.goal}m</span>`
      : `1-${lvl.id}`;
  });

  // setas de paginação: só fazem sentido com mais de uma fase pra girar
  const hasMultiple = n > 1;
  pagePrevBtn.classList.toggle('hidden', !hasMultiple);
  pageNextBtn.classList.toggle('hidden', !hasMultiple);

  // botão JOGAR: sempre logo abaixo do card central, some se ela estiver bloqueada
  const centerLvl = LEVELS[carouselIndex];
  playBtn.style.left = centerX + 'px';
  playBtn.style.top = (centerY + 68) + 'px';
  playBtn.classList.toggle('hidden', !centerLvl.unlocked);
  playBtn.onclick = () => startLevel(centerLvl);

  // vinheta decorativa: personagem parada perto da cerca já presente no fundo
  const vign = document.getElementById('menuVignette');
  vign.innerHTML = `<img src="${IMG.correr_0.src}" style="left:26px;bottom:6px;width:38px;height:auto;">`;
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space' && state === 'gameover') { e.preventDefault(); retryOrAdvance(); }
  else if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
  else if (e.code === 'ArrowDown') { e.preventDefault(); setCrouch(true); }
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); heldKeys.add('right'); }
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') { e.preventDefault(); heldKeys.add('left'); }
  else if (e.code === 'KeyE') { e.preventDefault(); triggerHammer(); }
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') releaseJump();
  else if (e.code === 'ArrowDown') setCrouch(false);
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') heldKeys.delete('right');
  else if (e.code === 'ArrowLeft' || e.code === 'KeyA') heldKeys.delete('left');
});
canvas.addEventListener('touchstart', e => { e.preventDefault(); jump(); }, { passive: false });
canvas.addEventListener('touchend', e => { e.preventDefault(); releaseJump(); }, { passive: false });
if (hammerHud) {
  hammerHud.addEventListener('touchstart', e => { e.preventDefault(); triggerHammer(); }, { passive: false });
  hammerHud.addEventListener('click', () => triggerHammer());
}

loadProgress();
resetPlayer();
renderLevelSelect();
window.addEventListener('resize', () => { if (state === 'menu') renderLevelSelect(); });
requestAnimationFrame(ts => { lastTime = ts; requestAnimationFrame(loop); });

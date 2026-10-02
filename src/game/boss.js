// CloudDragonBoss — chefão da Fase Final ("Dragão das Nuvens").
//
// Fica isolado neste módulo de propósito: diferente de obstáculos comuns
// (que nascem, rolam com o scroll do mundo e morrem), o chefe é uma
// entidade persistente presa ao canto direito da tela, com sua própria
// máquina de estados de ataque, vida e janela de vulnerabilidade. Colocar
// tudo isso dentro de engine.js inflaria ainda mais aquele módulo e
// misturaria dois modelos de objeto bem diferentes (obstáculo efêmero vs.
// entidade com estado persistente). engine.js só entende a superfície
// pública abaixo: update(), draw(), takeHit(), getHazards()/
// getDamageHazards()/getVulnerableHitbox(), destroyHazard() e
// isDefeatSequenceDone().
//
// Sistema de coordenadas: tudo aqui é espaço de tela (canvas), não espaço
// de mundo — o chefe não rola com scrollSpeed como um obstáculo comum.

export const BOSS_MAX_HP = 6;

const STATE = {
  IDLE: 'idle',
  TELEGRAPH: 'telegraph',
  ATTACK: 'attack',
  VULNERABLE: 'vulnerable',
  HURT: 'hurt',
  DEFEATED: 'defeated',
};

// Pool de sorteio dos ataques — investida é mais rara que os outros três
// (ela sozinha já força uma janela de vulnerabilidade logo depois).
const ATTACK_POOL = ['petalas', 'petalas', 'petalas', 'orbe', 'orbe', 'orbe', 'rugido', 'rugido', 'rugido', 'investida'];

// Constantes de tempo por ataque, centralizadas aqui pra facilitar ajuste
// fino depois sem precisar caçar números espalhados pelo update().
const ATTACK_CONFIG = {
  petalas: { telegraph: 0.4, duration: 1.0, burstCount: 5, burstGap: 0.09, speed: 260 },
  orbe: { telegraph: 0.45, duration: 0.4, speed: 560 }, // "raio" precisa parecer rápido de verdade, não flutuar
  rugido: { telegraph: 0.75, duration: 0.6 },
  investida: { telegraph: 0.55, dashOut: 0.22, hold: 0.18, dashBack: 0.32 },
};

// Intervalo entre lasers na rajada do Sopro Mágico (1 a 3 disparos, ver
// _startAttackOrbe) — dá tempo de pousar de um pulo e já se preparar pro
// próximo laser antes dele chegar.
const ORB_LASER_GAP = 0.75;
// Janela de "boca abrindo" antes de cada disparo — tem que bater com o
// atraso de spawn de cada laser em _startAttackOrbe() (t: 0.05 + i*GAP),
// pra cabeça virar pra pose de disparo bem no instante em que o laser nasce.
const ORB_LASER_WINDUP = 0.05;
// Velocidade de queda (px/s) do laser saindo da boca até a faixa rasteira —
// junto com maxY em _updateHazards(), cria o "mergulho" da boca até o chão.
const ORB_LASER_DIVE_SPEED = 150;
// Tamanho do hazard do laser — compartilhado entre _startAttackOrbe() (spawna
// com esse tamanho) e _updateTracking() (a cabeça desce até essa altura
// durante o Sopro Mágico, ver ORB_HEAD_DIVE_Y abaixo). Quadrado (era 104x72,
// alongado) — um retângulo esticado horizontalmente já sugere movimento
// numa direção; um orbe redondo não sugere direção nenhuma, só giro.
const ORB_LASER_W = 74, ORB_LASER_H = 74;

// Recorte vertical do sprite do raio (dragao_atk2_4, ver ORB_BEAM_FRAME): a
// metade de cima do PNG é preenchimento vazio (pétalas soltas flutuando,
// sem a faixa de luz) — medido a partir do bounding box alfa real do PNG
// (265x187, conteúdo visível só de y=74 a y=186). Sem recortar isso fora,
// esticar a imagem inteira pro retângulo do hazard deixava o feixe de luz
// ocupando só uma faixa fina no meio em vez da altura inteira. Usado só
// pelo Rugido agora (ladrilhado) — o Sopro Mágico virou um orbe desenhado
// via canvas (ver _drawSpinningOrb), sem sprite estático nenhum.
const ORB_BEAM_SRC_Y = 70;
const ORB_BEAM_SRC_H = 117;

const VULNERABLE_DURATION = 2.6;
const HURT_DURATION = 0.5;
const DEFEAT_DURATION = 2.4;
const ATTACKS_PER_VULNERABLE_CYCLE = 3; // a cada 3 ataques concluídos, abre uma janela extra

// ---- Sprites (ver assets.js / src/assets/obstaculos/inimigos/dragao/) -----
// Chaves do dicionário `images` (== IMG de engine.js) por animação. Cada
// grupo veio recortado do mesmo sheet, um frame por ação do design
// ("ATAQUE 1 - ABRE A BOCA" etc.) — os nomes aqui casam com esses rótulos.
const IDLE_FRAMES = ['dragao_idle', 'dragao_mov_0', 'dragao_mov_1', 'dragao_mov_2', 'dragao_mov_3', 'dragao_mov_4'];
const IDLE_FPS = 6; // ciclo de respiração/vento no cabelo, sempre em loop

// "Olhando para o protagonista" — cabeça focando o jogador. Reaproveitado
// tanto no TELEGRAPH (o chefe mira antes de atacar) quanto no VULNERABLE
// (guarda aberta, encarando o jogador).
const LOOK_FRAMES = ['dragao_olhar_0', 'dragao_olhar_1', 'dragao_olhar_2', 'dragao_olhar_3', 'dragao_olhar_4'];
const LOOK_FPS = 5;

// orbe e investida pulam alguns índices do sheet original (dragao_atk2_1/2
// e dragao_atk3_1/2): as cabeças vêm coladas sem espaço real entre elas
// nesse trecho do sheet, e qualquer corte vertical nesses índices mostra um
// pedaço da cabeça vizinha junto. Os arquivos continuam em disco (podem ser
// re-encaixados se o sheet original for recortado à mão depois).
//
// dragao_atk2_4 NÃO é uma pose de cabeça — é o raio/feixe em si (arte só do
// projétil, sem cabeça nenhuma no frame). Por isso fica de fora da animação
// da cabeça e é usado só como sprite do hazard viajando (ver ORB_BEAM_FRAME
// e _drawHazards()); usá-lo como pose de cabeça é o que fazia o "raio"
// aparecer só na cabeça e o projétil de verdade sair como uma bolinha lisa.
const ATTACK_FRAMES = {
  petalas: ['dragao_atk1_0', 'dragao_atk1_1', 'dragao_atk1_2', 'dragao_atk1_3', 'dragao_atk1_4', 'dragao_atk1_5'],
  orbe: ['dragao_atk2_0', 'dragao_atk2_3'],
  rugido: ['dragao_atk4_0', 'dragao_atk4_1', 'dragao_atk4_2', 'dragao_atk4_3', 'dragao_atk4_4'],
  investida: ['dragao_atk3_0', 'dragao_atk3_3', 'dragao_atk3_4'],
};

// Sprite do raio, usado hoje só pra ladrilhar o Rugido (ver _drawHazards) —
// o Sopro Mágico não usa mais essa arte, virou um orbe desenhado via canvas
// (_drawSpinningOrb) porque o feixe tem uma direção óbvia de leitura (ponta
// brilhante de um lado, cauda do outro) e o pedido era um efeito sem
// nenhuma sensação de movimento direcional, só giro sobre si mesmo.
const ORB_BEAM_FRAME = 'dragao_atk2_4';

// Animação de cada pétala individual (Sopro de Pétalas) — 5 frames de um
// orbe de energia girando (src/assets/obstaculos/inimigos/dragao/poderes/).
// Cada hazard mantém seu próprio relógio (h.animT, ver _updateHazards),
// então as pétalas de uma mesma rajada não ficam todas sincronizadas.
const PETAL_FRAMES = ['dragao_poder_orbe_0', 'dragao_poder_orbe_1', 'dragao_poder_orbe_2', 'dragao_poder_orbe_3', 'dragao_poder_orbe_4'];
const PETAL_FPS = 10;

const DEATH_FRAMES = ['dragao_morte_0', 'dragao_morte_1', 'dragao_morte_2', 'dragao_morte_3', 'dragao_morte_4'];
const HURT_FRAME = 'dragao_dano';

// O sheet original não é consistente: só o grupo idle/movimento já vem
// desenhado com o focinho pra esquerda (a direção que o chefe precisa
// encarar, já que ele fica preso na borda direita da tela olhando pro
// jogador) — todo o resto (ataques, "olhando pro protagonista", dano,
// morte) veio virado pra direita. Espelhamos esses na hora de desenhar em
// vez de reexportar os PNGs invertidos.
const FLIP_H_FRAMES = new Set([
  ...LOOK_FRAMES,
  ...ATTACK_FRAMES.petalas,
  ...ATTACK_FRAMES.orbe,
  ...ATTACK_FRAMES.rugido,
  ...ATTACK_FRAMES.investida,
  ...DEATH_FRAMES,
  HURT_FRAME,
]);

// Largura-alvo de desenho (altura segue a proporção natural do PNG). O grupo
// idle/movimento saiu do sheet com uma margem de recorte maior que os
// outros grupos, por isso recebe uma largura-alvo maior — sem isso a cabeça
// "encolheria" visivelmente sempre que voltasse pro estado IDLE.
const DISPLAY_W = 168;
const DISPLAY_W_IDLE = 224;

// ---- Corpo/cauda (ver _drawBody()) -------------------------------------
// corpo.png e Cauda.png vieram do mesmo sheet com a mesma margem vazia em
// cima/baixo (medido via bounding box alfa real dos dois PNGs: conteúdo
// visível em ambos de y=25 a ~y=181 de 197) — um recorte só serve pros dois.
const BODY_SRC_Y = 22, BODY_SRC_H = 162;
const BODY_THICKNESS = 118; // espessura desenhada do corpo — grande o bastante pra não sumir ao lado da cabeça (headH=130)
// Largura (em pixels DA FONTE) de cada "tira" fatiada de corpo.png/Cauda.png
// ao desenhar dobrado na curva — ver _drawBentStrip(). Menor = curva mais
// suave, porém mais chamadas de drawImage por frame; 6px já fica liso na
// escala em que o corpo é desenhado.
const BODY_STRIP_SRC_W = 6;
// Deslocamento do ponto de origem fora da tela, a partir do canto superior
// direito do canvas — fixo, nunca se move (é a outra ponta do "elástico").
const BODY_ANCHOR_OFFSET = { x: 70, y: -70 };

const IDLE_MIN = 0.7, IDLE_MAX = 1.1;

const JUMP_REACT_OFFSET = -18;   // cabeça sobe um pouco quando o jogador pula
const TRACK_LERP = 7;            // velocidade da interpolação de posição (maior = mais "grudento")
const RECOIL_DECAY = 90;         // px/s de decaimento do recuo visual (hurt/flinch)

let nextHazardId = 1;

export class CloudDragonBoss {
  constructor({ canvasW, canvasH, groundY, images }) {
    this.canvasW = canvasW;
    this.canvasH = canvasH;
    this.groundY = groundY;
    this.images = images || {}; // dicionário chave->HTMLImageElement (== IMG de engine.js)

    // Geometria de repouso / aproximação — ver getApproachTargetX() pra
    // saber por que a aproximação é calculada em relação ao jogador em vez
    // de ser um X fixo (garante alcance do martelo em qualquer posição).
    this.restX = canvasW - 110;
    this.baseY = canvasH * 0.42;
    this.headW = 150;
    this.headH = 130;

    this.hp = BOSS_MAX_HP;
    this.x = this.restX;
    this.y = this.baseY;
    this.recoilX = 0;   // offset horizontal extra (telegraph/hurt/flinch), sempre decai a 0
    this.flinchT = 0;   // reação leve ao ter um projétil destruído

    this.state = STATE.IDLE;
    this.stateT = 0;
    this.idleTarget = IDLE_MIN;
    this.currentAttack = null;
    this._lastAttack = null;
    this._attacksSinceVulnerable = 0;

    this._pendingSpawns = []; // { t, fn } — usado pelo sopro de pétalas e pelos lasers do Sopro Mágico (rajadas escalonadas)
    this._attackDurationOverride = null; // ver _startAttackOrbe — sobrescreve ATTACK_CONFIG[attack].duration quando o nº de lasers muda a duração real do golpe
    this._investidaPhase = null; // 'telegraph' | 'out' | 'hold' | 'back'
    this._investidaHazardActive = false;

    this.hazards = []; // { id, x, y, w, h, vx, vy, ttl, destructible, kind }

    this.defeatFallY = 0; // deslocamento vertical de queda durante a derrota
    this.defeatAlpha = 1;
  }

  // ---- Laço principal ----------------------------------------------------
  // input: { playerX, playerRight, playerJumping, playerCrouching }
  update(dt, input) {
    this.stateT += dt;
    this._updateTimers(dt);
    this._updateHazards(dt);
    this._updateTracking(dt, input);
    this._updatePendingSpawns(dt); // fica fora do switch: precisa continuar disparando mesmo se o estado ATTACK já tiver acabado (ver _startAttackOrbe)

    switch (this.state) {
      case STATE.IDLE: this._tickIdle(dt); break;
      case STATE.TELEGRAPH: this._tickTelegraph(dt); break;
      case STATE.ATTACK: this._tickAttack(dt, input); break;
      case STATE.VULNERABLE: this._tickVulnerable(dt); break;
      case STATE.HURT: this._tickHurt(dt); break;
      case STATE.DEFEATED: this._tickDefeated(dt); break;
    }
  }

  _updateTimers(dt) {
    if (this.flinchT > 0) this.flinchT = Math.max(0, this.flinchT - dt);
    if (this.recoilX > 0) this.recoilX = Math.max(0, this.recoilX - RECOIL_DECAY * dt);
  }

  // Alvo de aproximação: sempre calculado a partir da posição atual do
  // jogador (não um X fixo), pra garantir que a cabeça fique dentro do
  // alcance do martelo não importa onde o jogador esteja na pista — inclusive
  // se ele estiver bem atrás (perto de PLAYER_X_MIN). O piso de 120px é só
  // uma margem de segurança pra cabeça nunca colar em cima do personagem;
  // o teto é o próprio repouso (nunca "aproxima" pra mais longe que isso).
  _approachTargetX(input) {
    const target = (input.playerRight ?? 0) + 150 - this.headW / 2;
    return Math.min(this.restX, Math.max(120, target));
  }

  _updateTracking(dt, input) {
    const lerp = Math.min(1, dt * TRACK_LERP);

    // X: aproxima durante vulnerabilidade e durante a investida (out/hold);
    // nos demais estados, fica no repouso.
    let targetX = this.restX;
    if (this.state === STATE.VULNERABLE) targetX = this._approachTargetX(input);
    else if (this.state === STATE.TELEGRAPH && this.currentAttack === 'investida') targetX = this.restX + 24; // recuo do telegraph
    else if (this.state === STATE.ATTACK && this.currentAttack === 'investida') {
      if (this._investidaPhase === 'out' || this._investidaPhase === 'hold') targetX = this._approachTargetX(input) - 40;
    }
    this.x += (targetX - this.x) * lerp;

    // Y: reage ao pulo do jogador (sobe um pouco) e desce durante a
    // investida, a vulnerabilidade e o Sopro Mágico — nos três casos a
    // cabeça precisa descer até uma faixa baixa (alcance do martelo, ou a
    // altura do próprio laser), senão fica visualmente desconectada do que
    // está acontecendo ali embaixo.
    let targetY = this.baseY + (input.playerJumping ? JUMP_REACT_OFFSET : 0);
    const investidaClose = this.state === STATE.ATTACK && this.currentAttack === 'investida' && (this._investidaPhase === 'out' || this._investidaPhase === 'hold');
    // já baixa no TELEGRAPH (mira) e continua baixa durante o ATTACK
    // (disparo) — assim a boca já está na altura certa quando o 1º laser
    // sai, em vez de só alcançar lá depois de vários disparos.
    const orbeLow = this.currentAttack === 'orbe' && (this.state === STATE.TELEGRAPH || this.state === STATE.ATTACK);
    if (this.state === STATE.VULNERABLE || investidaClose) {
      targetY = this.groundY - 90;
    } else if (orbeLow) {
      targetY = this.groundY - ORB_LASER_H / 2; // centro do retângulo do laser — a boca "encosta" na faixa onde ele nasce
    }
    this.y += (targetY - this.y) * lerp;
  }

  // ---- Estados -------------------------------------------------------
  _enterState(state) {
    this.state = state;
    this.stateT = 0;
  }

  _tickIdle(dt) {
    if (this.stateT < this.idleTarget) return;
    this.currentAttack = this._pickNextAttack();
    this._enterState(STATE.TELEGRAPH);
  }

  _pickNextAttack() {
    let choice = this._lastAttack;
    for (let tries = 0; tries < 6 && choice === this._lastAttack; tries++) {
      choice = ATTACK_POOL[Math.floor(Math.random() * ATTACK_POOL.length)];
    }
    this._lastAttack = choice;
    return choice;
  }

  _tickTelegraph(dt) {
    const cfg = ATTACK_CONFIG[this.currentAttack];
    if (this.stateT < cfg.telegraph) return;
    this._enterState(STATE.ATTACK);
    this._startAttack(this.currentAttack);
  }

  _startAttack(kind) {
    this._attackDurationOverride = null; // só o Sopro Mágico define um (depende de quantos lasers saíram, ver _startAttackOrbe)
    if (kind === 'petalas') this._startAttackPetalas();
    else if (kind === 'orbe') this._startAttackOrbe();
    else if (kind === 'rugido') this._startAttackRugido();
    else if (kind === 'investida') this._startAttackInvestida();
  }

  // Processa a fila de spawns escalonados (rajada de pétalas, sequência de
  // lasers) — roda todo frame independente do estado atual. Não pode viver
  // só dentro de _tickAttack: se a duração do estado ATTACK for mais curta
  // que o tempo total da sequência (ex.: 3 lasers espaçados), o motor sairia
  // de ATTACK antes do 2º/3º disparo e eles nunca aconteceriam.
  _updatePendingSpawns(dt) {
    for (let i = this._pendingSpawns.length - 1; i >= 0; i--) {
      const item = this._pendingSpawns[i];
      item.t -= dt;
      if (item.t <= 0) { item.fn(); this._pendingSpawns.splice(i, 1); }
    }
  }

  _tickAttack(dt, input) {
    if (this.currentAttack === 'investida') { this._tickAttackInvestida(dt, input); return; }

    const duration = this._attackDurationOverride ?? ATTACK_CONFIG[this.currentAttack].duration;
    if (this.stateT >= duration) this._finishAttack();
  }

  _finishAttack() {
    this._attacksSinceVulnerable++;
    if (this._attacksSinceVulnerable >= ATTACKS_PER_VULNERABLE_CYCLE) {
      this._attacksSinceVulnerable = 0;
      this._enterState(STATE.VULNERABLE);
    } else {
      this.idleTarget = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
      this._enterState(STATE.IDLE);
    }
  }

  _tickVulnerable(dt) {
    if (this.stateT >= VULNERABLE_DURATION) {
      this.idleTarget = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
      this._enterState(STATE.IDLE);
    }
  }

  _tickHurt(dt) {
    if (this.stateT >= HURT_DURATION) {
      this.idleTarget = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
      this._enterState(STATE.IDLE);
    }
  }

  _tickDefeated(dt) {
    const frac = Math.min(1, this.stateT / DEFEAT_DURATION);
    this.defeatFallY = frac * frac * 140; // acelera pra baixo, tipo queda
    this.defeatAlpha = Math.max(0, 1 - frac * 1.15);
  }

  isDefeatSequenceDone() {
    return this.state === STATE.DEFEATED && this.stateT >= DEFEAT_DURATION;
  }

  // ---- Ataque: Sopro de Pétalas (rajada baixa/média — exige pular) ------
  _startAttackPetalas() {
    const cfg = ATTACK_CONFIG.petalas;
    for (let i = 0; i < cfg.burstCount; i++) {
      this._pendingSpawns.push({
        t: i * cfg.burstGap,
        fn: () => {
          const y = this.groundY - 40 + (Math.random() * 16 - 8);
          // maior que antes (era 14x14) — só assim dá pra ver o orbe girando de verdade
          this._addHazard({ x: this.x - this.headW / 2, y, w: 30, h: 30, vx: -cfg.speed, vy: 0, ttl: 2.5, destructible: true, kind: 'petala', animT: Math.random() * 0.5 });
        },
      });
    }
  }

  // ---- Ataque: Sopro Mágico (rajada de 1 a 3 lasers rasteiros, puláveis) --
  // Cada disparo é um laser reto e rápido — quando saem 2 ou 3, viram uma
  // sequência tipo "cavaletes": pular, aterrissar a tempo, pular de novo.
  _startAttackOrbe() {
    const cfg = ATTACK_CONFIG.orbe;
    const count = 1 + Math.floor(Math.random() * 3); // 1, 2 ou 3 lasers
    // Bem maior que antes — proporcional à boca do dragão (headW=150), não
    // uma bolinha perdida do lado da cabeça.
    const w = ORB_LASER_W, h = ORB_LASER_H;
    const floorY = this.groundY - h; // faixa "pulável" onde o laser precisa terminar
    for (let i = 0; i < count; i++) {
      this._pendingSpawns.push({
        t: ORB_LASER_WINDUP + i * ORB_LASER_GAP,
        fn: () => {
          // Nasce ALINHADO com a boca — na posição vertical real da cabeça
          // nesse instante (this.y), não numa altura fixa perto do chão.
          // Sem isso o laser "aparecia" rasteiro enquanto a animação da
          // cabeça continuava no centro da tela, sem nenhuma ligação visual
          // entre as duas coisas. Ele desce (vy) da boca até a faixa
          // rasteira e, uma vez lá, o teto (maxY) trava a queda — vira uma
          // espécie de mergulho curto em vez de nascer teleportado embaixo.
          const y = this.y - h / 2;
          this._addHazard({ x: this.x - this.headW / 2, y, w, h, vx: -cfg.speed, vy: ORB_LASER_DIVE_SPEED, maxY: floorY, ttl: 2.5, destructible: true, kind: 'orbe' });
        },
      });
    }
    // a cabeça só volta a IDLE depois do ÚLTIMO laser da rajada ter saído —
    // sem isso, com 2-3 lasers, o estado ATTACK acabaria antes do 2º/3º disparo.
    this._attackDurationOverride = ORB_LASER_WINDUP + (count - 1) * ORB_LASER_GAP + 0.25;
  }

  // ---- Ataque: Rugido (onda de vento alta — exige agachar) --------------
  // Geometria da onda — método próprio pra que o aviso piscando durante o
  // TELEGRAPH e o hazard real do ATTACK usem exatamente o mesmo retângulo
  // (senão o aviso mentiria sobre onde o golpe de fato vai bater).
  // Banda alta: cruza o jogador em pé (standH=62, topo em groundY-62) mas
  // fica acima do topo agachado (crouchH~37, topo em groundY-37) — só
  // agachar (ou já estar agachado) escapa; pular não ajuda.
  _rugidoRect() {
    return { x: 0, y: this.groundY - 110, w: this.restX, h: 70 };
  }

  _startAttackRugido() {
    this._addHazard({ ...this._rugidoRect(), vx: 0, vy: 0, ttl: ATTACK_CONFIG.rugido.duration, destructible: false, kind: 'rugido' });
  }

  // ---- Ataque: Investida (recuo + avanço físico) ------------------------
  _startAttackInvestida() {
    this._investidaPhase = 'out';
    this._investidaHazardActive = true;
  }

  _tickAttackInvestida(dt) {
    const cfg = ATTACK_CONFIG.investida;
    const tOut = cfg.dashOut, tHold = tOut + cfg.hold, tBack = tHold + cfg.dashBack;
    if (this._investidaPhase === 'out' && this.stateT >= tOut) this._investidaPhase = 'hold';
    else if (this._investidaPhase === 'hold' && this.stateT >= tHold) this._investidaPhase = 'back';
    else if (this._investidaPhase === 'back' && this.stateT >= tBack) {
      this._investidaPhase = null;
      this._investidaHazardActive = false;
      // investida sempre força uma janela de vulnerabilidade logo em seguida
      this._attacksSinceVulnerable = 0;
      this._enterState(STATE.VULNERABLE);
    }
  }

  // ---- Hazards genéricos (pétalas/esfera/rugido) -------------------------
  _addHazard(opts) {
    this.hazards.push({ id: nextHazardId++, ...opts });
  }

  _updateHazards(dt) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.animT = (h.animT || 0) + dt; // relógio próprio de cada hazard — usado pela animação da pétala (ver _drawHazards)
      h.x += (h.vx || 0) * dt;
      h.y += (h.vy || 0) * dt;
      // teto opcional (ex.: laser do Sopro Mágico mergulhando da boca até a
      // faixa rasteira) — trava a queda ao chegar lá, não deixa continuar afundando
      if (h.maxY !== undefined && h.y > h.maxY) h.y = h.maxY;
      h.ttl -= dt;
      if (h.ttl <= 0 || h.x + h.w < -30 || h.x > this.canvasW + 30) this.hazards.splice(i, 1);
    }
  }

  // ---- Interação com o Martelo (chamado por engine.js) -------------------
  // Retângulo do corpo/cabeça do chefe — só "existe" pra fins de dano
  // quando está com a guarda aberta (VULNERABLE) ou no meio da investida.
  _headRect() {
    return { x: this.x - this.headW / 2, y: this.y - this.headH / 2, w: this.headW, h: this.headH };
  }

  // Hitbox que o martelo pode ferir de fato — null fora da janela de fadiga.
  getVulnerableHitbox() {
    return this.state === STATE.VULNERABLE ? this._headRect() : null;
  }

  // Todos os hazards ativos (pétalas/esfera/rugido), pra varredura genérica
  // do martelo (destrói) e pra checagem de dano no jogador.
  getHazards() {
    return this.hazards;
  }

  // Todo retângulo capaz de ferir o JOGADOR agora — hazards + a cabeça
  // durante a investida (fora da investida, a cabeça não machuca por
  // toque; só é perigosa durante o avanço físico).
  getDamageHazards() {
    const list = this.hazards.map(h => ({ x: h.x, y: h.y, w: h.w, h: h.h }));
    if (this._investidaHazardActive) list.push(this._headRect());
    return list;
  }

  // engine.js chama isso quando o martelo acerta um hazard destrutível.
  destroyHazard(id) {
    const idx = this.hazards.findIndex(h => h.id === id);
    if (idx === -1) return false;
    this.hazards.splice(idx, 1);
    this.flinchT = 0.25;
    this.recoilX = Math.max(this.recoilX, 10);
    return true;
  }

  // engine.js chama isso quando o martelo acerta a hitbox vulnerável.
  // Retorna true se o golpe realmente conectou (fora da janela, não conta).
  takeHit() {
    if (this.state !== STATE.VULNERABLE) return false;
    this.hp = Math.max(0, this.hp - 1);
    this.recoilX = 26;
    this.hazards.length = 0; // limpa qualquer hazard pendente por segurança
    if (this.hp <= 0) this._enterState(STATE.DEFEATED);
    else this._enterState(STATE.HURT);
    return true;
  }

  // ---- Desenho -------------------------------------------------------
  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.defeatAlpha;
    const cx = this.x - this.recoilX + (this.state === STATE.HURT ? (Math.random() * 6 - 3) : 0);
    const cy = this.y + this.defeatFallY;

    this._drawClouds(ctx, cx, cy);
    this._drawBody(ctx, cx, cy);
    this._drawHead(ctx, cx, cy); // desenhada por cima do corpo de propósito — esconde a junção do pescoço
    this._drawTelegraph(ctx);
    this._drawHazards(ctx);
    ctx.restore();
  }

  // Aviso piscando durante o TELEGRAPH do rugido — desenhado na posição
  // EXATA onde o golpe real vai aparecer (mesmo retângulo de _rugidoRect()),
  // pra dar um alvo visual claro de "agache aqui" antes do golpe "oficial"
  // (o hazard de verdade, sólido) nascer.
  _drawTelegraph(ctx) {
    if (this.state !== STATE.TELEGRAPH || this.currentAttack !== 'rugido') return;
    const blinkOn = Math.floor(this.stateT * 8) % 2 === 0; // ~4 piscadas por segundo
    if (!blinkOn) return;
    const r = this._rugidoRect();
    ctx.save();
    ctx.fillStyle = 'rgba(255,99,146,.45)';
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  _drawClouds(ctx, cx, cy) {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    const puffs = [[cx + 60, cy + 46, 22], [cx + 92, cy + 60, 16], [cx + 40, cy + 70, 14]];
    for (const [px, py, r] of puffs) {
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Corpo/cauda: dragao_corpo (ladrilhado, repetindo) + dragao_cauda (uma
  // vez, na ponta) DOBRADOS de verdade em cima da bezier — troca o
  // retângulo roxo antigo.
  //
  // Versões anteriores giravam cópias INTEIRAS de dragao_corpo (que já vem
  // com uma curva em "S" própria desenhada nele, não é uma faixa reta de
  // escamas) pra seguir a tangente local. Isso sempre deixava costura: cada
  // cópia carrega sua própria curva fixa nos pixels, então girar a cópia
  // inteira faz a curva DELA brigar com a curva DO CAMINHO — e a briga fica
  // mais visível quanto mais o caminho estica/muda de ângulo (a queixa
  // "esquisito quando estica").
  //
  // A correção de verdade é dobrar o DESENHO em si, não a peça inteira:
  // fatiamos a imagem em tiras verticais bem finas (BODY_STRIP_SRC_W) e
  // desenhamos cada tirana sua própria posição/ângulo ao longo da curva —
  // a técnica padrão de "bend sprite along a path". Andando em distância
  // real percorrida (arco), não em t, pra o ladrilhamento de dragao_corpo
  // não esticar/comprimir conforme a curva muda de forma.
  _drawBody(ctx, cx, cy) {
    const corpoImg = this.images.dragao_corpo;
    if (!corpoImg || !corpoImg.complete || !corpoImg.naturalWidth) return;

    const p0 = { x: cx + this.headW * 0.42, y: cy + this.headH * 0.12 };
    const p2 = { x: this.canvasW + BODY_ANCHOR_OFFSET.x, y: BODY_ANCHOR_OFFSET.y };
    const headDeviation = this.y - this.baseY; // negativo = cabeça subiu, positivo = desceu
    const p1 = {
      x: (p0.x + p2.x) / 2 + 10,
      y: (p0.y + p2.y) / 2 + 30 + headDeviation * 0.55,
    };
    const bezierAt = t => {
      const mt = 1 - t;
      return {
        x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
        y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
      };
    };
    const tangentAngleAt = t => {
      const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
      const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
      return Math.atan2(dy, dx);
    };

    // Comprimento real da curva, por amostragem — precisamos disso pra
    // andar em distância (arco) constante, não em t (que anda mais rápido
    // ou mais devagar dependendo de onde a curva está mais "esticada").
    const SAMPLES = 40;
    const sampleT = [0], sampleLen = [0];
    let prev = bezierAt(0), totalLen = 0;
    for (let i = 1; i <= SAMPLES; i++) {
      const t = i / SAMPLES;
      const p = bezierAt(t);
      totalLen += Math.hypot(p.x - prev.x, p.y - prev.y);
      sampleT.push(t);
      sampleLen.push(totalLen);
      prev = p;
    }
    // Converte distância percorrida (0..totalLen) de volta pra t, interpolando
    // linearmente entre as duas amostras mais próximas.
    const tAtLen = s => {
      if (s <= 0) return 0;
      if (s >= totalLen) return 1;
      for (let i = 1; i <= SAMPLES; i++) {
        if (sampleLen[i] >= s) {
          const span = sampleLen[i] - sampleLen[i - 1] || 1;
          return sampleT[i - 1] + (s - sampleLen[i - 1]) / span * (sampleT[i] - sampleT[i - 1]);
        }
      }
      return 1;
    };

    const corpoSrcH = Math.min(BODY_SRC_H, corpoImg.naturalHeight - BODY_SRC_Y);
    const corpoScale = BODY_THICKNESS / corpoSrcH;

    const caudaImg = this.images.dragao_cauda;
    const caudaThickness = BODY_THICKNESS * 1.15;
    let caudaLen = 0;
    if (caudaImg && caudaImg.complete && caudaImg.naturalWidth) {
      const caudaSrcH = Math.min(BODY_SRC_H, caudaImg.naturalHeight - BODY_SRC_Y);
      caudaLen = caudaImg.naturalWidth * (caudaThickness / caudaSrcH);
    }
    const corpoEndLen = Math.max(0, totalLen - caudaLen);

    // dragao_corpo ladrilhado (repetindo o padrão de escamas) do ponto
    // junto à cabeça até onde a cauda assume, na ponta.
    const stripScreenW = BODY_STRIP_SRC_W * corpoScale;
    for (let s = 0; s < corpoEndLen; s += stripScreenW) {
      const srcX = (s / corpoScale) % corpoImg.naturalWidth;
      this._drawBentStrip(ctx, corpoImg, srcX, corpoSrcH, tAtLen(s), bezierAt, tangentAngleAt, stripScreenW, BODY_THICKNESS);
    }

    // dragao_cauda: flourish final, sem repetir — cobre exatamente o
    // trecho final (corpoEndLen..totalLen) uma única vez.
    if (caudaLen > 0) {
      const caudaSrcH = Math.min(BODY_SRC_H, caudaImg.naturalHeight - BODY_SRC_Y);
      const caudaScale = caudaThickness / caudaSrcH;
      const stripScreenW2 = BODY_STRIP_SRC_W * caudaScale;
      for (let srcX = 0; srcX < caudaImg.naturalWidth; srcX += BODY_STRIP_SRC_W) {
        const s = corpoEndLen + srcX * caudaScale;
        this._drawBentStrip(ctx, caudaImg, srcX, caudaSrcH, tAtLen(s), bezierAt, tangentAngleAt, stripScreenW2, caudaThickness);
      }
    }
  }

  // Desenha UMA tira fina (BODY_STRIP_SRC_W px de largura na fonte, a partir
  // de srcX) na posição/ângulo do ponto `t` da curva — as tiras se
  // sobrepõem levemente (screenW * 1.6) só pra não sobrar nenhuma frestinha
  // entre elas por causa do arredondamento/rotação, sem deixar a tira
  // visivelmente mais grossa que o resto.
  _drawBentStrip(ctx, img, srcX, srcH, t, bezierAt, tangentAngleAt, screenW, thickness) {
    const p = bezierAt(t);
    const angle = tangentAngleAt(t);
    const w = Math.min(BODY_STRIP_SRC_W, img.naturalWidth - srcX);
    if (w <= 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);
    ctx.drawImage(img, srcX, BODY_SRC_Y, w, srcH, 0, -thickness / 2, screenW * 1.6, thickness);
    ctx.restore();
  }

  // Escolhe o frame (chave em `this.images`) pra animação do estado/ataque
  // atual. Cada grupo de frames corresponde a uma das ações rotuladas no
  // sheet original (ver comentário acima de IDLE_FRAMES).
  _currentFrameKey() {
    switch (this.state) {
      case STATE.IDLE:
        return IDLE_FRAMES[Math.floor(this.stateT * IDLE_FPS) % IDLE_FRAMES.length];

      case STATE.TELEGRAPH: {
        const cfg = ATTACK_CONFIG[this.currentAttack];
        const idx = Math.min(LOOK_FRAMES.length - 1, Math.floor((this.stateT / cfg.telegraph) * LOOK_FRAMES.length));
        return LOOK_FRAMES[idx];
      }

      case STATE.ATTACK: {
        if (this.currentAttack === 'orbe') {
          // Uma animação de "soltar o poder" COMPLETA por laser, não uma só
          // esticada pra rajada inteira — reinicia o ciclo (boca abrindo ->
          // disparando) a cada ORB_LASER_GAP, alinhado ao instante em que
          // cada laser realmente nasce (ver _startAttackOrbe). Com 3 lasers,
          // são 3 ciclos completos em sequência.
          const frames = ATTACK_FRAMES.orbe;
          const localT = this.stateT % ORB_LASER_GAP;
          return localT < ORB_LASER_WINDUP ? frames[0] : frames[frames.length - 1];
        }

        const frames = ATTACK_FRAMES[this.currentAttack];
        let duration;
        if (this.currentAttack === 'investida') {
          const cfg = ATTACK_CONFIG.investida;
          duration = cfg.dashOut + cfg.hold + cfg.dashBack;
        } else {
          duration = this._attackDurationOverride ?? ATTACK_CONFIG[this.currentAttack].duration;
        }
        const idx = Math.min(frames.length - 1, Math.floor((this.stateT / duration) * frames.length));
        return frames[idx];
      }

      case STATE.VULNERABLE:
        return LOOK_FRAMES[Math.floor(this.stateT * LOOK_FPS) % LOOK_FRAMES.length];

      case STATE.HURT:
        return HURT_FRAME;

      case STATE.DEFEATED: {
        const idx = Math.min(DEATH_FRAMES.length - 1, Math.floor((this.stateT / DEFEAT_DURATION) * DEATH_FRAMES.length));
        return DEATH_FRAMES[idx];
      }

      default:
        return IDLE_FRAMES[0];
    }
  }

  _drawHead(ctx, cx, cy) {
    const key = this._currentFrameKey();
    const img = this.images[key];
    if (!img || !img.complete || !img.naturalWidth) return; // ainda carregando — pula o frame

    const targetW = IDLE_FRAMES.includes(key) ? DISPLAY_W_IDLE : DISPLAY_W;
    const scale = targetW / img.naturalWidth;
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;

    if (FLIP_H_FRAMES.has(key)) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    }
  }

  // Animação do orbe de energia (5 frames, poderes/orbe-*.png) — usada tanto
  // pela pétala quanto pelo Sopro Mágico (mesma arte, tamanhos diferentes:
  // cada hazard já carrega seu w/h, ORB_LASER_W/H pro laser e o tamanho
  // fixo da pétala). Cada hazard mantém seu próprio relógio (h.animT), então
  // vários na tela ao mesmo tempo não ficam sincronizados.
  _drawPetalFrame(ctx, h) {
    const frameIdx = Math.floor(h.animT * PETAL_FPS) % PETAL_FRAMES.length;
    const img = this.images[PETAL_FRAMES[frameIdx]];
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, h.x, h.y, h.w, h.h);
      return;
    }
    // ainda carregando — placeholder só até o sprite chegar
    ctx.fillStyle = '#f490b2';
    ctx.strokeStyle = '#7d2f5b'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(h.x + h.w / 2, h.y + h.h / 2, h.w / 2, h.h / 2, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  _drawHazards(ctx) {
    for (const h of this.hazards) {
      if (h.kind === 'rugido') {
        // Sem sprite dedicado de "onda de vento" — reaproveita o mesmo raio
        // do Sopro Mágico (ORB_BEAM_FRAME), ladrilhado ao longo da faixa
        // inteira, recortado no retângulo do hazard. Continua bem mais
        // sólido/contrastado que o aviso piscando do telegraph, pra ficar
        // claro que virou perigo real.
        const img = this.images[ORB_BEAM_FRAME];
        if (img && img.complete && img.naturalWidth) {
          const srcH = Math.min(ORB_BEAM_SRC_H, img.naturalHeight - ORB_BEAM_SRC_Y);
          ctx.save();
          ctx.beginPath();
          ctx.rect(h.x, h.y, h.w, h.h);
          ctx.clip();
          ctx.globalAlpha = 0.8;
          const tileH = h.h;
          const tileW = tileH * (img.naturalWidth / srcH); // proporção do RECORTE (sem a folga vazia no topo), não da imagem inteira
          for (let tx = h.x; tx < h.x + h.w; tx += tileW * 0.82) {
            ctx.drawImage(img, 0, ORB_BEAM_SRC_Y, img.naturalWidth, srcH, tx, h.y, tileW, tileH);
          }
          ctx.restore();
          ctx.strokeStyle = 'rgba(255,255,255,.85)';
          ctx.lineWidth = 3;
          ctx.strokeRect(h.x, h.y, h.w, h.h);
          continue;
        }
        // ainda carregando — placeholder só até o sprite chegar
        ctx.fillStyle = 'rgba(178,110,225,.62)';
        ctx.strokeStyle = 'rgba(255,255,255,.85)';
        ctx.lineWidth = 3;
        ctx.fillRect(h.x, h.y, h.w, h.h);
        ctx.strokeRect(h.x, h.y, h.w, h.h);
        continue;
      }
      // orbe (Sopro Mágico) e petala usam a mesma animação de orbe de
      // energia — só o tamanho do hazard muda (ORB_LASER_W/H pro laser,
      // fixo e menor pra pétala).
      this._drawPetalFrame(ctx, h);
    }
  }
}

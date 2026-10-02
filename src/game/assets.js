import fundoMenu from '../assets/ui/fundo_menu.png';
import ceu from '../assets/cenario/ceu.png';
import montanhas from '../assets/cenario/montanhas.png';
import arvoreRosaGrande from '../assets/cenario/arvore_rosa_grande.png';
import arvoreRosaPequena from '../assets/cenario/arvore_rosa_pequena.png';
import arvoreConifera from '../assets/cenario/arvore_conifera.png';
import arbusto from '../assets/cenario/arbusto.png';
import nuvem1 from '../assets/cenario/nuvem_1.png';
import nuvem2 from '../assets/cenario/nuvem_2.png';
import nuvem3 from '../assets/cenario/nuvem_3.png';
import bandeira from '../assets/cenario/bandeira.png';
import chao from '../assets/cenario/chao.png';
import ponteSegura from '../assets/cenario/ponte_segura.png';

import pedra from '../assets/obstaculos/pedra.png';
import cogumelo from '../assets/obstaculos/cogumelo.png';
import espinho from '../assets/obstaculos/espinho.png';
import galho from '../assets/obstaculos/galho.png';
import galho2 from '../assets/obstaculos/galho_2.png';
import cachoeira from '../assets/obstaculos/cachoeia_obstaculos.png';
import ponteQuebrada from '../assets/obstaculos/ponte_qyebrada.png';

import sapoChao from '../assets/obstaculos/inimigos/sapo-1.png';
import sapoPulando from '../assets/obstaculos/inimigos/sapo-2-pulando.png';
import sapoTopo from '../assets/obstaculos/inimigos/sapo-3-topo.png';
import sapoQueda from '../assets/obstaculos/inimigos/sapo-4-queda.png';

import fantasma1 from '../assets/obstaculos/inimigos/fantasma-1.png';
import fantasma2 from '../assets/obstaculos/inimigos/fantasma-2.png';
import fantasma3 from '../assets/obstaculos/inimigos/fantasma-3.png';
import fantasma4 from '../assets/obstaculos/inimigos/fantasma-4.png';

// Chefe da Fase 6 (CloudDragonBoss, ver boss.js) — sprites recortados do
// sheet "BOSS spriteSheet.png" (ver src/assets/obstaculos/inimigos/dragao/).
import dragaoIdle from '../assets/obstaculos/inimigos/dragao/dragao_idle.png';
import dragaoMov0 from '../assets/obstaculos/inimigos/dragao/dragao_mov_0.png';
import dragaoMov1 from '../assets/obstaculos/inimigos/dragao/dragao_mov_1.png';
import dragaoMov2 from '../assets/obstaculos/inimigos/dragao/dragao_mov_2.png';
import dragaoMov3 from '../assets/obstaculos/inimigos/dragao/dragao_mov_3.png';
import dragaoMov4 from '../assets/obstaculos/inimigos/dragao/dragao_mov_4.png';
import dragaoAtk1_0 from '../assets/obstaculos/inimigos/dragao/dragao_atk1_0.png';
import dragaoAtk1_1 from '../assets/obstaculos/inimigos/dragao/dragao_atk1_1.png';
import dragaoAtk1_2 from '../assets/obstaculos/inimigos/dragao/dragao_atk1_2.png';
import dragaoAtk1_3 from '../assets/obstaculos/inimigos/dragao/dragao_atk1_3.png';
import dragaoAtk1_4 from '../assets/obstaculos/inimigos/dragao/dragao_atk1_4.png';
import dragaoAtk1_5 from '../assets/obstaculos/inimigos/dragao/dragao_atk1_5.png';
import dragaoAtk2_0 from '../assets/obstaculos/inimigos/dragao/dragao_atk2_0.png';
import dragaoAtk2_1 from '../assets/obstaculos/inimigos/dragao/dragao_atk2_1.png';
import dragaoAtk2_2 from '../assets/obstaculos/inimigos/dragao/dragao_atk2_2.png';
import dragaoAtk2_3 from '../assets/obstaculos/inimigos/dragao/dragao_atk2_3.png';
import dragaoAtk2_4 from '../assets/obstaculos/inimigos/dragao/dragao_atk2_4.png';
import dragaoAtk3_0 from '../assets/obstaculos/inimigos/dragao/dragao_atk3_0.png';
import dragaoAtk3_1 from '../assets/obstaculos/inimigos/dragao/dragao_atk3_1.png';
import dragaoAtk3_2 from '../assets/obstaculos/inimigos/dragao/dragao_atk3_2.png';
import dragaoAtk3_3 from '../assets/obstaculos/inimigos/dragao/dragao_atk3_3.png';
import dragaoAtk3_4 from '../assets/obstaculos/inimigos/dragao/dragao_atk3_4.png';
import dragaoAtk4_0 from '../assets/obstaculos/inimigos/dragao/dragao_atk4_0.png';
import dragaoAtk4_1 from '../assets/obstaculos/inimigos/dragao/dragao_atk4_1.png';
import dragaoAtk4_2 from '../assets/obstaculos/inimigos/dragao/dragao_atk4_2.png';
import dragaoAtk4_3 from '../assets/obstaculos/inimigos/dragao/dragao_atk4_3.png';
import dragaoAtk4_4 from '../assets/obstaculos/inimigos/dragao/dragao_atk4_4.png';
import dragaoOlhar0 from '../assets/obstaculos/inimigos/dragao/dragao_olhar_0.png';
import dragaoOlhar1 from '../assets/obstaculos/inimigos/dragao/dragao_olhar_1.png';
import dragaoOlhar2 from '../assets/obstaculos/inimigos/dragao/dragao_olhar_2.png';
import dragaoOlhar3 from '../assets/obstaculos/inimigos/dragao/dragao_olhar_3.png';
import dragaoOlhar4 from '../assets/obstaculos/inimigos/dragao/dragao_olhar_4.png';
import dragaoDano from '../assets/obstaculos/inimigos/dragao/dragao_dano.png';
import dragaoMorte0 from '../assets/obstaculos/inimigos/dragao/dragao_morte_0.png';
import dragaoMorte1 from '../assets/obstaculos/inimigos/dragao/dragao_morte_1.png';
import dragaoMorte2 from '../assets/obstaculos/inimigos/dragao/dragao_morte_2.png';
import dragaoMorte3 from '../assets/obstaculos/inimigos/dragao/dragao_morte_3.png';
import dragaoMorte4 from '../assets/obstaculos/inimigos/dragao/dragao_morte_4.png';
// Corpo/cauda: tiles repetidos formando a "corda" que liga a cabeça até fora
// da tela (ver _drawBody() em boss.js) — corpo.png é o segmento genérico que
// se repete, Cauda.png é a peça final (afunilada) presa fora da tela.
import dragaoCorpo from '../assets/obstaculos/inimigos/dragao/corpo.png';
import dragaoCauda from '../assets/obstaculos/inimigos/dragao/Cauda.png';

// Animação do orbe de energia usada no Sopro de Pétalas — cada pétala
// disparada anima esse ciclo de 5 frames com seu próprio relógio (ver
// PETAL_FRAMES em boss.js), em vez de todas ficarem sincronizadas.
import dragaoPoderOrbe0 from '../assets/obstaculos/inimigos/dragao/poderes/orbe-0.png';
import dragaoPoderOrbe1 from '../assets/obstaculos/inimigos/dragao/poderes/orbe-1.png';
import dragaoPoderOrbe2 from '../assets/obstaculos/inimigos/dragao/poderes/orbe-2.png';
import dragaoPoderOrbe3 from '../assets/obstaculos/inimigos/dragao/poderes/orbe-3.png';
import dragaoPoderOrbe4 from '../assets/obstaculos/inimigos/dragao/poderes/orbe-4.png';

import correr0 from '../assets/jogador/correr_0.png';
import correr1 from '../assets/jogador/correr_1.png';
import correr2 from '../assets/jogador/correr_2.png';
import correr3 from '../assets/jogador/correr_3.png';
import correr4 from '../assets/jogador/correr_4.png';
import pular0 from '../assets/jogador/pular_0.png';
import pular1 from '../assets/jogador/pular_1.png';
import pular2 from '../assets/jogador/pular_2.png';
import cair0 from '../assets/jogador/cair_0.png';
import cair1 from '../assets/jogador/cair_1.png';
import cair2 from '../assets/jogador/cair_2.png';
import cair3 from '../assets/jogador/cair_3.png';
import aterrissar0 from '../assets/jogador/aterrissar_0.png';
import aterrissar1 from '../assets/jogador/aterrissar_1.png';
import aterrissar2 from '../assets/jogador/aterrissar_2.png';
import aterrissar3 from '../assets/jogador/aterrissar_3.png';

import martelo from '../assets/jogador/weapon/martelo.png';

// SFX placeholder (bipes sintéticos) — trocar pelos sons finais quando
// existirem, só substituindo os arquivos em src/assets/sfx/ e mantendo as
// mesmas chaves abaixo.
import sfxPlayerPulo from '../assets/sfx/player_pulo.wav';
import sfxUiClique from '../assets/sfx/ui_clique.wav';
import sfxVitoria from '../assets/sfx/sfx_vitoria.wav';
import sfxUiGirar from '../assets/sfx/ui_girar.wav';
import sfxPlayerAgachar from '../assets/sfx/player_agachar.wav';
import sfxPlayerLevantar from '../assets/sfx/player_levantar.wav';
import sfxPlayerAterrissar from '../assets/sfx/player_aterrissar.wav';
import sfxPlayerMorteImpacto from '../assets/sfx/player_morte_impacto.wav';
import sfxDerrota from '../assets/sfx/sfx_derrota.wav';
import sfxFantasmaAproximando from '../assets/sfx/fantasma_aproximando.wav';
import sfxPlayerMartelo from '../assets/sfx/player_martelo.wav';
import sfxObstaculoDestruido from '../assets/sfx/obstaculo_destruido.wav';

// Música de fundo (BGM) — toca em loop, canal de volume separado dos SFX.
// bgm_boss troca de lugar com bgm_fases só durante a Fase do Chefão (ver
// startLevel() em engine.js).
import bgmFases from '../assets/sfx/SOUDTRACK/1-LEVELS_SOUNDTRACK.mp3';
import bgmBoss from '../assets/sfx/SOUDTRACK/Boss_SoundTrack.mp3';

// Catalogo unico dos assets do jogo. As chaves casam 1:1 com o dicionario de
// imagens que o motor (game/engine.js) carrega em runtime.
export const assets = {
  fundo_menu: fundoMenu,
  ceu,
  montanhas,
  arvore_rosa_grande: arvoreRosaGrande,
  arvore_rosa_pequena: arvoreRosaPequena,
  arvore_conifera: arvoreConifera,
  arbusto,
  nuvem_1: nuvem1,
  nuvem_2: nuvem2,
  nuvem_3: nuvem3,
  nuvem_4: nuvem3,
  nuvem_5: nuvem3,
  bandeira,
  chao,
  ponte_segura: ponteSegura,

  pedra_grande: pedra,
  pedra_pequena: pedra,
  cogumelo,
  espinho,
  galho,
  galho_2: galho2,
  cachoeira,
  ponte_quebrada: ponteQuebrada,
  sapo_chao: sapoChao,
  sapo_pulando: sapoPulando,
  sapo_topo: sapoTopo,
  sapo_queda: sapoQueda,
  fantasma_1: fantasma1,
  fantasma_2: fantasma2,
  fantasma_3: fantasma3,
  fantasma_4: fantasma4,

  dragao_idle: dragaoIdle,
  dragao_mov_0: dragaoMov0,
  dragao_mov_1: dragaoMov1,
  dragao_mov_2: dragaoMov2,
  dragao_mov_3: dragaoMov3,
  dragao_mov_4: dragaoMov4,
  dragao_atk1_0: dragaoAtk1_0,
  dragao_atk1_1: dragaoAtk1_1,
  dragao_atk1_2: dragaoAtk1_2,
  dragao_atk1_3: dragaoAtk1_3,
  dragao_atk1_4: dragaoAtk1_4,
  dragao_atk1_5: dragaoAtk1_5,
  dragao_atk2_0: dragaoAtk2_0,
  dragao_atk2_1: dragaoAtk2_1,
  dragao_atk2_2: dragaoAtk2_2,
  dragao_atk2_3: dragaoAtk2_3,
  dragao_atk2_4: dragaoAtk2_4,
  dragao_atk3_0: dragaoAtk3_0,
  dragao_atk3_1: dragaoAtk3_1,
  dragao_atk3_2: dragaoAtk3_2,
  dragao_atk3_3: dragaoAtk3_3,
  dragao_atk3_4: dragaoAtk3_4,
  dragao_atk4_0: dragaoAtk4_0,
  dragao_atk4_1: dragaoAtk4_1,
  dragao_atk4_2: dragaoAtk4_2,
  dragao_atk4_3: dragaoAtk4_3,
  dragao_atk4_4: dragaoAtk4_4,
  dragao_olhar_0: dragaoOlhar0,
  dragao_olhar_1: dragaoOlhar1,
  dragao_olhar_2: dragaoOlhar2,
  dragao_olhar_3: dragaoOlhar3,
  dragao_olhar_4: dragaoOlhar4,
  dragao_dano: dragaoDano,
  dragao_morte_0: dragaoMorte0,
  dragao_morte_1: dragaoMorte1,
  dragao_morte_2: dragaoMorte2,
  dragao_morte_3: dragaoMorte3,
  dragao_morte_4: dragaoMorte4,
  dragao_corpo: dragaoCorpo,
  dragao_cauda: dragaoCauda,
  dragao_poder_orbe_0: dragaoPoderOrbe0,
  dragao_poder_orbe_1: dragaoPoderOrbe1,
  dragao_poder_orbe_2: dragaoPoderOrbe2,
  dragao_poder_orbe_3: dragaoPoderOrbe3,
  dragao_poder_orbe_4: dragaoPoderOrbe4,

  correr_0: correr0,
  correr_1: correr1,
  correr_2: correr2,
  correr_3: correr3,
  correr_4: correr4,
  pular_0: pular0,
  pular_1: pular1,
  pular_2: pular2,
  cair_0: cair0,
  cair_1: cair1,
  cair_2: cair2,
  cair_3: cair3,
  aterrissar_0: aterrissar0,
  aterrissar_1: aterrissar1,
  aterrissar_2: aterrissar2,
  aterrissar_3: aterrissar3,

  martelo,
};

// Catálogo dos efeitos sonoros (SFX). Só placeholders por enquanto — trocar
// pelos sons finais depois, mantendo as mesmas chaves. Consumido por
// audioManager.preload().
export const sfxAssets = {
  player_pulo: sfxPlayerPulo,
  ui_clique: sfxUiClique,
  sfx_vitoria: sfxVitoria,
  ui_girar: sfxUiGirar,
  player_agachar: sfxPlayerAgachar,
  player_levantar: sfxPlayerLevantar,
  player_aterrissar: sfxPlayerAterrissar,
  player_morte_impacto: sfxPlayerMorteImpacto,
  sfx_derrota: sfxDerrota,
  fantasma_aproximando: sfxFantasmaAproximando,
  player_martelo: sfxPlayerMartelo,
  obstaculo_destruido: sfxObstaculoDestruido,
};

// Catálogo da música de fundo (BGM) — canal separado dos SFX, tocada em loop
// via audioManager.playMusicWhenReady().
export const musicAssets = {
  bgm_fases: bgmFases,
  bgm_boss: bgmBoss,
};

import './style.css';
import './game/engine.js';

const gameCanvas = document.querySelector('#game');
const levelSelect = document.querySelector('#levelSelect');

if (!gameCanvas || !levelSelect) {
  throw new Error('A estrutura inicial do Potato Run nao foi encontrada.');
}

document.documentElement.dataset.app = 'potato-run-vite';

import { build as compound } from './compound.js?v=3';
import { build as foundry } from './foundry.js?v=3';
import { build as spire } from './spire.js?v=3';
import { build as catacomb } from './catacomb.js?v=3';

/**
 * Every hand-built arena, keyed by the `mapId` a scenario references.
 * Each builder is a pure function: it receives a kit (js/kit.js) and
 * describes the layout, returning { arena, spawn, enemies, pickups }.
 */
export const MAPS = {
  compound: { id: 'compound', name: 'Neon Compound', build: compound },
  foundry: { id: 'foundry', name: 'Slagworks Foundry', build: foundry },
  spire: { id: 'spire', name: 'Skyspire', build: spire },
  catacomb: { id: 'catacomb', name: 'Undercroft', build: catacomb },
};

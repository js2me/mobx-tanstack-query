import { ConfigsManager } from 'sborshik/utils';
import { defineLibVitestConfig } from 'sborshik/vite';

export default defineLibVitestConfig(ConfigsManager.create());

import { defineDocsBuildConfig } from 'sborshik/vitepress';
import { ConfigsManager } from 'sborshik/utils/configs-manager';

const configs = ConfigsManager.create('../')

export default defineDocsBuildConfig(configs); 

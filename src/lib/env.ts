import { resolveConfig, type EnvLike } from './config';

/** Active configuration, computed once from Vite env. The logic lives in config.ts (pure, tested). */
export const appConfig = resolveConfig(import.meta.env as EnvLike);

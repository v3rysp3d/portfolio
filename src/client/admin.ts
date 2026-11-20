/*
 * Admin entry — deliberately tiny. Admin pages get the nav toggle and
 * destructive-action confirms and nothing else: no animation libraries.
 */
import { initConfirms, initNav } from './motion/nav';

initNav();
initConfirms();

// The display name lives in one place, `productName` in src-tauri/tauri.conf.json; the bundle identifier sits next to
// it. Every UI string reaches the name through the `{app}` placeholder.
import tauriConfig from '../src-tauri/tauri.conf.json';

export const APP_NAME: string = tauriConfig.productName;

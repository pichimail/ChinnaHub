const pass = (v = {}) => v;
const noop = () => undefined;
const join = (...v) => v.filter(Boolean).join(' ');
const obj = {};
const api = {
  createTheme: pass,
  defineTheme: pass,
  createThemeContract: pass,
  createGlobalTheme: (...args) => args[args.length - 1] || {},
  createGlobalThemeContract: pass,
  style: join,
  styleVariants: pass,
  recipe: pass,
  keyframes: (v = {}) => JSON.stringify(v),
  globalStyle: noop,
  fontFace: noop,
  assignVars: (...args) => Object.assign({}, ...args.filter(Boolean)),
  fallbackVar: (...args) => args.find(Boolean) || '',
  createVar: () => `--chinna-var-${Math.random().toString(36).slice(2)}`,
  vars: obj,
  theme: obj,
  themes: obj,
  darkTheme: obj,
  lightTheme: obj,
  defaultTheme: obj,
  themeClass: '',
  darkThemeClass: '',
  lightThemeClass: '',
  colors: obj,
  color: obj,
  palette: obj,
  getColor: (...args) => args.find(Boolean) || '',
  getPalette: pass,
  hexToRgb: (v = '') => v,
  rgbToHex: (v = '') => v,
  alpha: (v = '') => v,
  darken: (v = '') => v,
  lighten: (v = '') => v,
  transparentize: (v = '') => v,
  readableColor: (v = '') => v
};
module.exports = api;
module.exports.default = api;

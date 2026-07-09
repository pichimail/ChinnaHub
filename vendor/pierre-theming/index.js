const pass = (v = {}) => v;
const noop = () => undefined;
const join = (...v) => v.filter(Boolean).join(' ');
const obj = {};

export const createTheme = pass;
export const defineTheme = pass;
export const createThemeContract = pass;
export const createGlobalTheme = (...args) => args[args.length - 1] || {};
export const createGlobalThemeContract = pass;
export const style = join;
export const styleVariants = pass;
export const recipe = pass;
export const keyframes = (v = {}) => JSON.stringify(v);
export const globalStyle = noop;
export const fontFace = noop;
export const assignVars = (...args) => Object.assign({}, ...args.filter(Boolean));
export const fallbackVar = (...args) => args.find(Boolean) || '';
export const createVar = () => `--chinna-var-${Math.random().toString(36).slice(2)}`;
export const vars = obj;

export const theme = obj;
export const themes = obj;
export const darkTheme = obj;
export const lightTheme = obj;
export const defaultTheme = obj;
export const themeClass = '';
export const darkThemeClass = '';
export const lightThemeClass = '';

export const colors = obj;
export const color = obj;
export const palette = obj;
export const getColor = (...args) => args.find(Boolean) || '';
export const getPalette = pass;
Color = (...args) => args.find(Boolean) || '';
export const getPalette = pass;
export const hexToRgb = (v = '') => v;
export const rgbToHex = (v = '') => v;
export const alpha = (v = '') => v;
export const darken = (v = '') => v;
export const lighten = (v = '') => v;
export const transparentize = (v = '') => v;
export const readableColor = (v = '') => v;

export default {
  createTheme, defineTheme, createThemeContract, createGlobalTheme,
  createGlobalThemeContract, style, styleVariants, recipe, keyframes,
  globalStyle, fontFace, assignVars, fallbackVar, createVar, vars,
  theme, themes, darkTheme, lightTheme, defaultTheme, themeClass,
  darkThemeClass, lightThemeClass, colors, color, palette, getColor,
  getPalette, hexToRgb, rgbToHex, alpha, darken, lighten,
  transparentize, readableColor
};

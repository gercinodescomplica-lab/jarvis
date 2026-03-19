/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/stream-shift";
exports.ids = ["vendor-chunks/stream-shift"];
exports.modules = {

/***/ "(rsc)/./node_modules/stream-shift/index.js":
/*!********************************************!*\
  !*** ./node_modules/stream-shift/index.js ***!
  \********************************************/
/***/ ((module) => {

eval("module.exports = shift\n\nfunction shift (stream) {\n  var rs = stream._readableState\n  if (!rs) return null\n  return (rs.objectMode || typeof stream._duplexState === 'number') ? stream.read() : stream.read(getStateLength(rs))\n}\n\nfunction getStateLength (state) {\n  if (state.buffer.length) {\n    var idx = state.bufferIndex || 0\n    // Since node 6.3.0 state.buffer is a BufferList not an array\n    if (state.buffer.head) {\n      return state.buffer.head.data.length\n    } else if (state.buffer.length - idx > 0 && state.buffer[idx]) {\n      return state.buffer[idx].length\n    }\n  }\n\n  return state.length\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvc3RyZWFtLXNoaWZ0L2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTs7QUFFQTtBQUNBIiwic291cmNlcyI6WyIvVXNlcnMvVXNlci9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvamFydmlzL25vZGVfbW9kdWxlcy9zdHJlYW0tc2hpZnQvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsibW9kdWxlLmV4cG9ydHMgPSBzaGlmdFxuXG5mdW5jdGlvbiBzaGlmdCAoc3RyZWFtKSB7XG4gIHZhciBycyA9IHN0cmVhbS5fcmVhZGFibGVTdGF0ZVxuICBpZiAoIXJzKSByZXR1cm4gbnVsbFxuICByZXR1cm4gKHJzLm9iamVjdE1vZGUgfHwgdHlwZW9mIHN0cmVhbS5fZHVwbGV4U3RhdGUgPT09ICdudW1iZXInKSA/IHN0cmVhbS5yZWFkKCkgOiBzdHJlYW0ucmVhZChnZXRTdGF0ZUxlbmd0aChycykpXG59XG5cbmZ1bmN0aW9uIGdldFN0YXRlTGVuZ3RoIChzdGF0ZSkge1xuICBpZiAoc3RhdGUuYnVmZmVyLmxlbmd0aCkge1xuICAgIHZhciBpZHggPSBzdGF0ZS5idWZmZXJJbmRleCB8fCAwXG4gICAgLy8gU2luY2Ugbm9kZSA2LjMuMCBzdGF0ZS5idWZmZXIgaXMgYSBCdWZmZXJMaXN0IG5vdCBhbiBhcnJheVxuICAgIGlmIChzdGF0ZS5idWZmZXIuaGVhZCkge1xuICAgICAgcmV0dXJuIHN0YXRlLmJ1ZmZlci5oZWFkLmRhdGEubGVuZ3RoXG4gICAgfSBlbHNlIGlmIChzdGF0ZS5idWZmZXIubGVuZ3RoIC0gaWR4ID4gMCAmJiBzdGF0ZS5idWZmZXJbaWR4XSkge1xuICAgICAgcmV0dXJuIHN0YXRlLmJ1ZmZlcltpZHhdLmxlbmd0aFxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBzdGF0ZS5sZW5ndGhcbn1cbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/stream-shift/index.js\n");

/***/ })

};
;
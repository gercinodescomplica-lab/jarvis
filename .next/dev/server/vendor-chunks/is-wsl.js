"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/is-wsl";
exports.ids = ["vendor-chunks/is-wsl"];
exports.modules = {

/***/ "(rsc)/./node_modules/is-wsl/index.js":
/*!**************************************!*\
  !*** ./node_modules/is-wsl/index.js ***!
  \**************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var node_process__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! node:process */ \"node:process\");\n/* harmony import */ var node_os__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! node:os */ \"node:os\");\n/* harmony import */ var node_fs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! node:fs */ \"node:fs\");\n/* harmony import */ var is_inside_container__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! is-inside-container */ \"(rsc)/./node_modules/is-inside-container/index.js\");\n\n\n\n\n\nconst isWsl = () => {\n\tif (node_process__WEBPACK_IMPORTED_MODULE_0__.platform !== 'linux') {\n\t\treturn false;\n\t}\n\n\tif (node_os__WEBPACK_IMPORTED_MODULE_1__.release().toLowerCase().includes('microsoft')) {\n\t\tif ((0,is_inside_container__WEBPACK_IMPORTED_MODULE_3__[\"default\"])()) {\n\t\t\treturn false;\n\t\t}\n\n\t\treturn true;\n\t}\n\n\ttry {\n\t\tif (node_fs__WEBPACK_IMPORTED_MODULE_2__.readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft')) {\n\t\t\treturn !(0,is_inside_container__WEBPACK_IMPORTED_MODULE_3__[\"default\"])();\n\t\t}\n\t} catch {}\n\n\t// Fallback for custom kernels: check WSL-specific paths.\n\tif (\n\t\tnode_fs__WEBPACK_IMPORTED_MODULE_2__.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')\n\t\t|| node_fs__WEBPACK_IMPORTED_MODULE_2__.existsSync('/run/WSL')\n\t) {\n\t\treturn !(0,is_inside_container__WEBPACK_IMPORTED_MODULE_3__[\"default\"])();\n\t}\n\n\treturn false;\n};\n\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (node_process__WEBPACK_IMPORTED_MODULE_0__.env.__IS_WSL_TEST__ ? isWsl : isWsl());\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvaXMtd3NsL2luZGV4LmpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQW1DO0FBQ1Y7QUFDQTtBQUMyQjs7QUFFcEQ7QUFDQSxLQUFLLGtEQUFnQjtBQUNyQjtBQUNBOztBQUVBLEtBQUssNENBQVU7QUFDZixNQUFNLCtEQUFpQjtBQUN2QjtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQSxNQUFNLGlEQUFlO0FBQ3JCLFdBQVcsK0RBQWlCO0FBQzVCO0FBQ0EsR0FBRzs7QUFFSDtBQUNBO0FBQ0EsRUFBRSwrQ0FBYTtBQUNmLEtBQUssK0NBQWE7QUFDbEI7QUFDQSxVQUFVLCtEQUFpQjtBQUMzQjs7QUFFQTtBQUNBOztBQUVBLGlFQUFlLDZDQUFXLGtDQUFrQyxFQUFDIiwic291cmNlcyI6WyIvVXNlcnMvVXNlci9Eb2N1bWVudHMvRGV2ZWxvcG1lbnQvamFydmlzL25vZGVfbW9kdWxlcy9pcy13c2wvaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHByb2Nlc3MgZnJvbSAnbm9kZTpwcm9jZXNzJztcbmltcG9ydCBvcyBmcm9tICdub2RlOm9zJztcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcbmltcG9ydCBpc0luc2lkZUNvbnRhaW5lciBmcm9tICdpcy1pbnNpZGUtY29udGFpbmVyJztcblxuY29uc3QgaXNXc2wgPSAoKSA9PiB7XG5cdGlmIChwcm9jZXNzLnBsYXRmb3JtICE9PSAnbGludXgnKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKG9zLnJlbGVhc2UoKS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKCdtaWNyb3NvZnQnKSkge1xuXHRcdGlmIChpc0luc2lkZUNvbnRhaW5lcigpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHR0cnkge1xuXHRcdGlmIChmcy5yZWFkRmlsZVN5bmMoJy9wcm9jL3ZlcnNpb24nLCAndXRmOCcpLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ21pY3Jvc29mdCcpKSB7XG5cdFx0XHRyZXR1cm4gIWlzSW5zaWRlQ29udGFpbmVyKCk7XG5cdFx0fVxuXHR9IGNhdGNoIHt9XG5cblx0Ly8gRmFsbGJhY2sgZm9yIGN1c3RvbSBrZXJuZWxzOiBjaGVjayBXU0wtc3BlY2lmaWMgcGF0aHMuXG5cdGlmIChcblx0XHRmcy5leGlzdHNTeW5jKCcvcHJvYy9zeXMvZnMvYmluZm10X21pc2MvV1NMSW50ZXJvcCcpXG5cdFx0fHwgZnMuZXhpc3RzU3luYygnL3J1bi9XU0wnKVxuXHQpIHtcblx0XHRyZXR1cm4gIWlzSW5zaWRlQ29udGFpbmVyKCk7XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59O1xuXG5leHBvcnQgZGVmYXVsdCBwcm9jZXNzLmVudi5fX0lTX1dTTF9URVNUX18gPyBpc1dzbCA6IGlzV3NsKCk7XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/is-wsl/index.js\n");

/***/ })

};
;
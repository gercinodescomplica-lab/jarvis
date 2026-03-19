"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/stubs";
exports.ids = ["vendor-chunks/stubs"];
exports.modules = {

/***/ "(rsc)/./node_modules/stubs/index.js":
/*!*************************************!*\
  !*** ./node_modules/stubs/index.js ***!
  \*************************************/
/***/ ((module) => {

eval("\n\nmodule.exports = function stubs(obj, method, cfg, stub) {\n  if (!obj || !method || !obj[method])\n    throw new Error('You must provide an object and a key for an existing method')\n\n  if (!stub) {\n    stub = cfg\n    cfg = {}\n  }\n\n  stub = stub || function() {}\n\n  cfg.callthrough = cfg.callthrough || false\n  cfg.calls = cfg.calls || 0\n\n  var norevert = cfg.calls === 0\n\n  var cached = obj[method].bind(obj)\n\n  obj[method] = function() {\n    var args = [].slice.call(arguments)\n    var returnVal\n\n    if (cfg.callthrough)\n      returnVal = cached.apply(obj, args)\n\n    returnVal = stub.apply(obj, args) || returnVal\n\n    if (!norevert && --cfg.calls === 0)\n      obj[method] = cached\n\n    return returnVal\n  }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvc3R1YnMvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQVk7O0FBRVo7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0EiLCJzb3VyY2VzIjpbIi9Vc2Vycy9Vc2VyL0RvY3VtZW50cy9EZXZlbG9wbWVudC9qYXJ2aXMvbm9kZV9tb2R1bGVzL3N0dWJzL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0J1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHN0dWJzKG9iaiwgbWV0aG9kLCBjZmcsIHN0dWIpIHtcbiAgaWYgKCFvYmogfHwgIW1ldGhvZCB8fCAhb2JqW21ldGhvZF0pXG4gICAgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBwcm92aWRlIGFuIG9iamVjdCBhbmQgYSBrZXkgZm9yIGFuIGV4aXN0aW5nIG1ldGhvZCcpXG5cbiAgaWYgKCFzdHViKSB7XG4gICAgc3R1YiA9IGNmZ1xuICAgIGNmZyA9IHt9XG4gIH1cblxuICBzdHViID0gc3R1YiB8fCBmdW5jdGlvbigpIHt9XG5cbiAgY2ZnLmNhbGx0aHJvdWdoID0gY2ZnLmNhbGx0aHJvdWdoIHx8IGZhbHNlXG4gIGNmZy5jYWxscyA9IGNmZy5jYWxscyB8fCAwXG5cbiAgdmFyIG5vcmV2ZXJ0ID0gY2ZnLmNhbGxzID09PSAwXG5cbiAgdmFyIGNhY2hlZCA9IG9ialttZXRob2RdLmJpbmQob2JqKVxuXG4gIG9ialttZXRob2RdID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIGFyZ3MgPSBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cylcbiAgICB2YXIgcmV0dXJuVmFsXG5cbiAgICBpZiAoY2ZnLmNhbGx0aHJvdWdoKVxuICAgICAgcmV0dXJuVmFsID0gY2FjaGVkLmFwcGx5KG9iaiwgYXJncylcblxuICAgIHJldHVyblZhbCA9IHN0dWIuYXBwbHkob2JqLCBhcmdzKSB8fCByZXR1cm5WYWxcblxuICAgIGlmICghbm9yZXZlcnQgJiYgLS1jZmcuY2FsbHMgPT09IDApXG4gICAgICBvYmpbbWV0aG9kXSA9IGNhY2hlZFxuXG4gICAgcmV0dXJuIHJldHVyblZhbFxuICB9XG59XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/stubs/index.js\n");

/***/ })

};
;
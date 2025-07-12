"use strict";
/**
 * Core data structures for call graph analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallGraphError = void 0;
class CallGraphError extends Error {
    constructor(message, code, file, line, column) {
        super(message);
        this.code = code;
        this.file = file;
        this.line = line;
        this.column = column;
        this.name = 'CallGraphError';
    }
}
exports.CallGraphError = CallGraphError;
//# sourceMappingURL=CallGraph.js.map
/**
 * @fileoverview Wraps source code information.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { Visitor } from "../visitors.js";

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const parents = Symbol("parents");

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Represents all static information about source code.
 */
export class SourceCode {

    /**
     * Creates a new instance.
     * @param {string} text The source code text.
     * @param {string} filePath The full path to the file containing the text.
     * @param {Node} ast The AST representing the source code.
     */
    constructor(text, filePath, ast) {
        
        /**
         * The source code text.
         * @property text
         * @type string
         */
        this.text = text;

        /**
         * The full path to the file containing the source code.
         * @property filePath
         * @type string
         */
        this.filePath = filePath;

        /**
         * The AST representation of the source code.
         * @property ast
         * @type Node
         */
        this.ast = ast;

        /**
         * Map of node parents.
         * @property parents
         * @type Map
         * @private
         */
        this[parents] = new Map();

        // initialize the parents map
        const parentMap = this[parents];
        const visitor = new Visitor();
        visitor.visit(ast, (node, parent) => {
            parentMap.set(node, parent);
        });
    }

    /**
     * Retrieves the parent of the given node.
     * @param {Node} node The node whose parent should be retrieved. 
     * @returns {Node} The parent of the given node or `undefined` if node is 
     *      the root.
     */
    getParent(node) {
        return this[parents].get(node);
    }
}

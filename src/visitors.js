/**
 * @fileoverview AST Visitors
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import estraverse from "estraverse";

//-----------------------------------------------------------------------------
// Symbols
//-----------------------------------------------------------------------------

const tasks = Symbol("tasks");

//-----------------------------------------------------------------------------
// Visitor
//-----------------------------------------------------------------------------

export class Visitor {
    constructor(visitorKeys) {
        this.visitorKeys = visitorKeys;
    }

    visit(ast, callback) {

        estraverse.traverse(ast, {
            enter: callback,
            keys: this.visitorKeys,
            fallback: "iteration"
        });
    }
}


//-----------------------------------------------------------------------------
// Task Visitor
//-----------------------------------------------------------------------------

export class TaskVisitor extends Visitor {
    constructor(visitorKeys) {
        super(visitorKeys);
        this[tasks] = [];
    }

    addTask(task) {
        this[tasks].push(task);
    }

    visit(ast, context) {

        const nodeTypes = new Map();

        // create visitors
        this[tasks].forEach(task => {
            const visitor = task(context);

            // store node-specific visitors in a map for easy lookup
            Object.keys(visitor).forEach(key => {
                if (!Array.isArray(nodeTypes.get(key))) {
                    nodeTypes.set(key, []);
                }

                nodeTypes.get(key).push(visitor[key].bind(visitor));
            });
        });

        // traverse the AST
        super.visit(ast, (node, parent) => {
            const visitors = nodeTypes.get(node.type);
            if (visitors) {
                visitors.forEach(visitor => {
                    visitor(node, parent);
                });
            }
        });
    }
}

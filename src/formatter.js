/**
 * @fileoverview Text formatter for JavaScript files.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { Layout } from "./layout.js";
import espree from "espree";
import estraverse from "estraverse";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const DEFAULT_OPTIONS = {
    parser: espree,
    parserOptions: {
        ecmaVersion: 2019,
        ecmaFeatures: {
            jsx: true
        }
    },
    plugins: []
};


//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

class PluginContext {
    constructor(text) {
        this.text = text;
    }
}

class LayoutPluginContext extends PluginContext {
    constructor({ ast, text, layout }) {
        super(text);
        this.ast = ast;
        this.layout = layout;
    }
}

function runLayouts(layouts, {ast, text, layoutOptions, parser }) {

    const nodeTypes = new Map();
    const layout = new Layout({ ast, text }, layoutOptions);

    // create visitors
    layouts.forEach(plugin => {
        const visitor = plugin.run(new LayoutPluginContext({ast, text, layout}));

        // store node-specific visitors in a map for easy lookup
        Object.keys(visitor).forEach(key => {
            if (!Array.isArray(nodeTypes.get(key))) {
                nodeTypes.set(key, []);
            }

            nodeTypes.get(key).push(visitor[key]);
        });
    });

    // traverse the AST
    estraverse.traverse(ast, {
        enter(node, parent) {
            const visitors = nodeTypes.get(node.type);
            if (visitors) {
                visitors.forEach(visitor => {
                    visitor(node, parent);
                });
            }
        },

        keys: parser.VisitorKeys,
        fallback: "iteration"
    });

    return layout.toString();
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export class Formatter {
    constructor(options = {}) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };

        this.options.parserOptions = {
            ...options.parserOptions,
            comment: true,
            tokens: true,
            range: true,
            loc: true,
            ecmaVersion: 2019
        };

    }

    format(text, layoutOptions = {}) {
        const { parser, parserOptions } = this.options;
        const todo = [...this.options.plugins];
        let plugin, layouts = [];
        let result = text;
        
        while (todo.length) {
            plugin = todo.shift();

            /*
             * Layout plugins can be combined for better efficiency if they
             * occur in sequence. Anytime we encounter a plugin that isn't a
             * layout, we check to see if there are any layouts to apply first
             * and only then go on to run the actual plugin.
             */
            if (plugin.type !== "layout" && layouts.length) {
                let ast = parser.parse(result, parserOptions);
                result = runLayouts(layouts, { ast, text, layoutOptions, parser });
                layouts = [];
            }

            switch (plugin.type) {
                case "text":
                    result = plugin.run(new PluginContext(result));
                    break;
                
                case "layout":
                    layouts.push(plugin);
                    break;
                
                default:
                    throw new TypeError(`Unknown plugin type "${ plugin.type }" found.`);
            }

        }

        // do any remaining layout plugins
        if (layouts.length) {
            let ast = parser.parse(result, parserOptions);
            result = runLayouts(layouts, { ast, text, layoutOptions, parser });
            layouts = [];
        }


        return result;
    }
}

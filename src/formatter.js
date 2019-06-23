/**
 * @fileoverview Text formatter for JavaScript files.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { Layout } from "./layout.js";
import espree from "espree";
import { TaskVisitor } from "./visitors.js";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const DEFAULT_OPTIONS = {
    parser: espree,
    parserOptions: {
        ecmaVersion: 2019,
        ecmaFeatures: {
            jsx: true,
            globalReturn: true
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

function runLayoutTasks(tasks, {ast, text, layoutOptions, parser }) {

    const layout = new Layout({ ast, text }, layoutOptions);

    const visitor = new TaskVisitor(parser.VisitorKeys);
    tasks.forEach(task => visitor.addTask(task));
    visitor.visit(ast, new LayoutPluginContext({ ast, text, layout }));

    return layout.toString();
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export class Formatter {
    constructor(config = {}) {
        this.config = config;
    }

    format(text, layoutOptions = {}) {
        const parser = espree;
        let ast = parser.parse(text, {
            comment: true,
            tokens: true,
            range: true,
            loc: true,
            ecmaVersion: 2019,
            sourceType: "module",
            ecmaFeatures: {
                jsx: true,
                globalReturn: true
            }
        });
        return runLayoutTasks(this.config.layout.tasks || [], { ast, text, layoutOptions, parser });

    }
}

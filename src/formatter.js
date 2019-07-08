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
import { SourceCode } from "./util/source-code.js";

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


//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export class Formatter {
    constructor(config = {}) {
        this.config = config;
    }

    format(text, filePath = "<text>") {
        // TODO: Read parser from config
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

        const sourceCode = new SourceCode(text, filePath, ast);
        const layout = new Layout(sourceCode, this.config.options);
        const visitor = new TaskVisitor(parser.VisitorKeys);
        // this.config.tasks.forEach(task => visitor.addTask(task));
        visitor.visit(ast, new LayoutPluginContext({ sourceCode, layout }));

        return layout.toString();

    }
}

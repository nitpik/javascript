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


//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

class PluginContext {
    constructor(text) {
        this.text = text;
    }
}

class LayoutPluginContext extends PluginContext {
    constructor({ sourceCode, layout }) {
        super(sourceCode.text);
        this.sourceCode = sourceCode;
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

    /**
     * 
     * @param {string} text The text to format. 
     * @param {string} [filePath] The file path the text was read from.
     * @returns {string} The formatted source code. 
     */
    format(text, filePath = "<text>") {

        let hashbang = text.startsWith("#!");
        let textToParse = text;

        // replace hashbang if necessary
        if (hashbang) {
            textToParse = "//" + text.slice(2);
        }

        // TODO: Read parser from config?
        const parser = espree;
        let ast = parser.parse(textToParse, {
            comment: true,
            tokens: true,
            range: true,
            loc: true,
            ecmaVersion: espree.latestEcmaVersion || 2019,
            sourceType: "module",
            ecmaFeatures: {
                jsx: true,
                globalReturn: true
            }
        });

        if (hashbang) {
            ast.comments[0].type = "Hashbang";
            ast.comments[0].value = "#!" + ast.comments[0].value.slice(2);
        }

        const sourceCode = new SourceCode(text, filePath, ast);
        const layout = new Layout(sourceCode, this.config.style);

        if (this.config.plugins) {
            const visitor = new TaskVisitor(parser.VisitorKeys);    
            
            for (const plugin of this.config.plugins) {
                visitor.addTask(plugin);
            }

            visitor.visit(ast, new LayoutPluginContext({ sourceCode, layout }));
        }

        return layout.toString();

    }
}

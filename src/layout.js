/**
 * @fileoverview Utility for laying out JavaScript files.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import OrderedSet from "@humanwhocodes/ordered-set";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const DEFAULT_OPTIONS = {
    indent: 4,
    eol: "\n",
    semicolons: true,
};

const WHITESPACE = /\s/;
const NEWLINE = /[\r\n]/;

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

function createParts({ast, text}, options) {
    const parts = new OrderedSet();
    const { tokens, comments } = ast;
    let commentIndex = 0, tokenIndex = 0;
    let index = 0;

    while (index < text.length) {
        let comment = comments[commentIndex];
        let token = tokens[tokenIndex];

        // next part is a comment
        if (comment && comment.range[0] === index) {
            parts.add({
                type: comment.type === "Line" ? "LineComment" : "BlockComment",
                value: text.slice(comment.range[0], comment.range[1])
            });
            index = comment.range[1];
            commentIndex++;
            continue;
        }

        // next part is a token
        if (token && token.range[0] === index) {
            parts.add(token);
            index = token.range[1];
            tokenIndex++;
            continue;
        }

        // otherwise it's whitespace, EOL, or EOF
        let c = text.charAt(index);
        if (c) {

            if (NEWLINE.test(c)) {
                
                if (c === "\r") {
                    if (text.charAt(index + 1) === "\n") {
                        value = "\r\n";
                        index++;
                    }
                }

                parts.add({
                    type: "EOL",
                    value: options.eol
                });

                index++;

                continue;
            }

            if (WHITESPACE.test(c)) {
                let startIndex = index;
                do {
                    index++;
                } while (WHITESPACE.test(text.charAt(index)));

                parts.add({
                    type: "Whitespace",
                    value: text.slice(startIndex, index)
                });

                continue;
            }
                        
        } 

    }

    return parts;
}

function normalizeIndents(parts, options) {
    const indent = (typeof options.indent === "number") ? " ".repeat(options.indent) : options.indent;
    let indentLevel = 0;
    let part = parts.first();

    while (part) {

        if (/[\[\{\(]/.test(part.value)) {
            indentLevel++;
        }

        if (/[\]\}\)]/.test(part.value)) {
            indentLevel--;

            // get previous part to fix indent
            const maybeIndentPart = parts.previous(part);
            const maybeNewLinePart = parts.previous(maybeIndentPart);

            if (maybeIndentPart.type === "Whitespace" && maybeNewLinePart.type === "EOL") {
                maybeIndentPart.value = indent.repeat(indentLevel);
            }
        }

        // first Whitespace after EOL is an indent
        if (part.type === "EOL") {
            part = parts.next(part);

            if (part && part.type === "Whitespace") {
                part.value = indent.repeat(indentLevel);
            }
        }
        part = parts.next(part);
    }
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export class Layout {
    constructor(sourceCode, options = {}) {
        this.options = {
            ...DEFAULT_OPTIONS,
            ...options
        };

        this.parts = createParts(sourceCode, this.options);
        normalizeIndents(this.parts, this.options);
    }

    stripEOL() {
        let part = this.parts.first();

        while (part) {
            let next = this.parts.next(part);

            if (part.type === "EOL") {
                this.parts.delete(part);
            }

            part = next;
        }
    }

    stripWhitespace() {
        let part = this.parts.first();

        while (part) {
            let next = this.parts.next(part);

            if (part.type === "Whitespace") {
                this.parts.delete(part);
            }

            part = next;
        }
    }

    toString() {
        return [...this.parts].map(part => part.value).join("");
    }
}

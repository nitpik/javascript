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
    quotes: "double"
};

// TODO: Fix whitespace regex
const WHITESPACE = /\s/;
const NEWLINE = /[\r\n]/;

const QUOTES = new Map([
    ["double", "\""],
    ["single", "'"]
]);

function isWhitespace(c) {
    return WHITESPACE.test(c) && !NEWLINE.test(c);
}

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

class CodeParts extends OrderedSet {

    isWhitespace(part) {
        return part.type === "Whitespace";
    }

    isEol(part) {
        return part.type === "EOL";
    }

    isIndent(part) {
        const previous = this.previous(part);
        return Boolean(previous && this.isEol(part));
    }
}

function convertString(value, quotes) {

    const desiredQuotes = QUOTES.get(quotes);

    // Special case: Already the correct quote style
    if (value.charAt(0) === desiredQuotes) {
        return value;
    }

    return desiredQuotes + value.slice(1, -1).replace(new RegExp(desiredQuotes, "g"), "\\" + desiredQuotes) + desiredQuotes;
}

function createParts({ast, text}, options) {
    const parts = new CodeParts();
    const rangeParts = new Map();

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
            rangeParts.set(comment.range[0], parts.last());
            commentIndex++;
            continue;
        }

        // next part is a token
        if (token && token.range[0] === index) {
            const newToken = {
                ...token
            };

            if (newToken.type === "String") {
                newToken.value = convertString(newToken.value, options.quotes);
            }

            parts.add(newToken);
            index = newToken.range[1];
            rangeParts.set(newToken.range[0], newToken);
            tokenIndex++;
            continue;
        }

        // otherwise it's whitespace, EOL, or EOF
        let c = text.charAt(index);
        if (c) {

            if (NEWLINE.test(c)) {
                let startIndex = index;

                if (c === "\r") {
                    if (text.charAt(index + 1) === "\n") {
                        index++;
                    }
                }
                const previous = parts.last();

                parts.add({
                    type: "EOL",
                    value: options.eol
                });

                index++;
                rangeParts.set(startIndex, parts.last());

                // if there is whitespace before EOL, delete it
                if (previous && previous.type === "Whitespace") {
                    parts.delete(previous);
                }
                
                continue;
            }

            if (isWhitespace(c)) {
                let startIndex = index;
                do {
                    index++;
                } while (isWhitespace(text.charAt(index)));

                parts.add({
                    type: "Whitespace",
                    value: text.slice(startIndex, index)
                });

                rangeParts.set(startIndex, parts.last());

                continue;
            }
                        
        } 

    }

    return {parts, rangeParts};
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

        const { parts, rangeParts } = createParts(sourceCode, this.options);
        normalizeIndents(parts, this.options);

        this.parts = parts;
        this.rangeParts = rangeParts;
    }

    getFirstToken(node) {
        return this.rangeParts.get(node.range[0]);
    }

    getLastToken(node) {
        return this.parts.previous(this.rangeParts.get(node.range[1]));
    }

    spaceBefore(partOrNode) {

        let part = this.parts.has(partOrNode) ? partOrNode : this.rangeParts.get(partOrNode.range[0]);

        const previous = this.parts.previous(part);
        if (previous) {
            if (this.parts.isWhitespace(part)) {
                if (!this.parts.isEol(part)) {
                    previous.value = " ";
                }
            } else {
                this.parts.insertBefore({
                    type: "Whitespace",
                    value: " "
                }, part);
            }
        } else {
            this.parts.insertBefore({
                type: "Whitespace",
                value: " "
            }, part);
        }
    }

    spaceAfter(partOrNode) {
        let part = this.parts.has(partOrNode) ? partOrNode : this.rangeParts.get(partOrNode.range[0]);

        const next = this.parts.next(part);
        if (next) {
            if (this.parts.isWhitespace(next)) {
                if (!this.parts.isEol(part)) {
                    next.value = " ";
                }
            } else {
                this.parts.insertAfter({
                    type: "Whitespace",
                    value: " "
                }, part);
            }
        } else {
            this.parts.insertAfter({
                type: "Whitespace",
                value: " "
            }, part);
        }
    }

    noSpaceAfter(partOrNode) {
        let part = this.parts.has(partOrNode) ? partOrNode : this.rangeParts.get(partOrNode.range[0]);

        const next = this.parts.next(part);
        if (next && this.parts.isWhitespace(next)) {
            this.parts.delete(next);
        }
    }

    noSpaceBefore(partOrNode) {
        let part = this.parts.has(partOrNode) ? partOrNode : this.rangeParts.get(partOrNode.range[0]);

        const previous = this.parts.previous(part);
        if (previous && this.parts.isWhitespace(previous)) {
            this.parts.delete(previous);
        }
    }

    lineBreakAfter(partOrNode) {
        let part = this.parts.has(partOrNode) ? partOrNode : this.rangeParts.get(partOrNode.range[0]);

        const next = this.parts.next(part);
        if (next) {
            if (!this.parts.isEol(part)) {
                this.parts.insertAfter({
                    type: "EOL",
                    value: this.options.eol
                }, part);
            }
        } else {
            this.parts.insertAfter({
                type: "EOL",
                value: this.options.eol
            }, part);
        }
    }

    toString() {
        return [...this.parts].map(part => part.value).join("");
    }
}

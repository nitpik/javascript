/**
 * @fileoverview Utility for laying out JavaScript files.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { OrderedSet } from "@humanwhocodes/ordered-set";
import { Visitor, TaskVisitor } from "./visitors.js";
import semicolonsTask from "./tasks/semicolons.js";
import spacesTask from "./tasks/spaces.js";
import espree from "espree";

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

    isLineBreak(part) {
        return part.type === "LineBreak";
    }

    isIndent(part) {
        const previous = this.previous(part);
        return Boolean(previous && this.isLineBreak(part));
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

        // otherwise it's whitespace, LineBreak, or EOF
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
                    type: "LineBreak",
                    value: options.eol
                });

                index++;
                rangeParts.set(startIndex, parts.last());

                // if there is whitespace before LineBreak, delete it
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

                /*
                 * If the previous part is a line break, then this is an indent
                 * and should not be changed. Otherwise, normalize the whitespace
                 * to a single space.
                 */
                const previous = parts.last();
                const value = previous.type === "LineBreak"
                    ? text.slice(startIndex, index)
                    : " ";

                parts.add({
                    type: "Whitespace",
                    value
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

            if (maybeIndentPart.type === "Whitespace" && maybeNewLinePart.type === "LineBreak") {
                maybeIndentPart.value = indent.repeat(indentLevel);
            }
        }

        // first Whitespace after LineBreak is an indent
        if (part.type === "LineBreak") {
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
        let nodeParts = new Map();
        this.nodeParts = nodeParts;

        const visitor = new Visitor(espree.VisitorKeys);
        visitor.visit(sourceCode.ast, (node, parent) => {

            const first = rangeParts.get(node.range[0]);

            /*
             * Program nodes and the body property of Program nodes won't
             * have a last part because the end of the range occurs *after*
             * the last token. We can just substitue the last code part in
             * that case.
             */
            let last = rangeParts.get(node.range[1]) 
                ? parts.previous(rangeParts.get(node.range[1]))
                : parts.last();

            /*
             * Esprima-style parsers consider the trailing semicolon as the
             * last part of a given node. To make life easier when editing,
             * we assume the token *before* the semicolon is the last part
             * of the node. By doing so, developers can always assume a 
             * semicolon appears as the next part after the node if present.
             */
            if (last.value === ";") {
                last = parts.previous(last);

                /*
                 * If a node's last token was previously a semicolon, it's
                 * possible that it was preceded by whitespace. Whitespace
                 * between a token and a semicolon insignificant (and often a
                 * typo), so adjust the last token one more time.
                 */
                if (parts.isWhitespace(last)) {
                    last = parts.previous(last);
                }
            }

            // automatically remove empty statements
            if (node.type === "EmptyStatement") {
                if (Array.isArray(parent.body)) {
                    parent.body = parent.body.filter(child => child !== node);
                    parts.delete(first);
                    return;
                }
            }

            nodeParts.set(node, {
                first,
                last 
            });
        });

        const tasks = new TaskVisitor(espree.VisitorKeys);
        tasks.addTask(semicolonsTask);
        tasks.addTask(spacesTask);
        tasks.visit(sourceCode.ast, { layout: this });
    }

    getFirstCodePart(partOrNode) {
        return this.parts.has(partOrNode) ? partOrNode : this.nodeParts.get(partOrNode).first;
    }

    getLastCodePart(partOrNode) {
        return this.parts.has(partOrNode) ? partOrNode : this.nodeParts.get(partOrNode).last;
    }

    findNext(valueOrFunction, partOrNode) {
        const matcher = typeof valueOrFunction === "string"
            ? part => part.value === valueOrFunction
            : valueOrFunction;
        const part = partOrNode ? this.getFirstCodePart(partOrNode) : this.parts.first();
        return this.parts.findNext(matcher, part);
    }

    findPrevious(valueOrFunction, partOrNode) {
        const matcher = typeof valueOrFunction === "string"
            ? part => part.value === valueOrFunction
            : valueOrFunction;
        const part = partOrNode ? this.getFirstCodePart(partOrNode) : this.parts.last();
        return this.parts.findPrevious(matcher, part);
    }

    spaceBefore(partOrNode) {

        let part = this.getFirstCodePart(partOrNode);

        const previous = this.parts.previous(part);
        if (previous) {
            if (this.parts.isWhitespace(previous)) {
                previous.value = " ";
            } else if (!this.parts.isLineBreak(previous)) {
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
        let part = this.getLastCodePart(partOrNode);

        const next = this.parts.next(part);
        if (next) {
            if (this.parts.isWhitespace(next)) {
                next.value = " ";
            } else if (!this.parts.isLineBreak(next)) {
                this.parts.insertAfter({
                    type: "Whitespace",
                    value: " "
                }, part);
            }
        }
    }

    noSpaceAfter(partOrNode) {
        let part = this.getLastCodePart(partOrNode);

        const next = this.parts.next(part);
        if (next && this.parts.isWhitespace(next)) {
            this.parts.delete(next);
        }
    }

    noSpaceBefore(partOrNode) {
        let part = this.getFirstCodePart(partOrNode);

        const previous = this.parts.previous(part);
        if (previous && this.parts.isWhitespace(previous)) {
            this.parts.delete(previous);
        }
    }

    semicolonAfter(partOrNode) {
        let part = this.getLastCodePart(partOrNode);
        
        // check to see what the next code part is
        const next = this.parts.next(part);
        if (next) {
            if (next.type !== "Punctuator" || next.value !== ";") {
                this.parts.insertAfter({
                    type: "Punctuator",
                    value: ";"
                }, part);
            }
        } else {
            // we are at the end of the file, so just add the semicolon
            this.parts.add({
                type: "Punctuator",
                value: ";"
            });
        }
    }

    lineBreakAfter(partOrNode) {
        let part = this.getLastCodePart(partOrNode);

        const next = this.parts.next(part);
        if (next) {
            if (!this.parts.isLineBreak(part)) {
                this.parts.insertAfter({
                    type: "LineBreak",
                    value: this.options.eol
                }, part);
            }
        } else {
            this.parts.insertAfter({
                type: "LineBreak",
                value: this.options.eol
            }, part);
        }
    }

    toString() {
        return [...this.parts].map(part => part.value).join("");
    }
}

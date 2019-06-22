/**
 * @fileoverview Utility for laying out JavaScript files.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { CodeParts } from "./util/code-parts.js";
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
const NEWLINE = /[\r\n\u2028\u2029]/;

const QUOTES = new Map([
    ["double", { value: "\"", alternates: ["'", "`"] }],
    ["single", { value: "'", alternates: ["\"", "`"] }],
    ["backtick", { value: "`", alternates: ["\"", "'"] }]
]);

function isWhitespace(c) {
    return WHITESPACE.test(c) && !NEWLINE.test(c);
}

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

function convertString(value, quotes) {

    const { value: desiredQuotes, alternates } = QUOTES.get(quotes);

    // Special case: Already the correct quote style
    if (value.charAt(0) === desiredQuotes) {
        return value;
    }

    // strip off the start and end quotes
    let newValue = value.slice(1, -1)

        // escape any instances of the desired quotes
        .replace(new RegExp(desiredQuotes, "g"), "\\" + desiredQuotes)

        // unescape any isntances of alternate quotes
        .replace(new RegExp(`\\\\([${alternates.join("")}])`, "g"), "$1");

    // add back on the desired quotes
    return desiredQuotes + newValue + desiredQuotes;
}

function createParts({ast, text}, options) {
    const parts = new CodeParts();
    const originalIndents = new Map();

    const { tokens, comments } = ast;
    let commentIndex = 0, tokenIndex = 0;
    let index = 0;

    while (index < text.length) {
        let comment = comments[commentIndex];
        let token = tokens[tokenIndex];

        // next part is a comment
        if (comment && comment.range[0] === index) {
            const newPart = {
                type: comment.type === "Line" ? "LineComment" : "BlockComment",
                value: text.slice(comment.range[0], comment.range[1]),
                range: comment.range
            };
            const previousPart = parts.last();
            parts.add(newPart);
            index = comment.range[1];
            commentIndex++;

            if (parts.isIndent(previousPart)) {
                originalIndents.set(newPart, previousPart.value);
            }
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
                    value: options.eol,
                    range: [startIndex, ++index]
                });


                // if there is whitespace before LineBreak, delete it
                if (previous && parts.isWhitespace(previous)) {
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
                const value = parts.isLineBreak(previous)
                    ? text.slice(startIndex, index)
                    : " ";

                parts.add({
                    type: "Whitespace",
                    value,
                    range: [startIndex, index]
                });

                continue;
            }
                        
        } 

    }

    return {parts, originalIndents};
}

function indentBlockComment(part, parts, options, originalIndents) {

    const previousIndent = parts.findPreviousIndent(part);
    if (previousIndent && NEWLINE.test(part.value)) {

        // first normalize the new lines and replace with the user preference
        let newValue = part.value
            .replace(/\r\n/g, "\n")
            .replace(NEWLINE, options.eol);

        const originalIndent = originalIndents.get(part) || "";
        part.value = newValue.split(options.eol).map((line, index) => {

            /*
             * The first line should never be adjusted because the indent
             * is already in the file right before the comment. Similarly,
             * other lines that don't already contain the original indent
             * should be left alone because they have weird spacing.
             */
            return index === 0 || !line.startsWith(originalIndent)
                ? line
                : previousIndent.value + line.slice(originalIndent.length);
        }).join(options.eol);
    }

}

function normalizeIndents(parts, options, originalIndents) {
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

            if (parts.isIndent(maybeIndentPart)) {
                maybeIndentPart.value = indent.repeat(indentLevel);
            }
        }

        if (parts.isIndent(part)) {
            part.value = indent.repeat(indentLevel);
        } else if (indentLevel > 0 && parts.isLineBreak(part)) {
            
            /*
             * If we made it here, it means that there's an indent missing.
             * Any line break should be immediately followed by whitespace
             * whenever the `indentLevel` is greater than zero. So, here
             * we add in the missing whitespace and set it to the appropriate
             * indent.
             * 
             * Note that if the next part is a line break, that means the line
             * is empty and no extra whitespace should be added.
             */
            const peekPart = parts.next(part);

            if (!parts.isWhitespace(peekPart) && !parts.isLineBreak(peekPart)) {
                parts.insertBefore({
                    type: "Whitespace",
                    value: indent.repeat(indentLevel)
                }, peekPart);
            }
        } else if (parts.isBlockComment(part)) {
            indentBlockComment(part, parts, options, originalIndents);
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

        const { parts, originalIndents } = createParts(sourceCode, this.options);
        normalizeIndents(parts, this.options, originalIndents);

        this.parts = parts;
        let nodeParts = new Map();
        this.nodeParts = nodeParts;

        const visitor = new Visitor(espree.VisitorKeys);
        visitor.visit(sourceCode.ast, (node, parent) => {

            const first = parts.getByRangeStart(node.range[0]);

            /*
             * Program nodes and the body property of Program nodes won't
             * have a last part because the end of the range occurs *after*
             * the last token. We can just substitue the last code part in
             * that case.
             */
            let last = parts.getByRangeStart(node.range[1]) 
                ? parts.previous(parts.getByRangeStart(node.range[1]))
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

    nextToken(part) {
        return this.parts.nextToken(part);
    }

    previousToken(part) {
        return this.parts.previousToken(part);
    }

    isMultiLine(node) {
        const startToken = this.getFirstCodePart(node);
        const endToken = this.getLastCodePart(node);
        let token = this.parts.next(startToken);

        while (token !== endToken) {
            if (this.parts.isLineBreak(token)) {
                return true;
            }

            token = this.parts.next(token);
        }

        return false;
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
            if (this.parts.isWhitespace(previous) && !this.parts.isIndent(previous)) {
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

    spaces(partOrNode) {
        this.spaceAfter(partOrNode);
        this.spaceBefore(partOrNode);
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

    noSpaces(partOrNode) {
        this.noSpaceAfter(partOrNode);
        this.noSpaceBefore(partOrNode);
    }

    semicolonAfter(partOrNode) {
        let part = this.getLastCodePart(partOrNode);
        
        // check to see what the next code part is
        const next = this.parts.next(part);
        if (next) {
            if (next.type !== "Punctuator" || next.value !== ";") {
                this.parts.insertAfter({
                    type: "Punctuator",
                    value: ";",
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

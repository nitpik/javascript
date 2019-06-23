/**
 * @fileoverview Utility for laying out JavaScript files.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { TokenList, NEWLINE } from "./util/token-list.js";
import { Visitor, TaskVisitor } from "./visitors.js";
import semicolonsTask from "./tasks/semicolons.js";
import spacesTask from "./tasks/spaces.js";
import indentsTask from "./tasks/indents.js";
import espree from "espree";

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const LINE_ENDINGS = new Map([
    ["windows", "\r\n"],
    ["unix", "\n"]
]);

const QUOTES = new Map([
    ["double", "\""],
    ["single", "'"],
]);


const DEFAULT_OPTIONS = {
    indent: 4,
    lineEndings: "unix",
    semicolons: true,
    quotes: "double",
    collapseWhitespace: true,
    maxEmptyLines: 1,
    maxLineLength: Infinity
};

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Normalizes the options into a format that `TokenList` can understand.
 * @param {Object} options The options to normalize.
 * @returns {Object} The modified options object.
 */
function normalizeOptions(options) {
    options.indent = (typeof options.indent === "number") ? " ".repeat(options.indent) : options.indent,
    options.lineEndings = LINE_ENDINGS.get(options.lineEndings);
    options.quotes = QUOTES.get(options.quotes);
    return options;
}


function indentBlockComment(part, parts, options) {

    const previousIndent = parts.findPreviousIndent(part);
    if (previousIndent && NEWLINE.test(part.value)) {

        // first normalize the new lines and replace with the user preference
        let newValue = part.value
            .replace(/\r\n/g, "\n")
            .replace(NEWLINE, options.lineEndings);

        const originalIndent = parts.getOriginalIndent(part);
        part.value = newValue.split(options.lineEndings).map((line, index) => {

            /*
             * The first line should never be adjusted because the indent
             * is already in the file right before the comment. Similarly,
             * other lines that don't already contain the original indent
             * should be left alone because they have weird spacing.
             */
            return index === 0 || !line.startsWith(originalIndent)
                ? line
                : previousIndent.value + line.slice(originalIndent.length);
        }).join(options.lineEndings);
    }

}

function normalizeIndents(parts, options) {
    const indent = options.indent;
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
            indentBlockComment(part, parts, options);
        }

        part = parts.next(part);
    }
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export class Layout {
    constructor(sourceCode, options = {}) {
        this.options = normalizeOptions({
            ...DEFAULT_OPTIONS,
            ...options
        });

        let parts = TokenList.fromAst(sourceCode.ast, sourceCode.text, this.options);
        normalizeIndents(parts, this.options);
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
        tasks.addTask(indentsTask);
        tasks.visit(sourceCode.ast, { layout: this });
    }

    getFirstCodePart(partOrNode) {
        return this.parts.has(partOrNode) ? partOrNode : this.nodeParts.get(partOrNode).first;
    }

    getLastCodePart(partOrNode) {
        return this.parts.has(partOrNode) ? partOrNode : this.nodeParts.get(partOrNode).last;
    }

    boundaryTokens(node) {
        return this.nodeParts.get(node);
    }

    nextToken(part) {
        return this.parts.nextToken(part);
    }

    previousToken(part) {
        return this.parts.previousToken(part);
    }

    isFirstOnLine(startToken) {
        let token = this.parts.previous(startToken);
        while (token) {
            if (this.parts.isLineBreak(token)) {
                return true;
            }

            if (!this.parts.isComment(token) && !this.parts.isWhitespace(token)) {
                return false;
            }

            token = this.parts.previous(token);
        }
    }

    getIndent(node) {
        const startToken = this.getFirstCodePart(node);
        let token = this.parts.previous(startToken);

        /*
         * For this loop, we want to see if this node own an indent. That means
         * the start token of the node is the first indented token on the line.
         * This is important because it's possible to indent a node that
         * doesn't have an indent immediately before it (in which case, the
         * parent node is the one that needs indenting).
         * 
         * This loop also skips over comments that are in between the indent
         * and the first token.
         */
        while (token) {
            if (this.parts.isIndent(token)) {
                return { token };
            }

            // first on line but no indent
            if (this.parts.isLineBreak(token)) {
                return {};
            }

            if (!this.parts.isComment(token)) {
                break;
            }

            token = this.parts.previous(token);
        }

        return undefined;
    }

    indent(node) {
        const indentPart = this.getIndent(node);
        if (indentPart) {
            let indentToken = indentPart.token;
            const { first: firstToken, last: lastToken } = this.boundaryTokens(node);

            // if there is no indent token, create one
            if (!indentToken) {
                indentToken = {
                    type: "Whitespace",
                    value: ""
                };

                const lineBreak = this.parts.findPreviousLineBreak(firstToken);
                if (lineBreak) {
                    this.parts.insertAfter(indentToken, lineBreak);
                } else {
                    this.parts.insertBefore(indentToken, firstToken);
                }
            }

            // calculate new indent and update indent token
            const newIndent = indentToken.value + this.options.indent;
            indentToken.value = newIndent;

            // find remaining indents in this node and update as well
            let token = firstToken;
            while (token !== lastToken) {
                if (this.parts.isIndent(token)) {
                    token.value = newIndent;
                }
                token = this.parts.next(token);
            }
        }
    }

    isMultiLine(node) {
        const { first: firstToken, last: lastToken } = this.boundaryTokens(node);
        let token = this.parts.next(firstToken);

        while (token !== lastToken) {
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
                    value: this.options.lineEndings
                }, part);
            }
        } else {
            this.parts.insertAfter({
                type: "LineBreak",
                value: this.options.lineEndings
            }, part);
        }
    }

    toString() {
        return [...this.parts].map(part => part.value).join("");
    }
}

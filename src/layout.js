/**
 * @fileoverview Utility for laying out JavaScript files.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { TokenList, NEWLINE } from "./util/token-list.js";
import { Visitor, TaskVisitor } from "./visitors.js";
import semicolonsTask from "./plugins/semicolons.js";
import spacesTask from "./plugins/spaces.js";
import indentsTask from "./plugins/indents.js";
import multilineTask from "./plugins/multiline.js";
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
    tabWidth: 4,
    lineEndings: "unix",
    semicolons: true,
    quotes: "double",
    collapseWhitespace: true,
    trailingCommas: false,
    maxEmptyLines: 1,
    maxLineLength: Infinity,
    trimTrailingWhitespace: true,
    emptyLastLine: true
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
    return Object.freeze(options);
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

function normalizeIndentsAndLineBreaks(tokenList, options) {
    const indent = options.indent;
    const maxEmptyLines = options.maxEmptyLines;
    let indentLevel = 0;
    let lineBreakCount = 0;
    let token = tokenList.first();

    while (token) {

        if (tokenList.isIndentIncreaser(token)) {
            indentLevel++;
            lineBreakCount = 0;
        } else if (tokenList.isIndentDecreaser(token)) {
            
            /*
             * The tricky part about decreasing indent is that the token
             * triggering the indent decrease will already be indented at the
             * previous level. To fix this, we need to find the first syntax
             * on the same line and then adjust the indent before that.
             */
            const firstTokenOnLine = tokenList.findFirstTokenOrCommentOnLine(token);
            const maybeIndentPart = tokenList.previous(firstTokenOnLine);
           
            if (tokenList.isIndent(maybeIndentPart)) {
                indentLevel--;

                if (indentLevel > 0) {
                    maybeIndentPart.value = indent.repeat(indentLevel);
                } else {
                    tokenList.delete(maybeIndentPart);
                }
            }

            lineBreakCount = 0;

        } else if (tokenList.isIndent(token)) {
            if (indentLevel > 0) {
                token.value = indent.repeat(indentLevel);
            } else {
                const previousToken = tokenList.previous(token);
                tokenList.delete(token);
                token = previousToken;
            }
        } else if (tokenList.isLineBreak(token)) {
            
            lineBreakCount++;

            if (indentLevel > 0) {
            
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
                const peekPart = tokenList.next(token);
                if (!tokenList.isWhitespace(peekPart) && !tokenList.isLineBreak(peekPart)) {
                    tokenList.insertBefore({
                        type: "Whitespace",
                        value: indent.repeat(indentLevel)
                    }, peekPart);
                }
            }

            if (lineBreakCount > maxEmptyLines + 1) {
                let previousToken = tokenList.previous(token);
                tokenList.delete(token);

                if (tokenList.isWhitespace(previousToken)) {
                    const whitespaceToken = previousToken;
                    previousToken = tokenList.previous(whitespaceToken);
                    tokenList.delete(whitespaceToken);
                }

                token = previousToken;
                lineBreakCount--;                
            }

        } else if (tokenList.isBlockComment(token)) {
            lineBreakCount = 0;
            indentBlockComment(token, tokenList, options);
        } else if (!tokenList.isWhitespace(token)) {
            lineBreakCount = 0;
        }

        token = tokenList.next(token);
    }

}

function ensureEmptyLastLine(tokenList, options) {
    let lastToken = tokenList.last();
    if (tokenList.isIndent(lastToken)) {
        tokenList.delete(lastToken);
    } else if (!tokenList.isLineBreak(lastToken)) {
        tokenList.add({
            type: "LineBreak",
            value: options.lineEndings
        });
    }
}

function trimTrailingWhitespace(tokenList) {
    let token = tokenList.first();

    while (token) {
        
        if (tokenList.isLineBreak(token)) {
            
            const previous = tokenList.previous(token);
            if (tokenList.isWhitespace(previous)) {
                tokenList.delete(previous);
            }

        }

        token = tokenList.next(token);
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

        let tokenList = TokenList.fromAST(sourceCode.ast, sourceCode.text, this.options);
        normalizeIndentsAndLineBreaks(tokenList, this.options);
        this.tokenList = tokenList;
        let nodeParts = new Map();
        this.nodeParts = nodeParts;
        let nodeParents = this.nodeParents = new Map();

        const visitor = new Visitor(espree.VisitorKeys);
        visitor.visit(sourceCode.ast, (node, parent) => {

            nodeParents.set(node, parent);

            const firstToken = tokenList.getByRangeStart(node.range[0]);

            /*
             * Program nodes and the body property of Program nodes won't
             * have a last part because the end of the range occurs *after*
             * the last token. We can just substitue the last code part in
             * that case.
             */
            let lastToken = tokenList.getByRangeStart(node.range[1]) 
                ? tokenList.previous(tokenList.getByRangeStart(node.range[1]))
                : tokenList.last();

            /*
             * Esprima-style parsers consider the trailing semicolon as the
             * last part of a given node. To make life easier when editing,
             * we assume the token *before* the semicolon is the last part
             * of the node. By doing so, developers can always assume a 
             * semicolon appears as the next part after the node if present.
             */
            if (lastToken.value === ";") {
                lastToken = tokenList.previous(lastToken);

                /*
                 * If a node's last token was previously a semicolon, it's
                 * possible that it was preceded by whitespace. Whitespace
                 * between a token and a semicolon insignificant (and often a
                 * typo), so adjust the last token one more time.
                 */
                if (tokenList.isWhitespace(lastToken)) {
                    lastToken = tokenList.previous(lastToken);
                }
            }

            // automatically remove unneeded empty statements
            if (node.type === "EmptyStatement") {
                if (Array.isArray(parent.body)) {
                    parent.body = parent.body.filter(child => child !== node);
                    tokenList.delete(firstToken);
                    return;
                }
            }

            nodeParts.set(node, {
                firstToken,
                lastToken 
            });
        });

        /*
         * We need to trim trailing whitespace after all of the rest of the
         * processing is done in order to ensure that we've made a correct
         * map of nodes to tokens. Removing the whitespace earlier can result
         * in tokens missing at the end-range of nodes, which messes up the
         * mapping.
         */
        if (this.options.trimTrailingWhitespace) {
            trimTrailingWhitespace(tokenList);
        }

        const tasks = new TaskVisitor(espree.VisitorKeys);
        tasks.addTask(semicolonsTask);
        tasks.addTask(spacesTask);
        tasks.addTask(indentsTask);
        tasks.addTask(multilineTask);
        tasks.visit(sourceCode.ast, Object.freeze({ sourceCode, layout: this }));

        // now ensure empty last line
        if (this.options.emptyLastLine) {
            ensureEmptyLastLine(tokenList, this.options);
        }
    }

    firstToken(tokenOrNode) {
        return this.tokenList.has(tokenOrNode) ? tokenOrNode : this.nodeParts.get(tokenOrNode).firstToken;
    }

    lastToken(tokenOrNode) {
        return this.tokenList.has(tokenOrNode) ? tokenOrNode : this.nodeParts.get(tokenOrNode).lastToken;
    }

    boundaryTokens(tokenOrNode) {
        return this.tokenList.has(tokenOrNode)
            ? { firstToken: tokenOrNode, lastToken: tokenOrNode }
            : this.nodeParts.get(tokenOrNode);
    }

    nextToken(part) {
        return this.tokenList.nextToken(part);
    }

    previousToken(part) {
        return this.tokenList.previousToken(part);
    }

    nextTokenOrComment(part) {
        return this.tokenList.nextTokenOrComment(part);
    }

    previousTokenOrComment(part) {
        return this.tokenList.previousTokenOrComment(part);
    }

    isFirstOnLine(startToken) {
        let token = this.tokenList.previous(startToken);
        while (token) {
            if (this.tokenList.isLineBreak(token)) {
                return true;
            }

            if (!this.tokenList.isComment(token) && !this.tokenList.isWhitespace(token)) {
                return false;
            }

            token = this.tokenList.previous(token);
        }
    }

    /**
     * Gets number of characters amongst two tokens.
     * @param {Token} firstToken The token to start counting from.
     * @param {Token} lastToken The last token to count.
     * @returns {int} The number of characters among the tokens.
     */
    getLength(firstToken, lastToken) {
        let currentToken = firstToken;
        let characterCount = 0;
        
        // then count the other tokens
        while (currentToken && currentToken !== lastToken) {
            characterCount += currentToken.value.length;
            currentToken = this.tokenList.next(currentToken);
        }

        if (currentToken) {
            characterCount += currentToken.value.length;
        }

        return characterCount;
    }
    
    /**
     * Gets number of characters in the line represented by the token or node.
     * @param {Token|Node} tokenOrNode The token or node whose line should be checked.
     * @returns {int} The number of characters in the line.
     */
    getLineLength(tokenOrNode) {
        const token = this.firstToken(tokenOrNode);
        let currentToken = this.tokenList.findFirstTokenOrCommentOnLine(token);
        const previousToken = this.tokenList.previous(currentToken);
        let characterCount = 0;
        
        // first count the indent, if any
        if (this.tokenList.isIndent(previousToken)) {
            if (previousToken.value.includes("\t")) {
                characterCount += previousToken.value.length * this.options.tabWidth;
            } else {
                characterCount += previousToken.value.length;
            }
        }

        // then count the other tokens
        while (currentToken && !this.tokenList.isLineBreak(currentToken)) {
            characterCount += currentToken.value.length;
            currentToken = this.tokenList.next(currentToken);
        }

        return characterCount;
    }

    isLineTooLong(tokenOrNode) {
        const characterCount = this.getLineLength(tokenOrNode);
        return characterCount > this.options.maxLineLength;
    }

    getIndent(tokenOrNode) {
        const firstToken = this.firstToken(tokenOrNode);
        let currentToken = this.tokenList.previous(firstToken);
        
        /*
         * If there is no previous token, that means this is the first syntax
         * on the first line of the input. Technically, this is a level zero
         * indent, so return an object.
         */
        if (!currentToken) {
            return {};
        }

        /*
         * For this loop, we want to see if this node owns an indent. That means
         * the start token of the node is the first indented token on the line.
         * This is important because it's possible to indent a node that
         * doesn't have an indent immediately before it (in which case, the
         * parent node is the one that needs indenting).
         * 
         * This loop also skips over comments that are in between the indent
         * and the first token.
         */
        while (currentToken) {
            if (this.tokenList.isIndent(currentToken)) {
                return { token: currentToken };
            }

            // first on line but no indent
            if (this.tokenList.isLineBreak(currentToken)) {
                return {};
            }

            if (!this.tokenList.isComment(currentToken)) {
                break;
            }

            currentToken = this.tokenList.previous(currentToken);
        }

        return undefined;
    }

    /**
     * Determines the indentation level of the line on which the code starts.
     * @param {Token|Node} tokenOrNode The token or node to inspect.
     * @returns {int} The zero-based indentation level of the code. 
     */
    getIndentLevel(tokenOrNode) {
        const firstToken = this.firstToken(tokenOrNode);
        const lineBreak = this.tokenList.findPreviousLineBreak(firstToken);
        const maybeIndent = lineBreak ? this.tokenList.next(lineBreak) : this.tokenList.first();

        if (this.tokenList.isWhitespace(maybeIndent)) {
            return maybeIndent.value.length / this.options.indent.length;
        }

        return 0;
    }

    /**
     * Ensures the given token or node is indented to the specified level. This
     * has an effect if the token or node is the first syntax on the line.
     * @param {Node} tokenOrNode The token or node to indent.
     * @param {int} level The number of levels to indent. 
     * @returns {boolean} True if the indent was performed, false if not. 
     */
    indentLevel(tokenOrNode, level) {

        if (typeof level !== "number" || level < 0) {
            throw new TypeError("Second argument must be a number >= 0.");
        }

        const indent = this.getIndent(tokenOrNode);
        
        /*
         * If the token or node is not the first syntax on a line then we
         * should not indent.
         */
        if (!indent) {
            return false;
        }

        let indentToken = indent.token;
        const indentText = this.options.indent.repeat(level);
        const { firstToken, lastToken } = this.boundaryTokens(tokenOrNode);

        // if there is no indent token, create one
        if (!indentToken) {
            indentToken = {
                type: "Whitespace",
                value: ""
            };

            const lineBreak = this.tokenList.findPreviousLineBreak(firstToken);
            if (lineBreak) {
                this.tokenList.insertAfter(indentToken, lineBreak);
            } else {
                this.tokenList.insertBefore(indentToken, firstToken);
            }
        }

        indentToken.value = indentText;

        // find remaining indents in this node and update as well
        let token = firstToken;
        while (token !== lastToken) {
            if (this.tokenList.isIndent(token)) {
                // make sure to keep relative indents correct
                token.value = indentText + token.value.slice(indentText.length);
            }
            token = this.tokenList.next(token);
        }

        return true;
    }

    /**
     * Ensures all indents between the two tokens are set to the given level.
     * @param {Token} firstToken The first token to indent.
     * @param {Token} lastToken The last token to indent.
     * @param {int} level The number of levels to indent. 
     * @returns {boolean} True if the indent was performed, false if not. 
     */
    indentLevelBetween(firstToken, lastToken, level) {

        if (typeof level !== "number" || level < 0) {
            throw new TypeError("Third argument must be a number >= 0.");
        }

        const indent = this.getIndent(firstToken);
        
        /*
         * If the token or node is not the first syntax on a line then we
         * should not indent.
         */
        if (!indent) {
            return false;
        }

        let indentToken = indent.token;
        const indentText = this.options.indent.repeat(level);

        // if there is no indent token, create one
        if (!indentToken) {
            indentToken = {
                type: "Whitespace",
                value: ""
            };

            const lineBreak = this.tokenList.findPreviousLineBreak(firstToken);
            if (lineBreak) {
                this.tokenList.insertAfter(indentToken, lineBreak);
            } else {
                this.tokenList.insertBefore(indentToken, firstToken);
            }
        }

        indentToken.value = indentText;

        // find remaining indents in this node and update as well
        let token = firstToken;
        while (token && token !== lastToken) {
            
            if (this.tokenList.isIndent(token)) {
                // make sure to keep relative indents correct
                token.value = indentText + token.value.slice(indentText.length);
            } else if (this.tokenList.isLineBreak(token)) {

                /*
                 * It's possible a node that should be indented doesn't already
                 * have an indent. The only way to know is to check to see if the
                 * next node after a line break is whitespace. If not, then create
                 * one. The created indent will be adjusted in the first part of this
                 * while loop.
                 */
                const maybeIndent = this.tokenList.next(token);
                if (!this.tokenList.isIndent(maybeIndent) && !this.tokenList.isLineBreak(maybeIndent)) {
                    this.tokenList.insertAfter({
                        type: "Whitespace",
                        value: ""
                    }, token);
                }

            }
            token = this.tokenList.next(token);
        }

        return true;
    }

    /**
     * Indents the given node only if the node is the first syntax on the line.
     * @param {Node} tokenOrNode The token or node to indent.
     * @param {int} [levels=1] The number of levels to indent. If this value is
     *      0 then it is considered to be 1. Negative numbers decrease indentation.
     * returns {boolean} True if the indent was performed, false if not. 
     */
    indent(tokenOrNode, levels = 1) {
        const indentPart = this.getIndent(tokenOrNode);
        if (!indentPart) {
            return false;

        }
        
        // normalize levels
        if (levels === 0) {
            levels = 1;
        }

        const effectiveIndent = this.options.indent.repeat(Math.abs(levels));
        let indentToken = indentPart.token;
        const { firstToken, lastToken } = this.boundaryTokens(tokenOrNode);

        // if there is no indent token, create one
        if (!indentToken) {
            indentToken = {
                type: "Whitespace",
                value: ""
            };

            const lineBreak = this.tokenList.findPreviousLineBreak(firstToken);
            if (lineBreak) {
                this.tokenList.insertAfter(indentToken, lineBreak);
            } else {
                this.tokenList.insertBefore(indentToken, firstToken);
            }
        }

        // calculate new indent and update indent token
        const newIndent = levels > 0
            ? indentToken.value + effectiveIndent
            : indentToken.value.slice(effectiveIndent.length);
        indentToken.value = newIndent;

        // find remaining indents in this node and update as well
        let token = firstToken;
        while (token !== lastToken) {
            if (this.tokenList.isIndent(token)) {
                token.value = newIndent;
            }
            token = this.tokenList.next(token);
        }
        
        return true;
    }


    /**
     * Determines if a given node's syntax spans multiple lines.
     * @param {Node} node The node to check.
     * @returns {boolean} True if the node spans multiple lines, false if not.
     */
    isMultiLine(node) {
        const { firstToken, lastToken } = this.boundaryTokens(node);
        let token = this.tokenList.next(firstToken);

        while (token !== lastToken) {
            if (this.tokenList.isLineBreak(token)) {
                return true;
            }

            token = this.tokenList.next(token);
        }

        return false;
    }

    isSameLine(firstPartOrNode, secondPartOrNode) {
        const startToken = this.lastToken(firstPartOrNode);
        const endToken = this.firstToken(secondPartOrNode);
        let token = this.tokenList.next(startToken);
        
        while (token && token !== endToken) {
            if (this.tokenList.isLineBreak(token)) {
                return false;
            }
            
            token = this.tokenList.next(token);
        }

        return Boolean(token);
    }

    findNext(valueOrFunction, partOrNode) {
        const matcher = typeof valueOrFunction === "string"
            ? part => part.value === valueOrFunction
            : valueOrFunction;
        const part = partOrNode ? this.lastToken(partOrNode) : this.tokenList.first();
        return this.tokenList.findNext(matcher, part);
    }

    findPrevious(valueOrFunction, partOrNode) {
        const matcher = typeof valueOrFunction === "string"
            ? part => part.value === valueOrFunction
            : valueOrFunction;
        const part = partOrNode ? this.firstToken(partOrNode) : this.tokenList.last();
        return this.tokenList.findPrevious(matcher, part);
    }

    spaceBefore(tokenOrNode) {

        let firstToken = this.firstToken(tokenOrNode);

        const previousToken = this.tokenList.previous(firstToken);
        if (previousToken) {
            if(!this.tokenList.isIndent(previousToken)) {
                if (this.tokenList.isWhitespace(previousToken)) {
                    previousToken.value = " ";
                    return true;
                } else if (!this.tokenList.isLineBreak(previousToken)) {
                    this.tokenList.insertBefore({
                        type: "Whitespace",
                        value: " "
                    }, firstToken);
                    return true;
                }
            }
        } else {
            this.tokenList.insertBefore({
                type: "Whitespace",
                value: " "
            }, firstToken);
            return true;
        }

        return false;
    }

    spaceAfter(partOrNode) {
        let lastToken = this.lastToken(partOrNode);

        const nextToken = this.tokenList.next(lastToken);
        if (nextToken) {
            if (this.tokenList.isWhitespace(nextToken)) {
                nextToken.value = " ";
                return true;
            } else if (!this.tokenList.isLineBreak(nextToken)) {
                this.tokenList.insertAfter({
                    type: "Whitespace",
                    value: " "
                }, lastToken);
                return true;
            }
        }

        return false;
    }

    spaces(partOrNode) {
        const afterResult = this.spaceAfter(partOrNode);
        const beforeResult = this.spaceBefore(partOrNode);
        return afterResult || beforeResult;
    }

    noSpaceAfter(partOrNode) {
        let part = this.lastToken(partOrNode);

        const next = this.tokenList.next(part);
        if (next && this.tokenList.isWhitespace(next)) {
            this.tokenList.delete(next);
            return true;
        }

        return false;
    }

    noSpaceBefore(partOrNode) {
        let part = this.firstToken(partOrNode);

        const previous = this.tokenList.previous(part);
        if (previous && this.tokenList.isWhitespace(previous) && !this.tokenList.isIndent(previous)) {
            this.tokenList.delete(previous);
            return true;
        }

        return false;
    }

    noSpaces(partOrNode) {
        const afterResult = this.noSpaceAfter(partOrNode);
        const beforeResult = this.noSpaceBefore(partOrNode);
        return afterResult || beforeResult;
    }

    semicolonAfter(partOrNode) {
        let part = this.lastToken(partOrNode);
        
        // check to see what the next code part is
        const next = this.tokenList.next(part);
        if (next) {
            if (next.type !== "Punctuator" || next.value !== ";") {
                this.tokenList.insertAfter({
                    type: "Punctuator",
                    value: ";",
                }, part);
                return true;
            }
        } else if (!this.tokenList.isLineBreak(part)) {

            /*
             * We are at the end of the file, so just add the semicolon
             * but only if the last part of the file isn't a line break.
             */
            this.tokenList.add({
                type: "Punctuator",
                value: ";"
            });
            return true;
        }

        return false;
    }
    
    noSemicolonAfter(partOrNode) {
        let part = this.lastToken(partOrNode);
        
        // check to see what the next code part is
        const next = this.tokenList.next(part);
        if (next) {
            if (next.value === ";") {

                // can only remove if there's a line break or EOF
                const maybeLineBreak = this.tokenList.next(next);
                
                if (!maybeLineBreak || this.tokenList.isLineBreak(maybeLineBreak)) {
                    this.tokenList.delete(next);
                    return true;
                }

            }
        }

        return false;
    }
    
    /**
     * Ensures that there is a comma after a given token or node.
     * @param {Token|Node} tokenOrNode The token or node to look for a comma
     *      after.
     * @returns {boolean} True if a comma was added, false if not.
     */
    commaAfter(partOrNode) {
        let part = this.lastToken(partOrNode);
       
        // check to see what the next code part is
        const next = this.nextToken(part);
        if (next) {

            // don't insert after another comma
            if (next.value !== ",") {
                this.tokenList.insertAfter({
                    type: "Punctuator",
                    value: ",",
                }, part);

                return true;
            }
        }

        /*
         * If we make it to here, then we're at the end of the file and a comma
         * should not be inserted because it's likely not valid syntax.
         */
        return false;
    }

    /**
     * Ensures that there is no comma after a given token or node.
     * @param {Token|Node} tokenOrNode The token or node to look for a comma
     *      after.
     * @returns {boolean} True if a comma was deleted, false if not.
     */
    noCommaAfter(tokenOrNode) {
        let firstToken = this.lastToken(tokenOrNode);
       
        // check to see what the next token is
        const next = this.nextToken(firstToken);
        if (next && next.value === ",") {
            this.tokenList.delete(next);
            return true;
        }

        /*
         * If we make it to here, then we're at the end of the file and a comma
         * should not be inserted because it's likely not valid syntax.
         */
        return false;
    }

    emptyLineBefore(tokenOrNode) {
        let token = this.firstToken(tokenOrNode);
        const previousToken = this.tokenList.previous(token);

        if (previousToken) {

            // if there's already a line break see if there's another
            if (this.tokenList.isLineBreak(previousToken)) {

                const earlierToken = this.tokenList.previous(previousToken);
                
                if (this.tokenList.isLineBreak(earlierToken)) {
                    return false;
                }

                this.tokenList.insertBefore({
                    type: "LineBreak",
                    value: this.options.lineEndings
                }, token);

                return true;

            } else if (!this.tokenList.isIndent(previousToken)) {
                this.tokenList.insertBefore({
                    type: "LineBreak",
                    value: this.options.lineEndings
                }, token);

                this.tokenList.insertBefore({
                    type: "LineBreak",
                    value: this.options.lineEndings
                }, token);

                // trim trailing whitespace if necessary
                if (this.options.trimTrailingWhitespace && this.tokenList.isWhitespace(previousToken)) {
                    this.tokenList.delete(previousToken);
                }

                return true;
            }

        } else {

            this.tokenList.insertBefore({
                type: "LineBreak",
                value: this.options.lineEndings
            }, token);

            return true;
        }

        return false;
    }

    emptyLineAfter(tokenOrNode) {
        let token = this.lastToken(tokenOrNode);

        let next = this.tokenList.next(token);
        if (next) {

            if (this.tokenList.isLineBreak(next)) {

                // There is at least one line break so see if we need more
                next = this.tokenList.next(next);

                // skip over any whitespace
                if (this.tokenList.isWhitespace(next)) {
                    next = this.tokenList.next(next);
                }

                if (!this.tokenList.isLineBreak(next)) {
                    this.tokenList.insertAfter({
                        type: "LineBreak",
                        value: this.options.lineEndings
                    }, token);

                    return true;
                }

                return false;

            } else {

                // There are no line breaks after the token so insert two

                this.tokenList.insertAfter({
                    type: "LineBreak",
                    value: this.options.lineEndings
                }, token);

                this.tokenList.insertAfter({
                    type: "LineBreak",
                    value: this.options.lineEndings
                }, token);
            }

            return true;

        } else {
            this.tokenList.insertAfter({
                type: "LineBreak",
                value: this.options.lineEndings
            }, token);

            this.tokenList.insertAfter({
                type: "LineBreak",
                value: this.options.lineEndings
            }, token);

            return true;
        }

    }

    noEmptyLineAfter(tokenOrNode) {
        let token = this.lastToken(tokenOrNode);
        let maybeLineBreak = this.tokenList.next(token);
        
        if (maybeLineBreak) {
            // skip over semicolons
            if (maybeLineBreak.value === ";") {
                maybeLineBreak = this.tokenList.next(maybeLineBreak);
            }
        
            if (this.tokenList.isLineBreak(maybeLineBreak)) {
        
                let whitespace = null;
                maybeLineBreak = this.tokenList.next(maybeLineBreak);
                if (this.tokenList.isWhitespace(maybeLineBreak)) {
                    whitespace = maybeLineBreak;
                    maybeLineBreak = this.tokenList.next(maybeLineBreak);
                }

                if (this.tokenList.isLineBreak(maybeLineBreak)) {
                    // make sure to delete any preceding whitespace too
                    if (whitespace) {
                        this.tokenList.delete(whitespace);
                    }

                    this.tokenList.delete(maybeLineBreak);

                    return true;
                }
            }
        }

        return false;
    }

    noEmptyLineBefore(tokenOrNode) {
        let token = this.firstToken(tokenOrNode);
        let maybeLineBreak = this.tokenList.previous(token);

        if (maybeLineBreak) {
            // skip over whitespace
            if (this.tokenList.isWhitespace(maybeLineBreak)) {
                maybeLineBreak = this.tokenList.previous(maybeLineBreak);
            }

            if (this.tokenList.isLineBreak(maybeLineBreak)) {

                // TODO: Refactor this logic

                // check for beginning of file
                if (this.tokenList.first() !== maybeLineBreak) {

                    // check for preceding whitespace too
                    let whitespace = null;
                    maybeLineBreak = this.tokenList.previous(maybeLineBreak);
                    if (this.tokenList.isWhitespace(maybeLineBreak)) {
                        whitespace = maybeLineBreak;
                        maybeLineBreak = this.tokenList.previous(maybeLineBreak);
                    }
    
                    // only if we find a second line break do we need to act
                    if (this.tokenList.isLineBreak(maybeLineBreak)) {
    
                        // make sure to delete any preceding whitespace too
                        if (whitespace) {
                            this.tokenList.delete(whitespace);
                        }
        
                        this.tokenList.delete(maybeLineBreak);

                        return true;
                    }
                } else {
                    this.tokenList.delete(maybeLineBreak);
                    return true;
                }

            }

            return false;
        }
    }

    lineBreakAfter(tokenOrNode) {
        let token = this.lastToken(tokenOrNode);

        const next = this.tokenList.next(token);
        if (next) {
            if (!this.tokenList.isLineBreak(next)) {
                this.tokenList.insertAfter({
                    type: "LineBreak",
                    value: this.options.lineEndings
                }, token);
                return true;
            }
        } else {
            this.tokenList.insertAfter({
                type: "LineBreak",
                value: this.options.lineEndings
            }, token);
            return true;
        }

        return false;
    }

    noLineBreakAfter(tokenOrNode) {
        let token = this.lastToken(tokenOrNode);

        const lineBreak = this.tokenList.next(token);
        if (lineBreak) {
            if (this.tokenList.isLineBreak(lineBreak)) {
                this.tokenList.delete(lineBreak);

                // collapse whitespace if necessary
                const nextToken = this.tokenList.next(token);
                if (this.tokenList.isWhitespace(nextToken) && this.options.collapseWhitespace) {
                    nextToken.value = " ";
                }
            }
        }
    }
    
    lineBreakBefore(tokenOrNode) {
        let token = this.firstToken(tokenOrNode);
        const previousToken = this.tokenList.previous(token);
        
        if (previousToken) {
            if (!this.tokenList.isLineBreak(previousToken) && !this.tokenList.isIndent(previousToken)) {
                this.tokenList.insertBefore({
                    type: "LineBreak",
                    value: this.options.lineEndings
                }, token);
                
                // trim trailing whitespace if necessary
                if (this.options.trimTrailingWhitespace && this.tokenList.isWhitespace(previousToken)) {
                    this.tokenList.delete(previousToken);
                }

            }

        }
    }

    noLineBreakBefore(tokenOrNode) {
        const token = this.firstToken(tokenOrNode);
        let previousToken = this.tokenList.previous(token);
        
        if (previousToken) {

            // TODO: Maybe figure out if indent should be deleted or converted to one space?
            // delete any indent
            if (this.tokenList.isIndent(previousToken)) {
                this.tokenList.delete(previousToken);
                previousToken = this.tokenList.previous(token);
            }

            if (this.tokenList.isLineBreak(previousToken)) {
                this.tokenList.delete(previousToken);
            }

        }
    }

    toString() {
        return [...this.tokenList].map(part => part.value).join("");
    }
}

import { OrderedSet } from '@humanwhocodes/ordered-set';
import estraverse from 'estraverse';
import espree from 'espree';

/**
 * @fileoverview Doubly-linked list representing tokens.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// TypeDefs
//-----------------------------------------------------------------------------

/**
 * @typedef TokenListOptions
 * @property {boolean} collapseWhitespace If true, replaces multiple whitespace
 *      characters with a single space.
 * @property {string} indent The string to use as the indent.
 * @property {string} lineEndings The string to use as a line ending.
 * @property {int} maxEmptyLines The maximum number of empty lines permitted
 *      before lines are deleted from the token list.
 * @property {string} quotes The string to use to quote strings.
 * @property {boolean} trimTrailingWhitespace If true, trims whitespace before
 *      line breaks.
 */

//-----------------------------------------------------------------------------
// Private
//-----------------------------------------------------------------------------

const rangeStarts = Symbol("rangeStarts");
const originalIndents = Symbol("originalIndents");

const SYNTAX_TOKENS = new Set([
    "Keyword",
    "String",
    "Numeric",
    "Boolean",
    "Punctuator",
    "Null",
    "Template",
    "Identifier"
]);

const NON_WHITESPACE_TOKENS = new Set([
    ...SYNTAX_TOKENS,
    "LineComment",
    "BlockComment"
]);

const WHITESPACE = /\s/;
const NEWLINE = /[\r\n\u2028\u2029]/;

const QUOTE_ALTERNATES = new Map([
    ["\"", "'"],
    ["`", "\""]
]);

const INDENT_INCREASE_CHARS = new Set(["{", "(", "["]);
const INDENT_DECREASE_CHARS = new Set(["}", ")", "]"]);

/** @type TokenListOptions */
const DEFAULT_OPTIONS = {
    indent: 4,
    lineEndings: "\n",
    quotes: "\"",
    trimTrailingWhitespace: true,
    collapseWhitespace: true,
    maxEmptyLines: 1
};

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Determines if the given character is a non-newline whitespace character.
 * @param {string} c The character to check.
 * @returns {boolean} True if the character is a non-newline whitespace
 *      character; false if not. 
 */
function isWhitespace(c) {
    return WHITESPACE.test(c) && !NEWLINE.test(c);
}

/**
 * Converts a string token between using double and single quotes.
 * @param {string} value The string value to convert. 
 * @param {string} quotes Either "double" or "single".
 * @returns {string} The converted string.
 */
function convertString(value, quotes) {

    const alternate = QUOTE_ALTERNATES.get(quotes);
    
    // Special case: Already the correct quote style
    if (value.charAt(0) === quotes) {
        return value;
    }

    // strip off the start and end quotes
    let newValue = value.slice(1, -1)

        // escape any instances of the desired quotes
        .replace(new RegExp(quotes, "g"), "\\" + quotes)

        // unescape any isntances of alternate quotes
        .replace(new RegExp(`\\\\([${alternate}])`, "g"), "$1");

    // add back on the desired quotes
    return quotes + newValue + quotes;
}


function buildTokenList(list, ast, text, options) {
    const { tokens, comments } = ast;
    let commentIndex = 0, tokenIndex = 0;
    let index = 0;
    let lineBreakCount = 0;

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
            const previousPart = list.last();
            list.add(newPart);
            index = comment.range[1];
            commentIndex++;

            if (list.isIndent(previousPart)) {
                list[originalIndents].set(newPart, previousPart.value);
            }

            lineBreakCount = 0;
            continue;
        }

        // next part is a token
        if (token && token.range[0] === index) {
            const newToken = {
                type: token.type,
                value: token.value,
                range: token.range
            };

            if (newToken.type === "String") {
                newToken.value = convertString(newToken.value, options.quotes);
            }

            list.add(newToken);
            index = newToken.range[1];
            tokenIndex++;
            lineBreakCount = 0;
            continue;
        }

        // otherwise it's whitespace, LineBreak, or EOF
        let c = text.charAt(index);
        if (c) {

            if (NEWLINE.test(c)) {

                // if there is whitespace before LineBreak, delete it
                if (options.trimTrailingWhitespace) {
                    const previous = list.last();
                    if (previous && list.isWhitespace(previous)) {
                        list.delete(previous);
                    }
                }

                let startIndex = index;

                if (c === "\r") {
                    if (text.charAt(index + 1) === "\n") {
                        index++;
                    }
                }

                if (lineBreakCount < options.maxEmptyLines + 1) {
                    list.add({
                        type: "LineBreak",
                        value: options.lineEndings,
                        range: [startIndex, index]
                    });
                }

                index++;
                lineBreakCount++;
                continue;
            }

            if (isWhitespace(c)) {
                let startIndex = index;
                do {
                    index++;
                } while (isWhitespace(text.charAt(index)));

                let value = text.slice(startIndex, index);

                /*
                 * If the previous part is a line break or start of the file
                 * (list is empty), then this is an indent and should not be
                 * changed. Otherwise, collapse the whitespace to a single
                 * space.
                 */
                if (options.collapseWhitespace) {
                    const previous = list.last();
                    if (!list.isLineBreak(previous) && !list.isEmpty()) {
                        value = " ";
                    }
                }

                list.add({
                    type: "Whitespace",
                    value,
                    range: [startIndex, index]
                });

                continue;
            }

        }

    }

}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A doubly-linked list representing the parts of source code.
 */
class TokenList extends OrderedSet {

    /**
     * Creates a new instance.
     */
    constructor() {

        super();

        /**
         * Keeps track of where in the source text that each token starts.
         * @property rangeStarts
         * @type Map
         * @private
         */
        this[rangeStarts] = new Map();

        /**
         * Keeps track of the original indents for some tokens.
         * @property originalIndents
         * @type Map
         * @private
         */
        this[originalIndents] = new Map();
    }

    /**
     * 
     * @param {Node} ast The AST to build a token list for. 
     * @param {string} text The original text of the source code. 
     * @param {TokenListOptions} options The options to apply to the token list. 
     */
    static fromAST(ast, text, options) {
        const list = new TokenList();
        buildTokenList(list, ast, text, {
            ...DEFAULT_OPTIONS,
            ...options
        });
        return list;
    }

    /**
     * Returns the original indent string for a given token.
     * @param {Token} token The token to look up the original indent for. 
     * @returns {string} The indent before the token in the original string or
     *      an empty string if not found.
     */
    getOriginalIndent(token) {
        return this[originalIndents].get(token) || "";
    }

    /**
     * Adds a new token and keeps track of its starting position.
     * @param {Token} part The part to add.
     * @returns {void}
     */
    add(part) {
        super.add(part);
        if (part.range) {
            this[rangeStarts].set(part.range[0], part);
        }
    }

    /**
     * Deletes a new token and its starting position.
     * @param {Token} part The part to delete.
     * @returns {void}
     */
    delete(part) {
        super.delete(part);
        if (part.range) {
            this[rangeStarts].set(part.range[0], part);
        }
    }

    /**
     * Inserts a token after a given token that already exists in the
     * set.
     * @param {*} part The token to insert.
     * @param {*} relatedPart The token after which to insert the new
     *      token.
     * @returns {void}
     * @throws {Error} If `part` is an invalid value for the set.
     * @throws {Error} If `part` already exists in the set.
     * @throws {Error} If `relatedPart` does not exist in the set.
     */
    insertAfter(part, relatedPart) {
        super.insertAfter(part, relatedPart);
        if (part.range) {
            this[rangeStarts].set(part.range[0], part);
        }
    }

    /**
     * Inserts a token before a given token that already exists in the
     * set.
     * @param {*} part The token to insert.
     * @param {*} relatedPart The token before which to insert the new
     *      token.
     * @returns {void}
     * @throws {Error} If `part` is an invalid value for the set.
     * @throws {Error} If `part` already exists in the set.
     * @throws {Error} If `relatedPart` does not exist in the set.
     */
    insertBefore(part, relatedPart) {
        super.insertBefore(part, relatedPart);
        if (part.range) {
            this[rangeStarts].set(part.range[0], part);
        }
    }

    /**
     * Gets the token that begins at the given index in the source text.
     * @param {int} start The range start. 
     * @returns {Token} The token is found or `undefined` if not.
     */
    getByRangeStart(start) {
        return this[rangeStarts].get(start);
    }

    /**
     * Determines if a given token is a punctuator.
     * @param {Token} part The token to check.
     * @returns {boolean} True if the token is a punctuator, false if not.
     */
    isPunctuator(part) {
        return part.type === "Punctuator";
    }

    /**
     * Determines if a given token is whitespace.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the token is whitespace, false if not.
     */
    isWhitespace(token) {
        return Boolean(token && token.type === "Whitespace");
    }

    /**
     * Determines if a given token is line break.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the token is a line break, false if not.
     */
    isLineBreak(token) {
        return Boolean(token && token.type === "LineBreak");
    }

    /**
     * Determines if a given token is whitespace or a line break.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the token is whitespace or a line break,
     *      false if not.
     */
    isWhitespaceOrLineBreak(token) {
        return this.isWhitespace(token) || this.isLineBreak(token);
    }

    /**
     * Determines if a given token is a line comment.
     * @param {Token} part The token to check.
     * @returns {boolean} True if the token is a line comment, false if not.
     */
    isLineComment(part) {
        return part.type === "LineComment";
    }

    /**
     * Determines if a given token is a block comment.
     * @param {Token} part The token to check.
     * @returns {boolean} True if the token is a block comment, false if not.
     */
    isBlockComment(part) {
        return part.type === "BlockComment";
    }

    /**
     * Determines if a given token is a comment.
     * @param {Token} part The token to check.
     * @returns {boolean} True if the token is a comment, false if not.
     */
    isComment(part) {
        return this.isLineComment(part) || this.isBlockComment(part);
    }

    /**
     * Determines if a given token is an indent. Indents are whitespace
     * immediately preceded by a line break or `undefined` if the token
     * is the first whitespace in the file.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the token is an indent, false if not. 
     */
    isIndent(token) {
        const previous = this.previous(token);
        return Boolean(
            this.isWhitespace(token) &&
            (!previous || this.isLineBreak(previous))
        );
    }

    /**
     * Determines if the indent should increase after this token.
     * @param {Token} token The token to check. 
     * @returns {boolean} True if the indent should be increased, false if not.
     */
    isIndentIncreaser(token) {
        return (INDENT_INCREASE_CHARS.has(token.value) || this.isTemplateOpen(token)) &&
            this.isLineBreak(this.next(token));
    }

    /**
     * Determines if the indent should decrease after this token.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the indent should be decreased, false if not.
     */
    isIndentDecreaser(token) {
        if (INDENT_DECREASE_CHARS.has(token.value) || this.isTemplateClose(token)) {
            let lineBreak = this.findPreviousLineBreak(token);
            return !lineBreak || (this.nextToken(lineBreak) === token);
        }

        return false;
    }

    /**
     * Determines if a given token is part of a template literal.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the token is a template, false if not.
     */
    isTemplate(token) {
        return Boolean(token && token.type === "Template");
    }

    /**
     * Determines if a given token is the start of a template literal with
     * placeholders.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the token is a template start, false if not.
     */
    isTemplateOpen(token) {
        return this.isTemplate(token) && token.value.endsWith("${");
    }

    /**
     * Determines if a given token is the end of a template literal with
     * placeholders.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the token is a template end, false if not.
     */
    isTemplateClose(token) {
        return this.isTemplate(token) && token.value.startsWith("}");
    }

    /**
     * Determines if the list is empty.
     * @returns {boolean} True if the list is empty, false if not.
     */
    isEmpty() {
        return !this.first();
    }

    /**
     * Finds the first non-whitespace token on the same line as the
     * given token.
     * @param {Token} token The token whose line should be searched. 
     * @returns {Token} The first non-whitespace token on the line.
     */
    findFirstTokenOrCommentOnLine(token) {
        const lineBreak = this.findPreviousLineBreak(token);
        return lineBreak ? this.nextTokenOrComment(lineBreak) : this.first();
    }

    /**
     * Finds the closest previous token that represents an indent.
     * @param {Token} token The part to start searching from. 
     * @returns {Token} The token if found or `undefined` if not.
     */
    findPreviousIndent(token) {
        let previousToken = this.previous(token);
        while (previousToken && !this.isIndent(previousToken)) {
            previousToken = this.previous(previousToken);
        }
        return previousToken;
    }

    /**
     * Finds the closest previous token that represents a line break.
     * @param {Token} token The part to start searching from. 
     * @returns {Token} The token if found or `undefined` if not.
     */
    findPreviousLineBreak(token) {
        let previousToken = this.previous(token);
        while (previousToken && !this.isLineBreak(previousToken)) {
            previousToken = this.previous(previousToken);
        }
        return previousToken;
    }

    /**
     * Returns the next non-whitespace, non-comment token after the given part.
     * @param {Token} startToken The part to search after.
     * @returns {Token} The next part or `undefined` if no more parts.
     */
    nextToken(startToken) {
        return this.findNext(token => SYNTAX_TOKENS.has(token.type), startToken);
    }

    /**
     * Returns the next non-whitespace token after the given token.
     * @param {Token} startToken The token to search after.
     * @returns {Token} The next token or `undefined` if no more tokens.
     */
    nextTokenOrComment(startToken) {
        return this.findNext(token => NON_WHITESPACE_TOKENS.has(token.type), startToken);
    }

    /**
     * Returns the previous non-whitespace, non-comment token before the given part.
     * @param {Token} startToken The part to search before.
     * @returns {Token} The previous part or `undefined` if no more tokens.
     */
    previousToken(startToken) {
        return this.findPrevious(token => SYNTAX_TOKENS.has(token.type), startToken);
    }

    /**
     * Returns the previous non-whitespace token after the given token.
     * @param {Token} startToken The token to search after.
     * @returns {Token} The next token or `undefined` if no more tokens.
     */
    previousTokenOrComment(startToken) {
        return this.findPrevious(token => NON_WHITESPACE_TOKENS.has(token.type), startToken);
    }


}

/**
 * @fileoverview AST Visitors
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Symbols
//-----------------------------------------------------------------------------

const tasks = Symbol("tasks");

//-----------------------------------------------------------------------------
// Visitor
//-----------------------------------------------------------------------------

class Visitor {
    constructor(visitorKeys = espree.VisitorKeys) {
        this.visitorKeys = visitorKeys;
    }

    visit(ast, callback) {
        estraverse.traverse(ast, {
            enter: callback,
            keys: this.visitorKeys,
            fallback: "iteration"
        });
    }
}


//-----------------------------------------------------------------------------
// Task Visitor
//-----------------------------------------------------------------------------

class TaskVisitor extends Visitor {
    constructor(visitorKeys) {
        super(visitorKeys);
        this[tasks] = [];
    }

    addTask(task) {
        this[tasks].push(task);
    }

    visit(ast, context) {

        const nodeTypes = new Map();

        // create visitors
        this[tasks].forEach(task => {
            const visitor = task(context);

            // store node-specific visitors in a map for easy lookup
            Object.keys(visitor).forEach(key => {
                if (!Array.isArray(nodeTypes.get(key))) {
                    nodeTypes.set(key, []);
                }

                nodeTypes.get(key).push(visitor[key].bind(visitor));
            });
        });

        // traverse the AST
        super.visit(ast, (node, parent) => {
            const visitors = nodeTypes.get(node.type);
            if (visitors) {
                visitors.forEach(visitor => {
                    visitor(node, parent);
                });
            }
        });
    }
}

/**
 * @fileoverview A task to automatically adjust semicolons as needed.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Data
//-----------------------------------------------------------------------------

const variableDeclarationExceptions = new Set([
    "ForInStatement",
    "ForOfStatement",
]);

//-----------------------------------------------------------------------------
// Task
//-----------------------------------------------------------------------------

function semicolonsTask(context) {
    const layout = context.layout;
    const semicolons = layout.options.semicolons;

    function adjustSemicolon(node) {
        if (semicolons) {
            layout.semicolonAfter(node);
        } else {
            layout.noSemicolonAfter(node);
        }
    }

    return {
        ExpressionStatement: adjustSemicolon,
        ReturnStatement: adjustSemicolon,
        ThrowStatement: adjustSemicolon,
        DoWhileStatement: adjustSemicolon,
        DebuggerStatement: adjustSemicolon,
        BreakStatement: adjustSemicolon,
        ContinueStatement: adjustSemicolon,
        ImportDeclaration: adjustSemicolon,
        ExportAllDeclaration: adjustSemicolon,
        ExportNamedDeclaration(node) {

            // declarations never need a semicolon
            if(!node.declaration) {
                adjustSemicolon(node);
            }

        },
        ExportDefaultDeclaration(node) {
            if (!/(?:Class|Function)Declaration/u.test(node.declaration.type)) {
                adjustSemicolon(node);
            }
        },
        VariableDeclaration(node, parent) {

            if (!variableDeclarationExceptions.has(parent.type) || parent.left !== node) {
                adjustSemicolon(node);
            }
        }

    }

}

/**
 * @fileoverview A task to automatically adjust spaces as needed.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

function findNextCommaOrSemicolon(layout, start) {
    return layout.findNext(part => part.type === "Punctuator", start);
}

function normalizePunctuatorSpacing(layout) {
    let token = findNextCommaOrSemicolon(layout);
    while (token) {

        switch (token.value) {
            case ",":
            case ";":
                layout.noSpaceBefore(token);
                layout.spaceAfter(token);
                break;
                
            case ".":
                layout.noSpaces(token);
                break;

            default:
                if (token.value.includes("=")) {
                    layout.spaceBefore(token);
                    layout.spaceAfter(token);
                }
        }

        token = findNextCommaOrSemicolon(layout, token);
    }
}

function spaceKeywordAndBrace(node, bodyKey, layout) {
    const firstToken = layout.firstToken(node);
    layout.spaceAfter(firstToken);

    const braceToken = layout.firstToken(node[bodyKey]);
    if (braceToken.value === "{") {
        layout.spaceBefore(braceToken);
    }

}

//-----------------------------------------------------------------------------
// Task
//-----------------------------------------------------------------------------

function spacesTask(context) {
    const layout = context.layout;

    // first, adjust all commas
    normalizePunctuatorSpacing(layout);


    return {

        ArrayExpression(node) {
            
            const { firstToken, lastToken } = layout.boundaryTokens(node);
            layout.noSpaceAfter(firstToken);
            
            // no spacing work for multiline
            if (!layout.isMultiLine(node)) {
              
                layout.noSpaceBefore(lastToken);

                if (node.elements.length) {

                    node.elements.forEach((element, index) => {

                        if (index > 0) {
                            layout.spaceBefore(element);
                        }
                        layout.noSpaceAfter(element);
                    });
                }
            }
        },

        ArrayPattern(node) {
            this.ArrayExpression(node);
        },

        ArrowFunctionExpression(node) {
    
            let openParenToken, closeParenToken;
            const firstToken = layout.firstToken(node);
    
            if (node.async) {
                layout.spaceAfter(firstToken);
            }
    
            if (node.params.length === 0) {
    
                openParenToken = node.async
                    ? layout.findNext("(", firstToken)
                    : firstToken;
    
                closeParenToken = layout.findNext(")", openParenToken);
            } else if (node.params.length === 1) {
                
                if (node.async) {
                    layout.spaceAfter(firstToken);
                    openParenToken = layout.findPrevious(part => {
                        return part === firstToken || part.value === "(";
                    }, node.params[0]);
                    
                    if (openParenToken.value !== "(") {
                        openParenToken = null;
                    } else {
                        closeParenToken = layout.findNext(")", node.params[0]);
                    }
    
                } else {
                    if (firstToken.value === "(") {
                        openParenToken = firstToken;
                        closeParenToken = layout.findNext(")", node.params[0]);
                    }
                }
    
            } else {
    
                openParenToken = node.async
                    ? layout.findNext("(", firstToken)
                    : firstToken;
    
                closeParenToken = layout.findNext(")", node.params[node.params.length - 1]);
            }
    
            if (openParenToken) {
                // have to do both in case there's a comment inside
                layout.noSpaceAfter(openParenToken);
                layout.noSpaceBefore(closeParenToken);
            }
        },


        AwaitExpression(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);
        },

        BinaryExpression(node) {
            const firstToken = layout.firstToken(node);
            const operatorToken = layout.findNext(node.operator, firstToken);
            layout.spaces(operatorToken);
        },

        BlockStatement(node) {
            const { firstToken, lastToken } = layout.boundaryTokens(node);
            if (layout.isSameLine(firstToken, lastToken)) {
                if (node.body.length) {
                    layout.spaceAfter(firstToken);
                    layout.spaceBefore(lastToken);
                } else {
                    layout.noSpaceAfter(firstToken);
                    layout.noSpaceBefore(lastToken);
                }
            }
        },

        ConditionalExpression(node) {
            const questionMark = layout.findPrevious("?", node.consequent);
            const colon = layout.findNext(":", node.consequent);
            
            layout.spaceBefore(questionMark);
            layout.spaces(questionMark);
            layout.spaces(colon);
        },

        DoWhileStatement(node) {
            spaceKeywordAndBrace(node, "body", layout);

            const whileToken = layout.findPrevious("while", node.test);
            layout.spaces(whileToken);
        },

        ExportNamedDeclaration(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);

            if (node.specifiers.length) {

                // adjust spaces around braces
                layout.spaceAfter(layout.findNext("{", firstToken));
                layout.spaceBefore(layout.findNext("}", firstToken));
            }
        },

        ForStatement(node) {
            spaceKeywordAndBrace(node, "body", layout);
        },

        ForInStatement(node) {
            this.ForStatement(node);
        },

        ForOfStatement(node) {
            this.ForStatement(node);
        },

        FunctionDeclaration(node, parent) {
            this.FunctionExpression(node, parent);
        },

        FunctionExpression(node, parent) {

            // ESTree quirk: concise methods don't have "function" keyword
            const isConcise =
                (parent.type === "Property" && parent.method) ||
                (parent.type === "MethodDefinition");
            let token = layout.firstToken(node);
            let id, openParen;

            if (!isConcise) {
                
                // "async" keyword
                if (token.value === "async") {
                    layout.spaceAfter(token);
                    token = layout.nextToken(token);
                }

                // "function" keyword
                layout.spaceAfter(token);
                token = layout.nextToken(token);

                // "*" punctuator
                if (token.value === "*") {
                    layout.noSpaceAfter(token);
                    token = layout.nextToken(token);
                }

                // function name
                if (token.type === "Identifier") {
                    layout.noSpaceAfter(token);
                    token = layout.nextToken(token);
                }
                
                if (token.value === "(") {
                    openParen = token;
                } else {
                    throw new Error(`Unexpected token "${token.value}".`);
                }
            } else {
                let idStart = layout.firstToken(parent.key);
                id = idStart;

                if (parent.computed) {
                    const leftBracket = layout.previousToken(idStart);
                    layout.noSpaceAfter(leftBracket);

                    const rightBracket = layout.nextToken(idStart);
                    layout.noSpaceBefore(rightBracket);

                    idStart = leftBracket;
                    id = rightBracket;
                }

                if (parent.generator) {
                    const star = layout.previousToken(idStart);
                    layout.noSpaceAfter(star);
                }

                openParen = token;
            }

            if (id) {
                layout.noSpaceAfter(id);
            }
            
            layout.noSpaces(openParen);

            const openBrace = layout.firstToken(node.body);
            layout.spaceBefore(openBrace);
            
            const closeParen = layout.findPrevious(")", openBrace);
            layout.noSpaceBefore(closeParen);
        },
        
        IfStatement(node) {
            spaceKeywordAndBrace(node, "consequent", layout);

            if (node.alternate) {
                const elseToken = layout.findPrevious("else", node.alternate);
                layout.spaces(elseToken);
            }
        },

        ImportDeclaration(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);

            const fromToken = layout.findPrevious("from", node.source);
            layout.spaces(fromToken);

            if (node.specifiers.some(node => node.type === "ImportSpecifier")) {

                // adjust spaces around braces
                layout.spaceAfter(layout.findNext("{", firstToken));
                layout.spaceBefore(layout.findNext("}", firstToken));
            }
        },

        LogicalExpression(node) {
            this.BinaryExpression(node);
        },

        MethodDefinition(node) {
            this.FunctionExpression(node.value, node);
        },

        ObjectExpression(node) {

            const { firstToken, lastToken } = layout.boundaryTokens(node);
            layout.spaceAfter(firstToken);

            if (!layout.isMultiLine(node)) {

                
                if (node.properties.length) {
                    
                    node.properties.forEach((property, index) => {
                        
                        if (index > 0) {
                            layout.spaceBefore(property);
                        }
                        layout.noSpaceAfter(property);
                    });
                }
            }
            
            layout.spaceBefore(lastToken);
        },

        ObjectPattern(node) {
            this.ObjectExpression(node);
        },

        Property(node) {

            // ensure there's a space after the colon in properties
            if (!node.shorthand && !node.method) {

                layout.spaceBefore(node.value);
                
                // also be sure to check spacing of computed properties
                if (node.computed) {
                    const firstToken = layout.firstToken(node.key);
                    const openBracket = layout.findPrevious("[", firstToken);
                    const closeBracket = layout.findNext("]", firstToken);
                    
                    layout.noSpaceAfter(openBracket);
                    layout.noSpaceBefore(closeBracket);
                    layout.noSpaceAfter(closeBracket);
                } else {
                    layout.noSpaceAfter(node.key);
                }
            }

            if (node.method) {
                layout.spaceBefore(node.value.body);
            }
        },

        ReturnStatement(node) {
            if (node.argument) {
                layout.spaceBefore(node.argument);
            } else {
                layout.noSpaceAfter(node);
            }
        },

        SwitchStatement(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);

            const braceToken = layout.findNext("{", node.discriminant);
            layout.spaceBefore(braceToken);
        },

        SwitchCase(node) {
            const colon = layout.findPrevious(":", node.consequent[0]);
            layout.noSpaceBefore(colon);
            layout.spaceAfter(colon);
        },

        TemplateLiteral(node) {
            const [firstQuasi, ...quasis] = node.quasis;
            if (quasis.length) {
                layout.noSpaceAfter(firstQuasi);
                
                quasis.forEach(quasi => {
                    layout.noSpaceBefore(quasi);
                    layout.noSpaceAfter(quasi);
                });
            }
        },

        ThrowStatement(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);
        },

        TryStatement(node) {
            spaceKeywordAndBrace(node, "block", layout);

            const catchToken = layout.firstToken(node.handler);
            layout.spaces(catchToken);

            const catchBraceToken = layout.firstToken(node.handler.body);
            layout.spaceBefore(catchBraceToken);

            if (node.finalizer) {
                const finallyBraceToken = layout.firstToken(node.finalizer);
                const finallyToken = layout.findPrevious("finally", finallyBraceToken);
                layout.spaces(finallyToken);
            }
        },

        UpdateExpression(node) {
            if (node.prefix) {
                const operatorToken = layout.firstToken(node);
                layout.noSpaceAfter(operatorToken);
            } else {
                const operatorToken = layout.lastToken(node);
                layout.noSpaceBefore(operatorToken);
            }
        },

        UnaryExpression(node) {
            this.UpdateExpression(node);
        },

        VariableDeclaration(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);
        },
        
        WhileStatement(node) {
            spaceKeywordAndBrace(node, "body", layout);
        },

        YieldExpression(node) {
            const firstToken = layout.firstToken(node);
            layout.spaceAfter(firstToken);
        },
        
    };

}

/**
 * @fileoverview A task to automatically adjust spaces as needed.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------


//-----------------------------------------------------------------------------
// Task
//-----------------------------------------------------------------------------

function indentsTask(context) {
    const layout = context.layout;


    function indentNonBlockBody(node, body) {
        if (body.type === "ExpressionStatement" && layout.isMultiLine(node)) {
            const indentLevel = layout.getIndentLevel(node);
            layout.indentLevel(body, indentLevel + 1);
        }
    }

    return {
        
        ForStatement(node) {
            indentNonBlockBody(node, node.body);
        },
        
        ForInStatement(node) {
            indentNonBlockBody(node, node.body);
        },
        
        ForOfStatement(node) {
            indentNonBlockBody(node, node.body);
        },
        
        IfStatement(node) {
            indentNonBlockBody(node, node.consequent);
        },
        
        SwitchCase(node) {
            const indentLevel = layout.getIndentLevel(node);
            node.consequent.forEach(child => {
                if (child.type !== "BlockStatement") {
                    layout.indentLevel(child, indentLevel + 1);
                }
            });
        },
        
        WhileStatement(node) {
            indentNonBlockBody(node, node.body);
        },
        
    };
}

/**
 * @fileoverview Handles wrapping for nodes.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------


function shouldIncreaseIndentForVariableDeclaration(node, sourceCode) {
    const parent = sourceCode.getParent(node);
    if (parent.type === "VariableDeclarator" && parent.init === node) {
        const grandParent = sourceCode.getParent(parent);

        return grandParent.declarations.length > 1 &&
            grandParent.declarations[0] === parent;
    }

    return false;
}

function unwrapObjectOrArrayLiteral(node, {layout}) {
    const children = node.type.startsWith("Array") ? "elements" : "properties";
    const { firstToken, lastToken } = layout.boundaryTokens(node);

    if (node[children].length === 0) {

        // if there are comments then we can't unwrap
        if (layout.nextTokenOrComment(firstToken) === lastToken) {
            layout.noLineBreakAfter(firstToken);
            layout.noSpaceAfter(firstToken);
            layout.noLineBreakBefore(lastToken);
            layout.noSpaceBefore(lastToken);
        }
    }
}

function wrapObjectOrArrayLiteral(node, {layout, sourceCode }) {
    const children = node.type.startsWith("Array") ? "elements" : "properties";
    const { firstToken, lastToken } = layout.boundaryTokens(node);
    const firstBodyToken = layout.nextTokenOrComment(firstToken);
    const lastBodyToken = layout.previousTokenOrComment(lastToken);
    let originalIndentLevel = layout.getIndentLevel(node);
    
    if (shouldIncreaseIndentForVariableDeclaration(node, sourceCode)) {
        originalIndentLevel++;
    }

    const newIndentLevel = originalIndentLevel + 1;

    layout.lineBreakAfter(firstToken);
    layout.lineBreakBefore(lastToken);
    layout.indentLevel(lastToken, originalIndentLevel);

    if (node[children].length) {
        node[children].forEach(child => {

            const lastToken = layout.lastToken(child);
            const maybeComma = layout.nextToken(lastToken);

            if (maybeComma.value === ",") {
                layout.lineBreakAfter(maybeComma);
            }
        });

        if (layout.options.trailingCommas) {
            layout.commaAfter(node[children][node[children].length - 1]);
        } else {
            layout.noCommaAfter(node[children][node[children].length - 1]);
        }
    }

    layout.indentLevelBetween(firstBodyToken, lastBodyToken, newIndentLevel);

}

function wrapFunction(node, { layout, sourceCode }) {
    const { firstToken, lastToken } = layout.boundaryTokens(node.body);
    const firstBodyToken = layout.nextTokenOrComment(firstToken);
    const lastBodyToken = layout.previousTokenOrComment(lastToken);
    let originalIndentLevel = layout.getIndentLevel(node);

    if (shouldIncreaseIndentForVariableDeclaration(node, sourceCode)) {
        originalIndentLevel++;
    }

    const newIndentLevel = originalIndentLevel + 1;

    // indent arguments
    if (node.params.length > 1 && layout.isLineTooLong(node)) {
        const openParen = layout.findPrevious("(", node.params[0]);
        const closeParen = layout.findPrevious(")", firstToken);

        layout.lineBreakAfter(openParen);
        layout.lineBreakBefore(closeParen);
        layout.indentLevel(closeParen, originalIndentLevel);

        node.params.forEach(param => {
            layout.indentLevel(param, newIndentLevel);
            const lastParamToken = layout.lastToken(param);
            const maybeComma = layout.nextToken(lastParamToken);
            if (maybeComma.value === ",") {
                layout.lineBreakAfter(maybeComma);
            }
        });
    }

    // indent body
    layout.lineBreakAfter(firstToken);
    layout.lineBreakBefore(lastToken);
    layout.indentLevel(lastToken, originalIndentLevel);
    layout.indentLevelBetween(firstBodyToken, lastBodyToken, newIndentLevel);
}

function wrapBinaryOrLogicalExpression(node, { layout, sourceCode }) {
    const parent = sourceCode.getParent(node);
    const indentLevel = layout.isMultiLine(parent)
        ? layout.getIndentLevel(parent) + 1
        : layout.getIndentLevel(node) + 1;
    const operator = layout.findNext(node.operator, node.left);

    layout.lineBreakAfter(operator);
    layout.indentLevel(node.right, indentLevel);
}

function unwrapBinaryOrLogicalExpression(node, { layout }) {
    const operator = layout.findNext(node.operator, node.left);
    layout.noLineBreakAfter(operator);
    layout.spaces(operator);
}

function wrapStatementWithTestCondition(node, { layout }) {
    const openParen = layout.findPrevious("(", node.test);
    const closeParen = layout.findNext(")", node.test);

    layout.noLineBreakAfter(openParen);
    layout.lineBreakBefore(closeParen);
}

function unwrapStatementWithTestCondition(node, { layout }) {
    const openParen = layout.findPrevious("(", node.test);
    const closeParen = layout.findNext(")", node.test);

    layout.noLineBreakAfter(openParen);
    layout.noLineBreakBefore(closeParen);
    layout.noSpaceAfter(openParen);
    layout.noSpaceBefore(closeParen);
}

function wrapImportOrExport(node, layout, startSpecifierIndex = 0) {

    if (node.specifiers[startSpecifierIndex]) {
        const openBrace = layout.findPrevious("{", node.specifiers[startSpecifierIndex]);
        const closeBrace = layout.findNext("}", node.specifiers[node.specifiers.length - 1]);
        layout.lineBreakAfter(openBrace);
        layout.lineBreakBefore(closeBrace);

        for (let i = startSpecifierIndex; i < node.specifiers.length; i++) {

            // imports always have no indent because they are top-level
            layout.indentLevel(node.specifiers[i], 1);
            const lastSpecifierToken = layout.lastToken(node.specifiers[i]);
            const maybeComma = layout.nextToken(lastSpecifierToken);
            if (maybeComma.value === ",") {
                layout.noSpaceBefore(maybeComma);
                layout.lineBreakAfter(maybeComma);
            }
        }
    }

}

const wrappers = new Map(Object.entries({
    ArrayExpression: wrapObjectOrArrayLiteral,
    ArrayPattern: wrapObjectOrArrayLiteral,
    ArrowFunctionExpression: wrapFunction,

    BinaryExpression: wrapBinaryOrLogicalExpression,

    CallExpression(node, {layout}) {
        const indentLevel = layout.getIndentLevel(node) + 1;
        const openParen = layout.findNext("(", node.callee);
        const closeParen = layout.lastToken(node);

        if (node.arguments.length > 1) {
            layout.lineBreakAfter(openParen);
            layout.lineBreakBefore(closeParen);

            node.arguments.forEach(argument => {
                layout.indentLevel(argument, indentLevel);
                const maybeComma = layout.nextToken(layout.lastToken(argument));
                if (maybeComma.value === ",") {
                    layout.lineBreakAfter(maybeComma);
                }
            });
        } else {
            layout.noSpaceAfter(openParen);
            layout.noSpaceBefore(closeParen);
        }
    },

    ConditionalExpression(node, {layout}) {
        const questionMark = layout.findPrevious("?", node.consequent);
        const colon = layout.findNext(":", node.consequent);
        
        layout.lineBreakBefore(questionMark);
        layout.indent(questionMark);
        layout.lineBreakBefore(colon);
        layout.indent(colon);
    },

    DoWhileStatement: wrapStatementWithTestCondition,

    ExportNamedDeclaration(node, { layout }) {
        wrapImportOrExport(node, layout);
    },

    FunctionDeclaration: wrapFunction,
    FunctionExpression: wrapFunction,
    IfStatement: wrapStatementWithTestCondition,

    ImportDeclaration(node, { layout }) {
        let startSpecifierIndex = 0;

        // don't consider default or namespace specifiers
        if (node.specifiers[0].type !== "ImportSpecifier") {
            startSpecifierIndex = 1;
        }

        wrapImportOrExport(node, layout, startSpecifierIndex);
    },

    LogicalExpression: wrapBinaryOrLogicalExpression,

    MemberExpression(node, {layout}) {

        // don't wrap member expressions with computed properties
        if (node.computed) {
            return;
        }

        const indentLevel = layout.getIndentLevel(node);
        const dot = layout.findPrevious(".", node.property);
        
        layout.lineBreakBefore(dot);
        layout.indentLevel(dot, indentLevel + 1);
    },

    ObjectExpression: wrapObjectOrArrayLiteral,
    ObjectPattern: wrapObjectOrArrayLiteral,
    
    TemplateLiteral(node, {layout}) {
        const indentLevel = layout.getIndentLevel(node) + 1;
        node.expressions.forEach(child => {
            layout.lineBreakBefore(child);
            layout.lineBreakAfter(child);
            layout.indentLevel(child, indentLevel);
        });
    },

    VariableDeclaration(node, {layout}) {
        const indentLevel = layout.getIndentLevel(node) + 1;
        
        if (node.declarations.length > 1) {
            node.declarations.forEach((declarator, i) => {
                const lastToken = layout.lastToken(declarator);
                const commaToken = layout.nextToken(lastToken);
                if (commaToken.value === ",") {
                    layout.lineBreakAfter(commaToken);
                }

                if (i > 0) {
                    layout.indentLevel(declarator, indentLevel);
                }
            });
        }
    },
    WhileStatement: wrapStatementWithTestCondition,
    
}));

const unwrappers = new Map(Object.entries({
    ArrayExpression: unwrapObjectOrArrayLiteral,
    ArrayPattern: unwrapObjectOrArrayLiteral,
    BinaryExpression: unwrapBinaryOrLogicalExpression,

    CallExpression(node, { layout }) {
        const openParen = layout.findNext("(", node.callee);
        const closeParen = layout.lastToken(node);

        layout.noLineBreakAfter(openParen);
        layout.noSpaceAfter(openParen);
        layout.noLineBreakBefore(closeParen);
        layout.noSpaceBefore(closeParen);

        node.arguments.forEach(argument => {
            const maybeComma = layout.nextToken(layout.lastToken(argument));
            if (maybeComma.value === ",") {
                layout.noLineBreakAfter(maybeComma);
                layout.noSpaceBefore(maybeComma);
                layout.spaceAfter(maybeComma);
            }
        });
    },

    ConditionalExpression(node, {layout}) {
        const questionMark = layout.findPrevious("?", node.consequent);
        const colon = layout.findNext(":", node.consequent);

        layout.noLineBreakBefore(questionMark);
        layout.spaces(questionMark);
        layout.noLineBreakBefore(colon);
        layout.spaces(colon);
    },

    DoWhileStatement: unwrapStatementWithTestCondition,
    IfStatement: unwrapStatementWithTestCondition,

    ImportDeclaration(node, { layout }) {
        let startSpecifierIndex = 0;

        // don't consider default or namespace specifiers
        if (node.specifiers[0].type !== "ImportSpecifier") {
            startSpecifierIndex = 1;
        }

        if (node.specifiers[startSpecifierIndex]) {
            const openBrace = layout.findPrevious("{", node.specifiers[startSpecifierIndex]);
            const closeBrace = layout.findNext("}", node.specifiers[node.specifiers.length - 1]);
            layout.noLineBreakAfter(openBrace);
            layout.spaceAfter(openBrace);
            layout.noLineBreakBefore(closeBrace);
            layout.spaceBefore(closeBrace);

            for (let i = startSpecifierIndex; i < node.specifiers.length; i++) {
                
                const lastSpecifierToken = layout.lastToken(node.specifiers[i]);
                const maybeComma = layout.nextToken(lastSpecifierToken);

                if (maybeComma.value === ",") {
                    layout.noSpaceBefore(maybeComma);
                    layout.noLineBreakAfter(maybeComma);
                    layout.spaceAfter(maybeComma);
                }
            }
        }
    },

    LogicalExpression: unwrapBinaryOrLogicalExpression,
    ObjectExpression: unwrapObjectOrArrayLiteral,
    ObjectPattern: unwrapObjectOrArrayLiteral,
    
    TemplateLiteral(node, {layout}) {
        node.expressions.forEach(child => {
            layout.noLineBreakBefore(child);
            layout.noLineBreakAfter(child);
        });
    },

    WhileStatement: unwrapStatementWithTestCondition,
}));

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

class Wrapper {
    constructor(options) {
        this.options = options;
    }

    wrap(node) {
        return wrappers.get(node.type)(node, this.options);
    }

    unwrap(node) {
        return unwrappers.get(node.type)(node, this.options);
    }
}

/**
 * @fileoverview A task to figure out multi- vs single-line layout.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const binaries = new Set([
    "BinaryExpression",
    "LogicalExpression"
]);


function isMemberExpression(node) {
    return Boolean(node && node.type === "MemberExpression");
}


//-----------------------------------------------------------------------------
// Task
//-----------------------------------------------------------------------------

function multilineTask(context) {
    const layout = context.layout;
    const wrapper = new Wrapper(context);

    function wrapIfTooLong(node) {
        if (layout.isLineTooLong(node)) {
            wrapper.wrap(node);
        }
    }

    function wrapIfTooLongOrMultiLine(node) {
        if (layout.isMultiLine(node) || layout.isLineTooLong(node)) {
            wrapper.wrap(node);
        }
    }

    return {
        ArrayExpression(node) {
            const isMultiLine = layout.isMultiLine(node);
            if (node.elements.length) {
                if (layout.isLineTooLong(node) || isMultiLine) {
                    wrapper.wrap(node);
                } else if (!isMultiLine) {
                    wrapper.unwrap(node);
                }
            } else {
                wrapper.unwrap(node);
            }
        },

        ArrayPattern(node) {
            this.ArrayExpression(node);
        },

        ArrowFunctionExpression(node, parent) {
            this.FunctionExpression(node, parent);
        },        
        
        BinaryExpression(node, parent) {
            if (layout.isMultiLine(node) || layout.isLineTooLong(node) ||
                (binaries.has(parent.type) && layout.isMultiLine(parent))
            ) {
                wrapper.wrap(node);
            }    
        },    

        CallExpression(node, parent) {
            // covers chained member expressions like `a.b().c()`
            if (isMemberExpression(parent) && layout.isMultiLine(parent) &&
                isMemberExpression(node.callee)
            ) {
                wrapper.wrap(node.callee);
            }    

            // covers long calls like `foo(bar, baz)`
            wrapIfTooLongOrMultiLine(node);
        },

        ConditionalExpression: wrapIfTooLongOrMultiLine,       
        
        DoWhileStatement(node) {

            /*
             * Because the condition is on the last list of a do-while loop
             * we need to check if the last line is too long rather than the
             * first line.
             */
            const openParen = layout.findPrevious("(", node.test);
            if (layout.isLineTooLong(openParen)) {
                wrapper.wrap(node);
            }
        },

        ExportNamedDeclaration: wrapIfTooLongOrMultiLine,

        FunctionDeclaration(node) {
            this.FunctionExpression(node);
        },

        FunctionExpression: wrapIfTooLongOrMultiLine,
        IfStatement: wrapIfTooLong,
        ImportDeclaration: wrapIfTooLongOrMultiLine,

        LogicalExpression(node, parent) {
            this.BinaryExpression(node, parent);
        },

        MemberExpression(node, parent) {

            // covers chained member calls like `a.b.c`
            if (
                layout.isMultiLine(node) || layout.isLineTooLong(node) ||
                (isMemberExpression(parent) && layout.isMultiLine(parent))
            ) {
                wrapper.wrap(node);
            }
        },

        TemplateLiteral: wrapIfTooLong,

        ObjectExpression(node) {
            const isMultiLine = layout.isMultiLine(node);
            if (node.properties.length) {
                if (layout.isLineTooLong(node) || isMultiLine) {
                    wrapper.wrap(node);
                } else if (!isMultiLine) {
                    wrapper.unwrap(node);
                }
            } else {
                wrapper.unwrap(node);
            }
        },

        ObjectPattern(node) {
            this.ObjectExpression(node);
        },

        VariableDeclaration: wrapIfTooLongOrMultiLine,
        WhileStatement: wrapIfTooLong,

    };
}

/**
 * @fileoverview Utility for laying out JavaScript files.
 * @author Nicholas C. Zakas
 */

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


const DEFAULT_OPTIONS$1 = {
    indent: 4,
    tabWidth: 4,
    lineEndings: "unix",
    semicolons: true,
    quotes: "double",
    collapseWhitespace: true,
    trailingCommas: false,
    maxEmptyLines: 1,
    maxLineLength: Infinity,
    trimTrailingWhitespace: true
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

function normalizeIndents(tokenList, options) {
    const indent = options.indent;
    let indentLevel = 0;
    let token = tokenList.first();

    while (token) {

        if (tokenList.isIndentIncreaser(token)) {
            indentLevel++;
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
        } else if (tokenList.isIndent(token)) {
            if (indentLevel > 0) {
                token.value = indent.repeat(indentLevel);
            } else {
                const previousToken = tokenList.previous(token);
                tokenList.delete(token);
                token = previousToken;
            }
        } else if (indentLevel > 0 && tokenList.isLineBreak(token)) {
            
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
        } else if (tokenList.isBlockComment(token)) {
            indentBlockComment(token, tokenList, options);
        }

        token = tokenList.next(token);
    }
}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

class Layout {
    constructor(sourceCode, options = {}) {
        this.options = normalizeOptions({
            ...DEFAULT_OPTIONS$1,
            ...options
        });

        let tokenList = TokenList.fromAST(sourceCode.ast, sourceCode.text, this.options);
        normalizeIndents(tokenList, this.options);
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

        const tasks = new TaskVisitor(espree.VisitorKeys);
        tasks.addTask(semicolonsTask);
        tasks.addTask(spacesTask);
        tasks.addTask(indentsTask);
        tasks.addTask(multilineTask);
        // tasks.addTask(spacesTask);
        tasks.visit(sourceCode.ast, Object.freeze({ sourceCode, layout: this }));
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
            if (this.tokenList.isWhitespace(previousToken) && !this.tokenList.isIndent(previousToken)) {
                previousToken.value = " ";
            } else if (!this.tokenList.isLineBreak(previousToken)) {
                this.tokenList.insertBefore({
                    type: "Whitespace",
                    value: " "
                }, firstToken);
            }
        } else {
            this.tokenList.insertBefore({
                type: "Whitespace",
                value: " "
            }, firstToken);
        }
    }

    spaceAfter(partOrNode) {
        let lastToken = this.lastToken(partOrNode);

        const nextToken = this.tokenList.next(lastToken);
        if (nextToken) {
            if (this.tokenList.isWhitespace(nextToken)) {
                nextToken.value = " ";
            } else if (!this.tokenList.isLineBreak(nextToken)) {
                this.tokenList.insertAfter({
                    type: "Whitespace",
                    value: " "
                }, lastToken);
            }
        }
    }

    spaces(partOrNode) {
        this.spaceBefore(partOrNode);
        this.spaceAfter(partOrNode);
    }

    noSpaceAfter(partOrNode) {
        let part = this.lastToken(partOrNode);

        const next = this.tokenList.next(part);
        if (next && this.tokenList.isWhitespace(next)) {
            this.tokenList.delete(next);
        }
    }

    noSpaceBefore(partOrNode) {
        let part = this.firstToken(partOrNode);

        const previous = this.tokenList.previous(part);
        if (previous && this.tokenList.isWhitespace(previous)) {
            this.tokenList.delete(previous);
        }
    }

    noSpaces(partOrNode) {
        this.noSpaceAfter(partOrNode);
        this.noSpaceBefore(partOrNode);
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
            }
        } else {
            // we are at the end of the file, so just add the semicolon
            this.tokenList.add({
                type: "Punctuator",
                value: ";"
            });
        }
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
            
            this.tokenList.insertBefore({
                type: "LineBreak",
                value: this.options.lineEndings
            }, token);

            return true;
        }
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

/**
 * @fileoverview Wraps source code information.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

const parents = Symbol("parents");

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * Represents all static information about source code.
 */
class SourceCode {

    /**
     * Creates a new instance.
     * @param {string} text The source code text.
     * @param {string} filePath The full path to the file containing the text.
     * @param {Node} ast The AST representing the source code.
     */
    constructor(text, filePath, ast) {
        
        /**
         * The source code text.
         * @property text
         * @type string
         */
        this.text = text;

        /**
         * The full path to the file containing the source code.
         * @property filePath
         * @type string
         */
        this.filePath = filePath;

        /**
         * The AST representation of the source code.
         * @property ast
         * @type Node
         */
        this.ast = ast;

        /**
         * Map of node parents.
         * @property parents
         * @type Map
         * @private
         */
        this[parents] = new Map();

        // initialize the parents map
        const parentMap = this[parents];
        const visitor = new Visitor();
        visitor.visit(ast, (node, parent) => {
            parentMap.set(node, parent);
        });
    }

    /**
     * Retrieves the parent of the given node.
     * @param {Node} node The node whose parent should be retrieved. 
     * @returns {Node} The parent of the given node or `undefined` if node is 
     *      the root.
     */
    getParent(node) {
        return this[parents].get(node);
    }
}

/**
 * @fileoverview Text formatter for JavaScript files.
 * @author Nicholas C. Zakas
 */


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

class Formatter {
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

export { Formatter as JavaScriptFormatter };

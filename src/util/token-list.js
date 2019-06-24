/**
 * @fileoverview Doubly-linked list representing tokens.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { OrderedSet } from "@humanwhocodes/ordered-set";

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
    "Template"
]);

const NON_WHITESPACE_TOKENS = new Set([
    ...SYNTAX_TOKENS,
    "LineComment",
    "BlockComment"
]);

const WHITESPACE = /\s/;
export const NEWLINE = /[\r\n\u2028\u2029]/;

const QUOTE_ALTERNATES = new Map([
    ["\"", "'"],
    ["`", "\""]
]);

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
                ...token
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
                const previous = list.last();
                if (previous && list.isWhitespace(previous)) {
                    list.delete(previous);
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

                /*
                 * If the previous part is a line break, then this is an indent
                 * and should not be changed. Otherwise, normalize the whitespace
                 * to a single space.
                 */
                const previous = list.last();
                const value = list.isLineBreak(previous)
                    ? text.slice(startIndex, index)
                    : " ";

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
export class TokenList extends OrderedSet {

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

    static fromAst(ast, text, options) {
        const list = new TokenList();
        buildTokenList(list, ast, text, options);
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
        return token.type === "Whitespace";
    }

    /**
     * Determines if a given token is line break.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the token is a line break, false if not.
     */
    isLineBreak(token) {
        return token.type === "LineBreak";
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
     * immediately preceded by a line break.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the token is an indent, false if not. 
     */
    isIndent(token) {
        const previous = this.previous(token);
        return Boolean(previous && this.isWhitespace(token) && this.isLineBreak(previous));
    }

    /**
     * Determines if a given token is part of a template literal.
     * @param {Token} token The token to check.
     * @returns {boolean} True if the token is a template, false if not.
     */
    isTemplate(token) {
        return token.type === "Template";
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
     * @param {Token} part The part to start searching from. 
     * @returns {Token} The token if found or `undefined` if not.
     */
    findPreviousIndent(part) {
        let previous = this.previous(part);
        while (previous && !this.isIndent(previous)) {
            previous = this.previous(previous);
        }
        return previous;
    }

    /**
     * Finds the closest previous token that represents a line break.
     * @param {Token} part The part to start searching from. 
     * @returns {Token} The token if found or `undefined` if not.
     */
    findPreviousLineBreak(part) {
        let previous = this.previous(part);
        while (previous && !this.isLineBreak(previous)) {
            previous = this.previous(previous);
        }
        return previous;
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

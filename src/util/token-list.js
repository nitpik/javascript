/**
 * @fileoverview Doubly-linked list representing tokens.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { NitpikTokenList } from "@nitpik/toolkit";

//-----------------------------------------------------------------------------
// TypeDefs
//-----------------------------------------------------------------------------

/**
 * @typedef TokenListOptions
 * @property {boolean} collapseWhitespace If true, replaces multiple whitespace
 *      characters with a single space.
 * @property {string} lineEndings The string to use as a line ending.
 * @property {int} maxEmptyLines The maximum number of empty lines permitted
 *      before lines are deleted from the token list.
 * @property {string} quotes The string to use to quote strings.
 */

//-----------------------------------------------------------------------------
// Private
//-----------------------------------------------------------------------------

const originalIndents = Symbol("originalIndents");

export const NEWLINE = /[\r\n\u2028\u2029]/;

const QUOTE_ALTERNATES = new Map([
    ["\"", "'"],
    ["`", "\""]
]);

const INDENT_INCREASE_CHARS = new Set(["{", "(", "["]);
const INDENT_DECREASE_CHARS = new Set(["}", ")", "]"]);

/** @type TokenListOptions */
const DEFAULT_OPTIONS = {
    lineEndings: "\n",
    quotes: "\"",
    collapseWhitespace: true,
    newLinePattern: NEWLINE
};

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------
/**
 * Converts a string token between using double and single quotes.
 * @param {string} value The string value to convert. 
 * @param {string} quotes Either "double" or "single".
 * @returns {string} The converted string.
 */
function convertString(value, quotes) {

    // Special case: Already the correct quote style
    if (value.charAt(0) === quotes) {
        return value;
    }
    
    const alternate = QUOTE_ALTERNATES.get(quotes);
    
    // strip off the start and end quotes
    let newValue = value.slice(1, -1)

        // escape any instances of the desired quotes
        .replace(new RegExp(quotes, "g"), "\\" + quotes)

        // unescape any isntances of alternate quotes
        .replace(new RegExp(`\\\\([${alternate}])`, "g"), "$1");

    // add back on the desired quotes
    return quotes + newValue + quotes;
}

function getCommentType(comment) {

    if (comment.type === "Line") {
        return "LineComment";
    }

    if (comment.type === "Block") {
        return "BlockComment";
    }

    return "HashbangComment";
}

function createTokens({ tokens, comments, text }, options) {

    let tokenIndex = 0, commentIndex = 0;
    const tokensAndComments = [];

    while (tokenIndex < tokens.length || commentIndex < comments.length) {
        let comment = comments[commentIndex];
        let token = tokens[tokenIndex];

        // next part is a comment
        if (!token || (comment && comment.range[0] < token.range[0])) {
            tokensAndComments.push({
                type: getCommentType(comment),
                value: text.slice(comment.range[0], comment.range[1]),
                range: comment.range
            });
            commentIndex++;
            continue;
        }

        // next part is a token
        if (!comment || (token && token.range[0] < comment.range[0])) {
            const newToken = {
                type: token.type,
                value: token.value,
                range: token.range
            };

            if (newToken.type === "String") {
                newToken.value = convertString(newToken.value, options.quotes);
            }

            tokensAndComments.push(newToken);
            tokenIndex++;
            continue;
        }

    }

    return tokensAndComments;

}

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A doubly-linked list representing the parts of source code.
 */
export class TokenList extends NitpikTokenList {

    /**
     * Creates a new instance.
     */
    constructor(iterable = []) {

        super(iterable);

        /**
         * Keeps track of the original indents for some tokens.
         * @property originalIndents
         * @type Map
         * @private
         */
        this[originalIndents] = new Map();
    }

    static from({ tokens, text, options }) {

        const list = super.from({ tokens, text, options: {
            ...options,
            ...DEFAULT_OPTIONS
        }});

        /*
         * In order to properly indent comments later on, we need to keep
         * track of their original indents before changes are made.
         */
        for (const token of list) {
            if (list.isComment(token)) {
                const previousToken = list.previous(token);
                if (list.isIndent(previousToken)) {
                    list[originalIndents].set(token, previousToken.value);
                }
            }
        }

        return list;
    }

    static fromAST(ast, text, options) {
        const finalOptions = {
            ...DEFAULT_OPTIONS,
            ...options
        };

        const tokens = createTokens({
            tokens: ast.tokens,
            comments: ast.comments,
            text
        }, finalOptions);

        return this.from({ tokens, text, finalOptions });
    }

    /**
     * Returns the original indent string for a given token.
     * @param {Token} token The token to look up the original indent for. 
     * @returns {string} The indent before the token in the original string or
     *      an empty string if not found.
     */
    getOriginalCommentIndent(token) {
        return this[originalIndents].get(token) || "";
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

}

/**
 * @fileoverview Doubly-linked list representing code parts.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Imports
//-----------------------------------------------------------------------------

import { OrderedSet } from "@humanwhocodes/ordered-set";

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

export class CodeParts extends OrderedSet {

    /**
     * Determines if a given code part is a punctuator.
     * @param {CodePart} part The code part to check.
     * @returns {boolean} True if the code part is a punctuator, false if not.
     */
    isPunctuator(part) {
        return part.type === "Punctuator";
    }

    /**
     * Determines if a given code part is whitespace.
     * @param {CodePart} part The code part to check.
     * @returns {boolean} True if the code part is whitespace, false if not.
     */
    isWhitespace(part) {
        return part.type === "Whitespace";
    }

    /**
     * Determines if a given code part is a line comment.
     * @param {CodePart} part The code part to check.
     * @returns {boolean} True if the code part is a line comment, false if not.
     */
    isLineComment(part) {
        return part.type === "LineComment";
    }

    /**
     * Determines if a given code part is a block comment.
     * @param {CodePart} part The code part to check.
     * @returns {boolean} True if the code part is a block comment, false if not.
     */
    isBlockComment(part) {
        return part.type === "BlockComment";
    }

    /**
     * Determines if a given code part is line break.
     * @param {CodePart} part The code part to check.
     * @returns {boolean} True if the code part is a line break, false if not.
     */
    isLineBreak(part) {
        return part.type === "LineBreak";
    }

    /**
     * Determines if a given code part is an indent. Indents are whitespace
     * immediately preceded by a line break.
     * @param {CodePart} part The code part to check.
     * @returns {boolean} True if the code part is an indent, false if not. 
     */
    isIndent(part) {
        const previous = this.previous(part);
        return Boolean(previous && this.isWhitespace(part) && this.isLineBreak(previous));
    }

    /**
     * Finds the closest previous code part that represents an indent.
     * @param {CodePart} part The part to start searching from. 
     * @returns {CodePart} The code part if found or `undefined` if not.
     */
    findPreviousIndent(part) {
        let previous = this.previous(part);
        while (previous && !this.isIndent(previous)) {
            previous = this.previous(previous);
        }
        return previous;
    }
}

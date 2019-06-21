/**
 * @fileoverview Doubly-linked list representing code parts.
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

//-----------------------------------------------------------------------------
// Exports
//-----------------------------------------------------------------------------

/**
 * A doubly-linked list representing the parts of source code.
 */
export class CodeParts extends OrderedSet {

    /**
     * Creates a new instance.
     */
    constructor() {

        super();

        /**
         * Keeps track of where in the source text that each code part starts.
         * @property rangeStarts
         * @type Map
         * @private
         */
        this[rangeStarts] = new Map();
    }

    /**
     * Adds a new code part and keeps track of its starting position.
     * @param {CodePart} part The part to add.
     * @returns {void}
     */
    add(part) {
        super.add(part);
        if (part.range) {
            this[rangeStarts].set(part.range[0], part);
        }
    }

    /**
     * Deletes a new code part and its starting position.
     * @param {CodePart} part The part to delete.
     * @returns {void}
     */
    delete(part) {
        super.delete(part);
        if (part.range) {
            this[rangeStarts].set(part.range[0], part);
        }
    }

    /**
     * Inserts a code part after a given code part that already exists in the
     * set.
     * @param {*} part The code part to insert.
     * @param {*} relatedPart The code part after which to insert the new
     *      code part.
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
     * Inserts a code part before a given code part that already exists in the
     * set.
     * @param {*} part The code part to insert.
     * @param {*} relatedPart The code part before which to insert the new
     *      code part.
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
     * Gets the code part that begins at the given index in the source text.
     * @param {int} start The range start. 
     * @returns {CodePart} The code part is found or `undefined` if not.
     */
    getByRangeStart(start) {
        return this[rangeStarts].get(start);
    }

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

/**
 * @fileoverview Tests for OrderedWeakSet.
 * @author Nicholas C. Zakas
 */

"use strict";

//-----------------------------------------------------------------------------
// Requirements
//-----------------------------------------------------------------------------

const OrderedSet = require("../src/index.js");
const assert = require("chai").assert;

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------

/**
 * Asserts that the contents of the OrderedSet exactly match
 * an array of results, backwards and forwards.
 * 
 * @param {OrderedSet} set The set to check.
 * @param {Array} result The expected contents of the set.
 * @throws {AssertionError} If the set contents don't match the result.
 * @returns {void}
 */
function assertOrder(set, result) {
    assert.strictEqual(set.size, result.length);
    assert.strictEqual(set.first(), result[0]);
    assert.strictEqual(set.last(), result[result.length - 1]);
    assert.deepStrictEqual([...set], result);
    assert.deepStrictEqual([...set.reverse()], result.reverse());
}

//-----------------------------------------------------------------------------
// Tests
//-----------------------------------------------------------------------------

describe("OrderedSet", () => {

    const item ="a";
    const item2 = "b";
    const item3 = "c";

    describe("add()", () => {

        it("adds a new item when passed one item", () => {
            const set = new OrderedSet();
            const result = [item];

            set.add(item);

            assertOrder(set, result);
        });
        
        it("adds new items when passed multiple items", () => {
            const set = new OrderedSet();
            const result = [item, item2, item3];

            set.add(item);
            set.add(item2);
            set.add(item3);

            assertOrder(set, result);
        });

        it("throws an error when undefined is passed", () => {
            const set = new OrderedSet();

            
            assert.throws(() => {
                set.add(undefined);
            }, /null or undefined/);
        });

        it("throws an error when null is passed", () => {
            const set = new OrderedSet();

            
            assert.throws(() => {
                set.add(null);
            }, /null or undefined/);
        });
    });

    describe("delete()", () => {

        it("removes an item from a one-item list", () => {
            const set = new OrderedSet();
            const result = [];

            set.add(item);
            set.delete(item);

            assertOrder(set, result);
        });
        
        it("removes an item from the middle of a list", () => {
            const set = new OrderedSet();
            const result = [item, item3];

            set.add(item);
            set.add(item2);
            set.add(item3);

            set.delete(item2);

            assertOrder(set, result);
        });

        it("removes an item from the end of a list", () => {
            const set = new OrderedSet();
            const result = [item, item2];

            set.add(item);
            set.add(item2);
            set.add(item3);

            set.delete(item3);

            assertOrder(set, result);
        });

        it("throws an error when undefined is passed", () => {
            const set = new OrderedSet();

            assert.throws(() => {
                set.delete(undefined);
            }, /null or undefined/);
        });

        it("throws an error when null is passed", () => {
            const set = new OrderedSet();
            
            assert.throws(() => {
                set.delete(null);
            }, /null or undefined/);
        });

        it("throws an error when a value not in the set is passed", () => {
            const set = new OrderedSet();
            
            assert.throws(() => {
                set.delete("a");
            }, /Item 'a' does not exist/);
        });
    });

    describe("insertBefore()", () => {

        it("inserts an item at the start", () => {
            const set = new OrderedSet();
            const result = [item2, item];

            set.add(item);
            set.insertBefore(item2, item);

            assertOrder(set, result);
        });
        
        it("inserts an item in the middle", () => {
            const set = new OrderedSet();
            const result = [item, item2, item3];

            set.add(item);
            set.add(item3);
            set.insertBefore(item2, item3);
            
            assertOrder(set, result);
        });

        it("throws an error when undefined is passed", () => {
            const set = new OrderedSet();

            set.add(item);

            assert.throws(() => {
                set.insertBefore(undefined, item);
            }, /null or undefined/);
        });

        it("throws an error when null is passed", () => {
            const set = new OrderedSet();

            set.add(item);

            assert.throws(() => {
                set.insertBefore(null, item);
            }, /null or undefined/);
        });
    });

    describe("insertAfter()", () => {

        it("inserts an item in the middle", () => {
            const set = new OrderedSet();
            const result = [item, item2, item3];

            set.add(item);
            set.add(item3);
            set.insertAfter(item2, item);
            
            assertOrder(set, result);
        });

        it("inserts an item at the end", () => {
            const set = new OrderedSet();
            const result = [item, item2];

            set.add(item);
            set.insertAfter(item2, item);
            
            assertOrder(set, result);
        });

        it("throws an error when undefined is passed", () => {
            const set = new OrderedSet();

            set.add(item);

            assert.throws(() => {
                set.insertAfter(undefined, item);
            }, /null or undefined/);
        });

        it("throws an error when null is passed", () => {
            const set = new OrderedSet();

            set.add(item);

            assert.throws(() => {
                set.insertAfter(null, item);
            }, /null or undefined/);
        });
    });

});
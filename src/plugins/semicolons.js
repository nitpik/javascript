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

export default function(context) {
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

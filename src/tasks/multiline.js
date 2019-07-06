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

export default function(context) {
    const layout = context.layout;
    
    function wrapIfTooLong(node) {
        if (layout.isLineTooLong(node)) {
            layout.wrap(node);
        }
    }

    function wrapIfTooLongOrMultiLine(node) {
        if (layout.isMultiLine(node) || layout.isLineTooLong(node)) {
            layout.wrap(node);
        }
    }

    return {
        ArrayExpression(node) {
            const isMultiLine = layout.isMultiLine(node);
            if (node.elements.length) {
                if (layout.isLineTooLong(node) || isMultiLine) {
                    layout.wrap(node);
                } else if (!isMultiLine) {
                    layout.noWrap(node);
                }
            } else {
                layout.noWrap(node);
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
                layout.wrap(node);
            }    
        },    

        CallExpression(node, parent) {
            // covers chained member expressions like `a.b().c()`
            if (isMemberExpression(parent) && layout.isMultiLine(parent) &&
                isMemberExpression(node.callee)
            ) {
                layout.wrap(node.callee);
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
                layout.wrap(node);
            }
        },

        FunctionDeclaration(node) {
            this.FunctionExpression(node);
        },

        FunctionExpression: wrapIfTooLongOrMultiLine,
        IfStatement: wrapIfTooLong,

        LogicalExpression(node, parent) {
            this.BinaryExpression(node, parent);
        },

        MemberExpression(node, parent) {

            // covers chained member calls like `a.b.c`
            if (
                layout.isMultiLine(node) || layout.isLineTooLong(node) ||
                (isMemberExpression(parent) && layout.isMultiLine(parent))
            ) {
                layout.wrap(node);
            }
        },

        TemplateLiteral: wrapIfTooLong,

        ObjectExpression(node) {
            const isMultiLine = layout.isMultiLine(node);
            if (node.properties.length) {
                if (layout.isLineTooLong(node) || isMultiLine) {
                    layout.wrap(node);
                } else if (!isMultiLine) {
                    layout.noWrap(node);
                }
            } else {
                layout.noWrap(node);
            }
        },

        ObjectPattern(node) {
            this.ObjectExpression(node);
        },

        VariableDeclaration: wrapIfTooLongOrMultiLine,
        WhileStatement: wrapIfTooLong,

    };
}

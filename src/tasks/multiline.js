/**
 * @fileoverview A task to figure out multi- vs single-line layout.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------


function isMemberExpression(node) {
    return Boolean(node && node.type === "MemberExpression");
}


//-----------------------------------------------------------------------------
// Task
//-----------------------------------------------------------------------------

export default function(context) {
    const layout = context.layout;
    
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
        
        CallExpression(node, parent) {

            // covers chained member expressions like `a.b().c()`
            if (
                isMemberExpression(parent) && layout.isMultiLine(parent) &&
                isMemberExpression(node.callee)
            ) {
                layout.wrap(node.callee);
            }
        },

        ConditionalExpression(node) {
            if (layout.isMultiLine(node) || layout.isLineTooLong(node)) {
                layout.wrap(node);
            }    
        },    

        FunctionExpression(node) {
            if (layout.isMultiLine(node) || layout.isLineTooLong(node)) {
                layout.wrap(node);
            }        
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

        TemplateLiteral(node) {
            if (layout.isLineTooLong(node)) {
                layout.wrap(node);
            }
        },

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

        VariableDeclaration(node) {
            if (layout.isLineTooLong(node) || layout.isMultiLine(node)) {
                layout.wrap(node);
            }
        }

    };
}

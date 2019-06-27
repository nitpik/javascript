/**
 * @fileoverview A task to figure out multi- vs single-line layout.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Helpers
//-----------------------------------------------------------------------------


//-----------------------------------------------------------------------------
// Task
//-----------------------------------------------------------------------------

export default function(context) {
    const layout = context.layout;
    
    return {
        
        CallExpression(node, parent) {

            // covers chained member expressions like `a.b().c()`
            if (parent.type === "MemberExpression" && layout.isMultiLine(parent)) {
                if (node.callee.type === "MemberExpression") {
                    layout.wrap(node.callee);
                }
            }
        },

        ConditionalExpression(node) {
            if (!layout.isMultiLine(node) && layout.isLineTooLong(node)) {
                layout.wrap(node);
            }    
        },    

        MemberExpression(node, parent) {

            // Covers chained member expressions like `a.b.c`
            if (parent.type === "MemberExpression" && layout.isMultiLine(parent)) {
                layout.wrap(node);
                return;
            }

            if (layout.isLineTooLong(node)) {
                layout.wrap(node);
            }
        },

        TemplateLiteral(node) {
            if (layout.isLineTooLong(node)) {
                layout.wrap(node);
            }
        },

        ArrayExpression(node) {
            if (layout.isMultiLine(node)) {

                if (node.elements.length) {
                    const lastElementToken = layout.lastToken(node.elements[node.elements.length - 1]);
                    const closeBracket = layout.lastToken(node);

                    if (!layout.isSameLine(lastElementToken, closeBracket)) {
                        if (layout.options.trailingCommas) {
                            layout.commaAfter(lastElementToken);
                        }
                    }
                } else {
                    layout.noWrap(node);
                }
                
            }
        },

        ObjectExpression(node) {
            if (layout.isMultiLine(node)) {

                if (node.properties.length) {
                    const lastElementToken = layout.lastToken(node.properties[node.properties.length - 1]);
                    const closeBracket = layout.lastToken(node);

                    if (!layout.isSameLine(lastElementToken, closeBracket)) {
                        if (layout.options.trailingCommas) {
                            layout.commaAfter(lastElementToken);
                        }
                    }
                } else {
                    layout.noWrap(node);
                }

            }
        }

    };
}

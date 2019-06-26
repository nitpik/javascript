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
        
        ConditionalExpression(node) {
            if (!layout.isMultiLine(node) && (layout.getLineLength(node) > layout.options.maxLineLength)) {
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

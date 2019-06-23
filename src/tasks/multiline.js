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

        ArrayExpression(node) {
            if (layout.isMultiLine(node) && node.elements.length) {
                const lastElementToken = layout.getLastCodePart(node.elements[node.elements.length - 1]);
                const closeBracket = layout.getLastCodePart(node);
                
                if (!layout.isSameLine(lastElementToken, closeBracket)) {
                    if (layout.options.trailingCommas) {
                        layout.commaAfter(lastElementToken);
                    }
                }
            }
        },

        ObjectExpression(node) {
            if (layout.isMultiLine(node) && node.properties.length) {
                const lastPropertyToken = layout.getLastCodePart(node.properties[node.properties.length - 1]);
                const closeBrace = layout.getLastCodePart(node);
                
                if (!layout.isSameLine(lastPropertyToken, closeBrace)) {
                    if (layout.options.trailingCommas) {
                        layout.commaAfter(lastPropertyToken);
                    }
                }
            }
        }

    };
}

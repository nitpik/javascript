/**
 * @fileoverview A task to automatically adjust spaces as needed.
 * @author Nicholas C. Zakas
 */

//-----------------------------------------------------------------------------
// Task
//-----------------------------------------------------------------------------

export default function(context) {
    const layout = context.layout;

    return {
        ArrayExpression(node) {
            if (node.loc.start.line === node.loc.end.line) {
                if (node.elements.length) {

                    node.elements.forEach(element => {
                        layout.spaceBefore(element);
                        layout.noSpaceAfter(element);
                    });

                    layout.spaceAfter(node.elements[node.elements.length - 1]);
                }
            }
        },
        ReturnStatement(node) {
            if (node.argument) {
                layout.spaceBefore(node.argument);
            } else {
                layout.noSpaceAfter(node);
            }

            layout.semicolonAfter(node);
        },
        Property(node) {

            // ensure there's a space after the colon in properties
            if (!node.shorthand && !node.method) {
                layout.spaceBefore(node.value);
                layout.noSpaceAfter(node.key);
            }

            if (node.method) {
                layout.spaceBefore(node.value.body);
            }
        }

    };

}

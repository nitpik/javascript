/**
 * @fileoverview A task to automatically adjust spaces as needed.
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

        SwitchCase(node) {
            node.consequent.forEach(child => {
                if (child.type !== "BlockStatement") {
                    layout.indent(child);
                }
            });
        }

    };
}

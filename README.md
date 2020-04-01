# Nitpik JavaScript Formatter

by [Nicholas C. Zakas](https://humanwhocodes.com)

![Node CI](https://github.com/nitpik/javascript/workflows/Node%20CI/badge.svg)

If you find this useful, please consider supporting my work with a [donation](https://humanwhocodes.com/donate).

## Description

A pluggable JavaScript source code formatter.

### Status

**Prototype** - Seeking feedback and not ready for production use.

### Automatic Formatting

By default, Nitpik JavaScript automatically makes the following changes:

1. **Collapses whitespace.** Use a single space anywhere there's more than one space or other whitespace characters.
2. **Removes trailing whitespace.** Remove whitespace that appears before a line break.
3. **Normalizes comma spacing.** Spaces before commas are removed and spaces after commas are added where expected (spaces are not added when the comma is immediately followed by a line break).

## Usage

### Node.js

Install using [npm][npm] or [yarn][yarn]:

```
npm install @nitpick/javascript --save

# or

yarn add @nitpick/javascript
```

Import into your Node.js project:

```js
// CommonJS
const { JavaScriptFormatter } = require("@nitpick/javascript");

// ESM
import { JavaScriptFormatter } from "@nitpick/javascript";
```

### Deno

Import into your Deno project:

```js
import { JavaScriptFormatter } from "https://unpkg.com/@nitpick/javascript/dist/pkg.js";
```

### Browser

Import into a browser script:

```js
import { JavaScriptFormatter } from "https://unpkg.com/@nitpick/javascript/dist/pkg.js";
```

## API

After importing, create a new instance of `JavaScriptFormatter`. The constructor accepts one argument which is a configuration object with the following keys:

* **style** - formatting options
  * **indent** - either the character to use for indents or the number of spaces (default: `4`)
  * **tabWidth** - the number of spaces to count for each tab character (defualt: `4`)
  * **lineEndings** - the line ending format, either "windows" or "unix" (defualt: `"unix"`)
  * **semicolons** - whether or not to use semicolons (default: `true`)
  * **quotes** - the style of quotes to use, either "single" or "double" (default: `"double"`)
  * **collapseWhitespace** - whether multiple spaces in a row should be collapsed into one (default: `true`)
  * **trailingCommas** - whether trailing commas should be used for multiline object and array literals (default: `false`)
  * **maxEmptyLines** - the maximumn number of empty lines allowed before collapsing (default: `1`)
  * **maxLineLength** - the maximum length of a line before wrapping (defualt: `Infinity`)
  * **trimTrailingWhitespace** - should trailing whitespace be removed (default: `true`)
* **plugins** - Optional. An array of plugins (see below for examples).

For example:

```js
const formatter = new JavaScriptFormatter({
    style: {
        indent: "\t",
        quotes: "single"
    }
});

const result = formatter.format(yourJavaScriptCode);
```

### Plugins

A plugin is a function that accepts one parameter, `context`, and returns an object specifying the types of nodes to visit in a JavaScript abstract syntax tree (AST). Here's an example that ensures there's an empty line before each function declaration:

```js
function emptyLineBeforeFunctions(context) {

    const { layout } = context;

    return {
        FunctionDeclaration(node) {
            layout.emptyLineBefore(node);
        }
    };
}
```

This function uses the `context.layout` property to specify that there should be an empty line before each function declaration node. `FunctionDeclaration` is the type of node to look for, as defined by [ESTree](https://github.com/estree/estree). The node is passed as an argument to each method as the AST is traversed, so in this example, `node` represents a function declaration. You can then include the function in the `plugins` array of the configuration options:

```js
const formatter = new JavaScriptFormatter({
    style: {
        indent: "\t",
        quotes: "single"
    },
    plugins: [
        emptyLineBeforeFunctions
    ]
});

const result = formatter.format(yourJavaScriptCode);
```

When the formatter is run, it will now run any specified plugins *after* a first-pass of formatting based on the `style` options. This makes it easy to define a default style and then modify it to suit your needs.

All of the `style` options are implemented internally as plugins. Please see the [`src/plugins`](https://github.com/nitpik/javascript/tree/master/src/plugins) directory for examples (documentation to come later).

### Developer Setup

1. Ensure you have [Node.js](https://nodejs.org) 12+ installed
2. Fork and clone this repository
3. Run `npm install`
4. Run `npm test` to run tests

## License and Copyright

This code is licensed under the Apache 2.0 License (see LICENSE for details).

Copyright Human Who Codes LLC. All rights reserved.

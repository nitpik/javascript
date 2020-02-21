# Nitpik JavaScript

by [Nicholas C. Zakas](https://humanwhocodes.com)

If you find this useful, please consider supporting my work with a [donation](https://humanwhocodes.com/donate).

## Description

A pluggable JavaScript source code formatter.

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
const { Formatter } = require("@nitpick/javascript");

// ESM
import { Formatter } from "@nitpick/javascript";
```

### Deno

Import into your Deno project:

```js
import { Formatter } from "https://unpkg.com/@nitpick/javascript/dist/formatter.js";
```

### Browser

It's recommended to import the minified version to save bandwidth:

```js
import { Formatter } from "https://unpkg.com/@nitpick/javascript/dist/formatter.min.js";
```

However, you can also import the unminified version for debugging purposes:

```js
import { Formatter } from "https://unpkg.com/@nitpick/javascript/dist/formatter.js";
```

## API

After importing, create a new instance of `Formatter`. The constructor accepts one argument which is a configuration object with the following keys:

* **options** - formatting options
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
const Formatter = new Formatter({
    options: {
        indent: "\t",
        quotes: "single"
    }
});

const result = formatter.format(yourJavaScriptCode);
```

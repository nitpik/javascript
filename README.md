# Nitpik

by [Nicholas C. Zakas](https://humanwhocodes.com)

If you find this useful, please consider supporting my work with a [donation](https://humanwhocodes.com/donate).

## Description

A pluggable JavaScript source code formatter.


### Automatic Formatting

By default, Nitpik automatically makes the following changes:

1. **Collapses whitespace.** Use a single space anywhere there's more than one space or other whitespace characters.
2. **Removes trailing whitespace.** Remove whitespace that appears before a line break.
3. **Normalizes comma spacing.** Spaces before commas are removed and spaces after commas are added where expected (spaces are not added when the comma is immediately followed by a line break).

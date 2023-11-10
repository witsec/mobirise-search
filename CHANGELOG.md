# Changelog

All notable changes to this project will be documented in this file.

## v2 (2023-11-10)

- Links inside the template (meaning the block you see inside Mobirise) contain `href`. This would trigger services that check for 'dead links'. To avoid that, the attribute has been replaced with `data-href`
- Added an `anchor` option in the block parameters. This is useful if your search results block is further down a page, the browser will then automatically scroll to it. Use it like so: `#anchor`.

## v1 (2023-01-22)

This is the initial release of the Search extension for Mobirise.
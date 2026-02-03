# Command log

## Repository access checks
- `git ls-remote https://github.com/daniel17903/GoList`
  - Result: `fatal: unable to access 'https://github.com/daniel17903/GoList/': CONNECT tunnel failed, response 403`

## Dependency install attempts
- `yarn install`
  - Result: `RequestError: Bad response: 403`
- `bun install`
  - Result: multiple `GET https://registry.npmjs.org/<package> - 403` errors
- `npm install` (retry)
  - Result: `403 Forbidden - GET https://registry.npmjs.org/@types%2freact`

/**
 * Tests for new Kubernetes API documentation files added in the PR.
 *
 * Covers:
 *  - MDX file content structure (headings, components, props)
 *  - OpenAPI JSON spec validity (schema structure, required fields)
 *  - Cross-reference integrity (paths referenced in MDX exist in JSON specs)
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DOCS_DIR = path.join(ROOT, 'docs', 'en', 'apis', 'kubernetes_apis')
const OPENAPIS_DIR = path.join(ROOT, 'docs', 'shared', 'openapis')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readMdx(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8')
}

function loadJson(filename) {
  const raw = fs.readFileSync(path.join(OPENAPIS_DIR, filename), 'utf8')
  return JSON.parse(raw)
}

/**
 * Extract the array of path strings from an <OpenAPIPath path={[...]} /> block.
 * Returns an empty array if no path prop is found.
 */
function extractOpenAPIPathValues(content) {
  // Match path={[ ... ]} inside the component
  const match = content.match(/path=\{\[\s*([\s\S]*?)\s*\]\}/)
  if (!match) return []
  const inner = match[1]
  return [...inner.matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/**
 * Check whether the MDX content includes a pathPrefix prop.
 */
function hasPathPrefix(content, value) {
  return content.includes(`pathPrefix="${value}"`)
}

// ---------------------------------------------------------------------------
// MDX Structure Tests – Index files
// ---------------------------------------------------------------------------

describe('Index MDX files - structure', () => {
  const indexFiles = [
    {
      file: 'docs/en/apis/kubernetes_apis/connector/index.mdx',
      expectedTitle: '# Connector APIs',
    },
    {
      file: 'docs/en/apis/kubernetes_apis/project/index.mdx',
      expectedTitle: '# Project APIs',
    },
    {
      file: 'docs/en/apis/kubernetes_apis/rbac/index.mdx',
      expectedTitle: '# RBAC APIs',
    },
    {
      file: 'docs/en/apis/kubernetes_apis/serviceaccount/index.mdx',
      expectedTitle: '# ServiceAccount APIs',
    },
    {
      file: 'docs/en/apis/kubernetes_apis/user/index.mdx',
      expectedTitle: '# User APIs',
    },
  ]

  for (const { file, expectedTitle } of indexFiles) {
    test(`${file} has correct H1 title`, () => {
      const content = readMdx(file)
      assert.ok(
        content.startsWith(expectedTitle),
        `Expected file to start with "${expectedTitle}"`
      )
    })

    test(`${file} contains <Overview overviewHeaders={[]} />`, () => {
      const content = readMdx(file)
      assert.ok(
        content.includes('<Overview overviewHeaders={[]} />'),
        'Missing <Overview overviewHeaders={[]} /> component'
      )
    })

    test(`${file} does not contain <OpenAPIPath`, () => {
      const content = readMdx(file)
      assert.ok(
        !content.includes('<OpenAPIPath'),
        'Index files should not contain OpenAPIPath component'
      )
    })
  }
})

// ---------------------------------------------------------------------------
// MDX Structure Tests – Resource files
// ---------------------------------------------------------------------------

describe('Connector MDX - connector.mdx', () => {
  const file = 'docs/en/apis/kubernetes_apis/connector/connector.mdx'

  test('has correct H1 heading with group/version', () => {
    const content = readMdx(file)
    assert.ok(
      content.includes('# Connector [dex.coreos.com/v1]'),
      'Expected heading "# Connector [dex.coreos.com/v1]"'
    )
  })

  test('contains <OpenAPIPath component', () => {
    const content = readMdx(file)
    assert.ok(content.includes('<OpenAPIPath'), 'Missing <OpenAPIPath component')
  })

  test('references both collection and item paths', () => {
    const content = readMdx(file)
    const paths = extractOpenAPIPathValues(content)
    assert.equal(paths.length, 2, 'Expected exactly 2 paths')
    assert.ok(
      paths.some((p) => p === '/apis/dex.coreos.com/v1/namespaces/{namespace}/connectors'),
      'Missing collection path'
    )
    assert.ok(
      paths.some((p) => p === '/apis/dex.coreos.com/v1/namespaces/{namespace}/connectors/{name}'),
      'Missing item path'
    )
  })

  test('does NOT have a pathPrefix prop (namespace-scoped CRD)', () => {
    const content = readMdx(file)
    assert.ok(
      !content.includes('pathPrefix='),
      'connector.mdx should not have a pathPrefix prop'
    )
  })

  test('does NOT contain <K8sCrd component', () => {
    const content = readMdx(file)
    assert.ok(!content.includes('<K8sCrd'), 'connector.mdx should not have a K8sCrd component')
  })
})

describe('Project MDX - project.mdx', () => {
  const file = 'docs/en/apis/kubernetes_apis/project/project.mdx'

  test('has correct H1 heading with group/version', () => {
    const content = readMdx(file)
    assert.ok(
      content.includes('# Project [auth.alauda.io/v1]'),
      'Expected heading "# Project [auth.alauda.io/v1]"'
    )
  })

  test('references both collection and item paths', () => {
    const content = readMdx(file)
    const paths = extractOpenAPIPathValues(content)
    assert.equal(paths.length, 2, 'Expected exactly 2 paths')
    assert.ok(
      paths.some((p) => p === '/apis/auth.alauda.io/v1/projects'),
      'Missing collection path'
    )
    assert.ok(
      paths.some((p) => p === '/apis/auth.alauda.io/v1/projects/{name}'),
      'Missing item path'
    )
  })

  test('does NOT have a pathPrefix prop', () => {
    const content = readMdx(file)
    assert.ok(!content.includes('pathPrefix='), 'project.mdx should not have pathPrefix')
  })

  test('contains <K8sCrd name="projects.auth.alauda.io" />', () => {
    const content = readMdx(file)
    assert.ok(
      content.includes('<K8sCrd name="projects.auth.alauda.io" />'),
      'Missing K8sCrd component for projects.auth.alauda.io'
    )
  })
})

describe('User MDX - user.mdx', () => {
  const file = 'docs/en/apis/kubernetes_apis/user/user.mdx'

  test('has correct H1 heading with group/version', () => {
    const content = readMdx(file)
    assert.ok(
      content.includes('# User [auth.alauda.io/v1]'),
      'Expected heading "# User [auth.alauda.io/v1]"'
    )
  })

  test('references both collection and item paths', () => {
    const content = readMdx(file)
    const paths = extractOpenAPIPathValues(content)
    assert.equal(paths.length, 2, 'Expected exactly 2 paths')
    assert.ok(paths.some((p) => p === '/apis/auth.alauda.io/v1/users'), 'Missing collection path')
    assert.ok(
      paths.some((p) => p === '/apis/auth.alauda.io/v1/users/{name}'),
      'Missing item path'
    )
  })

  test('does NOT have a pathPrefix prop', () => {
    const content = readMdx(file)
    assert.ok(!content.includes('pathPrefix='), 'user.mdx should not have pathPrefix')
  })

  test('contains <K8sCrd name="users.auth.alauda.io" />', () => {
    const content = readMdx(file)
    assert.ok(
      content.includes('<K8sCrd name="users.auth.alauda.io" />'),
      'Missing K8sCrd component for users.auth.alauda.io'
    )
  })
})

describe('RBAC MDX files - ClusterRole', () => {
  const file = 'docs/en/apis/kubernetes_apis/rbac/clusterrole.mdx'

  test('has correct H1 heading', () => {
    const content = readMdx(file)
    assert.ok(content.includes('# ClusterRole [rbac.authorization.k8s.io/v1]'))
  })

  test('references clusterroles collection and item paths', () => {
    const content = readMdx(file)
    const paths = extractOpenAPIPathValues(content)
    assert.equal(paths.length, 2)
    assert.ok(paths.includes('/apis/rbac.authorization.k8s.io/v1/clusterroles'))
    assert.ok(paths.includes('/apis/rbac.authorization.k8s.io/v1/clusterroles/{name}'))
  })

  test('has pathPrefix="/kubernetes/{cluster}"', () => {
    const content = readMdx(file)
    assert.ok(hasPathPrefix(content, '/kubernetes/{cluster}'))
  })
})

describe('RBAC MDX files - ClusterRoleBinding', () => {
  const file = 'docs/en/apis/kubernetes_apis/rbac/clusterrolebinding.mdx'

  test('has correct H1 heading', () => {
    const content = readMdx(file)
    assert.ok(content.includes('# ClusterRoleBinding [rbac.authorization.k8s.io/v1]'))
  })

  test('references clusterrolebindings paths', () => {
    const content = readMdx(file)
    const paths = extractOpenAPIPathValues(content)
    assert.equal(paths.length, 2)
    assert.ok(paths.includes('/apis/rbac.authorization.k8s.io/v1/clusterrolebindings'))
    assert.ok(paths.includes('/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/{name}'))
  })

  test('has pathPrefix="/kubernetes/{cluster}"', () => {
    const content = readMdx(file)
    assert.ok(hasPathPrefix(content, '/kubernetes/{cluster}'))
  })
})

describe('RBAC MDX files - Role', () => {
  const file = 'docs/en/apis/kubernetes_apis/rbac/role.mdx'

  test('has correct H1 heading', () => {
    const content = readMdx(file)
    assert.ok(content.includes('# Role [rbac.authorization.k8s.io/v1]'))
  })

  test('references namespace-scoped roles paths', () => {
    const content = readMdx(file)
    const paths = extractOpenAPIPathValues(content)
    assert.equal(paths.length, 2)
    assert.ok(
      paths.includes('/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/roles')
    )
    assert.ok(
      paths.includes('/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/roles/{name}')
    )
  })

  test('has pathPrefix="/kubernetes/{cluster}"', () => {
    const content = readMdx(file)
    assert.ok(hasPathPrefix(content, '/kubernetes/{cluster}'))
  })
})

describe('RBAC MDX files - RoleBinding', () => {
  const file = 'docs/en/apis/kubernetes_apis/rbac/rolebinding.mdx'

  test('has correct H1 heading', () => {
    const content = readMdx(file)
    assert.ok(content.includes('# RoleBinding [rbac.authorization.k8s.io/v1]'))
  })

  test('references namespace-scoped rolebindings paths', () => {
    const content = readMdx(file)
    const paths = extractOpenAPIPathValues(content)
    assert.equal(paths.length, 2)
    assert.ok(
      paths.includes('/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/rolebindings')
    )
    assert.ok(
      paths.includes(
        '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/rolebindings/{name}'
      )
    )
  })

  test('has pathPrefix="/kubernetes/{cluster}"', () => {
    const content = readMdx(file)
    assert.ok(hasPathPrefix(content, '/kubernetes/{cluster}'))
  })
})

describe('ServiceAccount MDX - serviceaccount.mdx', () => {
  const file = 'docs/en/apis/kubernetes_apis/serviceaccount/serviceaccount.mdx'

  test('has correct H1 heading with core API version', () => {
    const content = readMdx(file)
    assert.ok(
      content.includes('# ServiceAccount [v1]'),
      'Expected heading "# ServiceAccount [v1]"'
    )
  })

  test('references /api/v1 (core API, not /apis/) paths', () => {
    const content = readMdx(file)
    const paths = extractOpenAPIPathValues(content)
    assert.equal(paths.length, 2)
    assert.ok(
      paths.every((p) => p.startsWith('/api/v1/')),
      'ServiceAccount paths must use /api/v1/ (core API group)'
    )
    assert.ok(paths.includes('/api/v1/namespaces/{namespace}/serviceaccounts'))
    assert.ok(paths.includes('/api/v1/namespaces/{namespace}/serviceaccounts/{name}'))
  })

  test('has pathPrefix="/kubernetes/{cluster}"', () => {
    const content = readMdx(file)
    assert.ok(hasPathPrefix(content, '/kubernetes/{cluster}'))
  })

  test('does NOT contain <K8sCrd', () => {
    const content = readMdx(file)
    assert.ok(!content.includes('<K8sCrd'), 'serviceaccount.mdx should not have a K8sCrd component')
  })
})

// ---------------------------------------------------------------------------
// OpenAPI JSON – auth.alauda.io.v1.json
// ---------------------------------------------------------------------------

describe('auth.alauda.io.v1.json - OpenAPI spec structure', () => {
  let spec

  test('parses as valid JSON', () => {
    spec = loadJson('auth.alauda.io.v1.json')
    assert.ok(typeof spec === 'object' && spec !== null)
  })

  test('has openapi field set to 3.0.0', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    assert.equal(spec.openapi, '3.0.0')
  })

  test('has info.title and info.version', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    assert.ok(typeof spec.info.title === 'string' && spec.info.title.length > 0)
    assert.ok(typeof spec.info.version === 'string' && spec.info.version.length > 0)
  })

  test('has paths object with entries', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    assert.ok(typeof spec.paths === 'object')
    assert.ok(Object.keys(spec.paths).length > 0)
  })

  test('has components.schemas', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    assert.ok(typeof spec.components?.schemas === 'object')
    assert.ok(Object.keys(spec.components.schemas).length > 0)
  })

  test('exposes /apis/auth.alauda.io/v1/projects (collection endpoint)', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    assert.ok(
      '/apis/auth.alauda.io/v1/projects' in spec.paths,
      'Missing /apis/auth.alauda.io/v1/projects'
    )
  })

  test('exposes /apis/auth.alauda.io/v1/projects/{name} (item endpoint)', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    assert.ok(
      '/apis/auth.alauda.io/v1/projects/{name}' in spec.paths,
      'Missing /apis/auth.alauda.io/v1/projects/{name}'
    )
  })

  test('exposes /apis/auth.alauda.io/v1/users (collection endpoint)', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    assert.ok(
      '/apis/auth.alauda.io/v1/users' in spec.paths,
      'Missing /apis/auth.alauda.io/v1/users'
    )
  })

  test('exposes /apis/auth.alauda.io/v1/users/{name} (item endpoint)', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    assert.ok(
      '/apis/auth.alauda.io/v1/users/{name}' in spec.paths,
      'Missing /apis/auth.alauda.io/v1/users/{name}'
    )
  })

  test('projects collection path has GET operation with operationId and responses', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    const pathObj = spec.paths['/apis/auth.alauda.io/v1/projects']
    assert.ok('get' in pathObj, 'Missing GET on /projects')
    assert.ok(typeof pathObj.get.operationId === 'string')
    assert.ok(typeof pathObj.get.responses === 'object')
  })

  test('users item path has GET and DELETE operations', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    const pathObj = spec.paths['/apis/auth.alauda.io/v1/users/{name}']
    assert.ok('get' in pathObj, 'Missing GET on /users/{name}')
    assert.ok('delete' in pathObj, 'Missing DELETE on /users/{name}')
  })

  test('all path operations have a non-empty operationId', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch']
    for (const [urlPath, pathObj] of Object.entries(spec.paths)) {
      for (const method of HTTP_METHODS) {
        if (pathObj[method]) {
          assert.ok(
            typeof pathObj[method].operationId === 'string' &&
              pathObj[method].operationId.length > 0,
            `Missing operationId on ${method.toUpperCase()} ${urlPath}`
          )
        }
      }
    }
  })

  test('all path operations have a responses object', () => {
    spec = spec ?? loadJson('auth.alauda.io.v1.json')
    const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch']
    for (const [urlPath, pathObj] of Object.entries(spec.paths)) {
      for (const method of HTTP_METHODS) {
        if (pathObj[method]) {
          assert.ok(
            typeof pathObj[method].responses === 'object',
            `Missing responses on ${method.toUpperCase()} ${urlPath}`
          )
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// OpenAPI JSON – dex.coreos.com.v1.json
// ---------------------------------------------------------------------------

describe('dex.coreos.com.v1.json - OpenAPI spec structure', () => {
  let spec

  test('parses as valid JSON', () => {
    spec = loadJson('dex.coreos.com.v1.json')
    assert.ok(typeof spec === 'object' && spec !== null)
  })

  test('has openapi field set to 3.0.0', () => {
    spec = spec ?? loadJson('dex.coreos.com.v1.json')
    assert.equal(spec.openapi, '3.0.0')
  })

  test('has non-empty info.title and info.version', () => {
    spec = spec ?? loadJson('dex.coreos.com.v1.json')
    assert.ok(spec.info.title.length > 0)
    assert.ok(spec.info.version.length > 0)
  })

  test('has paths object with entries', () => {
    spec = spec ?? loadJson('dex.coreos.com.v1.json')
    assert.ok(Object.keys(spec.paths).length > 0)
  })

  test('exposes namespace-scoped connectors collection path', () => {
    spec = spec ?? loadJson('dex.coreos.com.v1.json')
    assert.ok(
      '/apis/dex.coreos.com/v1/namespaces/{namespace}/connectors' in spec.paths,
      'Missing namespace-scoped connectors collection'
    )
  })

  test('exposes namespace-scoped connectors item path', () => {
    spec = spec ?? loadJson('dex.coreos.com.v1.json')
    assert.ok(
      '/apis/dex.coreos.com/v1/namespaces/{namespace}/connectors/{name}' in spec.paths,
      'Missing namespace-scoped connectors item'
    )
  })

  test('connectors collection path supports GET operation', () => {
    spec = spec ?? loadJson('dex.coreos.com.v1.json')
    const pathObj = spec.paths['/apis/dex.coreos.com/v1/namespaces/{namespace}/connectors']
    assert.ok('get' in pathObj)
    assert.ok(typeof pathObj.get.operationId === 'string')
  })

  test('connectors item path supports GET and DELETE operations', () => {
    spec = spec ?? loadJson('dex.coreos.com.v1.json')
    const pathObj =
      spec.paths['/apis/dex.coreos.com/v1/namespaces/{namespace}/connectors/{name}']
    assert.ok('get' in pathObj, 'Missing GET on connectors/{name}')
    assert.ok('delete' in pathObj, 'Missing DELETE on connectors/{name}')
  })

  test('connectors item path supports PATCH operation', () => {
    spec = spec ?? loadJson('dex.coreos.com.v1.json')
    const pathObj =
      spec.paths['/apis/dex.coreos.com/v1/namespaces/{namespace}/connectors/{name}']
    assert.ok('patch' in pathObj, 'Missing PATCH on connectors/{name}')
  })

  test('has components.schemas', () => {
    spec = spec ?? loadJson('dex.coreos.com.v1.json')
    assert.ok(typeof spec.components?.schemas === 'object')
    assert.ok(Object.keys(spec.components.schemas).length > 0)
  })

  test('all operations have operationId and responses', () => {
    spec = spec ?? loadJson('dex.coreos.com.v1.json')
    const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch']
    for (const [urlPath, pathObj] of Object.entries(spec.paths)) {
      for (const method of HTTP_METHODS) {
        if (pathObj[method]) {
          assert.ok(
            typeof pathObj[method].operationId === 'string' &&
              pathObj[method].operationId.length > 0,
            `Missing operationId on ${method.toUpperCase()} ${urlPath}`
          )
          assert.ok(
            typeof pathObj[method].responses === 'object',
            `Missing responses on ${method.toUpperCase()} ${urlPath}`
          )
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// OpenAPI JSON – rbac.authorization.k8s.io.v1.json
// ---------------------------------------------------------------------------

describe('rbac.authorization.k8s.io.v1.json - OpenAPI spec structure', () => {
  let spec

  test('parses as valid JSON', () => {
    spec = loadJson('rbac.authorization.k8s.io.v1.json')
    assert.ok(typeof spec === 'object' && spec !== null)
  })

  test('has openapi field set to 3.0.0', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    assert.equal(spec.openapi, '3.0.0')
  })

  test('has non-empty info.title and info.version', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    assert.ok(spec.info.title.length > 0)
    assert.ok(spec.info.version.length > 0)
  })

  test('exposes /apis/rbac.authorization.k8s.io/v1/clusterroles', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    assert.ok('/apis/rbac.authorization.k8s.io/v1/clusterroles' in spec.paths)
  })

  test('exposes /apis/rbac.authorization.k8s.io/v1/clusterroles/{name}', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    assert.ok('/apis/rbac.authorization.k8s.io/v1/clusterroles/{name}' in spec.paths)
  })

  test('exposes /apis/rbac.authorization.k8s.io/v1/clusterrolebindings', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    assert.ok('/apis/rbac.authorization.k8s.io/v1/clusterrolebindings' in spec.paths)
  })

  test('exposes /apis/rbac.authorization.k8s.io/v1/clusterrolebindings/{name}', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    assert.ok('/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/{name}' in spec.paths)
  })

  test('exposes namespace-scoped /roles path', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    assert.ok(
      '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/roles' in spec.paths
    )
  })

  test('exposes namespace-scoped /roles/{name} path', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    assert.ok(
      '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/roles/{name}' in spec.paths
    )
  })

  test('exposes namespace-scoped /rolebindings path', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    assert.ok(
      '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/rolebindings' in spec.paths
    )
  })

  test('exposes namespace-scoped /rolebindings/{name} path', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    assert.ok(
      '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/rolebindings/{name}' in
        spec.paths
    )
  })

  test('clusterroles collection supports GET operation', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    const pathObj = spec.paths['/apis/rbac.authorization.k8s.io/v1/clusterroles']
    assert.ok('get' in pathObj)
  })

  test('clusterroles item path supports GET and DELETE', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    const pathObj = spec.paths['/apis/rbac.authorization.k8s.io/v1/clusterroles/{name}']
    assert.ok('get' in pathObj)
    assert.ok('delete' in pathObj)
  })

  test('has components.schemas with ClusterRole schema', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    const schemaKeys = Object.keys(spec.components?.schemas ?? {})
    assert.ok(
      schemaKeys.some((k) => k.toLowerCase().includes('clusterrole')),
      'Expected a ClusterRole schema entry'
    )
  })

  test('all operations have operationId and responses', () => {
    spec = spec ?? loadJson('rbac.authorization.k8s.io.v1.json')
    const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch']
    for (const [urlPath, pathObj] of Object.entries(spec.paths)) {
      for (const method of HTTP_METHODS) {
        if (pathObj[method]) {
          assert.ok(
            typeof pathObj[method].operationId === 'string' &&
              pathObj[method].operationId.length > 0,
            `Missing operationId on ${method.toUpperCase()} ${urlPath}`
          )
          assert.ok(
            typeof pathObj[method].responses === 'object',
            `Missing responses on ${method.toUpperCase()} ${urlPath}`
          )
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Cross-reference tests: paths in MDX files must exist in the JSON spec
// ---------------------------------------------------------------------------

describe('Cross-reference: MDX paths exist in OpenAPI JSON specs', () => {
  test('all connector.mdx paths exist in dex.coreos.com.v1.json', () => {
    const content = readMdx('docs/en/apis/kubernetes_apis/connector/connector.mdx')
    const mdxPaths = extractOpenAPIPathValues(content)
    const spec = loadJson('dex.coreos.com.v1.json')
    for (const p of mdxPaths) {
      assert.ok(p in spec.paths, `Path "${p}" referenced in connector.mdx not found in dex.coreos.com.v1.json`)
    }
  })

  test('all project.mdx paths exist in auth.alauda.io.v1.json', () => {
    const content = readMdx('docs/en/apis/kubernetes_apis/project/project.mdx')
    const mdxPaths = extractOpenAPIPathValues(content)
    const spec = loadJson('auth.alauda.io.v1.json')
    for (const p of mdxPaths) {
      assert.ok(p in spec.paths, `Path "${p}" referenced in project.mdx not found in auth.alauda.io.v1.json`)
    }
  })

  test('all user.mdx paths exist in auth.alauda.io.v1.json', () => {
    const content = readMdx('docs/en/apis/kubernetes_apis/user/user.mdx')
    const mdxPaths = extractOpenAPIPathValues(content)
    const spec = loadJson('auth.alauda.io.v1.json')
    for (const p of mdxPaths) {
      assert.ok(p in spec.paths, `Path "${p}" referenced in user.mdx not found in auth.alauda.io.v1.json`)
    }
  })

  test('all clusterrole.mdx paths exist in rbac.authorization.k8s.io.v1.json', () => {
    const content = readMdx('docs/en/apis/kubernetes_apis/rbac/clusterrole.mdx')
    const mdxPaths = extractOpenAPIPathValues(content)
    const spec = loadJson('rbac.authorization.k8s.io.v1.json')
    for (const p of mdxPaths) {
      assert.ok(p in spec.paths, `Path "${p}" referenced in clusterrole.mdx not found in rbac spec`)
    }
  })

  test('all clusterrolebinding.mdx paths exist in rbac.authorization.k8s.io.v1.json', () => {
    const content = readMdx('docs/en/apis/kubernetes_apis/rbac/clusterrolebinding.mdx')
    const mdxPaths = extractOpenAPIPathValues(content)
    const spec = loadJson('rbac.authorization.k8s.io.v1.json')
    for (const p of mdxPaths) {
      assert.ok(p in spec.paths, `Path "${p}" referenced in clusterrolebinding.mdx not found in rbac spec`)
    }
  })

  test('all role.mdx paths exist in rbac.authorization.k8s.io.v1.json', () => {
    const content = readMdx('docs/en/apis/kubernetes_apis/rbac/role.mdx')
    const mdxPaths = extractOpenAPIPathValues(content)
    const spec = loadJson('rbac.authorization.k8s.io.v1.json')
    for (const p of mdxPaths) {
      assert.ok(p in spec.paths, `Path "${p}" referenced in role.mdx not found in rbac spec`)
    }
  })

  test('all rolebinding.mdx paths exist in rbac.authorization.k8s.io.v1.json', () => {
    const content = readMdx('docs/en/apis/kubernetes_apis/rbac/rolebinding.mdx')
    const mdxPaths = extractOpenAPIPathValues(content)
    const spec = loadJson('rbac.authorization.k8s.io.v1.json')
    for (const p of mdxPaths) {
      assert.ok(p in spec.paths, `Path "${p}" referenced in rolebinding.mdx not found in rbac spec`)
    }
  })
})

// ---------------------------------------------------------------------------
// Additional regression / boundary tests
// ---------------------------------------------------------------------------

describe('Regression and boundary tests', () => {
  test('connector.mdx does not accidentally reference auth or rbac paths', () => {
    const content = readMdx('docs/en/apis/kubernetes_apis/connector/connector.mdx')
    const paths = extractOpenAPIPathValues(content)
    for (const p of paths) {
      assert.ok(
        !p.includes('auth.alauda.io') && !p.includes('rbac.authorization'),
        `connector.mdx unexpectedly references non-dex path: ${p}`
      )
    }
  })

  test('serviceaccount.mdx paths use /api/v1/ not /apis/', () => {
    const content = readMdx('docs/en/apis/kubernetes_apis/serviceaccount/serviceaccount.mdx')
    const paths = extractOpenAPIPathValues(content)
    for (const p of paths) {
      assert.ok(
        p.startsWith('/api/'),
        `ServiceAccount path should use core API (/api/), got: ${p}`
      )
    }
  })

  test('all RBAC MDX files share the same group/version in their heading', () => {
    const rbacFiles = [
      'docs/en/apis/kubernetes_apis/rbac/clusterrole.mdx',
      'docs/en/apis/kubernetes_apis/rbac/clusterrolebinding.mdx',
      'docs/en/apis/kubernetes_apis/rbac/role.mdx',
      'docs/en/apis/kubernetes_apis/rbac/rolebinding.mdx',
    ]
    for (const file of rbacFiles) {
      const content = readMdx(file)
      assert.ok(
        content.includes('[rbac.authorization.k8s.io/v1]'),
        `${file} missing correct group/version in heading`
      )
    }
  })

  test('all RBAC resource MDX files use pathPrefix="/kubernetes/{cluster}"', () => {
    const rbacFiles = [
      'docs/en/apis/kubernetes_apis/rbac/clusterrole.mdx',
      'docs/en/apis/kubernetes_apis/rbac/clusterrolebinding.mdx',
      'docs/en/apis/kubernetes_apis/rbac/role.mdx',
      'docs/en/apis/kubernetes_apis/rbac/rolebinding.mdx',
    ]
    for (const file of rbacFiles) {
      const content = readMdx(file)
      assert.ok(
        hasPathPrefix(content, '/kubernetes/{cluster}'),
        `${file} missing pathPrefix="/kubernetes/{cluster}"`
      )
    }
  })

  test('no index file in the PR contains an <OpenAPIPath component', () => {
    const indexFiles = [
      'docs/en/apis/kubernetes_apis/connector/index.mdx',
      'docs/en/apis/kubernetes_apis/project/index.mdx',
      'docs/en/apis/kubernetes_apis/rbac/index.mdx',
      'docs/en/apis/kubernetes_apis/serviceaccount/index.mdx',
      'docs/en/apis/kubernetes_apis/user/index.mdx',
    ]
    for (const file of indexFiles) {
      const content = readMdx(file)
      assert.ok(!content.includes('<OpenAPIPath'), `Index file ${file} should not use <OpenAPIPath`)
    }
  })

  test('auth.alauda.io.v1.json does not expose connector paths', () => {
    const spec = loadJson('auth.alauda.io.v1.json')
    const connectorPaths = Object.keys(spec.paths).filter((p) =>
      p.includes('connectors')
    )
    assert.equal(
      connectorPaths.length,
      0,
      'auth.alauda.io.v1.json should not contain connector paths'
    )
  })

  test('dex.coreos.com.v1.json does not expose user or project paths', () => {
    const spec = loadJson('dex.coreos.com.v1.json')
    for (const p of Object.keys(spec.paths)) {
      assert.ok(
        !p.includes('/users') && !p.includes('/projects'),
        `dex.coreos.com.v1.json unexpectedly contains user/project path: ${p}`
      )
    }
  })

  test('rbac spec contains the 8 namespace/cluster-scoped RBAC resource paths referenced in MDX files', () => {
    const spec = loadJson('rbac.authorization.k8s.io.v1.json')
    const expectedPaths = [
      '/apis/rbac.authorization.k8s.io/v1/clusterroles',
      '/apis/rbac.authorization.k8s.io/v1/clusterroles/{name}',
      '/apis/rbac.authorization.k8s.io/v1/clusterrolebindings',
      '/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/{name}',
      '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/roles',
      '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/roles/{name}',
      '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/rolebindings',
      '/apis/rbac.authorization.k8s.io/v1/namespaces/{namespace}/rolebindings/{name}',
    ]
    for (const p of expectedPaths) {
      assert.ok(p in spec.paths, `Expected RBAC path "${p}" not found in spec`)
    }
  })
})

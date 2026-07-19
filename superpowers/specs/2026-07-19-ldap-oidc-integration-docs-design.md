# ACP LDAP and OIDC Integration Documentation Design

**Date:** 2026-07-19

**Status:** Approved for implementation

## Context

The current LDAP and OIDC management pages contain useful background material, but they do not provide a reliable end-to-end integration path for an ACP administrator. Several documented form fields and validation steps do not exist in the current UI, and some YAML fields do not match the behavior implemented by Apollo `dex2` and `auth-controller2`.

The user requested a documentation-only solution. Connector protocols and product code must not change because those changes would have a large compatibility impact.

Target files:

- `docs/en/security/users_and_roles/idp/functions/ldap_manage.mdx`
- `docs/en/security/users_and_roles/idp/functions/oidc_manage.mdx`

## Goals

- Let a platform administrator complete an LDAP, Active Directory, or standards-based OIDC integration without reading product source code.
- Reduce the concepts a user must understand before entering values in the ACP UI.
- Use the ACP form as the primary workflow and keep YAML as an advanced path.
- Separate connector creation, user synchronization, real login, and authorization verification.
- Provide copyable configuration values for common LDAP directory layouts and provider-neutral OIDC services.
- Help implementation engineers discover LDAP and Active Directory Base DNs, Filters, user attributes, and group mappings when the directory owner has not supplied them.
- Explain observable failure symptoms and the stage in which they occur.
- Keep all guidance aligned with current Apollo `dex2`, `auth-controller2`, and ACP UI behavior.

## Non-Goals

- Change connector APIs, validation behavior, identity semantics, or synchronization behavior.
- Add provider-specific OIDC guides or name a particular OIDC vendor.
- Document every LDAP schema, OIDC Claim, or connector configuration field.
- Add new runtime dependencies, scripts, screenshots, or product UI changes.
- Replace the existing user, group, and role management documentation.

## Product Capability Boundary

Every user-facing instruction must be grounded in at least one of these sources:

- A field, action, state, or message present in the current ACP UI.
- Current behavior implemented by Apollo `dex2` or `auth-controller2`.
- Behavior reproduced in the live ACP validation environment.

External utilities such as `ldapsearch`, PowerShell, `ldp.exe`, and `openssl` are pre-integration diagnostic aids. They must be labeled as external tools and must not be presented as built-in ACP functions.

Do not infer or advertise capabilities merely because the underlying LDAP or OIDC protocol supports them. In particular, do not add configurable ACP behavior that is absent from the product UI and runtime, such as form-level Search Scope selection, end-user credential validation fields, OIDC manual synchronization, or unsupported Claim mappings.

When an advanced YAML field is documented, verify that the current Connector configuration struct reads it and that its runtime semantics match the text. When the UI generates a legacy, redundant, or ineffective field, describe the observed limitation instead of inventing a supported use case for it.

## Verified Product Behavior

The design is based on source review and live ACP validation.

### LDAP

- The current form exposes basic information, server settings, user search settings, optional group search settings, field mappings, and an advanced auto-sync switch.
- The form does not expose separate ID, email, or end-user validation credential fields.
- Connector creation validates cluster-side connectivity, bind credentials, Base DN, filters, and mapped attributes.
- Creation does not prove that a normal directory user can authenticate because the current form does not collect a test user's credentials.
- The UI-generated v2 connector sets `userSearch.idAttr` and `userSearch.nameAttr` from **User Name Attr**.
- `userSearch.nameAttr` is used as the stable ACP identity value. A mutable or non-unique display attribute is therefore unsafe.
- A manual OpenLDAP synchronization imported 221 users and skipped four entries that lacked `uid`, while the overall synchronization still reported success.
- A manual Active Directory synchronization imported 18 users and nine groups.
- Group membership is evaluated as `(<groupAttr>=<userAttr value>)` for each user.
- Active Directory group membership worked with `groupAttr: member` and `userAttr: DN`.
- A user with no matching groups can produce a no-groups log message without causing the overall user synchronization to fail.
- The platform moves the submitted bind password to a managed Secret and replaces it with `clientSecretRef` in the stored Connector.
- Deleting an IDP without cleanup invalidates its users. Selecting **Clean up IDP users and User Groups** deletes the generated users and groups.

### OIDC

- The current form exposes basic information, Server Provider URL, Client ID, Client Key, and optional Logout URL.
- The form does not expose a Redirect URI field or OIDC test username/password fields.
- ACP derives the callback as `https://<ACP address>/dex/callback`; the administrator must register it with the upstream provider before testing login.
- Connector creation verifies the Issuer and client configuration. A provider does not need password grant or service-account behavior solely for this creation check when authorization code flow is available.
- A complete authorization code flow, ACP callback, and token exchange were validated against a standards-based OIDC provider.
- `sub` is mandatory to the connector. With the `email` scope, `email` and a boolean `email_verified` Claim must be present.
- ACP uses the mapped email as the unique platform account identity.
- The default username source is the `name` Claim. If it is absent, login can succeed while the ACP username remains empty.
- Setting `userNameKey: preferred_username` resolves the empty-username case when that Claim is available.
- OIDC users and groups are created or updated during successful login. OIDC does not use LDAP-style manual or scheduled full synchronization.
- Group processing requires `insecureEnableGroups: true` and a usable group Claim. The effective custom group mapping is `claimMapping.groups`.
- The connector automatically adds the `openid` scope. Advanced examples should not add a second `openid` entry.
- The stored client secret is moved to a managed Secret and represented by `clientSecretRef`.
- The logout configuration key read by the runtime is `logoutUrl`, not `logoutURL`.
- In the current product implementation, `insecureSkipVerify` cannot be relied on to enable upstream certificate verification. This must be documented as a version limitation rather than described as a production hardening switch.

## Writing Principles

1. Start with the outcome and the values the user must prepare.
2. Show the shortest standard path before explaining advanced options.
3. Use the exact labels visible in the current ACP UI.
4. Explain a field at the point where the user fills it in.
5. Prefer decision tables and tested value tables over protocol terminology.
6. Keep protocol background to a short paragraph with an optional standards link.
7. Put YAML, uncommon Claim mappings, TLS variants, and lifecycle details after the UI workflow.
8. Mark facts, recommendations, and current product limitations distinctly.
9. Use provider-neutral OIDC wording and generic example domains.
10. Never include real environment addresses, account names, passwords, client secrets, or tokens.
11. Present LDAP investigation as a fixed sequence: find the directory root, choose the search boundary, inspect representative entries, select attributes, then narrow the Filter.
12. Keep only essential diagnostic commands in the main path and put complete Linux and Windows command templates in a final troubleshooting appendix.
13. Do not expand protocol possibilities into ACP feature claims; every ACP operation in the final pages must be traceable to current product behavior.

## LDAP Document Structure

### 1. Purpose and Supported Directory Types

Open with the result: ACP can authenticate directory users and optionally synchronize directory groups. Mention OpenLDAP and Active Directory without adding a long LDAP tutorial.

Clarify the three milestones:

- The Connector was created.
- Expected users and groups were synchronized.
- A real directory user logged in and received the intended ACP permission.

### 2. Before You Begin

Provide a compact preparation checklist:

- LDAP address and port reachable from the ACP cluster.
- Bind DN and password with read access to the required users and groups.
- User Base DN and Filter.
- A stable, unique, non-empty user attribute.
- One or more login attributes.
- Optional group Base DN, Filter, member attribute, and name attribute.
- One representative user for final login verification.

State that access from an administrator's laptop does not prove access from ACP.

If the directory administrator has already supplied and verified all required values, direct the reader to skip the discovery section and continue with the console procedure.

### 3. Discover Directory Settings When Values Are Unknown

This section is a task-oriented investigation workflow for implementation engineers who are not LDAP or Active Directory specialists. It must not become a schema reference.

#### Step 1: Choose the Diagnostic Location

Run directory queries from a diagnostic host or Pod with network reachability equivalent to ACP whenever possible. A successful query from a laptop is preliminary evidence only; ACP Connector creation and synchronization remain the cluster-side acceptance tests.

#### Step 2: Find the Directory Root

Query Root DSE and read:

- OpenLDAP and compatible directories: `namingContexts`
- Active Directory: `defaultNamingContext`

The main text should include one short `ldapsearch` Root DSE example and one PowerShell `Get-ADRootDSE` example. Full command variants belong in the diagnostic appendix.

#### Step 3: Choose User and Group Base DNs

Explain Base DN as the search boundary, using a small directory-tree example rather than a terminology definition.

Selection rules:

- Use the lowest common parent that contains every intended user.
- Use a user OU such as `ou=People,dc=example,dc=com` when all intended users are below it.
- Use a higher domain root only when intended users span multiple branches.
- Configure a separate Group Base DN when groups are stored in another branch.
- ACP performs subtree searches below the configured Base DN; the current UI does not require a Search Scope value.

Show how to validate a candidate Base DN with a base-scope query before running a subtree query.

#### Step 4: Inspect Representative Users

Inspect at least three entries:

- A normal user expected to log in.
- A user in a different intended OU or organizational branch.
- A boundary case such as a disabled user, a user with no groups, or a user missing an optional attribute.

Request only useful candidate attributes:

- DN and `objectClass`
- OpenLDAP candidates: `uid`, `cn`, `mail`
- Active Directory candidates: `sAMAccountName`, `userPrincipalName`, `displayName`, `mail`, `userAccountControl`, `memberOf`

#### Step 5: Select Identity and Login Attributes

Provide a decision table:

| Purpose | OpenLDAP candidates | Active Directory candidates | Selection rule |
| --- | --- | --- | --- |
| ACP identity | `uid` | `sAMAccountName`, or a verified stable `userPrincipalName` | Present for all intended users, unique, stable, and non-empty |
| Login Field | `uid`, `mail` | `sAMAccountName`, `userPrincipalName` | Known to users and returns exactly one directory entry |
| Display-only information | `cn` | `displayName` | May change and should not be the default ACP identity |
| Group member value | `member`, `memberUid` | `member` | Match the value actually stored in a sample group entry |
| Group name | `cn` | `cn` | Readable and stable for administrators |

Explicitly discourage using `cn`, `displayName`, or a user's DN as the default ACP identity merely because those values are easy to read. A DN changes when a user is moved or renamed.

Include a query for entries missing the proposed identity attribute and an optional duplicate-value check. The reader should resolve missing or duplicate values before creating the Connector.

#### Step 6: Build the User Filter Incrementally

Use a four-stage recipe:

1. Limit entries by user object class.
2. Require the selected identity and login attributes to be present.
3. Exclude computers, disabled accounts, service accounts, or system accounts when required.
4. Add department, OU, email-domain, or other business restrictions only after the broad result is correct.

After every additional condition, rerun the query and compare the returned count and sample entries with the expected population.

Provide copyable patterns for:

- OpenLDAP users with `uid`: `(&(objectClass=inetOrgPerson)(uid=*))`
- Active Directory users with `sAMAccountName`: `(&(objectClass=user)(!(objectClass=computer))(sAMAccountName=*))`
- Entries missing `uid` or `sAMAccountName`
- Optional Active Directory disabled-account exclusion using the LDAP matching rule OID, without requiring the reader to understand the bitmask internals

#### Step 7: Identify the Group Model

Inspect one known group and compare its membership values:

- Full user DNs in `member`: use `groupAttr: member` and `userAttr: DN`.
- Short user IDs in `memberUid`: use `groupAttr: memberUid` and `userAttr: uid`.

Provide a sample query that substitutes one representative user's value into `(<groupAttr>=<userAttr value>)`. This reproduces the lookup performed by ACP and is more useful than relying only on a user's `memberOf` attribute.

### 4. Choose a Tested Mapping

Use a small decision table before the procedure.

OpenLDAP defaults:

- User Filter: `(&(objectClass=inetOrgPerson)(uid=*))`
- User Name Attr: `uid`
- Login Field: `uid`
- `groupOfNames`: `groupAttr: member`, `userAttr: DN`, `nameAttr: cn`
- `posixGroup`: `groupAttr: memberUid`, `userAttr: uid`, `nameAttr: cn`

Active Directory defaults:

- User Filter: `(&(objectClass=user)(!(objectClass=computer))(sAMAccountName=*))`
- User Name Attr: `sAMAccountName`
- Login Field: `sAMAccountName,userPrincipalName`
- Group mapping: `groupAttr: member`, `userAttr: DN`, `nameAttr: cn`

Explain that production filters should additionally exclude disabled or system accounts when required by the organization's directory policy. Do not silently impose one universal exclusion filter.

### 5. Add LDAP in the ACP Console

Document the current form in UI order:

- Basic Info: Name, Display Name, Description.
- LDAP Server Setting: Server Address, Admin Account, Admin Password.
- Search Setting: Filter, Base DN.
- Optional Group Search Setting: Filter, Base DN, Group Attr, User Attr.
- Field Mapping: User Name Attr, optional Group Name Attr, Login Field, Username Tip In Login Box.
- Advanced Settings: optional Auto Sync.

Important inline explanations:

- **User Name Attr** is the stable ACP identity value, not merely a display label.
- **Login Field** controls how ACP finds the user during login and supports comma-separated alternatives.
- Every synchronized entry should contain the selected User Name Attr and at least one usable login attribute.
- Group matching compares the configured group attribute with the configured value from each user.

Remove references to fields that are not present in the current form, including Object Type, Search Scope, Email Attribute, separate Login Attribute, and end-user validation credentials.

### 6. Verify the Integration

Use an explicit acceptance sequence:

1. Create the Connector and treat this as server/search validation only.
2. Run **Actions > Sync user**.
3. Compare the result with the expected user and group count.
4. Open a synchronized user and verify source, identity, and state.
5. Assign a minimal Platform Role to a test user or synchronized group, linking the existing role documentation.
6. Use a separate browser session to log in with the representative directory account.
7. Confirm both authentication and authorization.

Call out that a successful sync can still skip entries with missing required attributes.

### 7. Synchronization and Lifecycle

Explain the difference between:

- First-login synchronization for an individual user.
- Manual synchronization for inventory and reconciliation.
- Optional scheduled synchronization.

Document invalid-user behavior after upstream deletion and the two delete modes in ACP. Keep role-binding behavior factual and avoid implying that cleanup and invalidation are equivalent.

### 8. Troubleshooting by Symptom

Use a table with these rows:

- Connector creation cannot reach the server.
- Bind succeeds but Base DN or Filter validation fails.
- Sync succeeds with fewer users than expected.
- Connector creation succeeds but a real user cannot log in.
- Users synchronize but groups do not.
- Duplicate or unstable identities appear.
- Scheduled synchronization does not run.
- The directory administrator did not provide a Base DN, Filter, or attribute mapping.

Each row should include the likely stage, the configuration to inspect, and one concrete verification action.

### 9. YAML Advanced Configuration

Provide minimal, copyable OpenLDAP and Active Directory examples.

Requirements:

- `metadata.namespace: cpaas-system`
- `id` equals `metadata.name`
- `cpaas.io/idp.version: v2`
- Use `bindPW` only for initial creation.
- Explain that stored YAML later shows `clientSecretRef`.
- Include only the relevant TLS flags for the selected transport.
- Omit empty groupSearch blocks when group synchronization is not used.

Keep large filter catalogs out of the main guide. Include only a few directly useful filter modifications.

### 10. On-Site Diagnostic Tools

Put complete command templates at the end of the LDAP page so the standard console path stays short.

#### Linux and macOS Command-Line Tools

Document these tools:

- `ldapwhoami`: validate address, TLS mode, bind DN, and bind password independently of the search configuration.
- `ldapsearch`: query Root DSE, validate Base DN, reproduce subtree searches, inspect candidate attributes, find missing attributes, check duplicate values, and reproduce group matching.
- `openssl s_client`: inspect LDAPS or StartTLS handshake and certificate chains.
- A basic TCP test such as `nc` when available, clearly labeled as port reachability only.

Command examples must:

- Use generic hostnames and DNs.
- Use `-W` to prompt for the bind password.
- Avoid `-w <password>` and other plaintext password arguments.
- Use `-LLL` for readable output.
- Use `-s sub` when reproducing ACP user and group searches.
- Show the requested attributes explicitly to keep output reviewable.

Required templates:

```bash
ldapwhoami -x -H ldap://ldap.example.com:389 \
  -D 'cn=reader,dc=example,dc=com' -W

ldapsearch -LLL -x -H ldap://ldap.example.com:389 \
  -D 'cn=reader,dc=example,dc=com' -W \
  -b '' -s base '(objectClass=*)' namingContexts defaultNamingContext

ldapsearch -LLL -x -H ldap://ldap.example.com:389 \
  -D 'cn=reader,dc=example,dc=com' -W \
  -b 'ou=People,dc=example,dc=com' -s base '(objectClass=*)' dn

ldapsearch -LLL -x -H ldap://ldap.example.com:389 \
  -D 'cn=reader,dc=example,dc=com' -W \
  -b 'ou=People,dc=example,dc=com' -s sub \
  '(&(objectClass=inetOrgPerson)(uid=*))' \
  dn uid cn mail objectClass
```

The implemented page should add short variations for Active Directory, missing-attribute searches, group queries, LDAPS, and StartTLS. Avoid turning every variation into a separate tutorial.

#### Windows Active Directory Tools

Document these options:

- `Test-NetConnection`: TCP reachability to ports 389 or 636.
- `Get-ADRootDSE`: obtain `defaultNamingContext`.
- `Get-ADUser`: test LDAP Filters, Search Base, candidate attributes, disabled state, and representative users.
- `Get-ADGroup`: inspect `member` and group identity.
- `ldp.exe`: a GUI path for connect, bind, directory-tree browsing, and subtree search when the engineer is not comfortable with command-line tools.

State that the Active Directory PowerShell examples require the RSAT Active Directory module and suitable directory read permission.

Required template:

```powershell
Test-NetConnection ad.example.com -Port 389

(Get-ADRootDSE).defaultNamingContext

Get-ADUser -LDAPFilter '(&(objectClass=user)(sAMAccountName=*))' `
  -SearchBase 'OU=Employees,DC=example,DC=com' `
  -Properties userPrincipalName,displayName,mail,memberOf |
  Select-Object -First 10 -Property `
    DistinguishedName,SamAccountName,UserPrincipalName, `
    DisplayName,Mail,Enabled,MemberOf
```

The `ldp.exe` instructions should remain a short operation sequence: Connect, Bind, View Tree, then Search with the candidate Base DN, Filter, and Subtree scope.

#### ACP-Side Evidence

Explain which product stage owns each problem:

- `auth-controller2` logs: Connector creation, network connection, TLS, bind, Base DN, Filter, and attribute validation.
- `apollo` logs: manual or scheduled synchronization, skipped entries, group lookups, and login behavior.

Provide optional `kubectl logs` examples using the Connector ID and a short `--since` window. Mark this as an advanced path requiring cluster log permission, and avoid promising fixed Pod names.

The tool appendix must repeat that local-tool success is not the final acceptance criterion. ACP creation, synchronization, and real login complete the evidence chain.

## OIDC Document Structure

### 1. Purpose and Quick Path Decision

Start with the outcome: ACP can redirect users to a standards-based OIDC service and create or update their platform identity after successful login.

Add a two-row decision table:

- Use the form when the provider returns standard `name`, `email`, and `email_verified` Claims and group synchronization is not required.
- Use YAML when username fallback, non-standard Claims, UserInfo, group processing, or allow-listing is required.

Do not introduce a provider-specific subsection.

### 2. Before You Begin

Ask for only the values needed by the form:

- Issuer URL, shown as `https://idp.example.com` or another provider-specific Issuer root.
- Client ID.
- Client Secret.
- Optional Logout URL.

Place the callback requirement prominently:

`https://<ACP address>/dex/callback`

Explain that the Issuer is not the authorization, token, or login endpoint. ACP reads endpoint locations from OIDC discovery.

### 3. Upstream OIDC Service Requirements

Use protocol-neutral capability language:

- Support authorization code flow.
- Authenticate ACP as a confidential client using a Client ID and Client Secret.
- Register the exact ACP callback.
- Return `sub`, `email`, and boolean `email_verified` Claims.
- Prefer returning `name`; otherwise make `preferred_username` or another stable display Claim available.
- Return a string or string-array group Claim only when group-based authorization is needed.

Do not instruct users to enable password grant or service accounts for ACP validation.

### 4. Add OIDC in the ACP Console

Document the current form in UI order:

- Basic Info: Name, Display Name, Description.
- Server Setting: Server Provider URL, Client ID, Client Key, optional Logout URL.

State that ACP generates the Redirect URI and does not ask for an OIDC test username/password.

Recommend leaving Logout URL empty for the first integration. Add it only after login works and the provider's logout behavior is understood.

### 5. Verify the Integration

Use a real browser-based acceptance sequence:

1. Create the Connector.
2. Start a login in a browser session without an ACP login state.
3. Select the configured OIDC display name.
4. Complete upstream authentication and confirm return to ACP.
5. Find the generated ACP user and verify source, email, non-empty username, and active state.
6. Assign a minimal role to the user, or to a synchronized group after the first group-bearing login.
7. Log in again and verify access.

Warn that ACP uses the mapped email as the unique account identity. A rollout must test collision behavior with existing local or other-IDP users.

### 6. Advanced Claim and Group Configuration

Explain advanced options as solutions to visible problems:

- Empty username: `userNameKey: preferred_username`
- Thin ID token: `getUserInfo: true`
- Non-standard email or group Claim: nested `claimMapping`
- Force a custom mapping when a standard Claim is also present: `overrideClaimMapping: true`
- Process groups: `insecureEnableGroups: true`
- Restrict accepted groups: `allowedGroups`

For group processing:

- Explain that updates occur during successful login, not by manual or scheduled sync.
- Use `claimMapping.groups` as the effective mapping.
- Add a provider-required group scope only when needed.
- Validate that group values are intended, stable, and not duplicated before binding ACP roles.

### 7. YAML Advanced Configuration

Provide one provider-neutral minimal example and short modification snippets.

Requirements:

- Use generic domains and placeholders.
- Use `logoutUrl` with the correct casing.
- Omit `openid` from `scopes` because the connector adds it automatically.
- Omit the ineffective top-level `groupsKey` from recommended examples.
- Use `claimMapping.groups` for custom group Claims.
- Show `userNameKey: preferred_username` as a targeted fix, not a universal requirement.
- Use `clientSecret` only for initial creation and explain the managed `clientSecretRef` result.
- Document the current `insecureSkipVerify` limitation without presenting it as a hardening control.

### 8. Troubleshooting by Symptom

Use a table with these rows:

- Connector creation cannot read the Issuer or discovery document.
- Connector creation reports client authentication failure.
- The upstream service rejects the callback.
- Authentication returns to ACP but login fails because a required Claim is missing.
- The ACP user is created with an empty username.
- Groups are absent or unexpected.
- Logout returns to a page but the upstream session remains active.
- An HTTPS Issuer works with an untrusted certificate and the administrator expects verification.

Each row should state what ACP has already proven, what remains unproven, and the next configuration to inspect.

## Cross-Document Conventions

- Use **IDP** consistently for the ACP navigation label and **identity provider** in explanatory prose.
- Use current UI labels exactly, even when the underlying API field uses a different name.
- Link existing user and group role-assignment documentation instead of repeating it.
- Use generic example domains and identities.
- Avoid claims such as "configuration succeeded" when only a resource was created.
- Include a short final acceptance checklist in both documents.
- Keep destructive lifecycle behavior near the delete instructions.

## Implementation Scope

Expected content changes are limited to the two target MDX pages. This design file exists only to record the agreed structure and decisions.

No product code, CRDs, generated API files, dependencies, navigation metadata, or unrelated documentation will be modified.

## Verification Plan

After implementation:

1. Review the diff to confirm only the two target MDX pages changed, excluding this approved design record.
2. Run the repository's applicable MDX, formatting, link, and documentation checks.
3. Search the target files to ensure removed invalid guidance is absent:
   - OIDC form Redirect URI input
   - OIDC or LDAP validation username/password fields
   - `logoutURL`
   - recommended top-level `groupsKey`
   - duplicate `openid` in OIDC YAML scopes
4. Compare every YAML field with the current connector configuration structs and mutation behavior.
5. Confirm that all examples use placeholder values and contain no test-environment credentials or addresses.
6. Confirm that the main path can be followed without reading the YAML appendix.
7. Confirm that the final checklists cover creation, synchronization or first login, user identity, group behavior when enabled, and role-based access.

## Remaining Risk

The UI and runtime contain behaviors that documentation cannot correct, including OIDC certificate-verification handling and generated legacy or redundant YAML fields. The pages must label these as current limitations and avoid promising behavior that the product does not provide.

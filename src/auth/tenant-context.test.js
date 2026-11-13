/** Testes unitários da seleção explícita de tenant; não acessa Supabase nem estado global. */
import assert from "node:assert/strict";
import { resolveTenantMemberships } from "./tenant-context.js";

const memberships = [
  {org_id:"org-a",role:"owner",status:"active"},
  {org_id:"org-b",role:"manager",status:"active"}
];
const organizations = [
  {id:"org-a",name:"Salão A"},
  {id:"org-b",name:"Salão B"}
];

const pending = resolveTenantMemberships(memberships,organizations);
assert.equal(pending.requiresOrganizationSelection,true);
assert.equal(pending.organizations.length,2);

const selected = resolveTenantMemberships(memberships,organizations,"org-b");
assert.equal(selected.requiresOrganizationSelection,false);
assert.equal(selected.membership.role,"manager");
assert.equal(selected.organization.name,"Salão B");

const single = resolveTenantMemberships([memberships[0]],[organizations[0]]);
assert.equal(single.organization.id,"org-a");
assert.throws(()=>resolveTenantMemberships(memberships,organizations,"org-c"),/organização válida/);
assert.throws(()=>resolveTenantMemberships([],organizations),/organização vinculada/);

process.stdout.write("Testes de seleção multitenant: OK\n");

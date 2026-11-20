import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHQServer} from '../server.mjs';

test('organization layout HTTP routes enforce scope and CAS while preserving every workflow node and edge',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'imperium-org-api-')),dataDir=path.join(root,'data'),workspace=path.join(root,'workspace'),other=path.join(root,'other');await mkdir(workspace);await mkdir(other);
  const options={dataDir,workspace,port:0,quotaReaders:{},providers:{detectProviders:async()=>[],startProvider:async()=>{throw Error('No model calls');}}};
  let app=createHQServer(options),url=(await app.start()).url;
  t.after(async()=>{await app.close();await rm(root,{recursive:true,force:true});});
  const request=async(route,method='GET',body,authorized=true)=>{const response=await fetch(url+route,{method,headers:{'content-type':'application/json','x-hq-token':authorized?app.store.state.server.csrfToken:'invalid'},...(body?{body:JSON.stringify(body)}:{})});return{status:response.status,value:await response.json()};};
  const departments=app.store.state.departments.slice(0,2);
  const graph={workspace,nodes:departments.map((role,index)=>({id:'department:'+role.id,type:'department',referenceId:role.id,x:1700+index*333,y:890+index*127})),edges:[{id:'original-handoff',source:'department:'+departments[0].id,target:'department:'+departments[1].id,type:'handoff'}]};
  assert.equal((await request('/api/graph','PUT',graph)).status,200);
  const original=JSON.stringify((await request('/api/graph')).value.graph);
  const initial=await request('/api/organization-layout?workspace='+encodeURIComponent(workspace));assert.equal(initial.status,200);assert.equal(initial.value.revision,0);assert.deepEqual(initial.value.positions,{});
  const layout={workspace,revision:0,positions:{owner:{x:40,y:50},['agent:'+departments[0].id]:{x:220,y:330}},viewport:{pan:{x:10,y:-20},zoom:1.25}};
  assert.equal((await request('/api/organization-layout','PUT',layout,false)).status,403);
  const saved=await request('/api/organization-layout','PUT',layout);assert.equal(saved.status,200);assert.equal(saved.value.revision,1);
  assert.equal((await request('/api/organization-layout','PUT',layout)).status,409);
  assert.equal((await request('/api/organization-layout','PUT',{...layout,revision:1,edges:[]})).status,400);
  assert.equal((await request('/api/organization-layout?workspace='+encodeURIComponent(other))).status,409);
  assert.equal(JSON.stringify((await request('/api/graph')).value.graph),original);
  for(const route of ['/organization-nodes.js','/organization-nodes.css']){const asset=await fetch(url+route);assert.equal(asset.status,200);assert.match(asset.headers.get('content-type'),route.endsWith('.js')?/javascript/:/text\/css/);}
  await app.close();app=createHQServer(options);url=(await app.start()).url;
  const restored=await request('/api/organization-layout');assert.equal(restored.value.revision,1);assert.deepEqual(restored.value.positions,layout.positions);assert.deepEqual(restored.value.viewport,layout.viewport);
  assert.equal(JSON.stringify((await request('/api/graph')).value.graph),original);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHQServer } from '../server.mjs';

test('real skill routes require scoped authorization and frozen instructions reach the runner without claiming observed use', async t => {
  const root=await mkdtemp(path.join(tmpdir(),'imperium-equipped-'));
  const workspace=path.join(root,'project'),outside=path.join(root,'other');
  await mkdir(path.join(workspace,'skills','review'),{recursive:true});await mkdir(outside);
  const instruction='CHECK_UNIQUE_EQUIPPED_REQUIREMENT_180';
  const skillPath=path.join(workspace,'skills','review','SKILL.md');
  await writeFile(skillPath,'---\nname: specialist-review\ndescription: Check evidence\n---\n'+instruction);
  const calls=[];
  const app=createHQServer({dataDir:path.join(root,'data'),workspace,port:0,quotaReaders:{},providers:{
    detectProviders:async()=>['codex','claude'].map(id=>({id,status:'ready',authenticated:true,installed:true})),
    startProvider:async options=>{calls.push(options);setImmediate(()=>options.onExit({code:0}));return{cancel(){}};}
  }});
  t.after(async()=>{await app.close();await rm(root,{recursive:true,force:true});});
  const {url}=await app.start();
  for (const route of ['/organization-workbench.js','/agent-skills.js','/agent-skills.css','/workbench-theme.css']) {
    const asset=await fetch(url+route);
    assert.equal(asset.status,200,route);
    assert.match(asset.headers.get('content-type'),route.endsWith('.js')?/javascript/:/text\/css/);
  }
  const state=app.store.state,departmentId=state.departments[0].id;
  const request=async(route,method='GET',body,token=state.server.csrfToken)=>{
    const response=await fetch(url+route,{method,headers:{'content-type':'application/json','x-hq-token':token},...(body?{body:JSON.stringify(body)}:{})});
    return{status:response.status,value:await response.json()};
  };
  assert.equal((await request('/api/skills','POST',{workspace,path:'skills/review/SKILL.md'},'wrong')).status,403);
  assert.equal((await request('/api/skills','POST',{workspace:outside,path:'SKILL.md'})).status,409);
  const registered=await request('/api/skills','POST',{workspace,path:'skills/review/SKILL.md'});
  assert.equal(registered.status,201);const skill=registered.value.skill;
  assert.equal(skill.usage,'not-observed');
  assert.equal((await request('/api/skills/bindings/'+departmentId,'PUT',{workspace,skillIds:[skill.id]})).status,200);
  const task=await request('/api/tasks','POST',{workspace,departmentId,prompt:'Perform a review',permission:'read-only'});
  assert.equal(task.status,201);
  for(let attempt=0;attempt<100&&!calls.length;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(calls.length,1);assert.match(calls[0].prompt,new RegExp(instruction));assert.equal(calls[0].permission,'read-only');
  for(let attempt=0;attempt<100&&state.tasks[0].status==='running';attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  const snapshot=(await request('/api/state')).value;
  const executed=snapshot.tasks.find(value=>value.id===task.value.task.id);
  assert.equal(executed.skillBindingsSnapshot.skills[0].sha256,skill.sha256);
  assert.doesNotMatch(JSON.stringify(snapshot),new RegExp(instruction));
  assert.equal(executed.logs.filter(log=>log.type==='skill').length,0);
  await writeFile(skillPath,'Changed instructions must not run silently.');
  const failed=await request('/api/tasks','POST',{workspace,departmentId,prompt:'Recheck',permission:'read-only'});
  assert.equal(failed.status,201);
  for(let attempt=0;attempt<100&&!['failed','completed'].includes(state.tasks.find(value=>value.id===failed.value.task.id).status);attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(state.tasks.find(value=>value.id===failed.value.task.id).status,'failed');
  assert.equal(calls.length,1);
  assert.equal((await request('/api/skills/'+skill.id,'DELETE',{workspace})).status,200);
  assert.equal((await request('/api/skills')).value.skills.length,0);
});

test('cancellation during skill file loading releases the provider and writer locks before any child is launched', async t => {
  const root=await mkdtemp(path.join(tmpdir(),'imperium-skill-cancel-'));
  const workspace=path.join(root,'workspace');await mkdir(workspace);
  let release,reads=0;const calls=[];
  const waiting=new Promise(resolve=>{release=resolve;});
  const empty={skills:[],prompt:'',bytes:0};
  const app=createHQServer({dataDir:path.join(root,'data'),workspace,port:0,quotaReaders:{},
    agentSkillManager:{getForAgent:async()=>++reads===1?waiting:empty},
    providers:{detectProviders:async()=>['codex','claude'].map(id=>({id,status:'ready',authenticated:true,installed:true})),startProvider:async options=>{calls.push(options);setImmediate(()=>options.onExit({code:0}));return{cancel(){}};}}
  });
  t.after(async()=>{release(empty);await app.close();await rm(root,{recursive:true,force:true});});
  const {url}=await app.start();const state=app.store.state;
  const post=async(route,body)=>{const response=await fetch(url+route,{method:'POST',headers:{'content-type':'application/json','x-hq-token':state.server.csrfToken},body:JSON.stringify(body)});assert.equal(response.status,201===response.status?201:200);return response.json();};
  const project=await post('/api/projects',{name:'Second project',parentDir:root});
  const first=await post('/api/tasks',{workspace,departmentId:state.departments[0].id,prompt:'First',permission:'workspace-write'});
  assert.equal(reads,1);
  await post('/api/tasks/'+first.task.id+'/cancel',{});
  const prematureSwitch=await fetch(url+'/api/projects/'+project.project.id+'/select',{method:'POST',headers:{'content-type':'application/json','x-hq-token':state.server.csrfToken},body:'{}'});
  assert.equal(prematureSwitch.status,409);
  const second=await post('/api/tasks',{workspace,departmentId:state.departments[0].id,prompt:'Second',permission:'workspace-write'});
  assert.equal(calls.length,0);
  release(empty);
  for(let attempt=0;attempt<100&&state.tasks.find(task=>task.id===second.task.id).status!=='completed';attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(state.tasks.find(task=>task.id===first.task.id).status,'cancelled');
  assert.equal(state.tasks.find(task=>task.id===second.task.id).status,'completed');
  assert.equal(calls.length,1);assert.match(calls[0].prompt,/Second/);
  await post('/api/projects/'+project.project.id+'/select',{});
  assert.notEqual(state.settings.workspace,workspace);
});

(function () {
  'use strict';
  const LABELS = {
    ko: { canvas:'조직 노드 캔버스',fit:'화면 맞춤',arrange:'자동 배열',reload:'다시 불러오기',retry:'다시 시도',inspector:'노드 정보',connections:'업무 연결 편집',zoomIn:'확대',zoomOut:'축소',hint:'노드를 끌어 배치 · 빈 공간을 끌어 이동 · 휠로 확대/축소',membership:'조직 소속',handoff:'업무 전달 설정',loading:'조직도 배치를 불러오는 중…',ready:'배치는 프로젝트별로 저장됩니다.',saving:'배치 저장 중…',saved:'배치를 저장했습니다.',dirty:'아직 저장하지 않은 배치가 있습니다.',error:'배치를 저장하지 못했습니다. 화면의 배치는 유지됩니다.',conflict:'다른 창에서 조직도가 변경됐습니다. 배치를 유지했습니다. 다시 불러오면 이 화면의 미저장 배치를 대체합니다.',choose:'노드를 선택하면 정보를 확인할 수 있습니다.',owner:'소유자',edit:'역할 편집',assign:'업무 지시',skills:'스킬 설정',close:'닫기',readOnly:'배치를 불러온 뒤 이동할 수 있습니다.',model:'연결 모델',role:'역할과 책임',task:'현재 업무',none:'아직 없음' },
    en: { canvas:'Organization node canvas',fit:'Fit view',arrange:'Arrange',reload:'Reload',retry:'Retry',inspector:'Node details',connections:'Edit work connections',zoomIn:'Zoom in',zoomOut:'Zoom out',hint:'Drag nodes to arrange · drag background to pan · wheel to zoom',membership:'Organization membership',handoff:'Configured handoff',loading:'Loading organization layout…',ready:'Layouts are saved per project.',saving:'Saving layout…',saved:'Layout saved.',dirty:'There are unsaved layout changes.',error:'Layout could not be saved. Your arrangement is retained.',conflict:'Another window changed this layout. Your arrangement is retained. Reload replaces these unsaved changes.',choose:'Select a node to inspect it.',owner:'Owner',edit:'Edit role',assign:'Assign work',skills:'Configure skills',close:'Close',readOnly:'Load the layout before moving nodes.',model:'Connected model',role:'Responsibilities',task:'Current assignment',none:'None yet' },
    ja: { canvas:'組織ノードキャンバス',fit:'全体表示',arrange:'自動整列',reload:'再読み込み',retry:'再試行',inspector:'ノード情報',connections:'業務接続を編集',zoomIn:'拡大',zoomOut:'縮小',hint:'ノードをドラッグして配置・背景をドラッグして移動・ホイールで拡大縮小',membership:'組織の所属',handoff:'業務引き継ぎ設定',loading:'組織図の配置を読み込み中…',ready:'配置はプロジェクトごとに保存します。',saving:'配置を保存中…',saved:'配置を保存しました。',dirty:'未保存の配置があります。',error:'配置を保存できませんでした。現在の配置は保持します。',conflict:'別の画面で配置が変更されました。現在の配置は保持します。再読み込みすると未保存の配置を置き換えます。',choose:'ノードを選択して情報を確認します。',owner:'オーナー',edit:'役割を編集',assign:'業務指示',skills:'スキル設定',close:'閉じる',readOnly:'配置を読み込んでから移動できます。',model:'接続モデル',role:'役割と責任',task:'現在の業務',none:'まだありません' }
  };
  const CONTROLS = {
    ko: { fit: '맞춤', view: '보기 옵션', refresh: '스킬 새로고침', remove: '에이전트 삭제', reloaded: '배치를 불러왔습니다.' },
    en: { fit: 'Fit', view: 'View options', refresh: 'Refresh skills', remove: 'Remove agent', reloaded: 'Layout reloaded.' },
    ja: { fit: '全体表示', view: '表示設定', refresh: 'スキルを再読み込み', remove: 'エージェントを削除', reloaded: '配置を読み込みました。' }
  };
  const SCOPE = value => typeof value === 'string' ? (/^[a-z]:[\\/]/i.test(value) ? value.replaceAll('\\','/').toLowerCase() : value).replace(/[\\/]+$/,'') : '';
  const copy = value => JSON.parse(JSON.stringify(value));
  const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
  const h = (tag,attrs={},...children) => {const element=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(key==='class')element.className=value;else if(key.startsWith('on'))element.addEventListener(key.slice(2),value);else element.setAttribute(key,String(value));}element.append(...children);return element;};
  function create(configuration = {}) {
    const {container,owner,list}=configuration;
    if(!container||!owner||!list)throw Error('Organization container, owner and list are required.');
    let state={},language='ko',connected=false,workspace='',epoch=0,revision=0,positions={},viewport={pan:{x:0,y:0},zoom:1},loaded=false,loading=false,saving=false,dirty=false,blocked=false,failureKind='',disposed=false,edit=0,timer,frame,pointer,selected='',inspectorOpen=false,inspectorSignature='',edgeSignature='',stamp,autoFit=false,autoFitSize='',suppressClick=0;
    const nodes=new Map(),listeners=[];
    const tr=key=>(CONTROLS[language]||CONTROLS.ko)[key]||(LABELS[language]||LABELS.ko)[key]||key;
    const bind=(target,type,handler,options)=>{target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));};
    const root=h('section',{class:'on-canvas'}),toolbar=h('div',{class:'on-toolbar'}),body=h('div',{class:'on-body','data-inspector':'closed'}),stage=h('div',{class:'on-stage',tabindex:'0'}),world=h('div',{class:'on-world'}),status=h('p',{class:'on-status',role:'status','aria-live':'polite'}),details=h('aside',{class:'on-inspector',id:'org-node-details',hidden:''}),zoomLabel=h('span',{class:'on-zoom'}),legend=h('div',{class:'on-legend',hidden:''}),minimap=h('canvas',{class:'on-minimap',width:'144',height:'90','aria-hidden':'true',hidden:''});
    const zoomControls=h('div',{class:'on-zoom-controls'}), viewLabel=h('summary',{class:'on-view-label'}), menu=h('div',{class:'on-view-options'}), view=h('details',{class:'on-view-menu'},viewLabel,menu);
    const hint=h('p',{class:'on-view-hint'}), footer=h('div',{class:'on-footer'},legend,status);
    const edges=document.createElementNS('http://www.w3.org/2000/svg','svg');edges.setAttribute('class','on-edges');edges.setAttribute('aria-hidden','true');edges.setAttribute('width','1');edges.setAttribute('height','1');
    world.append(edges,owner,list);stage.append(world,minimap);body.append(stage,details);root.append(toolbar,body,footer);container.append(root);
    list.classList.add('on-node-list');
    const buttons={};
    function action(key,label,handler,{parent=toolbar,glyph}={}){
      const button=h('button',{type:'button',class:'on-'+key,'data-on-action':key,onclick:()=>{
        handler();
        if(parent===menu){view.open=false;viewLabel.focus({preventScroll:true});}
      }});
      buttons[key]={button,label,glyph};parent.append(button);
    }
    toolbar.append(zoomControls);
    action('zoom-out','zoomOut',()=>zoomBy(1/1.2),{parent:zoomControls,glyph:'−'});
    zoomControls.append(zoomLabel);
    action('zoom-in','zoomIn',()=>zoomBy(1.2),{parent:zoomControls,glyph:'+'});
    action('fit','fit',()=>{if(!loaded)return;fit();markDirty();});
    toolbar.append(view);
    action('arrange','arrange',arrange,{parent:menu});
    action('connections','connections',()=>configuration.onEditConnections?.(selected.startsWith('agent:')?selected.slice(6):null),{parent:menu});
    action('reload','reload',()=>{void load(true);},{parent:menu});
    if(configuration.onRefreshSkills)action('refresh','refresh',configuration.onRefreshSkills,{parent:menu});
    menu.append(hint);
    action('retry','retry',()=>{
      if(disposed||!blocked||!['load','save'].includes(failureKind)||loading||saving||pointer||!connected||!workspace)return;
      if(failureKind==='load'){void load(true);return;}
      if(!dirty)return;
      blocked=false;failureKind='';void save();
    });
    bind(document,'pointerdown',event=>{if(view.open&&!view.contains(event.target))view.open=false;});
    bind(view,'keydown',event=>{if(event.key==='Escape'&&view.open){event.stopPropagation();view.open=false;viewLabel.focus();}});
    function announce(text,error=false){status.textContent=text;status.dataset.error=String(error);}
    function active(key=workspace,generation=epoch){return !disposed&&workspace===key&&epoch===generation&&SCOPE(configuration.getState?.()?.settings?.workspace??workspace)===SCOPE(key);}
    function request(route,options){if(typeof configuration.api!=='function')return Promise.reject(Error(tr('error')));return configuration.api(route,options);}
    function nodeSize(element){return {width:element.offsetWidth||(element===owner?240:320),height:element.offsetHeight||(element===owner?74:92)};}
    function bounds(ids){const all=[...nodes].filter(([id])=>!ids||ids.includes(id)).map(([id,element])=>({...positions[id],...nodeSize(element)}));if(nodes.size===1&&list.querySelector('.org-empty-branch'))all.push({x:40,y:160,width:320,height:100});if(!all.length)return{x:0,y:0,width:640,height:480};const x=Math.min(...all.map(n=>n.x)),y=Math.min(...all.map(n=>n.y));return{x,y,width:Math.max(...all.map(n=>n.x+n.width))-x,height:Math.max(...all.map(n=>n.y+n.height))-y};}
    function stageSize(){return {width:stage.clientWidth||900,height:stage.clientHeight||560};}
    function assignDefaults(reset=false,width=stageSize().width){
      const agents=[...nodes.keys()].filter(id=>id!=='owner');
      const cols=Math.max(1,Math.min(4,Math.floor((width-32)/352),agents.length));
      const maxHeight=Math.max(92,...agents.map(id=>nodeSize(nodes.get(id)).height));
      if(reset||!positions.owner)positions.owner={x:40+((cols-1)*352+320-240)/2,y:32};
      agents.forEach((id,index)=>{if(reset||!positions[id])positions[id]={x:40+(index%cols)*352,y:160+Math.floor(index/cols)*(maxHeight+42)};});
    }
    function reconcile(){
      const next=new Map([['owner',owner],...[...list.querySelectorAll('.org-agent-card[data-department-id]')].map(element=>['agent:'+element.dataset.departmentId,element])]);
      for(const [id,element]of nodes)if(!next.has(id)){resize?.unobserve(element);element.classList.remove('on-node','on-node-selected');delete positions[id];}
      nodes.clear();for(const [id,element]of next){
        nodes.set(id,element);element.classList.add('on-node');element.dataset.nodeId=id;
        const handle=element.querySelector('.org-agent-heading,.org-commander-card')||element;
        const name=id==='owner'?(state.settings?.identity?.name||tr('owner')):state.departments?.find(role=>id==='agent:'+role.id)?.name||id;
        const info=[name,element.querySelector('.org-agent-summary')?.textContent,element.querySelector('.org-agent-status')?.textContent].filter(Boolean);
        handle.classList.add('on-node-drag-handle');handle.tabIndex=0;
        handle.setAttribute('role','button');handle.setAttribute('aria-label',info.join(' · '));handle.setAttribute('aria-controls',details.id);
      }
      if(selected&&!nodes.has(selected)){selected='';inspectorOpen=false;}assignDefaults();
    }
    function graph(){return state.graph||Object.entries(state.graphs||{}).find(([key])=>SCOPE(key)===SCOPE(workspace))?.[1]||{nodes:[],edges:[]};}
    function handoffs(){const current=graph(),references=new Map((current.nodes||[]).filter(node=>node.type==='department').map(node=>[node.id,node.referenceId]));const roleId=id=>{const role=references.get(id)||(typeof id==='string'&&id.startsWith('department:')?id.slice(11):null);return role&&nodes.has('agent:'+role)?'agent:'+role:null;};return(current.edges||[]).filter(edge=>edge.type==='handoff').map(edge=>({source:roleId(edge.source),target:roleId(edge.target)})).filter(edge=>edge.source&&edge.target&&edge.source!==edge.target);}
    function membershipTrunk(agents){
      if(agents.length<2)return null;
      const column=agents.map(id=>({...positions[id],height:nodeSize(nodes.get(id)).height})).sort((a,b)=>a.y-b.y);
      const [{x:left,y:top}]=column;
      if(column.some((card,index)=>Math.abs(card.x-left)>2 || index>0&&card.y<column[index-1].y+column[index-1].height))return null;
      const ownerSize=nodeSize(owner),startX=positions.owner.x+ownerSize.width/2,startY=positions.owner.y+ownerSize.height;
      const x=left-22;
      if(top-startY<24||startX-x<16)return null;
      const bend=startY+(top-startY)/2,last=column.at(-1);
      const line=document.createElementNS(edges.namespaceURI,'path');
      line.setAttribute('class','on-edge-organization on-membership-trunk');
      line.setAttribute('d',`M ${startX} ${startY} V ${bend-6} Q ${startX} ${bend} ${startX-6} ${bend} H ${x+6} Q ${x} ${bend} ${x} ${bend+6} V ${last.y+last.height/2}`);
      return {x,line};
    }
    function path(source,target,type,trunk){
      const start=positions[source],end=positions[target];if(!start||!end)return null;
      const first=nodeSize(nodes.get(source)),second=nodeSize(nodes.get(target));let shape;
      if(type==='handoff'){const direction=end.x>=start.x?1:-1,x1=start.x+(direction>0?first.width:0),y1=start.y+first.height/2,x2=end.x+(direction>0?0:second.width),y2=end.y+second.height/2,control=Math.max(48,Math.abs(x2-x1)*.5);shape=`M ${x1} ${y1} C ${x1+direction*control} ${y1}, ${x2-direction*control} ${y2}, ${x2} ${y2}`;}
      else if(trunk)shape=`M ${trunk.x} ${end.y+second.height/2} H ${end.x}`;
      else{const x1=start.x+first.width/2,y1=start.y+first.height,x2=end.x+second.width/2,y2=end.y,control=Math.max(45,Math.abs(y2-y1)*.45);shape=`M ${x1} ${y1} C ${x1} ${y1+control}, ${x2} ${y2-control}, ${x2} ${y2}`;}
      const element=document.createElementNS(edges.namespaceURI,'path');element.setAttribute('class',type==='membership'?'on-edge-organization on-edge-membership':'on-edge-handoff');element.dataset.edgeType=type;element.dataset.source=source;element.dataset.target=target;element.setAttribute('fill','none');element.setAttribute('d',shape);if(type==='handoff')element.setAttribute('marker-end',`url(#${arrowId})`);return element;
    }
    const arrowId='on-arrow-'+Math.random().toString(36).slice(2);
    let mapColors;
    function drawEdges(){
      const connections=handoffs(),signature=JSON.stringify([[...nodes].map(([id,element])=>[id,positions[id],nodeSize(element)]),connections]);
      if(signature===edgeSignature)return;edgeSignature=signature;
      const defs=document.createElementNS(edges.namespaceURI,'defs'),marker=document.createElementNS(edges.namespaceURI,'marker'),arrow=document.createElementNS(edges.namespaceURI,'path');
      marker.id=arrowId;marker.setAttribute('viewBox','0 0 10 10');marker.setAttribute('refX','9');marker.setAttribute('refY','5');marker.setAttribute('markerWidth','6');marker.setAttribute('markerHeight','6');marker.setAttribute('orient','auto-start-reverse');arrow.setAttribute('d','M 0 0 L 10 5 L 0 10 z');arrow.setAttribute('fill','currentColor');marker.append(arrow);defs.append(marker);
      const agents=[...nodes.keys()].filter(id=>id!=='owner'),trunk=membershipTrunk(agents),lines=[defs];
      if(trunk)lines.push(trunk.line);
      for(const id of agents)lines.push(path('owner',id,'membership',trunk));
      for(const edge of connections)lines.push(path(edge.source,edge.target,'handoff'));
      edges.replaceChildren(...lines.filter(Boolean));
    }
    function drawMap() {
      if (typeof window.CanvasRenderingContext2D !== 'function') return;
      const context = minimap.getContext('2d');
      if (!context) return;
      // The palette is fixed for the current page. Read it once, outside the drag loop.
      if (!mapColors) {
        const style = window.getComputedStyle(root);
        const color = (name, fallback) => style.getPropertyValue(name).trim() || fallback;
        mapColors = {
          background: color('--on-panel', '#0d0d0d'),
          selected: color('--on-orange', '#ffad32'),
          owner: color('--on-owner-line', '#94692a'),
          agent: color('--on-membership', '#8a8a8a'),
          viewport: color('--on-text', '#f2f2f2'),
        };
      }
      const box = bounds();
      const scale = Math.min(132 / (box.width + 80), 78 / (box.height + 80));
      const mapPoint = (x, y) => ({ x: 6 + (x - box.x + 40) * scale, y: 6 + (y - box.y + 40) * scale });
      context.clearRect(0, 0, 144, 90);
      context.fillStyle = mapColors.background;
      context.fillRect(0, 0, 144, 90);
      for (const [id, element] of nodes) {
        const position = positions[id];
        const size = nodeSize(element);
        const point = mapPoint(position.x, position.y);
        context.fillStyle = id === selected ? mapColors.selected : id === 'owner' ? mapColors.owner : mapColors.agent;
        context.fillRect(point.x, point.y, Math.max(2, size.width * scale), Math.max(2, size.height * scale));
      }
      const visible = mapPoint(-viewport.pan.x / viewport.zoom, -viewport.pan.y / viewport.zoom);
      const size = stageSize();
      context.strokeStyle = mapColors.viewport;
      context.lineWidth = 1;
      context.strokeRect(visible.x, visible.y, size.width / viewport.zoom * scale, size.height / viewport.zoom * scale);
    }
    function draw(){
      frame=null;
      if(disposed)return;
      world.style.transform=`translate(${viewport.pan.x}px,${viewport.pan.y}px) scale(${viewport.zoom})`;
      stage.style.backgroundPosition=`${viewport.pan.x}px ${viewport.pan.y}px`;
      stage.style.backgroundSize=`${24*viewport.zoom}px ${24*viewport.zoom}px`;
      for(const [id,element]of nodes){
        const point=positions[id];
        element.style.left=point.x+'px';element.style.top=point.y+'px';
        element.classList.toggle('on-node-selected',id===selected&&inspectorOpen);
        element.querySelector('.on-node-drag-handle')?.setAttribute('aria-expanded',String(id===selected&&inspectorOpen));
      }
      zoomLabel.textContent=Math.round(viewport.zoom*100)+'%';
      drawEdges();
      minimap.hidden=nodes.size<6;
      if(!minimap.hidden)drawMap();
      const busy=loading||saving||Boolean(pointer)||!connected;
      for(const [key,{button,label,glyph}]of Object.entries(buttons)){
        const caption=tr(label);
        button.textContent=glyph||caption;
        if(glyph){button.setAttribute('aria-label',caption);button.title=caption;}
        if(key==='retry')button.disabled=busy||!blocked||failureKind==='conflict';
        else if(key==='reload')button.disabled=busy;
        else if(key==='refresh')button.disabled=!connected;
        else if(key!=='connections')button.disabled=!loaded||loading;
      }
      buttons.retry.button.hidden=!blocked||failureKind==='conflict';
      root.setAttribute('aria-label',tr('canvas'));stage.setAttribute('aria-label',tr('canvas'));
      viewLabel.textContent=tr('view');hint.textContent=tr('hint');
      legend.hidden=!edges.querySelector('[data-edge-type=handoff]');
      if(!legend.hidden&&legend.dataset.language!==language){
        legend.dataset.language=language;
        legend.replaceChildren(h('span',{class:'on-membership-legend'},tr('membership')),h('span',{class:'on-handoff-legend'},tr('handoff')));
      }
    }
    function schedule(){if(frame!==undefined&&frame!==null)return;frame=window.requestAnimationFrame?requestAnimationFrame(draw):setTimeout(draw,0);}
    function fitScale(box,size){return clamp(Math.min(1,(size.width-64)/Math.max(1,box.width),(size.height-64)/Math.max(1,box.height)),.15,3);}
    function fit(ids,initial=false){
      const box=bounds(ids),size=stageSize();
      const zoom=fitScale(box,size);
      if(initial&&size.width<700&&zoom<.65){
        fit(['owner',[...nodes.keys()].find(id=>id!=='owner')].filter(Boolean));
        return;
      }
      viewport={zoom,pan:{x:(size.width-box.width*zoom)/2-box.x*zoom,y:(size.height-box.height*zoom)/2-box.y*zoom}};schedule();
    }
    function fitUnmodifiedLayout(){
      if(!autoFit||!loaded||!stage.clientWidth)return;
      const size=stageSize(),fullWidth=inspectorOpen&&window.innerWidth>900 ? Math.max(body.clientWidth,size.width) : size.width;
      const key=`${size.width}:${size.height}:${fullWidth}:${nodes.size}`;
      if(key===autoFitSize)return;
      autoFitSize=key;
      assignDefaults(true,fullWidth);
      if(fullWidth>size.width&&fitScale(bounds(),size)<.65)assignDefaults(true);
      fit(undefined,true);
    }
    function zoomBy(factor,client){if(!loaded||loading)return;const size=stageSize(),rect=stage.getBoundingClientRect(),point=client?{x:client.x-rect.left,y:client.y-rect.top}:{x:size.width/2,y:size.height/2},next=clamp(viewport.zoom*factor,.15,3),worldPoint={x:(point.x-viewport.pan.x)/viewport.zoom,y:(point.y-viewport.pan.y)/viewport.zoom};viewport={zoom:next,pan:{x:clamp(point.x-worldPoint.x*next,-100000,100000),y:clamp(point.y-worldPoint.y*next,-100000,100000)}};schedule();markDirty();}
    function arrange(){if(!loaded||loading||pointer)return;assignDefaults(true);fit();markDirty();}
    function select(id){
      if(!nodes.has(id))return;
      selected=id;inspectorOpen=true;drawInspector();schedule();
      if(window.innerWidth<=900)details.scrollIntoView?.({block:'nearest'});
    }
    function closeInspector(){
      const focused=details.contains(document.activeElement),node=nodes.get(selected);
      inspectorOpen=false;drawInspector();schedule();
      if(focused)(node?.querySelector('.on-node-drag-handle')||stage).focus({preventScroll:true});
    }
    function drawInspector(){
      details.hidden=!inspectorOpen;body.dataset.inspector=inspectorOpen?'open':'closed';if(!inspectorOpen)return;
      const id=selected.startsWith('agent:')?selected.slice(6):null,role=state.departments?.find(role=>role.id===id),element=nodes.get(selected);
      const model=element?.querySelector('.org-agent-model')?.textContent;
      const taskLine=element?.querySelector('.org-agent-task'),task=taskLine?.dataset.title||taskLine?.textContent;
      const skills=element?.querySelector('.org-card-skills'),evidence=element?.querySelector('.org-skill-evidence');
      const statusLabel=element?.querySelector('.org-agent-status'),next=element?.querySelector('.org-agent-next[data-has-handoff=true]')?.textContent;
      const assign=element?.querySelector('.org-agent-actions > button'),remove=element?.querySelector('.org-remove-agent');
      const signature=JSON.stringify([workspace,selected,language,role?.name,role?.title,role?.role,model,task,skills?.textContent,evidence?.textContent,statusLabel?.textContent,next,assign?.disabled,remove?.disabled,state.settings?.identity]);
      if(signature===inspectorSignature)return;inspectorSignature=signature;
      const focused=details.contains(document.activeElement)?document.activeElement.dataset.inspectorAction:null;
      const action=(name,label,handler,className='')=>h('button',{type:'button',class:className,'data-inspector-action':name,onclick:handler},label);
      const displayName=role?.name||state.settings?.identity?.name||tr('owner');
      const heading=h('div',{class:'on-inspector-heading'},
        h('div',{class:'on-inspector-identity'},h('h3',{},displayName),
          ...(role?.title?[h('p',{class:'on-detail-title'},role.title)]:[])),
        h('button',{type:'button',class:'on-inspector-close','data-inspector-action':'close','aria-label':tr('close'),title:tr('close'),onclick:closeInspector},'×')
      );
      details.setAttribute('aria-label',displayName);
      const content=[heading];
      if(!element)content.push(h('p',{},tr('choose')));
      else if(role){
        const assignButton=action('assign',tr('assign'),()=>configuration.onAssignAgent?.(id),'on-assign-button');
        assignButton.disabled=Boolean(assign?.disabled);
        content.push(h('div',{class:'on-inspector-actions'},assignButton,
          action('edit',tr('edit'),()=>configuration.onEditAgent?.(id)),
          action('skills',tr('skills'),()=>configuration.onSkillsAgent?.(id))));
        const fields=h('dl',{class:'on-detail-list'});
        const addField=(label,value)=>fields.append(h('div',{class:'on-detail'},h('dt',{},label),h('dd',{},value||tr('none'))));
        const currentTask=h('span',{class:'on-detail-task'},task||tr('none'));
        if(statusLabel)currentTask.prepend(h('span',{class:'on-detail-state','data-status':statusLabel.dataset.status||''},statusLabel.textContent));
        if(next)currentTask.append(h('span',{class:'on-detail-evidence'},next));
        addField(tr('task'),currentTask);
        addField(tr('model'),model);
        addField(tr('role'),role.role);
        const chips=[...(skills||element).querySelectorAll('.org-skill-chip')].map(chip=>chip.cloneNode(true));
        const skillDetails=h('span',{class:'on-detail-skills'},...(chips.length?chips:[skills?.textContent||tr('none')]));
        if(evidence?.textContent)skillDetails.append(h('span',{class:'on-detail-evidence',title:evidence.title},evidence.textContent));
        addField(tr('skills'),skillDetails);
        content.push(fields);
        if(configuration.onRemoveAgent){
          const removeButton=action('remove',tr('remove'),()=>configuration.onRemoveAgent(id),'on-remove-button');
          removeButton.disabled=Boolean(remove?.disabled)||!connected;
          if(remove?.title)removeButton.title=remove.title;
          content.push(h('div',{class:'on-inspector-footer'},removeButton));
        }
      }else content.push(h('p',{},state.settings?.identity?.title||''));
      details.replaceChildren(...content);
      if(focused&&!document.querySelector('dialog[open]'))details.querySelector(`[data-inspector-action="${focused}"]`)?.focus({preventScroll:true});
    }
    function queueSave(){if(timer!=null)return;timer=setTimeout(()=>{timer=null;void save();},350);}
    function markDirty(){autoFit=false;dirty=true;edit++;announce(tr(blocked?(failureKind==='conflict'?'conflict':'error'):'dirty'),blocked);clearTimeout(timer);timer=null;if(loaded&&connected&&!loading&&!saving&&!blocked)queueSave();}
    function validResponse(result,key){return result&&SCOPE(result.workspace)===SCOPE(key)&&Number.isSafeInteger(result.revision)&&result.revision>=0&&result.positions&&typeof result.positions==='object'&&result.viewport&&Number.isFinite(result.viewport.zoom)&&result.viewport.zoom>=.15&&result.viewport.zoom<=3&&Number.isFinite(result.viewport.pan?.x)&&Number.isFinite(result.viewport.pan?.y);}
    async function load(explicit=false){if(disposed||!workspace||!connected||!state.server?.csrfToken||loading||saving||pointer)return;const key=workspace,generation=epoch,previousFailure=failureKind;loading=true;announce(tr('loading'));schedule();try{const result=await request('/api/organization-layout?workspace='+encodeURIComponent(key));if(!active(key,generation))return;if(!validResponse(result,key))throw Error(tr('error'));revision=result.revision;positions=Object.fromEntries(Object.entries(result.positions).filter(([id,point])=>nodes.has(id)&&Number.isFinite(point?.x)&&Number.isFinite(point?.y)&&Math.abs(point.x)<=100000&&Math.abs(point.y)<=100000).map(([id,point])=>[id,{x:point.x,y:point.y}]));assignDefaults();viewport=copy(result.viewport);loaded=true;dirty=false;blocked=false;failureKind='';autoFit=Object.keys(result.positions).length===0;autoFitSize='';fitUnmodifiedLayout();announce(explicit?tr('reloaded'):'');}catch(error){if(active(key,generation)){blocked=true;failureKind=previousFailure==='conflict'?'conflict':'load';announce(failureKind==='conflict'?tr('conflict')+' '+(error.message||''):error.message||tr('error'),true);}}finally{if(active(key,generation)){loading=false;draw();}}}
    async function save(){if(disposed||!loaded||loading||saving||!dirty||blocked||!connected||pointer)return;const key=workspace,generation=epoch,snapshot=edit,payload={workspace:key,revision,positions:copy(positions),viewport:copy(viewport)};saving=true;announce(tr('saving'));schedule();try{const result=await request('/api/organization-layout',{method:'PUT',body:payload});if(!active(key,generation))return;if(!validResponse(result,key)||result.revision<=revision)throw Error(tr('error'));revision=result.revision;if(edit===snapshot){dirty=false;announce(tr('saved'));}else{announce(tr('dirty'));queueSave();}}catch(error){if(active(key,generation)){blocked=true;failureKind=error.status===409?'conflict':'save';announce(tr(failureKind==='conflict'?'conflict':'error'),true);}}finally{if(active(key,generation)){saving=false;schedule();}}}
    function endPointer(event){
      if(!pointer||event&&event.pointerId!==pointer.id)return;
      const {moved,node}=pointer;
      try{stage.releasePointerCapture?.(pointer.id);}catch{}
      pointer=null;root.classList.remove('on-dragging');
      document.removeEventListener('pointermove',movePointer);
      document.removeEventListener('pointerup',endPointer);
      document.removeEventListener('pointercancel',endPointer);
      if(moved){suppressClick=Date.now()+200;markDirty();}
      else if(node&&event?.type==='pointerup'){suppressClick=Date.now()+200;select(node);}
      schedule();
    }
    function movePointer(event){if(!pointer||event.pointerId!==pointer.id)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;if(Math.abs(dx)+Math.abs(dy)>3)pointer.moved=true;if(pointer.kind==='node'){positions[pointer.node]={x:clamp(pointer.origin.x+dx/viewport.zoom,-100000,100000),y:clamp(pointer.origin.y+dy/viewport.zoom,-100000,100000)};}else viewport.pan={x:clamp(pointer.origin.x+dx,-100000,100000),y:clamp(pointer.origin.y+dy,-100000,100000)};event.preventDefault();schedule();}
    function startPointer(event){if(pointer||event.button!==0||event.target.closest('button,input,textarea,select,a,.on-minimap,.on-hint'))return;if(!loaded||loading){announce(tr('readOnly'));return;}const handle=event.target.closest('.on-node-drag-handle'),node=handle?.closest('.on-node');if(!node&&event.target.closest('.on-node'))return;const id=node?.dataset.nodeId;if(id&&!nodes.has(id))return;if(id){selected=id;drawInspector();}pointer={id:event.pointerId,kind:id?'node':'pan',node:id,x:event.clientX,y:event.clientY,origin:copy(id?positions[id]:viewport.pan),moved:false};try{stage.setPointerCapture?.(event.pointerId);}catch{}root.classList.add('on-dragging');document.addEventListener('pointermove',movePointer);document.addEventListener('pointerup',endPointer);document.addEventListener('pointercancel',endPointer);event.preventDefault();schedule();}
    bind(stage,'pointerdown',startPointer);bind(stage,'click',event=>{if(Date.now()<suppressClick||event.target.closest('button,input,textarea,select,a,.on-minimap'))return;const node=event.target.closest('.on-node');if(node)select(node.dataset.nodeId);else if(inspectorOpen)closeInspector();});
    bind(stage,'wheel',event=>{if(!loaded||loading||event.target.closest('input,textarea,select'))return;event.preventDefault();zoomBy(event.deltaY<0?1.1:1/1.1,{x:event.clientX,y:event.clientY});},{passive:false});
    bind(details,'keydown',event=>{if(event.key==='Escape'&&!document.querySelector('dialog[open]'))closeInspector();});
    bind(stage,'keydown',event=>{if(event.target.closest('button,input,textarea,select,a'))return;if(event.key==='Escape'){closeInspector();return;}const id=event.target.closest('.on-node')?.dataset.nodeId||selected;if(['Enter',' '].includes(event.key)&&id){select(id);event.preventDefault();return;}const change={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(change&&id&&loaded&&!loading){const step=event.shiftKey?50:10;positions[id]={x:clamp(positions[id].x+change[0]*step,-100000,100000),y:clamp(positions[id].y+change[1]*step,-100000,100000)};event.preventDefault();schedule();markDirty();}});
    const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>{if(!pointer)fitUnmodifiedLayout();schedule();}):null;resize?.observe(stage);
    function update(incoming={},options={}){if(disposed)return;state=incoming;language=options.language||state.settings?.language||'ko';connected=options.connected!==false;const key=state.settings?.workspace||'';if(workspace!==key){endPointer();epoch++;clearTimeout(timer);timer=null;workspace=key;revision=0;positions={};viewport={pan:{x:0,y:0},zoom:1};loaded=loading=saving=dirty=blocked=false;failureKind='';selected='';inspectorOpen=false;view.open=false;announce('');stamp=undefined;autoFit=false;autoFitSize='';}
      reconcile();for(const element of nodes.values())resize?.observe(element);drawInspector();if(!pointer)fitUnmodifiedLayout();schedule();const nextStamp=state.server?.organizationLayoutRevision;
      if(!loaded&&!loading&&!blocked)void load();else if(stamp!==undefined&&nextStamp!==stamp&&loaded&&!dirty&&!saving&&!pointer)void load();stamp=nextStamp;
      if(dirty&&loaded&&connected&&!saving&&!loading&&!blocked)queueSave();
    }
    draw();return {update,fit,arrange,reload:()=>load(true),getLayout:()=>copy({workspace,revision,positions,viewport,dirty,blocked}),destroy(){if(disposed)return;endPointer();disposed=true;epoch++;clearTimeout(timer);if(frame!==undefined&&frame!==null){if(window.cancelAnimationFrame)cancelAnimationFrame(frame);else clearTimeout(frame);}resize?.disconnect();listeners.forEach(remove=>remove());root.remove();}};
  }
  window.ImperiumOrganizationNodes=Object.freeze({create});
})();

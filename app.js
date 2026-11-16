import {ticks, paretoFrontier, dataBounds, clampView, validRows, sortRows, valuePerDollar, VALUE_WEIGHT} from './chart-math.mjs?v=20261116-10';

const $ = selector => document.querySelector(selector);
const svg = $('#svg'), host = $('#chart'), tip = $('#tip');
const NS = 'http://www.w3.org/2000/svg';
const config = {
  models: {key:'models', title:'模型智能指数与每任务成本', english:'Artificial Analysis Intelligence Index vs. Cost per Intelligence Index Task', axis:'模型智能指数', axisEnglish:'Intelligence Index', unit:'个模型', unitEnglish:'models', source:'https://artificialanalysis.ai/', defaultX:4.5},
  'coding-agents': {key:'codingAgents', title:'编程智能体指数与每任务成本', english:'Artificial Analysis Coding Agent Index vs. Cost per Task', axis:'编程智能体指数', axisEnglish:'Coding Agent Index', unit:'个变体', unitEnglish:'agent variants', source:'https://artificialanalysis.ai/agents/coding-agents', defaultX:20}
};
const DEFAULT_SETTINGS = {
  models: {labels:true,labelSize:9,labelDistance:2},
  'coding-agents': {labels:true,labelSize:10,labelDistance:12}
};
let snapshot, activeKey = location.hash === '#coding-agents' ? 'coding-agents' : 'models';
const states = new Map();
let state, nodes = [], frame, pendingFrame = 0, drag = null, hovered = null, suppressClick = false;
let loadController, loadGeneration = 0;
const measure = document.createElement('canvas').getContext('2d');
const colorCache = new Map();
const node = (tag, attrs = {}, content) => {
  const element = document.createElementNS(NS, tag);
  for (const [key,value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  if (content != null) element.textContent = content;
  return element;
};
function html(tag, content, className) {
  const element = document.createElement(tag);
  if (content != null) element.textContent = content;
  if (className) element.className = className;
  return element;
}
function bilingual(element, chinese, english) {
  element.replaceChildren(document.createTextNode(chinese), html('small', english));
}
function color(source) {
  const dark = document.documentElement.dataset.theme === 'dark';
  let value = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(source || '') ? source.toLowerCase() : '#777777';
  const cacheKey = `${dark}:${value}`;
  if (colorCache.has(cacheKey)) return colorCache.get(cacheKey);
  if (!dark) return value;
  if (value.length === 4) value = '#' + [...value.slice(1)].map(x=>x+x).join('');
  const channels = [1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
  const luminance = values => values.reduce((sum,v,i)=>sum + (v/255<=.04045?v/255/12.92:((v/255+.055)/1.055)**2.4)*[.2126,.7152,.0722][i],0);
  let result = channels;
  for (let step=0;step<=100;step++) {
    result = channels.map(c=>Math.round(c+(255-c)*step/100));
    if ((luminance(result)+.05)/(luminance([20,50,47])+.05)>=4.5) break;
  }
  const adjusted = '#'+result.map(c=>c.toString(16).padStart(2,'0')).join('');
  colorCache.set(cacheKey,adjusted);
  return adjusted;
}
function format(value, digits=3) { return value.toLocaleString('en-US',{maximumFractionDigits:digits}); }
function money(value) { return '$'+format(value, value>0&&value<.001?6:3); }
function valueLabel(value) {return value===null?'—':value>0&&(value<.001||value>=1e6)?value.toExponential(2):format(value,value>0&&value<.01?6:2);}
function median(values) { const sorted=[...values].sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2; }
function makeState(key) {
  const rows = validRows(snapshot[config[key].key]);
  const bounds = dataBounds(rows);
  const defaultView = {...bounds, width:config[key].defaultX ? Math.min(bounds.width,config[key].defaultX) : bounds.width};
  return {rows,bounds,defaultView,view:{...defaultView},company:null,search:'',frontierOnly:false,...DEFAULT_SETTINGS[key],options:false,table:false,selected:null,sortKey:'intelligenceIndex',sortDirection:'desc',valueWeight:VALUE_WEIGHT.default};
}
function filteredRows() {
  const query = state.search.trim().toLocaleLowerCase();
  let rows = state.rows.filter(row => !query || [row.name,row.shortName,row.creator?.name,row.agentName,row.modelName].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  if (state.frontierOnly) {
    const frontier = new Set(paretoFrontier(state.rows).map(row=>row.id));
    rows = rows.filter(row=>frontier.has(row.id));
  }
  return rows;
}
function applyTheme() {
  const dark = document.documentElement.dataset.theme !== 'light';
  $('#themeLabel').textContent = dark?'深色':'浅色';
  $('#themeEnglish').textContent = dark?'Dark':'Light';
  $('#theme').setAttribute('aria-pressed',String(dark));
  $('#theme').setAttribute('aria-label',dark?'切换浅色主题 / Switch to light theme':'切换深色主题 / Switch to dark theme');
  clearHover();
  if (state) {renderLegend();buildPlot();}
}
$('#theme').addEventListener('click',()=>{
  const theme=document.documentElement.dataset.theme==='light'?'dark':'light';
  document.documentElement.dataset.theme=theme;
  try {localStorage.setItem('intelligence-cost-theme',theme);} catch {}
  applyTheme();
});
applyTheme();

function chooseChart(key, {changeHash=true}={}) {
  if (!config[key]) return;
  endDrag();clearHover();
  activeKey=key;
  if (changeHash && location.hash!==`#${key}`) history.replaceState(null,'',`#${key}`);
  for (const tab of document.querySelectorAll('[role=tab]')) {
    const selected=tab.dataset.chart===key;
    tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
  }
  $('#chart-panel').setAttribute('aria-labelledby',`tab-${key}`);
  $('#chartTitle').textContent=config[key].title;
  $('#chartSubtitle').textContent=config[key].english;
  if (!snapshot) return;
  try {
    if (!states.has(key)) states.set(key,makeState(key));
    state=states.get(key);
    $('#loading').hidden=true;host.setAttribute('aria-busy','false');
    syncControls();renderLegend();renderStatus();buildPlot();
  } catch (error) {state=null;svg.replaceChildren();showLoadError(error);}
}
for (const tab of document.querySelectorAll('[role=tab]')) {
  tab.addEventListener('click',()=>chooseChart(tab.dataset.chart));
  tab.addEventListener('keydown',event=>{
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const key=event.key==='Home'?'models':event.key==='End'?'coding-agents':activeKey==='models'?'coding-agents':'models';
    chooseChart(key);$(`#tab-${key}`).focus();
  });
}
addEventListener('hashchange',()=>chooseChart(location.hash==='#coding-agents'?'coding-agents':'models',{changeHash:false}));
function renderLegend() {
  const companies=new Map();
  for (const row of state.rows) {
    const name=row.creator?.name||'Other';
    if (!companies.has(name)) companies.set(name,{name,color:row.creator?.color,count:0});
    companies.get(name).count++;
  }
  const fragment=document.createDocumentFragment();
  for (const creator of [...companies.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))) {
    const button=html('button');button.type='button';
    button.setAttribute('aria-pressed',String(creator.name===state.company));
    button.setAttribute('aria-label',`聚焦 ${creator.name}，${creator.count} 项 / Focus ${creator.name}`);
    const dot=html('i');dot.style.setProperty('--color',color(creator.color));dot.setAttribute('aria-hidden','true');
    button.append(dot,document.createTextNode(creator.name),html('span',creator.count,'legend-count'));
    button.addEventListener('click',()=>{state.company=state.company===creator.name?null:creator.name;state.selected=null;clearHover();renderLegend();syncControls();if(state.table)renderTable();scheduleDraw();});
    fragment.append(button);
  }
  $('#legend').replaceChildren(fragment);
}
function syncControls() {
  $('#search').value=state.search;
  $('#frontier').setAttribute('aria-pressed',String(state.frontierOnly));
  bilingual($('#frontier'),state.frontierOnly?'✓ 仅看前沿':'仅看前沿',state.frontierOnly?'Frontier on':'Frontier only');
  $('#labels').setAttribute('aria-pressed',String(state.labels));
  bilingual($('#labels'),state.labels?'✓ 标签已显示':'标签已隐藏',state.labels?'Labels on':'Labels off');
  $('#labelSize').value=state.labelSize;$('#labelSizeValue').value=state.labelSize;
  $('#labelDistance').value=state.labelDistance;$('#labelDistanceValue').value=state.labelDistance;
  syncSettingsReset();
  syncValueControls();
  $('#options').setAttribute('aria-expanded',String(state.options));$('#optionsPanel').hidden=!state.options;
  $('#options').setAttribute('aria-pressed',String(state.options));
  bilingual($('#options'),state.options?'收起选项':'图表选项',state.options?'Hide options':'Options');
  $('#options').disabled=state.table;
  $('#options').title=state.table?'返回图表后调整标签 / Return to the chart to adjust labels':'';
  $('#tableToggle').setAttribute('aria-expanded',String(state.table));
  $('#tableToggle').setAttribute('aria-pressed',String(state.table));
  bilingual($('#tableToggle'),state.table?'返回图表':'图形数据表',state.table?'Back to chart':'Visual table');
  $('#dataTable').hidden=!state.table;host.hidden=state.table;
  $('#interactionHelp').hidden=state.table;
  document.querySelector('.view-controls').hidden=state.table;
  // Reserve this control's space so focusing a creator cannot resize the plot.
  const hasFocus=!!(state.company||state.search||state.frontierOnly);
  $('#clearFilters').hidden=false;
  $('#clearFilters').style.visibility=hasFocus?'visible':'hidden';
  $('#clearFilters').disabled=!hasFocus;
}
function syncSettingsReset() {
  const defaults=DEFAULT_SETTINGS[activeKey];
  const restored=Object.entries(defaults).every(([key,value])=>state[key]===value);
  $('#resetSettings').disabled=restored;
  bilingual($('#resetSettings'),restored?'已是默认':'恢复默认设置',restored?'Defaults':'Reset settings');
  $('#resetSettings').title=`标签显示 · 字号 ${defaults.labelSize} · 距离 ${defaults.labelDistance} / Show labels · Size ${defaults.labelSize} · Distance ${defaults.labelDistance}`;
}
function syncValueControls() {
  const weight=state.valueWeight,linear=weight===1,restored=weight===VALUE_WEIGHT.default;
  const slider=$('#valueWeight');
  slider.min=VALUE_WEIGHT.min;slider.max=VALUE_WEIGHT.max;slider.step=VALUE_WEIGHT.step;slider.value=weight;
  slider.setAttribute('aria-valuetext',`${weight.toFixed(1)}，${linear?'线性':restored?'默认非线性':'自定义非线性'} / ${linear?'Linear':restored?'Default nonlinear':'Custom nonlinear'}`);
  $('#valueWeightValue').value=weight.toFixed(1);
  $('#valueWeightState').textContent=linear?'线性 / Linear':restored?'默认 / Default':'自定义 / Custom';
  $('#linearValue').setAttribute('aria-pressed',String(linear));
  $('#resetValueWeight').disabled=restored;
  bilingual($('#resetValueWeight'),restored?'已是默认':'恢复默认',restored?'Default α = 3':'Reset α = 3');
  $('#valueFormula').replaceChildren(document.createTextNode(linear?'性价比 = 指数 ÷ 每任务成本':'性价比 = 100 × (指数 / 100)'),...(linear?[]:[html('sup',weight.toFixed(1)),document.createTextNode(' ÷ 每任务成本')]),html('small',linear?'Value = Index / cost':'Value = 100 × (Index / 100)^α / cost'));
  bilingual($('#valueEffect'),`指数翻倍 → 能力项 ×${format(2**weight,2)}；成本翻倍 → 性价比 ÷2`,`Double index → utility ×${format(2**weight,2)}; double cost → value ÷2`);
  $('#valueUnit').textContent=linear?'Index / USD':'Weighted / USD';
}
function renderStatus() {
  const cfg=config[activeKey], version=activeKey==='models'?snapshot.modelIndexVersion:snapshot.codingAgentIndexVersion;
  bilingual($('#count'),`${state.rows.length} ${cfg.unit}`,`${cfg.unitEnglish}${version?' · v'+version:''}`);
  const source=html('a','Artificial Analysis');source.href=cfg.source;source.target='_blank';source.rel='noopener';
  const time=new Date(snapshot.updatedAt);
  const label=Number.isFinite(time.getTime())?time.toLocaleString('zh-CN',{hour12:false}):'未知 / Unknown';
  $('#status').replaceChildren(document.createTextNode('来源 / Source：'),source,document.createTextNode(' · 快照 / Snapshot：'+label));
  const stale=Date.now()-time.getTime()>8*60*60*1000;
  if(stale) $('#status').append(document.createTextNode(' · 快照较早 / Older snapshot'));
  $('#status').title='数据变化时保存新快照；无变化时保留时间。定时检查记录见 GitHub Actions。 / Snapshot time changes only when data changes.';
  bilingual($('#costNote'),activeKey==='models'?'智能指数任务的加权平均 API 成本':'基准任务的平均 API 成本，非订阅价格',activeKey==='models'?'Weighted average API cost per index task':'Average API cost per task, not subscription pricing');
  document.querySelector('.swatch').parentElement.title='绿色参考区域：成本不高于中位数，指数不低于中位数（按此图全部数据计算）。 / Reference region uses median cost and index across all entries.';
}
function x(value) {return frame.left+(value-state.view.x)/state.view.width*frame.width;}
function y(value) {return frame.bottom-(value-state.view.y)/state.view.height*frame.height;}
function inView(row) {const xx=x(row.cost),yy=y(row.intelligenceIndex);return xx>=frame.left-.01&&xx<=frame.right+.01&&yy>=frame.top-.01&&yy<=frame.bottom+.01;}
function buildPlot() {
  clearHover();
  const rows=filteredRows();
  const defs=node('defs'),clip=node('clipPath',{id:'plot-clip'}),emphasisClip=node('clipPath',{id:'emphasis-clip'});clip.append(node('rect'));emphasisClip.append(node('rect'));defs.append(clip,emphasisClip);
  // Share soft, static gradients by color; text and connectors never receive a blur filter.
  for(const display of new Set(rows.map(row=>color(row.creator?.color)))) {
    const gradient=node('radialGradient',{id:glowId(display),cx:'50%',cy:'50%',r:'50%'});
    for(const [offset,opacity]of [['0%',.6],['35%',.38],['70%',.12],['100%',0]])gradient.append(node('stop',{offset,'stop-color':display,'stop-opacity':opacity}));
    defs.append(gradient);
  }
  const plot=node('g',{'clip-path':'url(#plot-clip)',class:'plot-content'});
  const quadrant=node('rect',{class:'quadrant'}),path=node('path',{class:'pareto'}),connectors=node('g',{class:'connector-layer'}),points=node('g',{class:'points'}),labels=node('g',{class:'label-layer'});
  const emphasis=node('g',{class:'emphasis-layer','clip-path':'url(#emphasis-clip)','aria-hidden':'true','pointer-events':'none'});
  emphasis.append(node('g',{class:'glow-layer'}),node('g',{class:'company-layer'}),node('g',{class:'active-layer'}));
  plot.append(quadrant,path,connectors,points,labels);
  svg.replaceChildren(defs,node('g',{class:'grid'}),plot,node('g',{class:'axis'}),emphasis);
  nodes=rows.map(row=>{
    const display=color(row.creator?.color),p=node('circle',{class:'point','data-id':row.id,r:4.3,fill:display,tabindex:0,role:'button','aria-label':`${row.name}，${config[activeKey].axis} ${format(row.intelligenceIndex,2)}，每任务 ${money(row.cost)} / Index ${format(row.intelligenceIndex,2)}, cost per task ${money(row.cost)}`});
    const label=node('text',{class:'label',fill:display,'font-size':state.labelSize},row.shortName||row.name),line=node('line',{class:'connector',stroke:display});
    points.append(p);labels.append(label);connectors.append(line);
    const item={row,p,label,line,color:display};
    p.addEventListener('focus',()=>showHover(item));p.addEventListener('blur',clearHover);
    p.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();togglePin(item);}if(event.key==='Escape'){clearPin();p.blur();host.focus();}});
    return item;
  });
  if(state.selected&&!rows.some(row=>row.id===state.selected))state.selected=null;
  if(state.table)renderTable(rows);
  scheduleDraw();
}
function renderTable(rows=filteredRows()) {
  const fragment=document.createDocumentFragment();
  const maxCost=Math.max(...state.rows.map(row=>row.cost),.001);
  const values=state.rows.map(row=>valuePerDollar(row,state.valueWeight)).filter(value=>value!==null),maxValue=values.length?Math.max(...values):null;
  const valueRange=maxValue===null?'暂无':`0–${valueLabel(maxValue)}`;
  $('#tableScale').textContent=`统一线性条：指数 0–100 · 成本 $0–${format(maxCost)} · 性价比 ${valueRange} / Shared linear bars · Full benchmark`;
  for (const row of sortRows(rows,state.sortKey,state.sortDirection,state.valueWeight)) {
    const tr=html('tr');
    tr.dataset.id=row.id;
    tr.classList.toggle('is-muted',!!state.company&&row.creator?.name!==state.company);
    const name=html('td',null,'table-name'),dot=html('i',null,'creator-dot');
    dot.style.background=color(row.creator?.color);dot.setAttribute('aria-hidden','true');
    name.append(dot,document.createTextNode(row.name));
    const value=valuePerDollar(row,state.valueWeight),valueCell=comparisonCell(valueLabel(value),value!==null&&maxValue>0?value/maxValue:0,color(row.creator?.color));
    valueCell.className='value-column';
    valueCell.title=value===null?'没有可比较的性价比 / No comparable value':`100 × (${row.intelligenceIndex.toPrecision(10)} / 100)^${state.valueWeight.toFixed(1)} ÷ $${row.cost.toPrecision(10)} ≈ ${value.toPrecision(10)} 加权指数/美元（按原始值计算） / Weighted index per USD · Unrounded inputs`;
    if(value===null)valueCell.querySelector('.comparison-track').hidden=true;
    tr.append(name,html('td',row.creator?.name||'Other'),comparisonCell(format(row.intelligenceIndex,2),row.intelligenceIndex/100,color(row.creator?.color)),comparisonCell(money(row.cost),row.cost/maxCost,color(row.creator?.color)),valueCell);
    fragment.append(tr);
  }
  if(!rows.length){const td=html('td','没有匹配结果 / No matching results');td.colSpan=5;const tr=html('tr');tr.append(td);fragment.append(tr);}
  $('#tableBody').replaceChildren(fragment);
  for(const button of document.querySelectorAll('.sort-button')) {
    const selected=button.dataset.sort===state.sortKey;
    button.closest('th').setAttribute('aria-sort',selected?(state.sortDirection==='asc'?'ascending':'descending'):'none');
    button.querySelector('.sort-arrow').textContent=selected?(state.sortDirection==='asc'?'↑':'↓'):'↕';
    button.title=selected?`当前${state.sortDirection==='asc'?'升序':'降序'}，点击反向排序 / Click to reverse sort`:'点击排序 / Click to sort';
  }
}
function comparisonCell(value,ratio,displayColor) {
  const cell=html('td'),comparison=html('div',null,'comparison'),track=html('span',null,'comparison-track'),bar=html('i');
  track.setAttribute('aria-hidden','true');
  bar.style.width=Math.max(0,Math.min(100,ratio*100))+'%';bar.style.background=displayColor;
  track.append(bar);comparison.append(html('span',value,'comparison-value'),track);cell.append(comparison);
  return cell;
}
function scheduleDraw() {if(!pendingFrame)pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;draw();});}
function draw() {
  if(!state)return;
  if(state.table){updateSummary();return;}
  const rect=host.getBoundingClientRect();if(rect.width<20||rect.height<20)return;
  const width=rect.width,height=rect.height;
  frame={left:width<500?55:66,top:14,right:width-16,bottom:height-53};frame.width=frame.right-frame.left;frame.height=frame.bottom-frame.top;
  if(frame.height<10)return;
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
  state.view=clampView(state.view,state.bounds);
  const clip=svg.querySelector('#plot-clip rect');
  setAttrs(clip,{x:frame.left-5,y:frame.top-5,width:frame.width+10,height:frame.height+10});
  setAttrs(svg.querySelector('#emphasis-clip rect'),{x:frame.left-12,y:Math.max(0,frame.top-12),width:frame.width+24,height:frame.height+24});
  const medianX=median(state.rows.map(d=>d.cost)),medianY=median(state.rows.map(d=>d.intelligenceIndex));
  const qx=Math.max(frame.left,Math.min(frame.right,x(medianX))),qy=Math.max(frame.top,Math.min(frame.bottom,y(medianY)));
  setAttrs(svg.querySelector('.quadrant'),{x:frame.left,y:frame.top,width:qx-frame.left,height:qy-frame.top});
  // Keep the same full-data reference frontier when a company or search is focused.
  const frontier=paretoFrontier(state.rows);
  svg.querySelector('.pareto').setAttribute('d',frontier.map((row,i)=>`${i?'L':'M'}${x(row.cost)},${y(row.intelligenceIndex)}`).join(' '));
  for (const item of nodes) {
    const visible=inView(item.row);
    setAttrs(item.p,{cx:x(item.row.cost),cy:y(item.row.intelligenceIndex),tabindex:visible?0:-1});
    item.p.style.visibility=visible?'visible':'hidden';
  }
  drawAxes();layoutLabels();drawActive();updateSummary();
  host.dataset.chart=activeKey;host.dataset.xMin=state.view.x;host.dataset.xMax=state.view.x+state.view.width;host.dataset.yMin=state.view.y;host.dataset.yMax=state.view.y+state.view.height;
}
function setAttrs(element,attrs){for(const [key,value]of Object.entries(attrs))element.setAttribute(key,String(value));}
function drawAxes() {
  const grid=svg.querySelector('.grid'),axis=svg.querySelector('.axis');grid.replaceChildren();axis.replaceChildren();
  const v=state.view;
  for (const value of ticks(v.x,v.x+v.width,Math.max(3,Math.floor(frame.width/100)))) {
    const xx=x(value);grid.append(node('line',{x1:xx,x2:xx,y1:frame.top,y2:frame.bottom}));
    axis.append(node('text',{class:'x-tick',x:xx,y:frame.bottom+16,'text-anchor':'middle'},'$'+format(value,6)));
  }
  const yTicks=ticks(v.y,v.y+v.height,Math.max(3,Math.floor(frame.height/55)));
  const upper=v.y+v.height;
  if(v.y===state.bounds.y&&v.height===state.bounds.height&&!yTicks.includes(upper)) {
    if(yTicks.length&&(upper-yTicks.at(-1))/v.height*frame.height<18)yTicks.pop();
    yTicks.push(upper);
  }
  for (const value of yTicks) {
    const yy=y(value);grid.append(node('line',{x1:frame.left,x2:frame.right,y1:yy,y2:yy}));
    axis.append(node('text',{class:'y-tick',x:frame.left-10,y:yy+3,'text-anchor':'end'},format(value,3)));
  }
  axis.append(node('path',{class:'frame',d:`M${frame.left},${frame.top}V${frame.bottom}H${frame.right}`}));
  axis.append(node('text',{class:'axis-title x-title',x:(frame.left+frame.right)/2,y:frame.bottom+34,'text-anchor':'middle'},'每任务成本（美元 · 线性）'));
  axis.append(node('text',{class:'axis-english',x:(frame.left+frame.right)/2,y:frame.bottom+47,'text-anchor':'middle'},'Cost per task · USD · Linear scale'));
  const group=node('g',{transform:`translate(16 ${(frame.top+frame.bottom)/2}) rotate(-90)`});
  group.append(node('text',{class:'axis-title y-title','text-anchor':'middle',y:0},config[activeKey].axis),node('text',{class:'axis-english','text-anchor':'middle',y:12},config[activeKey].axisEnglish));axis.append(group);
}
function overlap(a,b){return Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));}
function layoutLabels() {
  const placed=[],visible=nodes.filter(item=>inView(item.row));
  const frontier=new Set(paretoFrontier(state.rows).map(row=>row.id));
  const radii=[2,state.labelDistance*.45,state.labelDistance*.7,state.labelDistance].filter((value,i,array)=>value>=2&&array.indexOf(value)===i);
  measure.font=`${state.labelSize}px Inter, "Segoe UI", "Microsoft YaHei", sans-serif`;
  for (const item of [...nodes].sort((a,b)=>Number(frontier.has(b.row.id))-Number(frontier.has(a.row.id))||b.row.intelligenceIndex-a.row.intelligenceIndex)) {
    item.label.setAttribute('font-size',state.labelSize);
    if(!state.labels||!inView(item.row)){item.label.style.visibility=item.line.style.visibility='hidden';continue;}
    const px=x(item.row.cost),py=y(item.row.intelligenceIndex),w=measure.measureText(item.row.shortName||item.row.name).width+1,h=state.labelSize*1.2;
    let best,bestScore=Infinity;
    for(const radius of radii)for(let i=0;i<16;i++) {
      const dx=Math.cos(i*Math.PI/8),dy=Math.sin(i*Math.PI/8);
      const candidate={x:px+(dx>.01?radius:dx<-.01?-radius-w:-w/2),y:py+(dy>.01?radius:dy<-.01?-radius-h:-h/2),w,h};
      if(candidate.x<frame.left+1||candidate.x+w>frame.right-1||candidate.y<frame.top+1||candidate.y+h>frame.bottom-1)continue;
      let score=radius*.1;
      for(const previous of placed)score+=overlap(candidate,previous)*5;
      for(const other of visible)if(other!==item)score+=overlap(candidate,{x:x(other.row.cost)-4,y:y(other.row.intelligenceIndex)-4,w:8,h:8})*2;
      if(score<bestScore){bestScore=score;best=candidate;}
    }
    if(!best){item.label.style.visibility=item.line.style.visibility='hidden';continue;}
    placed.push(best);item.label.style.visibility=item.line.style.visibility='visible';
    setAttrs(item.label,{x:best.x,y:best.y+h*.8});
    setAttrs(item.line,{x1:px,y1:py,x2:Math.max(best.x,Math.min(best.x+w,px)),y2:Math.max(best.y,Math.min(best.y+h,py))});
  }
}
function drawActive() {
  const layer=svg.querySelector('.active-layer'),companies=svg.querySelector('.company-layer'),glows=svg.querySelector('.glow-layer');if(!layer||!companies||!glows||!frame)return;layer.replaceChildren();companies.replaceChildren();glows.replaceChildren();
  for(const item of nodes) {
    const selected=item.row.id===state.selected,active=selected||item===hovered;
    const focused=!!state.company&&item.row.creator?.name===state.company&&!state.selected;
    const emphasized=active||focused;
    const muted=!active&&((state.company&&item.row.creator?.name!==state.company)||(state.selected&&!selected));
    setAttrs(item.p,{r:active?6:focused?5:4.3,opacity:emphasized ? 0 : muted ? .34 : 1,'aria-pressed':selected});
    item.p.classList.toggle('is-active',active);
    item.label.classList.toggle('is-active',active);item.line.classList.toggle('is-active',active);
    item.label.style.opacity=emphasized?'0':muted?'.6':'1';item.line.style.opacity=emphasized?'0':muted?'.2':'.6';
    if(focused&&!active&&inView(item.row))companies.append(emphasisCopy(item,5,'company'));
  }
  const selected=nodes.find(item=>item.row.id===state.selected);
  if(selected&&inView(selected.row)) {
    const xx=x(selected.row.cost),yy=y(selected.row.intelligenceIndex);
    layer.append(node('path',{class:'pin-guides',d:`M${frame.left} ${yy}H${xx}V${frame.bottom}`,stroke:selected.color,fill:'none'}),node('circle',{class:'pin-ring',cx:xx,cy:yy,r:10,stroke:selected.color,fill:'none'}),emphasisCopy(selected,6,'pinned'));
  }
  if(hovered&&hovered!==selected&&inView(hovered.row))layer.append(node('circle',{cx:x(hovered.row.cost),cy:y(hovered.row.intelligenceIndex),r:8,stroke:hovered.color,'stroke-width':1.5,fill:'none'}),emphasisCopy(hovered,6,'hovered'));
  renderPinned();
}
function glowId(display) {return 'point-glow-'+display.slice(1);}
function emphasisCopy(item,radius,kind) {
  // Paint above every ordinary label without moving the keyboard/mouse target.
  // Hide that item's original visuals so only one name and marker is visible.
  const group=node('g',{class:`emphasis-item emphasis-${kind}`,'data-id':item.row.id});
  // All halos sit below the sharp company/active layers, including neighboring labels.
  svg.querySelector('.glow-layer').append(node('circle',{class:`emphasis-glow glow-${kind}`,'data-id':item.row.id,cx:x(item.row.cost),cy:y(item.row.intelligenceIndex),r:kind==='company'?11:12,fill:`url(#${glowId(item.color)})`}));
  const hasLabel=state.labels&&item.label.style.visibility==='visible';
  if(hasLabel){const line=item.line.cloneNode(false);line.setAttribute('class','emphasis-connector');line.style.opacity='1';group.append(line);}
  group.append(node('circle',{class:'emphasis-marker',cx:x(item.row.cost),cy:y(item.row.intelligenceIndex),r:radius,fill:item.color}));
  if(hasLabel){const label=item.label.cloneNode(true);label.setAttribute('class','label emphasis-label');label.style.opacity='1';group.append(label);}
  return group;
}
function renderPinned() {
  const row=state?.rows.find(row=>row.id===state.selected),card=$('#pinnedCard');
  card.hidden=!row||state.table;
  if(!row)return;
  for(const [id,value]of [['pinnedName',row.name],['pinnedScore',format(row.intelligenceIndex,2)],['pinnedCost',money(row.cost)]])if($('#'+id).textContent!==value)$('#'+id).textContent=value;
  $('#pinnedOutside').hidden=!frame||inView(row);
  if(frame) {
    // Keep the information card on the opposite side of the selected point.
    card.style.left='auto';card.style.right='8px';card.style.top='8px';card.style.bottom='auto';card.style.width='';
    if(frame.width>=420) {
      card.style.width=Math.min(270,frame.width*.43)+'px';
      if(x(row.cost)>frame.left+frame.width/2){card.style.left=frame.left+8+'px';card.style.right='auto';}
    } else if(y(row.intelligenceIndex)<frame.top+frame.height/2) {
      card.style.top='auto';card.style.bottom=host.clientHeight-frame.bottom+8+'px';
    }
  }
}
function showHover(item,event) {
  if(!inView(item.row))return;
  hovered=item;drawActive();
  const row=item.row;tip.replaceChildren(html('strong',row.name));
  if(row.agentName)tip.append(html('small',`${row.agentName}${row.modelName?' · '+row.modelName:''}`));
  for(const [label,value]of [[`${config[activeKey].axis} / Index`,format(row.intelligenceIndex,2)],['每任务成本 / Cost per task',money(row.cost)]]) {
    const line=html('div',null,'tip-value');line.append(html('span',label),html('b',value));tip.append(line);
  }
  if(row.isRouter)tip.append(html('small','路由变体 / Router variant'));
  tip.append(html('small','单击保留数值卡，移开鼠标也可查看 / Click to keep details visible'));
  tip.hidden=state.selected===row.id;
  const box=item.p.getBoundingClientRect();positionTip(event?.clientX??box.x+box.width/2,event?.clientY??box.y);
}
function positionTip(px,py) {
  const box=tip.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(innerWidth-box.width-8,px+14))+'px';
  tip.style.top=Math.max(8,Math.min(innerHeight-box.height-8,py+14))+'px';
}
function clearHover() {
  hovered=null;
  tip.hidden=true;
  if(state)drawActive();
}
// Pick the nearest point within 12 CSS pixels; overlapping hit areas cannot mask a closer node.
function nearestItem(event) {
  if(!state||state.table||!frame||event.target.closest('.pinned-card'))return null;
  const rect=host.getBoundingClientRect(),px=event.clientX-rect.left,py=event.clientY-rect.top;
  let closest=null,best=12*12;
  for(const item of nodes) {
    if(!inView(item.row))continue;
    const distance=(x(item.row.cost)-px)**2+(y(item.row.intelligenceIndex)-py)**2;
    if(distance<best){closest=item;best=distance;}
  }
  return closest;
}
function togglePin(item) {state.selected=state.selected===item.row.id?null:item.row.id;tip.hidden=true;draw();}
function clearPin() {if(!state)return;state.selected=null;clearHover();scheduleDraw();}
$('#unpin').addEventListener('click',clearPin);
function updateSummary() {
  const rows=filteredRows(),shown=frame&&!state.table?rows.filter(inView).length:rows.length;
  const v=state.view;
  $('#viewStatus').textContent=state.table?`${rows.length} 项结果 / results`:`${shown} / ${rows.length} 项可见 · ${money(v.x)}–${money(v.x+v.width)} / visible · cost range`;
  if(state.company)$('#viewStatus').append(document.createTextNode(` · 聚焦 / Focus：${state.company}`));
  $('#viewStatus').title=$('#viewStatus').textContent;
  if(!rows.length){$('#loading').hidden=state.table;$('#loading').replaceChildren(document.createTextNode('没有匹配结果'),html('small','No matching results · Clear filters to restore'));}
  else $('#loading').hidden=true;
  const selected=state.rows.find(row=>row.id===state.selected);
  $('#selection').textContent=selected?`已选 / Pinned：${selected.name}`:'';
}
function changeView(view) {if(!state)return;clearHover();state.view=clampView(view,state.bounds);scheduleDraw();}
function zoom(axis,factor) {if(!state)return;const v={...state.view};if(axis==='x')v.width*=factor;else v.height*=factor;changeView(v);}
$('#reset').addEventListener('click',()=>{if(state)changeView({...state.defaultView});});
$('#fit').addEventListener('click',()=>{if(state)changeView({...state.bounds});});
for(const [id,axis,factor]of [['xminus','x',1.18],['xplus','x',1/1.18],['yminus','y',1.18],['yplus','y',1/1.18]])$('#'+id).addEventListener('click',()=>zoom(axis,factor));
$('#search').addEventListener('input',()=>{if(!state)return;state.search=$('#search').value;state.selected=null;syncControls();buildPlot();});
$('#frontier').addEventListener('click',()=>{if(!state)return;state.frontierOnly=!state.frontierOnly;state.selected=null;syncControls();buildPlot();});
$('#clearFilters').addEventListener('click',()=>{if(!state)return;state.company=null;state.search='';state.frontierOnly=false;state.selected=null;syncControls();renderLegend();buildPlot();});
$('#options').addEventListener('click',()=>{if(!state)return;state.options=!state.options;syncControls();scheduleDraw();});
$('#labels').addEventListener('click',()=>{if(!state)return;state.labels=!state.labels;syncControls();scheduleDraw();});
for(const [id,key]of [['labelSize','labelSize'],['labelDistance','labelDistance']])$('#'+id).addEventListener('input',()=>{if(!state)return;state[key]=+$('#'+id).value;$('#'+id+'Value').value=state[key];syncSettingsReset();clearHover();scheduleDraw();});
$('#resetSettings').addEventListener('click',()=>{if(!state)return;Object.assign(state,DEFAULT_SETTINGS[activeKey]);clearHover();syncControls();scheduleDraw();});
function showTable(show) {if(!state)return;clearHover();state.table=show;if(show)state.options=false;syncControls();if(show)renderTable();scheduleDraw();}
$('#tableToggle').addEventListener('click',()=>showTable(!state?.table));
$('#backToChart').addEventListener('click',()=>{showTable(false);$('#tableToggle').focus({preventScroll:true});});
let pendingValueFrame=0;
function setValueWeight(value) {
  if(!state||!Number.isFinite(value)||value<VALUE_WEIGHT.min||value>VALUE_WEIGHT.max)return;
  state.valueWeight=Math.round(value*10)/10;syncValueControls();
  // Rebuild only the visible table once per animation frame while dragging.
  if(!pendingValueFrame)pendingValueFrame=requestAnimationFrame(()=>{pendingValueFrame=0;if(state?.table)renderTable();});
}
$('#valueWeight').addEventListener('input',()=>setValueWeight(Number($('#valueWeight').value)));
$('#linearValue').addEventListener('click',()=>setValueWeight(1));
$('#resetValueWeight').addEventListener('click',()=>setValueWeight(VALUE_WEIGHT.default));
for(const button of document.querySelectorAll('.sort-button'))button.addEventListener('click',()=>{
  if(!state)return;
  const key=button.dataset.sort;
  state.sortDirection=state.sortKey===key?(state.sortDirection==='asc'?'desc':'asc'):(['intelligenceIndex','valuePerDollar'].includes(key)?'desc':'asc');
  state.sortKey=key;renderTable();$('.table-scroll').scrollTop=0;
});
host.addEventListener('wheel',event=>{if(!state||!frame)return;event.preventDefault();zoom(event.shiftKey?'y':'x',Math.exp(Math.max(-240,Math.min(240,event.deltaY))*.0015));},{passive:false});
host.addEventListener('dblclick',event=>{if(state&&!event.target.closest('.pinned-card')&&!nearestItem(event))changeView({...state.defaultView});});
host.addEventListener('click',event=>{if(suppressClick){suppressClick=false;return;}if(!state||event.target.closest('.pinned-card'))return;const item=nearestItem(event);if(item){host.focus({preventScroll:true});togglePin(item);}});
host.addEventListener('pointerdown',event=>{
  if(!state||!frame||event.isPrimary===false||event.button!==0)return;
  suppressClick=false;
  if(event.target.closest('.pinned-card')||event.target.closest('.axis'))return;
  clearHover();host.focus({preventScroll:true});
  host.classList.remove('over-point');
  drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,view:{...state.view},moved:false};
  host.setPointerCapture(event.pointerId);host.classList.add('dragging');
});
host.addEventListener('pointermove',event=>{
  if(!drag){const item=nearestItem(event);host.classList.toggle('over-point',!!item);if(item!==hovered){if(item)showHover(item,event);else clearHover();}else if(item&&!tip.hidden)positionTip(event.clientX,event.clientY);return;}
  if(drag.id!==event.pointerId)return;
  const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;drag.moved ||= Math.abs(dx)+Math.abs(dy)>3;
  if(!drag.moved)return;
  changeView({...drag.view,x:drag.view.x-dx/frame.width*drag.view.width,y:drag.view.y+dy/frame.height*drag.view.height});
});
function endDrag() {if(drag?.moved)suppressClick=true;if(drag&&host.hasPointerCapture(drag.id))host.releasePointerCapture(drag.id);drag=null;host.classList.remove('dragging');}
for(const event of ['pointerup','pointercancel','lostpointercapture'])host.addEventListener(event,endDrag);
host.addEventListener('pointerleave',()=>{host.classList.remove('over-point');if(!drag)clearHover();});
host.addEventListener('keydown',event=>{
  if(!state||event.target!==host)return;
  const v={...state.view},delta=.08;
  if(event.key==='ArrowLeft')v.x-=v.width*delta;else if(event.key==='ArrowRight')v.x+=v.width*delta;
  else if(event.key==='ArrowUp')v.y+=v.height*delta;else if(event.key==='ArrowDown')v.y-=v.height*delta;
  else if(event.key==='+'||event.key==='='){event.preventDefault();zoom(event.shiftKey?'y':'x',1/1.18);return;}
  else if(event.key==='-'){event.preventDefault();zoom(event.shiftKey?'y':'x',1.18);return;}
  else if(event.key==='Home'){event.preventDefault();changeView({...state.defaultView});return;}
  else if(event.key==='Escape'){clearPin();return;}else return;
  event.preventDefault();changeView(v);
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state?.selected)clearPin();});
addEventListener('blur',()=>{endDrag();clearHover();});
new ResizeObserver(()=>{clearHover();scheduleDraw();}).observe(host);
function showLoadError(error) {
  host.hidden=false;$('#dataTable').hidden=true;
  $('#tableToggle').setAttribute('aria-expanded','false');
  $('#tableToggle').setAttribute('aria-pressed','false');bilingual($('#tableToggle'),'图形数据表','Visual table');
  $('#options').disabled=false;
  $('#pinnedCard').hidden=true;
  document.querySelector('.view-controls').hidden=false;
  $('#legend').replaceChildren();$('#count').replaceChildren();$('#viewStatus').textContent='';$('#selection').textContent='';
  host.setAttribute('aria-busy','false');$('#loading').hidden=false;
  const button=html('button','重新加载 / Retry');button.type='button';button.addEventListener('click',loadData);
  $('#loading').replaceChildren(document.createTextNode('数据暂时无法加载'),html('small','Unable to load benchmark data'),button);
  $('#status').textContent=error.message;
}
async function loadData() {
  loadController?.abort();loadController=new AbortController();const generation=++loadGeneration;
  const timeout=setTimeout(()=>loadController.abort(),20000);
  host.setAttribute('aria-busy','true');
  try {
    const response=await fetch('data/current.json',{cache:'no-cache',signal:loadController.signal});
    if(!response.ok)throw new Error(`数据请求失败 / Request failed (${response.status})`);
    const next=await response.json();
    if(generation!==loadGeneration)return;
    snapshot=next;states.clear();chooseChart(activeKey,{changeHash:false});
  }catch(error){if(generation===loadGeneration)showLoadError(error.name==='AbortError'?new Error('请求超时 / Request timed out'):error);}
  finally{clearTimeout(timeout);}
}
chooseChart(activeKey,{changeHash:false});loadData();

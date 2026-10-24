'use strict';
const KEY='my-personal-ledger-v1', GOAL_KEY='my-savings-goal-v1', BUDGET_KEY='my-category-budgets-v1';
const $=id=>document.getElementById(id);
const money=n=>'NT$ '+Number(n).toLocaleString('zh-TW',{minimumFractionDigits:0,maximumFractionDigits:2});
const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const categories={income:['薪資','獎金','利息','退款','其他收入'],saving:['額外存款','現金存入','其他存款']};
const starterBudgets={'食':0,'衣':0,'住':0,'行':0,'育':0,'樂':0,'醫療':0,'其他':0};
let budgetState={defaults:{...starterBudgets},months:{}};
let entries=[],settings={goal:100000,opening:0},editId=null;
try{let stored=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(stored))throw Error('紀錄格式錯誤');entries=stored;const custom=JSON.parse(localStorage.getItem(GOAL_KEY)||'null');if(custom&&typeof custom==='object'&&Number.isFinite(custom.goal)&&custom.goal>0&&Number.isFinite(custom.opening)&&custom.opening>=0)settings=custom;const savedBudgets=JSON.parse(localStorage.getItem(BUDGET_KEY)||'null');if(savedBudgets){if(!savedBudgets.defaults||typeof savedBudgets.defaults!=='object'||!savedBudgets.months||typeof savedBudgets.months!=='object')throw Error('預算資料格式錯誤');budgetState=savedBudgets;}}catch(err){alert('讀取資料失敗，為避免資料遺失，請勿繼續操作：'+err.message);throw err}
const sum=(arr,kind)=>arr.filter(e=>e.kind===kind).reduce((n,e)=>n+Number(e.amount),0);
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
// Each calendar month's spending allowance is independent. Budget spending does not
// reduce goal savings until that month's actual expenses exceed its allowance.
function monthlyBalances(){
 const months=new Map();
 for(const e of entries){
   const m=e.date.slice(0,7);
   const item=months.get(m)||{income:0,expenses:0,saved:0,budget:0};
   const amt=Number(e.amount)||0;
   if(e.kind==='income'){
     const saved=Number.isFinite(e.savedPart)?Math.max(0,Math.min(amt,e.savedPart)):amt;
     item.income+=amt;item.saved+=saved;item.budget+=amt-saved;
   }else if(e.kind==='saving'){item.saved+=amt;}else item.expenses+=amt;
   months.set(m,item);
 }
 for(const v of months.values()){
   v.overrun=round(Math.max(0,v.expenses-v.budget));
   v.available=round(Math.max(0,v.budget-v.expenses));
 }
 return months;
}

function persist(){try{localStorage.setItem(KEY,JSON.stringify(entries));localStorage.setItem(GOAL_KEY,JSON.stringify(settings));localStorage.setItem(BUDGET_KEY,JSON.stringify(budgetState));return true}catch(e){alert('儲存失敗，請確認手機可用空間。');return false}}
function kind(){return document.querySelector('input[name="kind"]:checked').value}
function expenseCategories(){return [...new Set([...Object.keys(budgetState.defaults),...entries.filter(e=>e.kind==='expense').map(e=>e.category)])]}
function effectiveBudgets(month){return {...budgetState.defaults,...(budgetState.months[month]||{})}}
function renderCategories(preferred){const arr=kind()==='expense'?expenseCategories():categories[kind()];$('category').replaceChildren(...arr.map(s=>{const opt=document.createElement('option');opt.value=s;opt.textContent=s;return opt}));if(arr.includes(preferred))$('category').value=preferred;$('allocation').hidden=kind()!=='income';$('saving-tip').hidden=kind()!=='saving';preview()}
function preview(){const a=Number($('amount').value)||0;const saved=Number($('saved-part').value)||0;$('spending-part').textContent=money(Math.max(0,round(a-saved)));$('saved-part').max=Math.max(0,a)}
function resetForm(){$('entry-form').reset();editId=null;$('form-title').textContent='記一筆收入、支出或存款';$('submit').textContent='儲存紀錄';$('cancel').hidden=true;$('date').value=today();$('saved-part').value='0';renderCategories()}
function node(parent,tag,text,cls){let el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.append(el);return el}
function render(){renderBudgets();const inc=sum(entries,'income'),exp=sum(entries,'expense');const balances=monthlyBalances();const totalSaved=round([...balances.values()].reduce((n,v)=>n+v.saved,0));const overrun=round([...balances.values()].reduce((n,v)=>n+v.overrun,0));const current=round(settings.opening+totalSaved-overrun);const raw=current/settings.goal*100;const percent=Math.max(0,Math.min(100,raw));$('current').textContent=money(current);$('goal-label').textContent=money(settings.goal);$('percent').textContent=`${percent.toFixed(1)}%`;$('bar').style.width=percent+'%';$('remaining').textContent=current>=settings.goal?'已達成存款目標！':`還差 ${money(round(settings.goal-current))}`;$('goal-status').textContent=current>=settings.goal?'🎉 目標達成':current<0?'目前為負結餘': '一步一步接近夢想';$('total-income').textContent=money(inc);$('total-expense').textContent=money(overrun);
const month=$('month').value;const items=entries.filter(e=>e.date.startsWith(month)).sort((a,b)=>b.date.localeCompare(a.date)||(b.created||0)-(a.created||0));const mi=sum(items,'income'),me=sum(items,'expense');const b=balances.get(month)||{budget:0,available:0,saved:0,overrun:0};$('month-budget').textContent=money(round(b.budget));$('month-available').textContent=money(b.available);$('month-saved').textContent=money(round(b.saved));$('month-overrun').textContent=money(b.overrun);$('month-income').textContent=money(mi);$('month-expense').textContent=money(me);$('month-net').textContent=money(round(mi-me));$('count').textContent=`${items.length} 筆`;$('records').replaceChildren();if(!items.length){node($('records'),'div','這個月沒有紀錄，新增第一筆吧 🌱','empty');return}
items.forEach(e=>{const r=node($('records'),'div','','record');node(r,'div',e.kind==='income'?'💰':e.kind==='saving'?'🐷':'🧾','symbol');const d=node(r,'div','','detail');node(d,'strong',e.category);const allocation=e.kind==='income'&&typeof e.savedPart==='number'?` · 預計存 ${money(e.savedPart)}`:'';node(d,'small',`${e.date}${e.note?' · '+e.note:''}${allocation}`);node(r,'div',(e.kind==='expense'?'− ':'+ ')+money(e.amount),'amount '+e.kind);const actions=node(r,'div','','actions');const edit=node(actions,'button','編輯');edit.onclick=()=>{editId=e.id;document.querySelector(`input[name="kind"][value="${e.kind}"]`).checked=true;renderCategories(e.category);if(!categories[e.kind].includes(e.category)){const opt=document.createElement('option');opt.value=e.category;opt.textContent=e.category;$('category').append(opt);$('category').value=e.category}$('date').value=e.date;$('amount').value=e.amount;$('saved-part').value=e.savedPart??0;$('note').value=e.note||'';$('form-title').textContent='編輯這筆紀錄';$('submit').textContent='更新紀錄';$('cancel').hidden=false;preview();$('entry-form').scrollIntoView({behavior:'smooth',block:'center'})};const del=node(actions,'button','刪除');del.onclick=()=>{if(!confirm(`刪除 ${e.date} 的 ${money(e.amount)}？`))return;const before=entries;entries=entries.filter(x=>x.id!==e.id);if(persist()){if(editId===e.id)resetForm();render()}else entries=before}})}
$('entry-form').onsubmit=ev=>{ev.preventDefault();const amount=round(Number($('amount').value)),saved=round(Number($('saved-part').value||0));if(!Number.isFinite(amount)||amount<=0||amount>1e12)return alert('請填寫有效金額');if(kind()==='income'&&(!Number.isFinite(saved)||saved<0||saved>amount))return alert('預計存款不能小於 0 或大於收入金額');const date=$('date').value;if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))return alert('請輸入有效日期');const old=entries.find(e=>e.id===editId);const item={id:editId||`id-${Date.now()}-${Math.random().toString(36).slice(2)}`,kind:kind(),date,category:$('category').value,amount,note:$('note').value.trim(),savedPart:kind()==='income'?saved:0,created:old?.created||Date.now()};const before=entries;entries=editId?entries.map(e=>e.id===editId?item:e):[...entries,item];if(persist()){$('month').value=date.slice(0,7);resetForm();render()}else entries=before};
$('amount').oninput=preview;$('saved-part').oninput=preview;document.querySelectorAll('input[name="kind"]').forEach(x=>x.onchange=()=>renderCategories());$('cancel').onclick=resetForm;$('month').onchange=render;
$('settings-button').onclick=()=>{$('settings').hidden=false;$('goal-input').value=settings.goal;$('opening-input').value=settings.opening;$('settings').scrollIntoView({behavior:'smooth'})};$('settings-cancel').onclick=()=>{$('settings').hidden=true};$('settings-form').onsubmit=ev=>{ev.preventDefault();const goal=round(Number($('goal-input').value)),opening=round(Number($('opening-input').value));if(!Number.isFinite(goal)||goal<=0||goal>1e12||!Number.isFinite(opening)||opening<0||opening>1e12)return alert('請輸入正確金額');const before=settings;settings={goal,opening};if(persist()){$('settings').hidden=true;render()}else settings=before};
function download(name,data,mime){const url=URL.createObjectURL(new Blob([data],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000)}
$('export-json').onclick=()=>download(`存款目標備份-${today()}.json`,JSON.stringify({app:'我的小帳本',version:5,settings,entries,budgetState,exported:new Date().toISOString()},null,2),'application/json');
$('export-csv').onclick=()=>{const rows=[['日期','類型','分類','金額','分配存款','當月預留生活費','備註'],...entries.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(e=>[e.date,e.kind==='income'?'收入':e.kind==='saving'?'增加存款':'支出',e.category,e.amount,e.kind==='income'?(e.savedPart??''):'',e.kind==='income'&&typeof e.savedPart==='number'?round(e.amount-e.savedPart):'',e.note||''])];const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')).join('\r\n');download(`存款目標明細-${today()}.csv`,csv,'text/csv;charset=utf-8')};
$('import-json').onchange=async ev=>{const file=ev.target.files[0];if(!file)return;try{if(file.size>10*1024*1024)throw Error('檔案太大');const p=JSON.parse(await file.text());if(p.app!=='我的小帳本'||![1,2,3,4,5].includes(p.version)||!Array.isArray(p.entries))throw Error('不支援的備份格式');if(!p.entries.every(e=>e&&typeof e.id==='string'&&['income','expense','saving'].includes(e.kind)&&/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&typeof e.category==='string'&&Number.isFinite(e.amount)&&e.amount>0&&e.amount<=1e12&&(!e.note||typeof e.note==='string')&&(e.savedPart===undefined||(Number.isFinite(e.savedPart)&&e.savedPart>=0&&e.savedPart<=e.amount))))throw Error('紀錄格式不正確');const nextSettings=p.version>=2?p.settings:settings;if(!nextSettings||!Number.isFinite(nextSettings.goal)||nextSettings.goal<=0||!Number.isFinite(nextSettings.opening)||nextSettings.opening<0)throw Error('存款目標資料有誤');if(!confirm(`還原 ${p.entries.length} 筆紀錄並取代目前 ${entries.length} 筆紀錄？建議先備份現有資料。`))return;const nextBudget=p.version>=5?p.budgetState:{defaults:{...starterBudgets},months:{}};if(!nextBudget||!validBudgets(nextBudget))throw Error('預算資料有誤');const beforeEntries=entries,beforeSettings=settings,beforeBudget=budgetState;entries=p.entries;settings=nextSettings;budgetState=nextBudget;if(persist()){resetForm();render();alert('還原成功')}else{entries=beforeEntries;settings=beforeSettings;budgetState=beforeBudget}}catch(err){alert('還原失敗：'+err.message)}finally{ev.target.value=''}};

function validBudgets(v){
 if(!v||typeof v!=='object'||!v.defaults||!v.months||typeof v.defaults!=='object'||typeof v.months!=='object'||Array.isArray(v.defaults)||Array.isArray(v.months))return false;
 const check=o=>Object.entries(o).every(([k,n])=>k.length>0&&k.length<=20&&typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e12);
 return check(v.defaults)&&Object.entries(v.months).every(([m,o])=>/^\d{4}-\d{2}$/.test(m)&&o&&typeof o==='object'&&!Array.isArray(o)&&check(o));
}
function renderBudgets(){
 const month=$('month').value, budgets=effectiveBudgets(month), host=$('category-budgets');host.replaceChildren();
 const spent={};entries.filter(e=>e.kind==='expense'&&e.date.startsWith(month)).forEach(e=>spent[e.category]=round((spent[e.category]||0)+Number(e.amount)));
 const names=[...new Set([...Object.keys(budgets),...Object.keys(spent)])];
 $('category-month-label').textContent=`目前查看 ${month}，分類預算總計 ${money(round(Object.values(budgets).reduce((a,b)=>a+b,0)))}；本月實際支出 ${money(round(Object.values(spent).reduce((a,b)=>a+b,0)))}。`;
 for(const name of names){
  const amount=budgets[name]??0, used=spent[name]??0, remaining=round(amount-used);
  const row=node(host,'div','','budget-row');
  const left=node(row,'div','','budget-name');node(left,'strong',name);node(left,'small',`已用 ${money(used)}`);
  const control=node(row,'label','','budget-input');node(control,'span','預算 NT$');const inp=document.createElement('input');inp.type='number';inp.min='0';inp.max='1000000000000';inp.step='0.01';inp.inputMode='decimal';inp.value=String(amount);inp.setAttribute('aria-label',`${name} ${month} 的預算`);control.append(inp);
  const balance=node(row,'div',(remaining<0?'- ':'')+money(Math.abs(remaining)),remaining<0?'budget-left negative':'budget-left');
  if(remaining<0)balance.title='已超支';else balance.title='剩餘預算';
  inp.onchange=()=>{const value=round(Number(inp.value));if(inp.value.trim()===''||!Number.isFinite(value)||value<0||value>1e12){alert('請輸入有效的非負預算');renderBudgets();return}const prior=JSON.stringify(budgetState);if(!budgetState.months[month])budgetState.months[month]={};budgetState.months[month][name]=value;if(!persist()){budgetState=JSON.parse(prior)}renderBudgets()};
  if(Object.hasOwn(budgetState.defaults,name)){const del=node(row,'button','刪除分類','tiny-delete');del.type='button';del.title=`刪除 ${name} 分類`;del.onclick=()=>{if(!confirm(`確定刪除「${name}」作為未來記帳分類？既有支出紀錄會保留。`))return;const prev=JSON.stringify(budgetState);delete budgetState.defaults[name];for(const m of Object.keys(budgetState.months))delete budgetState.months[m][name];if(!persist())budgetState=JSON.parse(prev);renderCategories();render()}}
 }
}
$('add-category-form').onsubmit=ev=>{ev.preventDefault();const name=$('new-category').value.trim();const value=round(Number($('new-budget').value));if(!name||name.length>20||name==='__proto__'||name==='constructor'||name==='prototype')return alert('請輸入有效分類名稱');if(!Number.isFinite(value)||value<0||value>1e12)return alert('請輸入有效預算');if(expenseCategories().includes(name))return alert('此分類已存在');const prev=JSON.stringify(budgetState);budgetState.defaults[name]=value;if(!persist()){budgetState=JSON.parse(prev);return}$('add-category-form').reset();$('new-budget').value='0';renderCategories();render()};
$('copy-budget').onclick=()=>{const month=$('month').value;if(!confirm(`把 ${month} 的各分類預算設成往後每月的預設值？已個別修改的月份不會被覆蓋。`))return;const prior=JSON.stringify(budgetState);budgetState.defaults=effectiveBudgets(month);if(!persist())budgetState=JSON.parse(prior);render()};

$('month').value=today().slice(0,7);resetForm();render();if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(console.warn);

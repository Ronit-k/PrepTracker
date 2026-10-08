// Shared floating controls keep editing attached to the text it changes.
import {iconMarkup} from '../static/js/site-icons.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const chevron = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true"><path d="m2 3.5 3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
export function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url : null; }
  catch { return null; }
}

// Browsers wrap typed/pasted lines in divs even in plaintext-only fields.
// Read those line boundaries without innerText's extra blank lines under pre-wrap.
export function editableText(element) {
  if (element.childNodes.length === 1 && element.firstChild.nodeName === 'BR') return '';
  const lines = [];
  let inline = '', hasInline = false;
  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) { inline += node.textContent; hasInline = true; }
    else if (['DIV', 'P'].includes(node.nodeName)) {
      if (hasInline) { lines.push(inline); inline = ''; hasInline = false; }
      lines.push(editableText(node));
    } else { inline += node.nodeName === 'BR' ? '\n' : editableText(node); hasInline = true; }
  }
  if (hasInline) lines.push(inline);
  return lines.join('\n');
}

function floatingControl(parent, trigger, panel) {
  const root = parent.closest('.question-detail');
  panel.dataset.detailPopup = '';
  const close = () => { panel.hidden = true; parent.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); };
  const open = () => {
    root.dispatchEvent(new CustomEvent('close-detail-selects'));
    root.append(panel); panel.hidden = false;
    parent.classList.add('open'); trigger.setAttribute('aria-expanded','true');
    const anchor = trigger.getBoundingClientRect(), card = root.getBoundingClientRect();
    const width = panel.offsetWidth, height = panel.offsetHeight;
    let left = anchor.left - card.left;
    left = Math.max(12, Math.min(left, card.width - width - 12));
    let top = anchor.bottom - card.top + 8;
    if (top + height > card.height - 12) top = Math.max(12, anchor.top - card.top - height - 8);
    panel.style.left = `${left}px`; panel.style.top = `${top}px`;
  };
  const setEnabled = enabled => {
    trigger.disabled = !enabled;
    trigger.setAttribute('aria-expanded','false');
    if (!enabled) close();
  };
  panel.addEventListener('keydown',e=>{
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); trigger.focus(); }
  });
  return {close,open,setEnabled,destroy:()=>panel.remove(),isOpen:()=>!panel.hidden};
}

export function mountSelect(parent, {label,value,options,searchable=false,onChange}) {
  parent.classList.add('detail-select');
  parent.innerHTML = `<button type="button" class="detail-select-trigger" aria-label="${label}" aria-haspopup="listbox" aria-expanded="false"><span></span>${chevron}</button>
    <div class="detail-select-panel" hidden>${searchable ? '<input type="search" aria-label="Search topics" placeholder="Find a topic…" autocomplete="off">' : ''}<div class="detail-select-options" role="listbox" aria-label="${label}"></div></div>`;
  const trigger=parent.querySelector('button'), panel=parent.querySelector('.detail-select-panel');
  const list=panel.querySelector('[role=listbox]'), search=panel.querySelector('input');
  const control=floatingControl(parent,trigger,panel);
  let selected=value;
  function draw() {
    const current=options.find(o=>o.key===selected) || {label:selected};
    trigger.querySelector('span').innerHTML=`${current.color && label==='Status' ? `<i style="background:${current.color}"></i>` : ''}${escape(current.label)}`;
    if (label==='Difficulty') {trigger.style.color=current.color || '';trigger.style.background=current.bg || '';}
    list.innerHTML=options.filter(o=>o.label.toLowerCase().includes(search?.value.toLowerCase() || '')).map(o=>`<button type="button" role="option" aria-selected="${o.key===selected}" data-key="${escape(o.key)}">${o.color ? `<i style="background:${o.color}"></i>`:''}<span>${escape(o.label)}</span><b aria-hidden="true">${o.key===selected?'✓':''}</b></button>`).join('') || '<p class="detail-muted">No matching topics</p>';
  }
  function open() {if(search) search.value='';draw();control.open(); (search || list.querySelector('[aria-selected=true]') || list.querySelector('button'))?.focus();}
  trigger.onclick=()=>control.isOpen()?control.close():open();
  trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open();}};
  list.onclick=e=>{const option=e.target.closest('[data-key]');if(!option)return;selected=option.dataset.key;onChange(selected);draw();control.close();trigger.focus();};
  panel.addEventListener('keydown',e=>{
    if(['ArrowDown','ArrowUp'].includes(e.key)) {
      e.preventDefault(); const buttons=[...list.querySelectorAll('button')], index=buttons.indexOf(document.activeElement);
      buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
    }
  });
  if(search) search.oninput=draw;
  draw();control.setEnabled(false);return control;
}

const formatDate = date => new Date(date+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function mountDatePicker(parent,{value,onChange}) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const part=type=>parts.find(p=>p.type===type).value;
  const today=`${part('year')}-${part('month')}-${part('day')}`;
  let selected=value || '', view=new Date((selected || today)+'T12:00:00');
  parent.classList.add('detail-date-picker','date-picker');
  parent.innerHTML=`<button type="button" class="detail-date-trigger" aria-label="Date solved" aria-haspopup="dialog" aria-expanded="false"><span></span>${chevron}</button>
    <div class="dp-dropdown detail-calendar" role="dialog" aria-label="Choose solved date" hidden>
      <div class="dp-nav"><button type="button" class="dp-nav-btn" aria-label="Previous month">‹</button><span class="dp-month-label" aria-live="polite"></span><button type="button" class="dp-nav-btn" aria-label="Next month">›</button></div>
      <div class="dp-weekdays">${['S','M','T','W','T','F','S'].map(d=>`<span>${d}</span>`).join('')}</div><div class="dp-grid"></div>
      <div class="detail-calendar-footer"><span>India Standard Time</span><button type="button" class="detail-calendar-today">Today</button></div>
    </div>`;
  const trigger=parent.querySelector('.detail-date-trigger'),panel=parent.querySelector('.dp-dropdown'),grid=panel.querySelector('.dp-grid');
  const control=floatingControl(parent,trigger,panel);
  const label=()=>trigger.querySelector('span').textContent=selected?formatDate(selected):'Select date';
  function render() {
    const year=view.getFullYear(),month=view.getMonth();
    panel.querySelector('.dp-month-label').textContent=view.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    const start=new Date(year,month,1,12); start.setDate(1-start.getDay());
    // Six consistent week rows prevent the picker jumping between months.
    grid.innerHTML=Array.from({length:42},(_,i)=>{
      const date=new Date(start);date.setDate(start.getDate()+i); const key=dateKey(date);
      return `<button type="button" class="dp-day${date.getMonth()!==month?' other-month':''}${key===selected?' selected':''}${key===today?' today':''}" data-date="${key}" aria-label="${formatDate(key)}" aria-pressed="${key===selected}"${key===today?' aria-current="date"':''}>${date.getDate()}</button>`;
    }).join('');
  }
  function choose(key) {selected=key;onChange(key);label();control.close();trigger.focus();}
  trigger.onclick=()=>{if(control.isOpen()){control.close();return;}view=new Date((selected||today)+'T12:00:00');render();control.open();grid.querySelector('.selected, .today')?.focus();};
  panel.querySelector('[aria-label="Previous month"]').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()-1,1,12);render();};
  panel.querySelector('[aria-label="Next month"]').onclick=()=>{view=new Date(view.getFullYear(),view.getMonth()+1,1,12);render();};
  grid.onclick=e=>{const button=e.target.closest('[data-date]');if(button)choose(button.dataset.date);};
  grid.onkeydown=e=>{
    const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];
    const key=e.target.dataset.date;if(delta===undefined || !key)return;
    e.preventDefault();const date=new Date(key+'T12:00:00');date.setDate(date.getDate()+delta);
    if(date.getMonth()!==view.getMonth() || date.getFullYear()!==view.getFullYear()){view=date;render();}
    grid.querySelector(`[data-date="${dateKey(date)}"]`)?.focus();
  };
  panel.querySelector('.detail-calendar-today').onclick=()=>choose(today);
  label();control.setEnabled(false);return control;
}

export function mountResource(parent,{label,value,onChange}) {
  let current=value || '', enabled=false;
  parent.classList.add('detail-resource-control');
  parent.innerHTML=`<a class="detail-resource" target="_blank" rel="noopener noreferrer"></a><div class="detail-link-panel" hidden><label>${label==='Problem'?'Problem link':'Reference material'}<input type="url" aria-label="${label==='Problem'?'Problem link':'Reference material'}" placeholder="https://…"></label><span class="detail-muted">Changes are saved with the question.</span></div>`;
  const trigger=parent.querySelector('a'),panel=parent.querySelector('.detail-link-panel'),input=panel.querySelector('input');
  const control=floatingControl(parent,trigger,panel);
  function draw() {
    const url=safeUrl(current);
    trigger.innerHTML=`${iconMarkup(current)}${label}<span class="detail-resource-edit-hint" aria-hidden="true">↗</span>`;
    trigger.href=url?.href || '#'; trigger.setAttribute('aria-label',enabled?`Edit ${label.toLowerCase()} link`:`Open ${label.toLowerCase()} link`);
    trigger.title=url?.hostname || `No ${label.toLowerCase()} link added`;
    trigger.classList.toggle('detail-resource-missing',!url);
  }
  trigger.onclick=e=>{
    if(!enabled){if(!safeUrl(current))e.preventDefault();return;}
    e.preventDefault();if(control.isOpen()){control.close();return;}control.open();input.focus();
  };
  input.value=current;
  input.oninput=()=>{current=input.value;onChange(current);draw();};
  input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();control.close();trigger.focus();}};
  draw();return {...control,setEnabled:active=>{enabled=active;if(!active)control.close();trigger.setAttribute('aria-haspopup',active?'dialog':'false');draw();}};
}

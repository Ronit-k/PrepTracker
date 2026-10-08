import {createCodeEditor} from './code-editor.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
  pencil: '<path d="m12 3 3 3-8.5 8.5H3v-3.5Z"/><path d="m10 5 3 3"/>',
  close: '<path d="m5 5 8 8M13 5l-8 8"/>',
  copy: '<rect x="6" y="6" width="9" height="9" rx="2"/><path d="M11 6V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h2"/>',
  chevron: '<path d="m5 7 4 4 4-4"/>',
  link: '<path d="m7 11 4-4M6 6l2-2a3 3 0 0 1 4 4l-2 2M12 12l-2 2a3 3 0 0 1-4-4l2-2"/>',
  previous: '<path d="m11 4-5 5 5 5"/>',
  next: '<path d="m7 4 5 5-5 5"/>',
};
const icon = name => `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const statusOptions = [
  {key:'solved',label:'Solved',color:'#30d158'},
  {key:'revisit',label:'Revisit',color:'#ff9f0a'},
  {key:'todo',label:'To do',color:'#8e8e93'},
];
function safeUrl(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url : null; }
  catch { return null; }
}
function linkMarkup(value, label) {
  const url = safeUrl(value);
  if (!url) return '';
  return `<a class="detail-resource" href="${escape(url.href)}" target="_blank" rel="noopener noreferrer" title="${escape(url.hostname)}">
    <img src="https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=32" width="18" height="18" alt="">${escape(label)}${icon('link')}</a>`;
}

function mountSelect(parent, {label, value, options, searchable = false, onChange}) {
  parent.innerHTML = `<span class="detail-field-label">${label}</span><div class="detail-select">
    <button type="button" class="detail-select-trigger" aria-label="${label}" aria-haspopup="listbox" aria-expanded="false"><span></span>${icon('chevron')}</button>
    <div class="detail-select-panel" hidden>${searchable ? '<input type="search" aria-label="Search topics" placeholder="Find a topic…" autocomplete="off">' : ''}
      <div class="detail-select-options" role="listbox" aria-label="${label}"></div></div></div>`;
  const trigger = parent.querySelector('button');
  const panel = parent.querySelector('.detail-select-panel');
  const list = parent.querySelector('[role=listbox]');
  const search = parent.querySelector('input');
  let selected = value;
  const draw = () => {
    const current = options.find(o => o.key === selected) || {label:selected};
    trigger.querySelector('span').innerHTML = `${current.color ? `<i style="background:${current.color}"></i>` : ''}${escape(current.label)}`;
    const matches = options.filter(o => o.label.toLowerCase().includes(search?.value.toLowerCase() || ''));
    list.innerHTML = matches.map(o => `<button type="button" role="option" aria-selected="${o.key === selected}" data-key="${escape(o.key)}">${o.color ? `<i style="background:${o.color}"></i>` : ''}<span>${escape(o.label)}</span><b aria-hidden="true">${o.key === selected ? '✓' : ''}</b></button>`).join('') || '<p class="detail-muted">No matching topics</p>';
  };
  const close = () => { panel.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  trigger.onclick = () => {
    const opening = panel.hidden;
    parent.closest('.question-detail').dispatchEvent(new CustomEvent('close-detail-selects'));
    if (opening) { panel.hidden = false; trigger.setAttribute('aria-expanded', 'true'); if (search) { search.value=''; draw(); search.focus(); } }
  };
  list.onclick = e => {
    const option = e.target.closest('[data-key]');
    if (!option) return;
    selected = option.dataset.key;
    onChange(selected); draw(); close(); trigger.focus();
  };
  if (search) search.oninput = draw;
  parent.onkeydown = e => {
    if (e.key === 'Escape' && !panel.hidden) { e.preventDefault(); e.stopPropagation(); close(); trigger.focus(); }
    if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      panel.hidden = false; trigger.setAttribute('aria-expanded', 'true');
      const buttons = [...list.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement);
      buttons[(index + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }
  };
  draw();
  return {close};
}

export function openQuestionDetail({question, questions = [question], topics, difficulties, onSave, onClosed}) {
  const backdrop = document.querySelector('#notesPopover');
  const root = document.querySelector('#notesPopoverContent');
  const opener = document.activeElement;
  let saved = {...question}, draft = {...question}, editing = false, busy = false, closed = false;
  const sequence = questions.map(q => ({...q}));
  let index = sequence.findIndex(q => q.id === question.id);
  if (index < 0) { sequence.push({...question}); index = sequence.length - 1; }
  let selects = [];
  const controller = new AbortController();
  const listen = (element, name, callback) => element.addEventListener(name, callback, {signal:controller.signal});
  const status = () => statusOptions.find(s => s.key === saved.status) || statusOptions[0];
  const diff = () => difficulties.find(d => d.key === saved.difficulty) || {label:saved.difficulty,color:'#a1a1aa',bg:'#ffffff0a'};
  root.classList.add('question-detail');
  root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); root.setAttribute('aria-labelledby','detail-title');
  root.innerHTML = `
    <header class="detail-toolbar"><div class="detail-heading"><span class="detail-eyebrow">QUESTION DETAILS</span><nav class="detail-navigation" aria-label="Browse questions">
      <button type="button" class="detail-icon-button detail-prev" aria-label="Previous question" title="Previous question (←)">${icon('previous')}</button>
      <span class="detail-position" aria-live="polite"></span>
      <button type="button" class="detail-icon-button detail-next" aria-label="Next question" title="Next question (→)">${icon('next')}</button>
    </nav></div><div class="detail-toolbar-actions">
      <span class="detail-save-state" role="status"></span>
      <button type="button" class="detail-button detail-cancel" hidden>Cancel</button>
      <button type="button" class="detail-button detail-save" hidden>Save changes</button>
      <button type="button" class="detail-icon-button detail-edit" title="Edit question" aria-label="Edit question">${icon('pencil')}</button>
      <span class="detail-toolbar-divider"></span>
      <button type="button" class="detail-icon-button detail-close" title="Close (Esc)" aria-label="Close question details">${icon('close')}</button>
    </div></header>
    <div class="detail-discard" hidden><span>Discard your unsaved changes?</span><button type="button" class="detail-button detail-keep">Keep editing</button><button type="button" class="detail-button detail-discard-confirm">Discard</button></div>
    <div class="detail-split"><section class="detail-info" aria-label="Question and notes"></section>
      <section class="detail-code" aria-label="Code panel"><div class="detail-code-toolbar"><div><span class="detail-language-dot"></span><span>C++</span><span class="detail-code-mode">SAVED SOLUTION</span></div>
        <button type="button" class="detail-copy" aria-label="Copy C++ code">${icon('copy')}<span>Copy</span></button></div>
        <div class="detail-editor"></div><div class="detail-code-footer"><span class="detail-line-count"></span><span>UTF-8 · C++</span></div>
      </section></div><div class="detail-error" role="alert" hidden></div>`;
  const editor = createCodeEditor(root.querySelector('.detail-editor'), saved.code, value => {
    if (editing) draft.code = value;
    updateLines(value);
  });
  function updateLines(value) {
    const count = (value || '').split('\n').length;
    root.querySelector('.detail-line-count').textContent = `${count} ${count === 1 ? 'line' : 'lines'}`;
  }
  updateLines(saved.code);
  const info = root.querySelector('.detail-info');
  const dirty = () => editing && Object.keys(draft).some(k => draft[k] !== saved[k]);
  const setError = message => { const el = root.querySelector('.detail-error'); el.textContent=message; el.hidden=!message; };
  const closeSelects = () => selects.forEach(s => s.close());
  const inerted = [...document.querySelectorAll('.app, .navbar')].map(el => ({el,was:el.inert}));
  inerted.forEach(({el}) => el.inert = true);
  const bodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  function renderInfo() {
    selects = [];
    if (!editing) {
      const level = diff();
      info.innerHTML = `<div class="detail-topic">${escape(saved.topic || 'Uncategorized')}</div>
        <h2 id="detail-title">${escape(saved.title)}</h2>
        <div class="detail-meta"><span class="detail-difficulty" style="color:${level.color};background:${level.bg}">${escape(level.label)}</span><span class="detail-status"><i style="background:${status().color}"></i>${status().label}</span>${saved.date_solved ? `<span class="detail-date">${escape(new Date(saved.date_solved+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}))}</span>` : ''}</div>
        <div class="detail-notes-section"><h3>Notes</h3><div class="detail-notes-text${saved.notes?.trim() ? '' : ' detail-muted'}">${escape(saved.notes?.trim() ? saved.notes : 'No notes yet. Use Edit to capture your approach.')}</div></div>
        <div class="detail-resources">${linkMarkup(saved.link,'Problem')}${linkMarkup(saved.video_link,'Reference')}${!safeUrl(saved.link) && !safeUrl(saved.video_link) ? '<span class="detail-muted">No links added</span>' : ''}</div>`;
    } else {
      info.innerHTML = `<form id="detail-form">
        <h2 id="detail-title" class="sr-only">Edit question</h2>
        <div class="detail-topic-field"></div>
        <label class="detail-field-label" for="detail-name">Question name</label><input id="detail-name" name="title" required maxlength="500" value="${escape(draft.title)}">
        <div class="detail-field-pair"><div class="detail-level-field"></div><div class="detail-status-field"></div></div>
        <label class="detail-field-label" for="detail-date">Date solved <span>IST</span></label><input id="detail-date" name="date_solved" type="date" value="${escape(draft.date_solved)}">
        <label class="detail-field-label" for="detail-notes">Notes</label><textarea id="detail-notes" name="notes" rows="7" placeholder="Your approach, key ideas, and things to revisit…">${escape(draft.notes)}</textarea>
        <label class="detail-field-label" for="detail-problem">Problem link</label><input id="detail-problem" type="url" name="link" placeholder="https://leetcode.com/problems/…" value="${escape(draft.link)}">
        <label class="detail-field-label" for="detail-reference">Reference material</label><input id="detail-reference" type="url" name="video_link" placeholder="https://…" value="${escape(draft.video_link)}">
      </form>`;
      const topicOptions = [...new Set([...topics, draft.topic].filter(Boolean))].map(t => ({key:t,label:t}));
      selects.push(mountSelect(info.querySelector('.detail-topic-field'), {label:'Topic',value:draft.topic,options:topicOptions,searchable:true,onChange:value=>draft.topic=value}));
      selects.push(mountSelect(info.querySelector('.detail-level-field'), {label:'Difficulty',value:draft.difficulty,options:difficulties,onChange:value=>draft.difficulty=value}));
      selects.push(mountSelect(info.querySelector('.detail-status-field'), {label:'Status',value:draft.status,options:statusOptions,onChange:value=>draft.status=value}));
      info.querySelector('form').onsubmit = e => {e.preventDefault(); save();};
      info.querySelectorAll('input[name], textarea[name]').forEach(input => {
        input.oninput = () => { draft[input.name] = input.value; };
      });
    }
    root.querySelector('.detail-edit').hidden = editing;
    root.querySelector('.detail-cancel').hidden = !editing;
    root.querySelector('.detail-save').hidden = !editing;
    root.querySelector('.detail-code-mode').textContent = editing ? 'EDITING SOLUTION' : 'SAVED SOLUTION';
    root.classList.toggle('is-editing',editing);
    updateNavigation();
  }

  function updateNavigation() {
    root.querySelector('.detail-position').textContent = `${index + 1} / ${sequence.length}`;
    root.querySelector('.detail-prev').disabled = editing || busy || index === 0;
    root.querySelector('.detail-next').disabled = editing || busy || index === sequence.length - 1;
  }
  function navigate(direction) {
    const next = index + direction;
    if (editing || busy || next < 0 || next >= sequence.length) return;
    index = next; saved = {...sequence[index]}; draft = {...saved};
    editor.reset(saved.code || ''); updateLines(saved.code);
    root.querySelector('.detail-save-state').textContent = '';
    setError(''); renderInfo(); info.scrollTop = 0;
    root.querySelector('.detail-edit').focus();
  }

  function close() {
    if (closed || busy) return;
    if (dirty()) {
      root.querySelector('.detail-discard').hidden = false;
      root.querySelector('.detail-keep').focus();
      return;
    }
    closed = true;
    backdrop.classList.remove('open');
    controller.abort(); editor.destroy();
    inerted.forEach(({el,was})=>el.inert=was);
    document.body.style.overflow = bodyOverflow;
    if (opener?.isConnected) opener.focus();
    else document.querySelector(`[data-id="${CSS.escape(saved.id)}"] .btn-notes`)?.focus();
    onClosed?.();
    // Keep the card shape until its existing exit transition has finished.
    setTimeout(() => { if (!backdrop.classList.contains('open')) {root.classList.remove('question-detail'); root.removeAttribute('role'); root.removeAttribute('aria-modal'); root.innerHTML='';} }, 220);
  }
  function cancel() {
    draft={...saved}; editing=false; editor.setEditable(false); editor.setValue(saved.code || '');
    root.querySelector('.detail-discard').hidden=true; setError(''); renderInfo(); root.querySelector('.detail-edit').focus();
  }
  async function save() {
    if (busy || !editing) return;
    const form = root.querySelector('form');
    if (!form.reportValidity()) return;
    if (!draft.title.trim() || !draft.topic) {setError('Enter a question name and choose a topic.'); return;}
    if ([draft.link,draft.video_link].some(url=>url && !safeUrl(url))) {setError('Links must start with https:// or http://.'); return;}
    busy=true; setError(''); closeSelects();
    root.querySelector('.detail-save').textContent='Saving…';
    root.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true);
    editor.setEditable(false);
    try {
      const updated={...draft,title:draft.title.trim(),link:draft.link.trim(),video_link:draft.video_link.trim(),code:editor.getValue()};
      await onSave(updated);
      saved=updated; draft={...updated}; editing=false; renderInfo();
      sequence[index] = {...updated};
      root.querySelector('.detail-save-state').textContent='Saved';
    } catch (error) {setError(error.message || 'Could not save. Your changes are still here.'); editor.setEditable(true);}
    finally {
      busy=false; root.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=false);
      root.querySelector('.detail-save').textContent='Save changes';
      updateNavigation();
      if (!editing) root.querySelector('.detail-edit').focus();
    }
  }
  listen(root,'close-detail-selects',closeSelects);
  listen(root.querySelector('.detail-prev'),'click',()=>navigate(-1));
  listen(root.querySelector('.detail-next'),'click',()=>navigate(1));
  root.addEventListener('keydown',e=>{
    if (!editing && !busy && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && ['ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault(); e.stopPropagation(); navigate(e.key === 'ArrowRight' ? 1 : -1);
    }
  },{capture:true,signal:controller.signal});
  listen(root,'click',e=>{ if (!e.target.closest('.detail-select')) closeSelects(); });
  listen(root.querySelector('.detail-edit'),'click',()=>{
    editing=true; draft={...saved}; root.querySelector('.detail-save-state').textContent=''; renderInfo(); editor.setEditable(true); info.querySelector('#detail-name').focus();
  });
  listen(root.querySelector('.detail-cancel'),'click',cancel);
  listen(root.querySelector('.detail-save'),'click',save);
  listen(root.querySelector('.detail-close'),'click',close);
  listen(root.querySelector('.detail-keep'),'click',()=>{root.querySelector('.detail-discard').hidden=true; editor.focus();});
  listen(root.querySelector('.detail-discard-confirm'),'click',()=>{editing=false;close();});
  listen(backdrop,'click',e=>{if (e.target===backdrop) close();});
  listen(root.querySelector('.detail-copy'),'click',async()=>{
    const label=root.querySelector('.detail-copy span');
    try {await navigator.clipboard.writeText(editor.getValue()); label.textContent='Copied'; setTimeout(()=>{if (!closed) label.textContent='Copy';},1500);}
    catch {setError('Clipboard unavailable. Select the code and copy it with your keyboard.');}
  });
  listen(root,'keydown',e=>{
    if (e.key==='Escape') {e.preventDefault();e.stopPropagation();close();}
    if ((e.ctrlKey || e.metaKey) && e.key==='Enter' && editing) {e.preventDefault();save();}
    if (e.key==='Tab') {
      const focusable=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length && !el.closest('[hidden]'));
      const first=focusable[0], last=focusable.at(-1);
      if (e.shiftKey && document.activeElement===first) {e.preventDefault();last?.focus();}
      else if (!e.shiftKey && document.activeElement===last) {e.preventDefault();first?.focus();}
    }
  });
  renderInfo(); backdrop.classList.add('open'); root.querySelector('.detail-edit').focus();
  return {close};
}

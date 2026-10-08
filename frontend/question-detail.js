import {createCodeEditor} from './code-editor.js';

import {escape, safeUrl, editableText, mountSelect, mountDatePicker, mountResource} from './detail-controls.js';

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
export function openQuestionDetail({question, questions = [question], topics, difficulties, isNew = false, startEditing = false, onSave, onClosed}) {
  const backdrop = document.querySelector('#notesPopover');
  const root = document.querySelector('#notesPopoverContent');
  const opener = document.activeElement;
  let saved = {...question}, draft = {...question}, editing = isNew || startEditing, busy = false, closed = false;
  const sequence = questions.map(q => ({...q}));
  let index = sequence.findIndex(q => q.id === question.id);
  if (index < 0) { sequence.push({...question}); index = sequence.length - 1; }
  let selects = [];
  const controller = new AbortController();
  const listen = (element, name, callback) => element.addEventListener(name, callback, {signal:controller.signal});
  root.classList.add('question-detail');
  root.setAttribute('role','dialog'); root.setAttribute('aria-modal','true'); root.setAttribute('aria-labelledby','detail-title');
  root.innerHTML = `
    <header class="detail-toolbar"><div class="detail-heading"><div class="detail-topic"></div><nav class="detail-navigation" aria-label="Browse questions">
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
    selects.forEach(control=>control.destroy());
    info.innerHTML = `<h2 id="detail-title" class="detail-inline-text" data-field="title" aria-label="Question name" data-placeholder="Question name" spellcheck="false">${escape(saved.title)}</h2>
      <div class="detail-meta"><div class="detail-level-field"></div><div class="detail-status-field"></div><div class="detail-date"></div></div>
      <div class="detail-notes-section"><h3>Notes</h3><div class="detail-notes-scroll" tabindex="0" aria-label="Scroll notes"><div class="detail-notes-text detail-inline-text" data-field="notes" aria-label="Notes" data-placeholder="No notes yet. Capture your approach here…">${escape(saved.notes)}</div></div></div>
      <div class="detail-resources"><div class="detail-problem"></div><div class="detail-reference"></div></div>`;
    const topicOptions=[...new Set([...topics,draft.topic].filter(Boolean))].map(t=>({key:t,label:t}));
    selects = [
      mountSelect(root.querySelector('.detail-topic'),{label:'Topic',value:draft.topic,options:topicOptions,searchable:true,onChange:value=>{draft.topic=value;updateToolbar();}}),
      mountSelect(info.querySelector('.detail-level-field'),{label:'Difficulty',value:draft.difficulty,options:difficulties,onChange:value=>draft.difficulty=value}),
      mountSelect(info.querySelector('.detail-status-field'),{label:'Status',value:draft.status,options:statusOptions,onChange:value=>draft.status=value}),
      mountDatePicker(info.querySelector('.detail-date'),{value:draft.date_solved,onChange:value=>draft.date_solved=value}),
      mountResource(info.querySelector('.detail-problem'),{label:'Problem',value:draft.link,onChange:value=>draft.link=value}),
      mountResource(info.querySelector('.detail-reference'),{label:'Reference',value:draft.video_link,onChange:value=>draft.video_link=value}),
    ];
    info.querySelectorAll('[data-field]').forEach(el=>{
      el.oninput=()=>{draft[el.dataset.field]=editableText(el);};
      el.onkeydown=e=>{if(el.dataset.field==='title' && e.key==='Enter'){e.preventDefault();}};
    });
    applyEditing();
  }
  function updateToolbar() {
    const name=(editing?draft.topic:saved.topic)||'Uncategorized';
    root.querySelector('.detail-topic .detail-select-trigger').title=name;
  }
  function applyEditing() {
    selects.forEach(control=>control.setEnabled(editing));
    info.querySelectorAll('[data-field]').forEach(el=>{
      el.setAttribute('contenteditable',editing?'plaintext-only':'false');
      if(editing) {
        el.setAttribute('role','textbox');
        el.setAttribute('aria-label',el.dataset.field==='title'?'Question name':'Notes');
        el.setAttribute('aria-multiline',String(el.dataset.field==='notes'));
      } else {el.removeAttribute('role');el.removeAttribute('aria-label');el.removeAttribute('aria-multiline');}
    });
    root.querySelector('.detail-edit').hidden=editing;
    root.querySelector('.detail-cancel').hidden=!editing;
    root.querySelector('.detail-save').hidden=!editing;
    if (!busy) root.querySelector('.detail-save').textContent=isNew?'Add question':'Save changes';
    root.querySelector('.detail-navigation').hidden=isNew;
    root.querySelector('.detail-code-mode').textContent=editing?'EDITING SOLUTION':'SAVED SOLUTION';
    root.classList.toggle('is-editing',editing);
    updateToolbar();updateNavigation();
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
    setError(''); renderInfo();
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
    controller.abort(); selects.forEach(control=>control.destroy()); editor.destroy();
    inerted.forEach(({el,was})=>el.inert=was);
    document.body.style.overflow = bodyOverflow;
    if (opener?.isConnected) opener.focus();
    else document.querySelector(`[data-id="${CSS.escape(saved.id)}"] .btn-notes`)?.focus();
    onClosed?.();
    // Keep the card shape until its existing exit transition has finished.
    setTimeout(() => { if (!backdrop.classList.contains('open')) {root.classList.remove('question-detail'); root.removeAttribute('role'); root.removeAttribute('aria-modal'); root.innerHTML='';} }, 220);
  }
  function cancel() {
    if (isNew) { close(); return; }
    draft={...saved}; editing=false; editor.setEditable(false); editor.setValue(saved.code || '');
    root.querySelector('.detail-discard').hidden=true; setError(''); renderInfo(); root.querySelector('.detail-edit').focus();
  }
  async function save() {
    if (busy || !editing) return;
    if (draft.title.length > 500) {setError('Keep the question name within 500 characters.'); return;}
    if (!draft.title.trim() || !draft.topic) {setError('Enter a question name and choose a topic.'); return;}
    if ([draft.link,draft.video_link].some(url=>url.trim() && !safeUrl(url.trim()))) {setError('Links must start with https:// or http://.'); return;}
    busy=true; setError(''); closeSelects();
    root.querySelector('.detail-save').textContent='Saving…';
    root.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=true);
    info.querySelectorAll('[data-field]').forEach(el=>el.contentEditable='false');
    editor.setEditable(false);
    try {
      const updated={...draft,title:draft.title.trim(),link:draft.link.trim(),video_link:draft.video_link.trim(),code:editor.getValue()};
      const persisted = await onSave(updated);
      saved={...updated,...persisted}; draft={...saved}; isNew=false; editing=false; renderInfo();
      sequence[index] = {...saved};
      root.querySelector('.detail-save-state').textContent='Saved';
    } catch (error) {setError(error.message || 'Could not save. Your changes are still here.'); editor.setEditable(true);}
    finally {
      busy=false; root.querySelectorAll('button,input,textarea').forEach(el=>el.disabled=false);
      root.querySelector('.detail-save').textContent='Save changes';
      applyEditing();
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
  listen(root,'click',e=>{ if (!e.target.closest('.detail-select,.detail-date-picker,.detail-resource-control,[data-detail-popup]')) closeSelects(); });
  listen(info,'scroll',closeSelects);
  listen(window,'resize',closeSelects);
  listen(root.querySelector('.detail-edit'),'click',()=>{
    editing=true; draft={...saved}; root.querySelector('.detail-save-state').textContent=''; applyEditing(); editor.setEditable(true); info.querySelector('#detail-title').focus({preventScroll:true});
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
      const focusable=[...root.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],[contenteditable="plaintext-only"],[tabindex="0"]')].filter(el=>el.getClientRects().length && !el.closest('[hidden]'));
      const first=focusable[0], last=focusable.at(-1);
      if (e.shiftKey && document.activeElement===first) {e.preventDefault();last?.focus();}
      else if (!e.shiftKey && document.activeElement===last) {e.preventDefault();first?.focus();}
    }
  });
  renderInfo(); editor.setEditable(editing); backdrop.classList.add('open');
  (editing ? info.querySelector('#detail-title') : root.querySelector('.detail-edit')).focus({preventScroll:true});
  return {close};
}

/* professor.js — Portal do Professor com login/cadastro local (como antes) */
(() => {
  'use strict';

  // Helpers
  const qs  = (sel, root=document) => root.querySelector(sel);
  const qsa = (sel, root=document) => [...root.querySelectorAll(sel)];
  const on  = (sel, ev, fn) => { const el = qs(sel); if (el) el.addEventListener(ev, fn); };

  const setBG = (css) => document.documentElement.style.setProperty('--app-bg', css);
  const fallbackAvatar = (color = '#6ea8fe') =>
    'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="#121c36"/><circle cx="48" cy="36" r="18" fill="${color}"/><rect x="18" y="62" width="60" height="20" rx="10" fill="${color}"/></svg>`);

  const load = (k, dflt) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? dflt; } catch { return dflt; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const del  = (k) => localStorage.removeItem(k);

  // Storage keys
  const TKEY = 'os_theme_prof';
  const UKEY = 'osportal_users';     // [{nome,email,pass}]
  const SKEY = 'osportal_session';   // {email,nome}

  // Escopo por usuário (mantém dados separados por conta)
  const keyEmail = (email) => (email||'').toLowerCase().trim();
  const PROFILE_KEY = (email) => `osportal_profile:${keyEmail(email)}`;
  const DATA_KEY    = (email) => `osportal_data:${keyEmail(email)}`;

  // THEME
  const overlay = () => 'linear-gradient(180deg, rgba(11,18,32,.65), rgba(14,22,48,.85))';
  const theme = () => load(TKEY, {mode:'color', color:'#0b1220', image:'', fit:'cover'});
  const setTheme = (t) => save(TKEY, t);
  function applyTheme(){
    const t=theme(); let bg;
    if(t.mode==='image' && t.image){
      bg = `${overlay()}, url('${t.image}')`;
      document.body.style.backgroundSize=t.fit||'cover';
      document.body.style.backgroundPosition='center';
      document.body.style.backgroundAttachment='fixed';
    }else{
      bg = `radial-gradient(900px 900px at 10% 10%, rgba(255,255,255,0.06) 0%, transparent 60%),
            linear-gradient(180deg, ${t.color} 0%, #0e1630 100%)`;
    }
    setBG(bg);
    const prev = qs('#themePreview');
    if(prev){ prev.style.background=bg; prev.style.backgroundSize=t.fit||'cover'; prev.style.backgroundPosition='center'; }
  }

  // Users/Auth (local)
  const users    = () => load(UKEY, []);
  const setUsers = (arr) => save(UKEY, arr);
  const session  = () => load(SKEY, null);
  const setSession = (s) => save(SKEY, s);
  const clearSession = () => del(SKEY);

  async function sha256(text){
    const enc = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function register(nome, email, senha){
    const u = users();
    if(u.find(x => x.email.toLowerCase() === email.toLowerCase()))
      throw new Error('E-mail/usuário já cadastrado.');
    u.push({ nome, email, pass: await sha256(senha) });
    setUsers(u);
  }
  async function login(email, senha){
    const u = users();
    const user = u.find(x => x.email.toLowerCase() === email.toLowerCase());
    if(!user) throw new Error('Usuário não encontrado.');
    if(await sha256(senha) !== user.pass) throw new Error('Senha inválida.');
    setSession({ email: user.email, nome: user.nome });
  }

  // Perfil (escopo por email)
  function loadProfile(email){
    return load(PROFILE_KEY(email), {nome:'', email:'', inst:'', bio:'', avatar:''});
  }
  function saveProfile(email, p){
    save(PROFILE_KEY(email), p);
  }

  function applyProfChip(){
    const s = session();
    const p = s ? loadProfile(s.email) : {nome:'Professor', email:'', inst:'', bio:'', avatar:''};
    const nome  = p.nome  || s?.nome || 'Professor';
    const email = p.email || s?.email || '';
    const avatar= p.avatar || fallbackAvatar();

    const a1=qs('#profAvatar'), a2=qs('#profDropAvatar');
    if(a1) a1.src=avatar; if(a2) a2.src=avatar;
    const n1=qs('#profNomeChip'), n2=qs('#profDropNome');
    if(n1) n1.textContent=nome; if(n2) n2.textContent=nome;
    const e1=qs('#profDropEmail'); if(e1) e1.textContent=email || 'sem login';
    const r =qs('#profRole');      if(r)  r.textContent = s ? 'Logado' : 'Deslogado';

    // form
    const fNome=qs('#perfilNome'), fEmail=qs('#perfilEmail'), fInst=qs('#perfilInst'), fBio=qs('#perfilBio');
    if(fNome)  fNome.value  = nome;
    if(fEmail) fEmail.value = email;
    if(fInst)  fInst.value  = p.inst||'';
    if(fBio)   fBio.value   = p.bio ||'';
  }

  // OS (escopo por email)
  function loadData(email){ return load(DATA_KEY(email), []); }
  function saveData(email, arr){ save(DATA_KEY(email), arr); }
  function dataAll(){
    const s=session(); if(!s) return [];
    return loadData(s.email);
  }
  function setDataAll(arr){
    const s=session(); if(!s) return;
    saveData(s.email, arr);
  }
  function upsertOS(rec){
    const arr=dataAll();
    const i=arr.findIndex(x=>x.id===rec.id);
    if(i>=0) arr[i]=rec; else arr.unshift(rec);
    setDataAll(arr); renderList(); populateSelect();
  }
  function removeOS(id){
    setDataAll(dataAll().filter(x=>x.id!==id));
    renderList(); populateSelect(); clearForm();
  }

  // PDF
  async function buildPDFBlob(data){
    const { jsPDF } = window.jspdf;
    const doc=new jsPDF({unit:'pt',format:'a4'});
    const mm=v=>v*2.83465,left=mm(20),top=mm(20),lh=18;
    doc.setFont('helvetica','bold');doc.setFontSize(16);doc.text('ORDEM DE SERVIÇO',left,top);
    doc.setFont('helvetica','normal');doc.setFontSize(10);
    const lines=[`Nº: ${data.numero}    Data: ${data.data}`,`Solicitante: ${data.solicitante}`,`Técnico Responsável: ${data.tecnico}`,`Local do Serviço: ${data.local}`,`Descrição: ${data.descricao}`,`Equip./Ferramentas: ${data.ferramentas||'-'}`,`Peças Substituídas: ${data.pecas||'-'}`,`Problemas/Soluções: ${data.problemas||'-'}`,`Observações: ${data.observacoes||'-'}`];
    let y=top+lh*2; for(const ln of lines){ const w=doc.splitTextToSize(ln,555); doc.text(w,left,y); y+=lh*w.length+4; if(y>760){doc.addPage(); y=top;} }
    return doc.output('blob');
  }
  async function downloadBlob(blob, filename){
    const url=URL.createObjectURL(blob); const a=document.createElement('a');
    a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  function blobToDataURL(blob){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(blob); }); }

  // Import
  async function importZip(file){
    const impMsg=qs('#impMsg'); if(!file){ if(impMsg) impMsg.textContent='Selecione um .zip.'; return; }
    try{
      const zip=await JSZip.loadAsync(file);
      const files=Object.values(zip.files);
      const jsonEntry=files.find(f=>f.name.endsWith('.json'));
      const pdfEntry =files.find(f=>f.name.endsWith('.pdf'));
      if(!jsonEntry) throw new Error('JSON não encontrado no ZIP.');
      const dataObj=JSON.parse(await jsonEntry.async('string'));
      let pdfB64=null; if(pdfEntry){ const pdfBlob=await pdfEntry.async('blob'); pdfB64=await blobToDataURL(pdfBlob); }
      upsertOS({ id: crypto.randomUUID(), dataObj, pdfB64 });
      if(impMsg) impMsg.textContent='Importado com sucesso.';
    }catch(e){ console.error(e); if(impMsg) impMsg.textContent='Falha ao importar ZIP.'; }
  }
  function extractPayloadAny(s){
    if(!s) return null; s=s.trim();
    if(/^[A-Za-z0-9+/=]+$/.test(s) && s.length>20) return s;
    if(s.startsWith('#')){ const p=new URLSearchParams(s.slice(1)); return p.get('payload'); }
    try{
      const u=new URL(s, location.href);
      if(u.hash && u.hash.includes('payload=')){ const p=new URLSearchParams(u.hash.replace(/^#/,'')); return p.get('payload'); }
      if(u.search && u.search.includes('payload=')){ const p=new URLSearchParams(u.search); return p.get('payload'); }
    }catch{}
    const m=s.match(/payload=([^&#\s]+)/); if(m) return m[1];
    return null;
  }
  function safeJSONfromB64(b64){ try{ return JSON.parse(decodeURIComponent(escape(atob(b64)))); }catch{ return JSON.parse(atob(b64)); } }
  async function importLinkGeneric(str){
    const impMsg=qs('#impMsg');
    try{
      const payload=extractPayloadAny(str); if(!payload) throw new Error('Payload não encontrado.');
      const dataObj=safeJSONfromB64(payload);
      upsertOS({ id: crypto.randomUUID(), dataObj, pdfB64:null });
      if(impMsg) impMsg.textContent='Importado via link/hash com sucesso.';
    }catch(e){ console.error(e); if(impMsg) impMsg.textContent='Link/Hash inválido.'; }
  }

  // UI auth toggle
  function requireAuth(){
    const s = session();
    const authCard=qs('#authCard');
    const app=qs('#app');
    if(authCard) authCard.style.display = s ? 'none' : '';
    if(app)      app.style.display      = s ? '' : 'none';
    applyProfChip(); applyTheme();
    if(s){ renderList(); populateSelect(); }
  }

  // OS UI
  function renderList(){
    const tbl=qs('#tbl'); if(!tbl) return;
    const arr=dataAll();
    tbl.innerHTML = arr.length ? arr.map(r=>`
      <tr>
        <td>${r.dataObj.numero}</td>
        <td>${r.dataObj.data}</td>
        <td>${r.dataObj.solicitante||'-'}</td>
        <td>${r.dataObj.tecnico||'-'}</td>
        <td><button class="btn" data-edit="${r.id}">Editar</button></td>
      </tr>`).join('') : `<tr><td colspan="5" class="muted">Nenhum registro</td></tr>`;
  }
  function populateSelect(){
    const sel=qs('#selOS'); if(!sel) return;
    sel.innerHTML = dataAll().map(r=>`<option value="${r.id}">${r.dataObj.numero} — ${r.dataObj.solicitante||'-'}</option>`).join('');
  }
  function current(){
    const sel=qs('#selOS'); if(!sel) return null;
    return dataAll().find(x=>x.id===sel.value)||null;
  }
  function fillForm(d){
    const set=(id,v='')=>{ const el=qs('#'+id); if(el) el.value=v; };
    set('f_numero', d.numero); set('f_data', d.data);
    set('f_solicitante', d.solicitante); set('f_tecnico', d.tecnico);
    set('f_local', d.local); set('f_descricao', d.descricao);
    set('f_ferramentas', d.ferramentas); set('f_pecas', d.pecas);
    set('f_problemas', d.problemas); set('f_observacoes', d.observacoes);
  }
  function grabForm(){
    const get=id=> (qs('#'+id)?.value.trim()||'');
    return { numero:get('f_numero'), data:get('f_data'), solicitante:get('f_solicitante'), tecnico:get('f_tecnico'),
             local:get('f_local'), descricao:get('f_descricao'), ferramentas:get('f_ferramentas'), pecas:get('f_pecas'),
             problemas:get('f_problemas'), observacoes:get('f_observacoes') };
  }
  function clearForm(){
    ['f_numero','f_data','f_solicitante','f_tecnico','f_local','f_descricao','f_ferramentas','f_pecas','f_problemas','f_observacoes']
      .forEach(id=>{ const el=qs('#'+id); if(el) el.value=''; });
  }

  // Wire-up
  document.addEventListener('DOMContentLoaded', ()=>{

    // Tema
    on('#btnTema','click', ()=>{ const t=theme(); const c=qs('#themeColor'), u=qs('#themeImageUrl'), f=qs('#themeFit');
      if(c) c.value=t.color||'#0b1220'; if(u) u.value=''; if(f) f.value=t.fit||'cover';
      applyTheme(); qs('#dlgTema')?.showModal();
    });
    on('#btnTemaFechar','click', ()=> qs('#dlgTema')?.close());
    on('#btnTemaSalvar','click', ()=>{ const t=theme(); const url=qs('#themeImageUrl')?.value.trim(); const fit=qs('#themeFit')?.value||'cover'; const color=qs('#themeColor')?.value||'#0b1220';
      if(url){ t.mode='image'; t.image=url; t.fit=fit; } else if(t.image){ t.color=color; } else { t.mode='color'; t.color=color; t.image=''; }
      setTheme(t); applyTheme(); qs('#dlgTema')?.close();
    });
    on('#btnTemaReset','click', ()=>{ setTheme({mode:'color', color:'#0b1220', image:'', fit:'cover'}); applyTheme(); });
    on('#themeColor','input', ()=>{ const t=theme(); t.mode='color'; t.color=qs('#themeColor').value; t.image=''; setTheme(t); applyTheme(); });
    on('#themeImageFile','change', (e)=>{ const f=e.target.files?.[0]; if(!f) return; const rd=new FileReader();
      rd.onload=()=>{ const t=theme(); t.mode='image'; t.image=rd.result; t.fit=qs('#themeFit')?.value||'cover'; setTheme(t); applyTheme(); }; rd.readAsDataURL(f);
    });
    on('#themeImageUrl','input', ()=>{ const t=theme(); t.mode='image'; t.image=qs('#themeImageUrl').value.trim(); setTheme(t); applyTheme(); });
    on('#themeFit','change', ()=>{ const t=theme(); t.fit=qs('#themeFit').value; setTheme(t); applyTheme(); });
    qsa('.swatch').forEach(el=> el.addEventListener('click', ()=>{ const c=el.getAttribute('data-c'); const t=theme();
      const i=qs('#themeColor'); if(i) i.value=c; t.mode='color'; t.color=c; t.image=''; setTheme(t); applyTheme();
    }));

    // Perfil chip
    document.addEventListener('click', (e)=>{
      const drop=qs('#profDrop'); if(!drop) return;
      if(e.target.closest('#profChip')){ drop.classList.toggle('show'); return; }
      if(!e.target.closest('#profDrop')) drop.classList.remove('show');
    });
    on('#perfilFoto','change', (e)=>{ const f=e.target.files?.[0]; if(!f) return; const rd=new FileReader();
      rd.onload=()=>{ const img=qs('#profDropAvatar'); if(img) img.src=rd.result; }; rd.readAsDataURL(f);
    });
    on('#btnSalvarPerfil','click', ()=>{
      const s=session(); if(!s) return alert('Faça login primeiro.');
      const p=loadProfile(s.email);
      p.nome  = qs('#perfilNome')?.value.trim()  || s.nome || 'Professor';
      p.email = qs('#perfilEmail')?.value.trim() || s.email || '';
      p.inst  = qs('#perfilInst')?.value.trim()  || '';
      p.bio   = qs('#perfilBio')?.value.trim()   || '';
      const src=qs('#profDropAvatar')?.src; if(src) p.avatar=src;
      saveProfile(s.email, p); applyProfChip(); alert('Perfil salvo!'); qs('#profDrop')?.classList.remove('show');
    });
    on('#btnSair','click', ()=>{ if(!session()) return; if(confirm('Sair da sessão?')){ clearSession(); requireAuth(); } });

    // Auth
    const authMsg=qs('#authMsg');
    on('#btnCadastrar','click', async ()=>{
      if(authMsg) authMsg.textContent='';
      try{
        const nome = qs('#regNome')?.value.trim();
        const email= qs('#regEmail')?.value.trim();
        const senha= qs('#regSenha')?.value;
        if(!nome || !email || !senha) throw new Error('Preencha nome, e-mail/usuário e senha.');
        await register(nome, email, senha);
        if(authMsg) authMsg.textContent='Cadastro ok. Faça login.';
      }catch(e){ if(authMsg) authMsg.textContent=e.message; }
    });
    async function doLogin(){
      if(authMsg) authMsg.textContent='';
      try{
        const email=qs('#logEmail')?.value.trim();
        const senha=qs('#logSenha')?.value;
        await login(email, senha);
        requireAuth(); renderList(); populateSelect();
        try{ if(location.hash.includes('payload=')){ await importLinkGeneric(location.href); location.hash=''; } }catch{}
      }catch(e){ if(authMsg) authMsg.textContent=e.message; }
    }
    on('#btnEntrar','click', doLogin);
    [qs('#logEmail'), qs('#logSenha')].forEach(el => el && el.addEventListener('keydown', (e)=>{ if(e.key==='Enter') doLogin(); }));

    // OS binds
    on('#btnImportZip','click', async ()=>{ if(!session()) return alert('Faça login.'); await importZip(qs('#zipInput')?.files?.[0]); });
    on('#btnImportLink','click', async ()=>{ if(!session()) return alert('Faça login.'); await importLinkGeneric(qs('#linkInput')?.value); });
    on('#selOS','change', ()=>{ const rec=current(); if(rec) fillForm(rec.dataObj); });
    document.addEventListener('click', (e)=>{
      const btn=e.target.closest('button[data-edit]'); if(!btn) return;
      const id=btn.getAttribute('data-edit'); const rec=dataAll().find(x=>x.id===id);
      const sel=qs('#selOS'); if(rec && sel){ sel.value=id; fillForm(rec.dataObj); }
    });
    on('#btnSalvarOS','click', ()=>{ const rec=current(); if(!rec) return; rec.dataObj=grabForm(); upsertOS(rec); alert('Alterações salvas.'); });
    on('#btnBaixarPDF','click', async ()=>{ const rec=current(); if(!rec) return; const blob=await buildPDFBlob(rec.dataObj); await downloadBlob(blob, `${rec.dataObj.numero}.pdf`); rec.pdfB64=await blobToDataURL(blob); upsertOS(rec); });
    on('#btnExcluirOS','click', ()=>{ const rec=current(); if(!rec) return; if(confirm('Excluir esta OS?')) removeOS(rec.id); });

    // Start
    requireAuth();
    renderList();
    populateSelect();
    applyTheme();
    applyProfChip();

    // se já logado e vier com payload na URL
    if(session() && location.hash.includes('payload=')){
      importLinkGeneric(location.href).finally(()=>{ try{ location.hash=''; }catch{} });
    }
  });
})();

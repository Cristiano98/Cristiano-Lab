(function initAluno(){
  const ready = (fn)=> (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', fn, { once:true })
    : fn();

  // ====== GOOGLE DRIVE (OAuth + Upload + Compartilhar) ======
  const DRIVE_CLIENT_ID = '870549815554-6bolhsodann1oa32cocltsr8opl1d5sp.apps.googleusercontent.com'; // <-- o seu
  const DRIVE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
  const DRIVE_DISCOVERY = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];

  let __gisTokenClient = null;
  let __gapiReady = false;
  let __gisReady = false;

  // functions chamadas pelos <script onload> no HTML
  window.gapiLoaded = function gapiLoaded() {
    gapi.load('client', async () => {
      await gapi.client.init({ discoveryDocs: DRIVE_DISCOVERY });
      __gapiReady = true;
    });
  };
  window.gisLoaded = function gisLoaded() {
    __gisTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: DRIVE_CLIENT_ID,
      scope: DRIVE_SCOPES,
      prompt: '',
      callback: () => {}
    });
    __gisReady = true;
  };

  function __libsProntas() {
    return new Promise(resolve => {
      const tick = () => (__gapiReady && __gisReady) ? resolve() : setTimeout(tick, 50);
      tick();
    });
  }

  async function __garantirAuthDrive({forcarConsent=false} = {}) {
    await __libsProntas();
    const token = gapi.client.getToken();
    if (!token || forcarConsent) {
      await new Promise((resolve, reject) => {
        __gisTokenClient.callback = (resp) => resp && resp.error ? reject(resp) : resolve();
        __gisTokenClient.requestAccessToken({ prompt: forcarConsent ? 'consent' : '' });
      });
    }
  }

  async function __driveUploadPdf(pdfBlob, fileName) {
    await __garantirAuthDrive().catch(async () => {
      await __garantirAuthDrive({ forcarConsent: true });
    });
    const token = gapi.client.getToken()?.access_token;
    if (!token) throw new Error('Sem token do Google (auth falhou).');

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelim = `\r\n--${boundary}--`;
    const metadata = { name: fileName, mimeType: 'application/pdf' };

    const multipartBody = new Blob([
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      'Content-Type: application/pdf\r\n\r\n',
      pdfBlob,
      closeDelim
    ], { type: `multipart/related; boundary=${boundary}` });

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: multipartBody
    });
    if (!res.ok) throw new Error('Falha no upload: ' + await res.text().catch(()=> ''));
    const json = await res.json();
    return json.id;
  }

  async function __driveTornarPublico(fileId) {
    const token = gapi.client.getToken()?.access_token;
    if (!token) throw new Error('Sem token do Google.');
    const permRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' })
    });
    if (!permRes.ok) throw new Error('Falha ao compartilhar: ' + await permRes.text().catch(()=> ''));
  }

  async function __driveBuscarLinks(fileId) {
    const token = gapi.client.getToken()?.access_token;
    if (!token) throw new Error('Sem token do Google.');
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=webViewLink,webContentLink`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Falha ao obter links: ' + await res.text().catch(()=> ''));
    return res.json(); // { webViewLink, webContentLink }
  }

  async function enviarParaDrive(nomeArquivo, dataOSObj) {
    const pdf = await buildPDFBlob(dataOSObj);
    const fileId = await __driveUploadPdf(pdf, nomeArquivo);
    await __driveTornarPublico(fileId);
    const { webViewLink } = await __driveBuscarLinks(fileId);
    return webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
  }

  // ====== APP ======
  ready(()=>{

    // helpers
    const $ = (sel, p=document)=> p.querySelector(sel);
    const setBG = (css)=> document.documentElement.style.setProperty('--app-bg', css);
    const fallbackAvatar = (color='#8bc1ff') =>
      'data:image/svg+xml;utf8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="100%" height="100%" fill="#121c36"/><circle cx="48" cy="36" r="18" fill="${color}"/><rect x="18" y="62" width="60" height="20" rx="10" fill="${color}"/></svg>`);

    /* ===== THEME (igual ao seu) ===== */
    const TKEY='os_theme_aluno';
    const overlay=()=> 'linear-gradient(180deg, rgba(11,18,32,.65), rgba(14,22,48,.85))';
    const theme=()=> JSON.parse(localStorage.getItem(TKEY)||'null') || {mode:'color', color:'#0b1220', image:'', fit:'cover'};
    const saveTheme=(t)=> localStorage.setItem(TKEY, JSON.stringify(t));
    const applyTheme=()=>{
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
      const prev=$('#themePreview'); if(prev){prev.style.background=bg; prev.style.backgroundSize=t.fit||'cover'; prev.style.backgroundPosition='center';}
    };

    // theme UI (igual)
    const btnTema = $('#btnTema'), dlgTema = $('#dlgTema');
    const themeColor = $('#themeColor'), themeImageFile = $('#themeImageFile'), themeImageUrl = $('#themeImageUrl'),
          themeFit = $('#themeFit'), btnTemaSalvar = $('#btnTemaSalvar'), btnTemaReset = $('#btnTemaReset'), btnTemaFechar = $('#btnTemaFechar');

    if(btnTema){
      btnTema.addEventListener('click', ()=>{
        const t=theme(); if(themeColor) themeColor.value=t.color||'#0b1220'; if(themeImageUrl) themeImageUrl.value=''; if(themeFit) themeFit.value=t.fit||'cover';
        applyTheme(); dlgTema?.showModal();
      });
    }
    btnTemaFechar?.addEventListener('click', ()=> dlgTema?.close());
    btnTemaSalvar?.addEventListener('click', ()=>{
      const t=theme(); const url=themeImageUrl?.value.trim();
      if(url){ t.mode='image'; t.image=url; t.fit=themeFit?.value; }
      else if(t.image){ t.color=themeColor?.value; }
      else { t.mode='color'; t.color=themeColor?.value; t.image=''; }
      saveTheme(t); applyTheme(); dlgTema?.close();
    });
    btnTemaReset?.addEventListener('click', ()=>{ saveTheme({mode:'color', color:'#0b1220', image:'', fit:'cover'}); applyTheme(); });
    themeColor?.addEventListener('input', ()=>{ const t=theme(); t.mode='color'; t.color=themeColor.value; t.image=''; saveTheme(t); applyTheme(); });
    themeImageFile?.addEventListener('change', e=>{
      const f=e.target.files?.[0]; if(!f) return;
      const rd=new FileReader(); rd.onload=()=>{ const t=theme(); t.mode='image'; t.image=rd.result; t.fit=themeFit?.value; saveTheme(t); applyTheme(); }; rd.readAsDataURL(f);
    });
    themeImageUrl?.addEventListener('input', ()=>{ const t=theme(); t.mode='image'; t.image=themeImageUrl.value.trim(); saveTheme(t); applyTheme(); });
    themeFit?.addEventListener('change', ()=>{ const t=theme(); t.fit=themeFit.value; saveTheme(t); applyTheme(); });
    document.querySelectorAll('.swatch').forEach(el=> el.addEventListener('click', ()=>{
      if(themeColor) themeColor.value = el.dataset.c;
      const t=theme(); t.mode='color'; t.color=el.dataset.c; t.image=''; saveTheme(t); applyTheme();
    }));

    /* ===== PERFIL (Aluno) ===== */
    const PKEY='os_aluno_profile';
    const profile=()=> JSON.parse(localStorage.getItem(PKEY)||'null') || {nome:'Aluno(a)', avatar:''};
    const saveProfile=(p)=> localStorage.setItem(PKEY, JSON.stringify(p));
    const applyChip=()=>{
      const p=profile(); const av=p.avatar || fallbackAvatar();
      const av1 = document.getElementById('alunoAvatar'); if(av1) av1.src=av;
      const av2 = document.getElementById('alunoDropAvatar'); if(av2) av2.src=av;
      const nm1 = document.getElementById('alunoNomeChip'); if(nm1) nm1.textContent=p.nome||'Aluno(a)';
      const nm2 = document.getElementById('alunoDropNome'); if(nm2) nm2.textContent=p.nome||'Aluno(a)';
      const inp = document.getElementById('perfilAlunoNome'); if(inp) inp.value=p.nome||'';
    };
    const alumnoChip=document.getElementById('alunoChip'), alumnoDrop=document.getElementById('alunoDrop'), perfilAlunoFoto=document.getElementById('perfilAlunoFoto');
    if(alumnoChip) document.addEventListener('click', (e)=>{
      if(e.target.closest('#alunoChip')){ alumnoDrop?.classList.toggle('show'); return; }
      if(!e.target.closest('#alunoDrop')) alumnoDrop?.classList.remove('show');
    });
    perfilAlunoFoto?.addEventListener('change', e=>{
      const f=e.target.files?.[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=> { const img=document.getElementById('alunoDropAvatar'); if(img) img.src=rd.result; }; rd.readAsDataURL(f);
    });
    document.getElementById('btnSalvarPerfilAluno')?.addEventListener('click', ()=>{
      const p=profile(); const nome = (document.getElementById('perfilAlunoNome')?.value||'').trim() || 'Aluno(a)';
      p.nome = nome;
      const src=document.getElementById('alunoDropAvatar')?.src; if(src) p.avatar=src;
      saveProfile(p); applyChip(); alert('Perfil salvo!'); alumnoDrop?.classList.remove('show');
    });

    /* ===== OS / PDF / ZIP / LINK ===== */
    const numeroOS=document.getElementById('numeroOS'), dataOS=document.getElementById('dataOS');
    const dlgEnviar=document.getElementById('dlgEnviar'), statusEnvio=document.getElementById('statusEnvio'), campoLink=document.getElementById('campoLink'), campoHash=document.getElementById('campoHash');

    const pad=n=> String(n).padStart(2,'0');
    const nowBR=()=>{ const d=new Date(); return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const genOS=()=>{ const d=new Date(); return `OS-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${Math.floor(1000+Math.random()*9000)}`; };
    const getData=()=>({ numero:numeroOS.value.trim(), data:dataOS.value.trim(), solicitante:document.getElementById('solicitante').value.trim(),
      tecnico:document.getElementById('tecnico').value.trim(), local:document.getElementById('local').value.trim(), descricao:document.getElementById('descricao').value.trim(),
      ferramentas:document.getElementById('ferramentas').value.trim(), pecas:document.getElementById('pecas').value.trim(), problemas:document.getElementById('problemas').value.trim(), observacoes:document.getElementById('observacoes').value.trim() });
    const validate=()=>{ for(const id of ['solicitante','tecnico','local','descricao']){ const el=document.getElementById(id); if(!el.value.trim()){ alert('Preencha: '+el.previousElementSibling.textContent); el.focus(); return false; } } return true; };

    async function buildPDFBlob(data){
      const { jsPDF } = window.jspdf; const doc = new jsPDF({unit:'pt', format:'a4'});
      const mm=v=>v*2.83465, left=mm(20), top=mm(20), lh=18;
      doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.text('ORDEM DE SERVIÇO', left, top);
      doc.setFont('helvetica','normal'); doc.setFontSize(10);
      const lines=[`Nº: ${data.numero}    Data: ${data.data}`,`Solicitante: ${data.solicitante}`,`Técnico Responsável: ${data.tecnico}`,`Local do Serviço: ${data.local}`,`Descrição: ${data.descricao}`,`Equip./Ferramentas: ${data.ferramentas||'-'}`,`Peças Substituídas: ${data.pecas||'-'}`,`Problemas/Soluções: ${data.problemas||'-'}`,`Observações: ${data.observacoes||'-'}`];
      let y=top+lh*2; for(const ln of lines){ const w=doc.splitTextToSize(ln,555); doc.text(w,left,y); y+=lh*w.length+4; if(y>760){ doc.addPage(); y=top; } }
      return doc.output('blob');
    }
    async function downloadBlob(blob, filename){
      const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    }

    // init
    if(numeroOS) numeroOS.value = genOS();
    if(dataOS) dataOS.value = nowBR();
    applyChip(); applyTheme();

    // eventos envio/pdf/drive (AGORA TUDO DENTRO DO ready)
    const btnGerarPdf=document.getElementById('btnGerarPdf');
    const btnEnviarProf=document.getElementById('btnEnviarProf');
    const btnZip=document.getElementById('btnZip');
    const btnLink=document.getElementById('btnLink');
    const fecharEnvio=document.getElementById('fecharEnvio');
    const btnDrive=document.getElementById('btnDrive');

    btnGerarPdf?.addEventListener('click', async ()=>{
      if(!validate()) return; const data=getData(); const pdf=await buildPDFBlob(data); await downloadBlob(pdf, `${data.numero}.pdf`);
    });
    btnEnviarProf?.addEventListener('click', ()=>{
      if(!validate()) return; if(statusEnvio) statusEnvio.textContent=''; if(campoLink) campoLink.value=''; if(campoHash) campoHash.value='';
      dlgEnviar?.showModal();
    });
    btnZip?.addEventListener('click', async ()=>{
      try{
        const data=getData(); const pdf=await buildPDFBlob(data);
        const json=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
        const zip=new JSZip(); zip.file(`${data.numero}.pdf`, pdf); zip.file(`${data.numero}.json`, json);
        const blob=await zip.generateAsync({type:'blob'}); await downloadBlob(blob, `${data.numero}_pacote.zip`);
        if(statusEnvio) statusEnvio.textContent='ZIP criado com sucesso.';
      }catch(e){ console.error(e); alert('Falha ao criar ZIP.'); }
    });
    btnLink?.addEventListener('click', async ()=>{
      try{
        const data=getData(); const b64=btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        const hash=`#payload=${b64}`, base=location.href.replace(/[^/]*$/,''); const link=`${base}professor-portal.html${hash}`;
        if(campoLink) campoLink.value=link; if(campoHash) campoHash.value=hash;
        try{ await navigator.clipboard.writeText(link); if(statusEnvio) statusEnvio.textContent='Link copiado.'; }catch{ if(statusEnvio) statusEnvio.textContent='Link gerado (copie manualmente).'; }
      }catch(e){ console.error(e); alert('Falha ao gerar link/hash.'); }
    });
    fecharEnvio?.addEventListener('click', ()=> dlgEnviar?.close());

    // === Drive: enviar e pegar link público ===
    btnDrive?.addEventListener('click', async ()=>{
      try{
        if(!validate()) return;
        if(statusEnvio) statusEnvio.textContent = 'Enviando ao Google Drive...';
        const data = getData();
        const link = await enviarParaDrive(`${data.numero}.pdf`, data);
        if(campoLink) campoLink.value = link;
        if(statusEnvio) statusEnvio.textContent = 'Arquivo no Drive (público) — link gerado.';
        try{
          await navigator.clipboard.writeText(link);
          if(statusEnvio) statusEnvio.textContent += ' (link copiado)';
        }catch{
          if(statusEnvio) statusEnvio.textContent += ' (não foi possível copiar automaticamente)';
        }
      }catch(e){
        console.error(e);
        alert('Falha ao enviar para o Drive: ' + (e.message || e));
        if(statusEnvio) statusEnvio.textContent = 'Erro no envio para o Drive.';
      }
    });

  });
})();

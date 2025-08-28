// ===== Util =====
const $ = (id) => document.getElementById(id);

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  // Nº OS e Data
  $("numeroOS").value = "OS-" + String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  $("dataOS").value   = new Date().toLocaleDateString("pt-BR");

  // Botão PDF
  $("btnGerarPdf").addEventListener("click", gerarPDF);

  // Troca de acento (inovador)
  document.querySelectorAll(".accent").forEach(btn => {
    btn.addEventListener("click", () => {
      document.body.setAttribute("data-accent", btn.dataset.accent);
    });
  });
});

// ===== PDF (modelo formal semelhante ao anexo) =====
function gerarPDF(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });

  // Dados
  const os = {
    numero: $("numeroOS").value.trim(),
    data: $("dataOS").value.trim(),
    solicitante: $("solicitante").value.trim(),
    tecnico: $("tecnico").value.trim(),
    local: $("local").value.trim(),
    descricao: $("descricao").value.trim(),
    ferramentas: $("ferramentas").value.trim(),
    pecas: $("pecas").value.trim(),
    problemas: $("problemas").value.trim(),
    observacoes: $("observacoes").value.trim(),
  };

  // Cabeçalho
  doc.setFont("times","bold");
  doc.setFontSize(16);
  doc.text("ORDEM DE SERVIÇO", 105, 16, { align:"center" });

  doc.setLineWidth(0.4);
  doc.rect(10, 10, 190, 277); // moldura

  doc.setFontSize(11);
  doc.setFont("times","normal");
  doc.text(`Nº da OS: ${os.numero}`, 14, 26);
  doc.text(`Data: ${os.data}`, 160, 26);

  let y = 36;

  // Helpers
  const line = (x1,y1,x2) => doc.line(x1, y1, x2, y1);
  const wrap = (text, width) => doc.splitTextToSize(text || "", width);
  const sectionLabel = (label) => {
    doc.setFont("times","bold"); doc.text(label, 14, y);
    doc.setFont("times","normal"); y += 6;
  };
  const fieldOneLine = (label, value) => {
    const base = y;
    doc.text(`${label} ${value}`, 14, base);
    line(14, base+2.2, 196);
    y += 8.5;
  };
  const fieldMultiline = (label, value, rows=4) => {
    sectionLabel(label);
    const w = 178;
    const lines = wrap(value, w);
    for(let i=0;i<rows;i++){
      const t = lines[i] || "";
      doc.text(t, 16, y);
      line(14, y+2.2, 196);
      y += 8;
    }
    y += 2;
  };

  // Campos (padrão do anexo)
  fieldOneLine("Solicitante:", os.solicitante);
  fieldOneLine("Técnico Responsável:", os.tecnico);
  fieldOneLine("Local do Serviço:", os.local);
  fieldMultiline("Descrição do Serviço:", os.descricao, 4);
  fieldMultiline("Equipamentos/Ferramentas Utilizadas:", os.ferramentas, 3);
  fieldMultiline("Peças Substituídas:", os.pecas, 3);
  fieldMultiline("Problemas Encontrados e Soluções:", os.problemas, 4);
  fieldMultiline("Observações:", os.observacoes, 3);

  // Assinaturas
  y += 4;
  doc.text("Assinatura do Técnico:", 14, y);
  line(60, y+2.2, 196);
  y += 14;
  doc.text("Assinatura do Cliente:", 14, y);
  line(60, y+2.2, 196);

  // Salvar
  doc.save(`${os.numero}.pdf`);
}

const caixaDePdf = document.getElementById("caixaPdf");
const inputEmail = document.getElementById("inputEmail");

caixaDePdf.innerHTML = "";

// Simulação de PDFs por e-mail (normalmente viria do servidor)
const PDFsPorEmail = {
    "teste@gmail.com": [
        "https://drive.google.com/file/d/16OI8ur-lCDKuDniW30sORiYZmrr3w56F/preview",
        "documentos/21.pdf",
        "documentos/39.pdf"
    ],
    "lety.adm@gmail.com": [
        "documentos/232.pdf"
    ]
    
};

// Função para gerar cards
function gerarCards(listaPDFs) {
    caixaDePdf.innerHTML = "";

    listaPDFs.forEach((pdf, i) => {
            let card = document.createElement("div");
            card.className = "pdf-card";
        

            // Preview simplificado
            let icon = document.createElement("div");
            icon.textContent = "📄";
            icon.style.fontSize = "40px";

            // Nome
            let label = document.createElement("span");
            label.textContent = "PDF " + (i + 1);

            card.onclick = function() {
                window.open(pdf, "_blank"); 
            }

            card.appendChild(icon);
            card.appendChild(label);

            caixaDePdf.appendChild(card);
    });
}

// Função de envio de e-mail
function enviarEmail() {
    const email = inputEmail.value.trim();

    if (!email) {
        alert("Por favor, digite um e-mail.");
        return;
    }

    if (PDFsPorEmail[email]) {
        gerarCards(PDFsPorEmail[email]);
    } else {
        caixaDePdf.innerHTML = "<p id='nenhum-pdf' >Nenhum PDF encontrado para este e-mail.</p>";
    }
}
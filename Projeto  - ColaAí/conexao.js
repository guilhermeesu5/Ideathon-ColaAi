"use strict";

const formulario = document.getElementById("formulario-chave");
const campoChave = document.getElementById("campo-chave");
const estado = document.getElementById("estado");
const listaTabelas = document.getElementById("tabelas");

function mostrarEstado(texto, erro = false) {
    estado.textContent = texto;
    estado.classList.toggle("conexao__estado--erro", erro);
}

/* A chave anon não pode listar o esquema (só a secret pode), então testamos
   as tabelas e visões do modelo proposto, uma a uma. */
const TABELAS_ESPERADAS = [
    "allowed_email_domains", "profiles", "profile_contacts", "hubs", "vehicles",
    "rides", "ride_requests", "available_rides", "incoming_requests",
];

async function descreverTabela(nome) {
    const resposta = await consultarSupabase(`${nome}?select=*&limit=1`);
    if (resposta.status === 404) return `${nome}: não existe`;
    if (!resposta.ok) return `${nome}: sem acesso para a chave anon (HTTP ${resposta.status})`;
    const [linha] = await resposta.json();
    return linha ? `${nome}: ${Object.keys(linha).join(", ")}` : `${nome}: existe, mas sem linhas visíveis para a chave anon`;
}

async function testarConexao() {
    listaTabelas.replaceChildren();
    mostrarEstado("Testando…");
    try {
        const resultados = await Promise.all(TABELAS_ESPERADAS.map(descreverTabela));
        const algumaExiste = resultados.some(texto => !texto.endsWith("não existe"));
        mostrarEstado(algumaExiste ? "Conectado. Resultado por tabela:" : "A chave falou com o Supabase, mas nenhuma tabela esperada existe.", !algumaExiste);
        listaTabelas.replaceChildren(...resultados.map(texto => {
            const item = document.createElement("li");
            item.className = "conexao__tabela";
            item.textContent = texto;
            return item;
        }));
    } catch {
        mostrarEstado("Não consegui falar com o Supabase (rede ou CORS).", true);
    }
}

formulario.addEventListener("submit", evento => {
    evento.preventDefault();
    const chave = campoChave.value.trim();
    const recusa = motivoDeRecusa(chave);
    if (recusa) return mostrarEstado(recusa, true);
    if (!salvarChave(chave)) return mostrarEstado("O navegador não deixou guardar a chave.", true);
    campoChave.value = "";
    testarConexao();
});

document.getElementById("botao-apagar").addEventListener("click", () => {
    apagarChave();
    listaTabelas.replaceChildren();
    mostrarEstado("Chave apagada.");
});

if (lerChave()) {
    mostrarEstado("Já há uma chave guardada neste navegador.");
    testarConexao();
}

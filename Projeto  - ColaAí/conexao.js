"use strict";

const formulario = document.getElementById("formulario-chave");
const campoChave = document.getElementById("campo-chave");
const estado = document.getElementById("estado");
const listaTabelas = document.getElementById("tabelas");

function mostrarEstado(texto, erro = false) {
    estado.textContent = texto;
    estado.classList.toggle("conexao__estado--erro", erro);
}

function mostrarTabelas(definicoes) {
    listaTabelas.replaceChildren(...Object.entries(definicoes).map(([nome, def]) => {
        const item = document.createElement("li");
        item.className = "conexao__tabela";
        item.textContent = `${nome}: ${Object.keys(def.properties || {}).join(", ")}`;
        return item;
    }));
}

async function testarConexao() {
    listaTabelas.replaceChildren();
    mostrarEstado("Testando…");
    try {
        const resposta = await consultarSupabase("");
        if (!resposta.ok) {
            mostrarEstado(`O Supabase recusou a chave (HTTP ${resposta.status}).`, true);
            return;
        }
        const { definitions = {} } = await resposta.json();
        const quantidade = Object.keys(definitions).length;
        mostrarEstado(quantidade ? `Conectado. ${quantidade} tabela(s)/visão(ões) visíveis para a chave anon.` : "Conectado, mas a chave anon não enxerga nenhuma tabela.");
        mostrarTabelas(definitions);
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

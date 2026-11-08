"use strict";

/* Endereço do projeto no Supabase (público). A chave NÃO fica aqui:
   o Guilherme cola em conexao.html e ela vai só para o localStorage do navegador. */
const SUPABASE_URL = "https://qdrnhmddabtseviwbjqm.supabase.co";
const CHAVE_STORAGE = "colaai.supabase.chave";

function lerChave() {
    try {
        return localStorage.getItem(CHAVE_STORAGE) || "";
    } catch {
        return "";
    }
}

function salvarChave(chave) {
    try {
        localStorage.setItem(CHAVE_STORAGE, chave);
        return true;
    } catch {
        return false;
    }
}

function apagarChave() {
    try {
        localStorage.removeItem(CHAVE_STORAGE);
    } catch { /* sem armazenamento: nada a apagar */ }
}

/* Recusa a chave secreta/service_role, que ignora a RLS e nunca pode ir para o navegador. */
function motivoDeRecusa(chave) {
    if (chave.startsWith("sb_secret_")) return "Essa é a chave secret. Use a publishable (anon).";
    const partes = chave.split(".");
    if (partes.length === 3) {
        try {
            const papel = JSON.parse(atob(partes[1].replace(/-/g, "+").replace(/_/g, "/"))).role;
            if (papel === "service_role") return "Essa é a chave service_role. Use a anon.";
        } catch { /* JWT ilegível: deixa o teste de conexão decidir */ }
    }
    return "";
}

/* Chamada ao PostgREST com a chave anon. Devolve a Response. */
function consultarSupabase(caminho, opcoes = {}) {
    const chave = lerChave();
    return fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
        ...opcoes,
        headers: { apikey: chave, Authorization: `Bearer ${chave}`, ...(opcoes.headers || {}) },
    });
}

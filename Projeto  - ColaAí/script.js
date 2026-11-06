"use strict";

const CONSUMO_KM_POR_LITRO = 11;
const PRECO_LITRO = 6.3;
const PASSAGEIROS_NA_LISTA = 2;
const KG_CO2_POR_CARONA = 1.9;
const CARONAS_BASE_DO_MES = HISTORICO_SIMULADO.semanas.reduce((soma, caronas) => soma + caronas, 0);
const META_CARONAS_DO_MES = 20;
const CHAVE_TEMA = "colaai-tema";
const ESTILO_MAPA = {
    claro: "https://tiles.openfreemap.org/styles/positron",
    escuro: "https://tiles.openfreemap.org/styles/dark",
};
const CORES_DA_ROTA = {
    claro: { linha: "#0A0908", contorno: "#F2F4F3" },
    escuro: { linha: "#F2F4F3", contorno: "#0A0908" },
};
const URL_ROTAS = "https://router.project-osrm.org/route/v1/driving";
const DURACAO_AVISO_MS = 2600;
const DURACAO_DESTAQUE_MS = 1100;
const ATRASO_DA_RESPOSTA_MS = 2200;
const DURACAO_ENTRADA_MS = 1100;
const COLEGAS_QUE_RECUSAM = ["pedro"];
const PAGINAS_DO_APP = ["painel", "matches", "rateio", "impacto"];
const TARIFA_DO_ONIBUS = 5.3;
const SEMANAS_NO_MES = 4;
const KG_CO2_POR_KM = 0.12;

let mapa;
let caminhoDaRota;
const rotulosDosHubs = {};
const temporizadoresDosPedidos = {};

const estado = {
    usuario: null,
    sentido: "ida",
    turno: "manha",
    filtro: "compativeis",
    busca: "",
    selecionadoId: null,
    km: 8,
    pessoas: 2,
    dias: 5,
    consumo: CONSUMO_KM_POR_LITRO,
    preco: PRECO_LITRO,
    confirmacoes: {},
    pedidos: {},
};

const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];
const reduzMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- regras de negócio ---------- */

function emailInstitucional(email) {
    const [usuario, dominio, sobra] = email.trim().toLowerCase().split("@");
    return Boolean(usuario) && !sobra && DOMINIOS_INSTITUCIONAIS.includes(dominio);
}

function custoDaViagem(km) {
    return (km / estado.consumo) * estado.preco;
}

function rateioPorPessoa(km, passageiros) {
    return custoDaViagem(km) / (passageiros + 1);
}

function papelBuscado() {
    return estado.usuario.papel === "motorista" ? "passageiro" : "motorista";
}

function estaNoContexto(colega) {
    return colega.turno === estado.turno && colega.sentido === estado.sentido;
}

function colegasDaLista() {
    const termo = estado.busca.trim().toLowerCase();

    return COLEGAS
        .filter(colega => colega.papel === papelBuscado())
        .map(colega => ({ ...colega, compativel: estaNoContexto(colega) }))
        .filter(colega => estado.filtro === "todos" || colega.compativel)
        .filter(colega => !termo || `${colega.nome} ${colega.curso}`.toLowerCase().includes(termo))
        .sort((a, b) => Number(b.compativel) - Number(a.compativel));
}

function colegaPorId(id) {
    return COLEGAS.find(colega => colega.id === id);
}

function colegaSelecionado(lista) {
    return lista.find(colega => colega.id === estado.selecionadoId) ?? lista[0];
}

function chaveDoContexto() {
    return `${estado.sentido}-${estado.turno}-${estado.usuario.papel}`;
}

function confirmadosDoContexto() {
    const chave = chaveDoContexto();
    estado.confirmacoes[chave] ??= new Set();
    return estado.confirmacoes[chave];
}

function chaveDoColega(colega) {
    return `${colega.sentido}-${colega.turno}-${estado.usuario.papel}`;
}

function confirmadosDoColega(colega) {
    const chave = chaveDoColega(colega);
    estado.confirmacoes[chave] ??= new Set();
    return estado.confirmacoes[chave];
}

function estaAceito(colega) {
    return confirmadosDoColega(colega).has(colega.id);
}

function statusDoPedido(colega) {
    if (estaAceito(colega)) return "aceito";
    return estado.pedidos[colega.id] ?? (estado.usuario.papel === "motorista" ? "pendente" : "nenhum");
}

function resumoDosPedidos() {
    const colegas = COLEGAS.filter(colega => colega.papel === papelBuscado());
    const contar = status => colegas.filter(colega => statusDoPedido(colega) === status).length;
    return { pendente: contar("pendente"), aceito: contar("aceito"), recusado: contar("recusado") };
}

function totalDeCaronas() {
    const confirmadas = Object.values(estado.confirmacoes).reduce((soma, ids) => soma + ids.size, 0);
    return CARONAS_BASE_DO_MES + confirmadas;
}

function alternarConfirmacao(id) {
    const confirmados = confirmadosDoColega(colegaPorId(id));

    if (confirmados.has(id)) {
        confirmados.delete(id);
        delete estado.pedidos[id];
        return;
    }

    if (estado.usuario.papel === "passageiro") {
        confirmados.clear();
    } else if (confirmados.size >= estado.usuario.vagas) {
        avisar("Seu carro já está lotado neste turno.");
        return;
    }

    confirmados.add(id);
    delete estado.pedidos[id];
    avisar(`Combinado com ${colegaPorId(id).nome.split(" ")[0]}. O Pix é entre vocês.`);
}

/* ---------- formatação ---------- */

function formatarReais(valor) {
    return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function iniciais(nome) {
    return nome.trim().split(/\s+/).slice(0, 2).map(parte => parte[0]).join("").toUpperCase();
}

function primeiroNome(nome) {
    return nome.trim().split(/\s+/)[0];
}

function nomeDoEmail(email) {
    return email.split("@")[0].split(/[._-]/).filter(Boolean)
        .map(parte => parte[0].toUpperCase() + parte.slice(1)).join(" ");
}

function rotuloDoSentido() {
    return estado.sentido === "ida" ? "Ida" : "Volta";
}

function horarioDoContexto() {
    return TURNOS[estado.turno].horarios[estado.sentido];
}

/* ---------- tema ---------- */

function aplicarTema(tema) {
    document.documentElement.dataset.tema = tema;
    $$("[data-tema-botao]").forEach(botao => {
        botao.setAttribute("aria-pressed", String(botao.dataset.temaBotao === tema));
    });
    mapa?.setStyle(ESTILO_MAPA[tema], { diff: false });
    try { localStorage.setItem(CHAVE_TEMA, tema); } catch { /* armazenamento bloqueado: segue sem salvar */ }
}

function temaSalvo() {
    try { return localStorage.getItem(CHAVE_TEMA) ?? "claro"; } catch { return "claro"; }
}

/* ---------- telas ---------- */

function mostrarTela() {
    const pagina = location.hash.slice(1);
    const ehDoApp = PAGINAS_DO_APP.includes(pagina);

    if (ehDoApp && !estado.usuario) {
        location.hash = "#entrar";
        return;
    }

    $("#tela-acesso").hidden = ehDoApp;
    $("#tela-app").hidden = !ehDoApp;
    if (ehDoApp) {
        renderizarPainel();
        mostrarPagina(pagina);
    }
    window.scrollTo(0, 0);
}

function mostrarPagina(nome) {
    PAGINAS_DO_APP.forEach(pagina => {
        const idDaPagina = pagina === "painel" ? "grade-painel" : `pagina-${pagina}`;
        document.getElementById(idDaPagina).hidden = pagina !== nome;
    });
    $$("[data-pagina]").forEach(botao => botao.classList.toggle("lateral__botao--ativo", botao.dataset.pagina === nome));
    if (nome === "painel") iniciarMapa();
    animarEntradaDaPagina(nome);
}

function animarEntradaDaPagina(nome) {
    if (nome === "painel") return;

    const pagina = $(`#pagina-${nome}`);
    pagina.classList.remove("pagina--entrando");
    void pagina.offsetWidth;
    pagina.classList.add("pagina--entrando");
    setTimeout(() => pagina.classList.remove("pagina--entrando"), DURACAO_ENTRADA_MS);
}

function entrar(usuario) {
    estado.usuario = usuario;
    location.hash = "#painel";
}

function sair() {
    Object.values(temporizadoresDosPedidos).forEach(clearTimeout);
    estado.usuario = null;
    estado.selecionadoId = null;
    estado.confirmacoes = {};
    estado.pedidos = {};
    reiniciarAcesso();
    location.hash = "#entrar";
}

/* ---------- acesso: formulários, validação e envio ---------- */

const PLACA_VALIDA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

function normalizarPlaca(valor) {
    return valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const regrasDeCampo = {
    email: campo => emailInstitucional(campo.value) ? "" : "Use seu e-mail @aluno.cps.sp.gov.br ou @fatec.sp.gov.br.",
    senha: campo => campo.value.length >= 6 ? "" : "A senha precisa ter pelo menos 6 caracteres.",
    confirmar: campo => campo.value === campo.form.elements.senha.value ? "" : "As senhas precisam ser iguais.",
    nome: campo => campo.value.trim().split(/\s+/).length >= 2 ? "" : "Informe nome e sobrenome.",
    carro: campo => campo.value.trim().length >= 2 ? "" : "Informe o modelo do seu carro.",
    placa: campo => !campo.value.trim() || PLACA_VALIDA.test(normalizarPlaca(campo.value)) ? "" : "Informe a placa no formato ABC1D23.",
    termos: campo => campo.checked ? "" : "Aceite os termos para criar a conta.",
};

function mostrarErroDoCampo(campo, mensagem) {
    $(`#${campo.getAttribute("aria-describedby")}`).textContent = mensagem;
    campo.setAttribute("aria-invalid", String(Boolean(mensagem)));
}

function validarCampo(campo) {
    const mensagem = regrasDeCampo[campo.dataset.regra](campo);
    mostrarErroDoCampo(campo, mensagem);
    return !mensagem;
}

function camposVisiveisDe(formulario) {
    return $$("[data-regra]", formulario).filter(campo => !campo.closest("[hidden]"));
}

function montarUsuario(formulario) {
    const dados = new FormData(formulario);
    const email = dados.get("email");

    return {
        nome: dados.get("nome") || nomeDoEmail(email),
        email,
        papel: dados.get("perfil") ?? "passageiro",
        carro: dados.get("carro") || "Honda Civic",
        placa: normalizarPlaca(dados.get("placa") ?? ""),
        vagas: Number(dados.get("vagas") ?? 3),
    };
}

function enviarFormulario(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const campos = camposVisiveisDe(formulario);
    const validos = campos.map(validarCampo);

    if (validos.includes(false)) {
        campos[validos.indexOf(false)].focus();
        return;
    }
    entrar(montarUsuario(formulario));
}

function mostrarFormulario(nome) {
    $$("[data-formulario]").forEach(formulario => { formulario.hidden = formulario.dataset.formulario !== nome; });
    $$("[data-vitrine]").forEach(vitrine => { vitrine.hidden = vitrine.dataset.vitrine !== nome; });
}

function selecionarAba(nome) {
    mostrarFormulario(nome);
    $(`[data-formulario="${nome}"] [data-regra]`).focus();
}

function reiniciarAcesso() {
    $$(".formulario").forEach(formulario => formulario.reset());
    $$("[data-regra]").forEach(campo => mostrarErroDoCampo(campo, ""));
    $("#dados-carro").hidden = true;
    mostrarFormulario("entrar");
}

function alternarSenha(botao) {
    const campo = $(`#${botao.dataset.mostrarSenha}`);
    const visivel = campo.type === "password";
    campo.type = visivel ? "text" : "password";
    botao.setAttribute("aria-pressed", String(visivel));
    botao.setAttribute("aria-label", visivel ? "Ocultar senha" : "Mostrar senha");
    $("use", botao).setAttribute("href", visivel ? "#icone-olho-fechado" : "#icone-olho");
}

function ligarAcesso() {
    $$("[data-aba]").forEach(aba => aba.addEventListener("click", () => selecionarAba(aba.dataset.aba)));
    $$("[data-aviso]").forEach(botao => botao.addEventListener("click", () => avisar(botao.dataset.aviso)));
    $$(".formulario").forEach(formulario => formulario.addEventListener("submit", enviarFormulario));
    $$("[data-regra]").forEach(campo => campo.addEventListener("blur", () => campo.value && campo.type !== "checkbox" && validarCampo(campo)));
    $$("[data-mostrar-senha]").forEach(botao => botao.addEventListener("click", () => alternarSenha(botao)));
    $$("input[name='perfil']").forEach(opcao => opcao.addEventListener("change", () => {
        $("#dados-carro").hidden = opcao.value !== "motorista";
    }));
}

/* ---------- painel: renderização ---------- */

function renderizarPainel() {
    renderizarUsuario();
    renderizarModo();
    renderizarContexto();
    renderizarMatches();
    renderizarCarro();
    renderizarCarona();
    renderizarRateio();
    renderizarImpacto();
    renderizarPaginaMatches();
    renderizarPaginaRateio();
    renderizarPaginaImpacto();
    renderizarMapa();
}

function renderizarUsuario() {
    const { nome } = estado.usuario;
    $("#usuario-nome").textContent = primeiroNome(nome);
    $("#usuario-avatar").textContent = iniciais(nome);

    const hoje = new Date();
    const data = $("#usuario-data");
    data.dateTime = hoje.toISOString().slice(0, 10);
    data.textContent = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(hoje).replace(" de ", " ");
}

function renderizarModo() {
    const motorista = estado.usuario.papel === "motorista";
    $("#interruptor-motorista").checked = motorista;
    $("#modo-descricao").textContent = motorista ? "Você aparece como motorista" : "Procurando carona";
}

function marcarBotoes(seletor, atributo, valorAtivo) {
    $$(seletor).forEach(botao => botao.setAttribute("aria-pressed", String(botao.dataset[atributo] === valorAtivo)));
}

function renderizarContexto() {
    marcarBotoes("[data-turno]", "turno", estado.turno);
    marcarBotoes("[data-sentido]", "sentido", estado.sentido);
    marcarBotoes("[data-filtro]", "filtro", estado.filtro);

    Object.entries(TURNOS).forEach(([turno, dados]) => {
        $(`[data-hora-turno="${turno}"]`).textContent = dados.horarios[estado.sentido];
    });
    $("#hubs-sentido").textContent = rotuloDoSentido();
    $("#hubs-papel").textContent = estado.sentido === "ida" ? "Destino" : "Saída";
    $("#hubs-horario").textContent = horarioDoContexto();
}

function modeloDaLinha(colega, confirmados) {
    const confirmado = confirmados.has(colega.id);
    const selecionado = colega.id === estado.selecionadoId;
    const classes = [
        "matches__item",
        confirmado && "matches__item--confirmado",
        selecionado && "matches__item--selecionado",
        !colega.compativel && "matches__item--incompativel",
    ].filter(Boolean).join(" ");
    const turno = TURNOS[colega.turno];
    const sentido = colega.sentido === "ida" ? "Ida" : "Volta";
    const pedido = estado.pedidos[colega.id];
    const aguardando = estado.usuario.papel === "passageiro" && !confirmado && ["pendente", "recusado"].includes(pedido);
    const rotuloAcao = confirmado ? "Combinado"
        : aguardando ? (pedido === "pendente" ? "Pendente" : "Recusado")
        : colega.compativel ? "Combinar" : "Outro turno";

    return `
        <li class="${classes}">
            <button class="matches__colega" type="button" data-selecionar="${colega.id}" aria-pressed="${selecionado}">
                <span class="avatar" aria-hidden="true">${iniciais(colega.nome)}</span>
                <span class="matches__dados">
                    <strong class="matches__nome">${colega.nome}</strong>
                    <span class="matches__detalhe">${colega.curso}</span>
                </span>
            </button>
            <span class="matches__horario">${turno.horarios[colega.sentido]}<small>${sentido} · ${turno.rotulo}</small></span>
            <span class="matches__rateio">${formatarReais(rateioPorPessoa(colega.km, PASSAGEIROS_NA_LISTA))}<small>por pessoa</small></span>
            <button class="matches__acao" type="button" data-confirmar="${colega.id}" aria-pressed="${confirmado}" ${colega.compativel && !aguardando ? "" : "disabled"}>${rotuloAcao}</button>
        </li>`;
}

function modeloDoVazio() {
    const busca = estado.busca.trim();
    const motivo = busca
        ? `Nada encontrado para “${busca.replace(/[<>&"]/g, "")}”.`
        : `Ninguém no mesmo hub, sentido e turno ainda.`;
    return `<li class="matches__vazio"><strong>Sem matches por aqui</strong>${motivo} Tente outro turno ou veja “Todos”.</li>`;
}

function renderizarMatches() {
    const lista = colegasDaLista();
    estado.selecionadoId = colegaSelecionado(lista)?.id ?? null;
    const confirmados = confirmadosDoContexto();

    $("#lista-matches").innerHTML = lista.length
        ? lista.map(colega => modeloDaLinha(colega, confirmados)).join("")
        : modeloDoVazio();
}

/* ---------- página de Impacto ---------- */

const NOMES_DAS_SEMANAS = ["Sem. 1", "Sem. 2", "Sem. 3", "Sem. 4 (atual)"];

function caronasConfirmadas() {
    return totalDeCaronas() - CARONAS_BASE_DO_MES;
}

function caronasPorSemana() {
    const semanas = [...HISTORICO_SIMULADO.semanas];
    semanas[semanas.length - 1] += caronasConfirmadas();
    return semanas;
}

function caronasPorTurno() {
    const turnos = { ...HISTORICO_SIMULADO.turnos };
    Object.entries(estado.confirmacoes).forEach(([chave, ids]) => {
        const [, turno] = chave.split("-");
        turnos[turno] += ids.size;
    });
    return turnos;
}

function economiaPorCarona() {
    const ida = TARIFA_DO_ONIBUS - rateioPorPessoa(estado.km, estado.pessoas);
    return Math.max(0, 2 * ida);
}

function formatarNumero(valor, casas = 1) {
    return valor.toLocaleString("pt-BR", { maximumFractionDigits: casas });
}

function premissasDoImpacto() {
    return [
        ["Emissão evitada por carona", `${formatarNumero(KG_CO2_POR_CARONA)} kg de CO₂`, "viagem de 8 km, ida e volta, a 0,12 kg por km"],
        ["Economia por carona", formatarReais(economiaPorCarona()), "ônibus, ida e volta, menos o seu rateio"],
        ["Tarifa do ônibus", formatarReais(TARIFA_DO_ONIBUS), "Canvas do Problema (TUA)"],
        ["Meta do mês", `${META_CARONAS_DO_MES} caronas`, "definida pelo projeto"],
        ["Caronas de base", `${CARONAS_BASE_DO_MES} caronas`, "dados simulados do mês"],
    ];
}

const ICONES_DOS_TURNOS = { manha: "nascer", tarde: "sol", noite: "lua" };

const METRICAS_DO_GRAFICO = {
    caronas: {
        fator: () => 1,
        texto: valor => `${valor} ${valor === 1 ? "carona" : "caronas"}`,
        eixo: valor => valor,
    },
    co2: {
        fator: () => KG_CO2_POR_CARONA,
        texto: valor => `${formatarNumero(valor)} kg de CO₂`,
        eixo: valor => `${formatarNumero(valor, 0)} kg`,
    },
    economia: {
        fator: economiaPorCarona,
        texto: formatarReais,
        eixo: valor => `R$ ${formatarNumero(valor, 0)}`,
    },
};

const LARGURA_DA_CURVA = 400;
const grafico = { metrica: "caronas", semana: NOMES_DAS_SEMANAS.length - 1 };

function modeloDoTurnoDoImpacto([turno, valor], total) {
    const { rotulo, horarios } = TURNOS[turno];
    const parte = total ? Math.round(valor / total * 100) : 0;
    return `
        <li class="impacto-turnos__item">
            <span class="impacto-turnos__icone"><svg class="icone"><use href="#icone-${ICONES_DOS_TURNOS[turno]}"/></svg></span>
            <span class="impacto-turnos__nome">${rotulo}<small>${horarios.ida} · ${horarios.volta}</small></span>
            <span class="impacto-turnos__valor">${valor}<small>${parte}% das caronas</small></span>
        </li>`;
}

/* Eixo vertical com marcas "redondas" (1, 2, 5, 10…) e um respiro acima do maior valor. */
function limitesDoEixo(maior) {
    const bruto = maior / 4 || 1;
    const potencia = 10 ** Math.floor(Math.log10(bruto));
    const passo = [1, 2, 5, 10].map(fator => fator * potencia).find(valor => valor >= bruto);
    let topo = Math.ceil(maior / passo) * passo || passo;
    if (topo < maior * 1.1) topo += passo;
    return { passo, topo };
}

function pontosDaCurva(valores, topo) {
    return valores.map((valor, indice) => ({
        x: (indice + 0.5) / valores.length * LARGURA_DA_CURVA,
        y: 100 - valor / topo * 100,
    }));
}

/* Curva suave (Catmull-Rom convertida em Bézier) passando por todos os pontos. */
function caminhoSuave(pontos) {
    const limitar = y => Math.min(Math.max(y, 0), 100);
    return pontos.slice(1).reduce((caminho, atual, indice) => {
        const anterior = pontos[indice - 1] ?? pontos[indice];
        const inicio = pontos[indice];
        const proximo = pontos[indice + 2] ?? atual;
        const controleA = [inicio.x + (atual.x - anterior.x) / 6, limitar(inicio.y + (atual.y - anterior.y) / 6)];
        const controleB = [atual.x - (proximo.x - inicio.x) / 6, limitar(atual.y - (proximo.y - inicio.y) / 6)];
        return `${caminho} C${controleA} ${controleB} ${atual.x},${atual.y}`;
    }, `${pontos[0].x},${pontos[0].y}`);
}

function modeloDoPontoDoGrafico(ponto, indice, texto) {
    return `<button class="grafico__ponto" type="button" data-semana="${indice}" data-texto="${texto}" style="--x: ${ponto.x / LARGURA_DA_CURVA}; --y: ${ponto.y / 100}" aria-label="${NOMES_DAS_SEMANAS[indice]}: ${texto}"></button>`;
}

function modeloDaPremissa([rotulo, valor, detalhe]) {
    return `<li class="premissa"><span>${rotulo}<small>${detalhe}</small></span><strong>${valor}</strong></li>`;
}

function renderizarIndicadores() {
    const total = totalDeCaronas();
    const progresso = Math.min(total / META_CARONAS_DO_MES, 1);
    const faltam = Math.max(META_CARONAS_DO_MES - total, 0);

    $("#imp-caronas").textContent = total;
    $("#imp-caronas-detalhe").textContent = `${caronasConfirmadas()} combinadas por você`;
    $("#imp-co2").textContent = `${formatarNumero(total * KG_CO2_POR_CARONA, 0)} kg`;
    $("#imp-economia").textContent = formatarReais(total * economiaPorCarona());
    $("#imp-co2-carona").textContent = `${formatarNumero(KG_CO2_POR_CARONA)} kg`;
    $("#imp-economia-carona").textContent = formatarReais(economiaPorCarona());
    $("#imp-meta").textContent = `${Math.round(progresso * 100)}%`;
    $("#imp-meta-detalhe").textContent = faltam ? `Faltam ${faltam} para a meta de ${META_CARONAS_DO_MES}` : "Meta do mês atingida";
    $("#imp-meta-barra").style.setProperty("--proporcao", progresso);
}

function destacarSemana(indice) {
    grafico.semana = indice;
    const pontos = $$("#imp-pontos .grafico__ponto");
    pontos.forEach((ponto, posicao) => ponto.classList.toggle("grafico__ponto--ativo", posicao === indice));

    const ativo = pontos[indice];
    const area = $("#imp-area");
    area.style.setProperty("--x", ativo.style.getPropertyValue("--x"));
    area.style.setProperty("--y", ativo.style.getPropertyValue("--y"));
    $("#imp-dica").innerHTML = `<small>${NOMES_DAS_SEMANAS[indice]}</small><strong>${ativo.dataset.texto}</strong>`;
    $("#imp-dica").classList.toggle("grafico__dica--abaixo", Number(ativo.style.getPropertyValue("--y")) < 0.4);
}

function renderizarGraficoDeEvolucao() {
    const metrica = METRICAS_DO_GRAFICO[grafico.metrica];
    const fator = metrica.fator();
    const valores = caronasPorSemana().map(caronas => caronas * fator);
    const { passo, topo } = limitesDoEixo(Math.max(...valores));
    const pontos = pontosDaCurva(valores, topo);
    const linha = `M0,${pontos[0].y} L${caminhoSuave(pontos)} L${LARGURA_DA_CURVA},${pontos.at(-1).y}`;

    $("#imp-linha").setAttribute("d", linha);
    $("#imp-preenchimento").setAttribute("d", `${linha} L${LARGURA_DA_CURVA},100 L0,100 Z`);

    const marcas = Array.from({ length: Math.round(topo / passo) + 1 }, (_, indice) => indice * passo);
    $("#imp-grade").innerHTML = marcas.map(valor => `<i style="--posicao: ${valor / topo}"></i>`).join("");
    $("#imp-eixo").innerHTML =marcas.map(valor => `<li style="--posicao: ${valor / topo}">${metrica.eixo(valor)}</li>`).join("");
    $("#imp-semanas").innerHTML = NOMES_DAS_SEMANAS.map(nome => `<li>${nome}</li>`).join("");
    $("#imp-pontos").innerHTML = pontos.map((ponto, indice) => modeloDoPontoDoGrafico(ponto, indice, metrica.texto(valores[indice]))).join("");
    destacarSemana(grafico.semana);

    const area = $("#imp-area");
    area.classList.remove("grafico__area--revelando");
    void area.offsetWidth;
    area.classList.add("grafico__area--revelando");
}

function trocarMetricaDoGrafico(nome) {
    grafico.metrica = nome;
    $$("[data-metrica]").forEach(botao => {
        const ativa = botao.dataset.metrica === nome;
        botao.classList.toggle("pilula--ativa", ativa);
        botao.setAttribute("aria-pressed", String(ativa));
    });
    renderizarGraficoDeEvolucao();
}

function alternarCalculo() {
    const painel = $("#imp-calculo");
    painel.hidden = !painel.hidden;
    $("#imp-calculo-botao").setAttribute("aria-expanded", String(!painel.hidden));
    $("#imp-calculo-botao").classList.toggle("pilula--ativa", !painel.hidden);
    if (!painel.hidden) painel.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function renderizarGraficos() {
    const turnos = caronasPorTurno();
    const total = Object.values(turnos).reduce((soma, valor) => soma + valor, 0);
    $("#imp-turnos").innerHTML = Object.entries(turnos).map(turno => modeloDoTurnoDoImpacto(turno, total)).join("");
    renderizarGraficoDeEvolucao();
}

function renderizarPaginaImpacto() {
    renderizarIndicadores();
    renderizarGraficos();
    $("#imp-premissas").innerHTML = premissasDoImpacto().map(modeloDaPremissa).join("");
}

/* ---------- página de Rateio ---------- */

const CONTROLES_DA_CALCULADORA = ["km", "pessoas", "dias", "consumo", "preco"];
const FORMATO_DAS_SAIDAS = {
    km: valor => `${valor} km`,
    pessoas: valor => valor,
    dias: valor => `${valor} dias`,
    consumo: valor => `${valor} km/L`,
    preco: valor => formatarReais(valor),
};

function viagensPorMes() {
    return estado.dias * SEMANAS_NO_MES * 2;
}

function valorDoRateioNoMes() {
    return viagensPorMes() * rateioPorPessoa(estado.km, estado.pessoas);
}

function co2EvitadoNoMes() {
    return estado.km * 2 * estado.dias * SEMANAS_NO_MES * KG_CO2_POR_KM;
}

function comparativoDoUsuario() {
    if (estado.usuario.papel === "motorista") {
        const combustivel = custoDaViagem(estado.km) * viagensPorMes();
        const recebido = valorDoRateioNoMes() * estado.pessoas;
        return {
            titulo: "Quanto o combustível pesa",
            linhas: [
                { rotulo: "Combustível no mês", valor: combustivel },
                { rotulo: "Você recebe dos colegas", valor: recebido },
            ],
            resumo: `Seu custo no mês cai para ${formatarReais(combustivel - recebido)}.`,
            nota: "Considera ida e volta nos dias escolhidos, com todas as vagas ocupadas.",
        };
    }

    const onibus = viagensPorMes() * TARIFA_DO_ONIBUS;
    const carona = valorDoRateioNoMes();
    const diferenca = onibus - carona;
    return {
        titulo: "Comparado ao ônibus",
        linhas: [
            { rotulo: "Ônibus no mês", valor: onibus },
            { rotulo: "Carona no mês", valor: carona },
        ],
        resumo: diferenca >= 0
            ? `Você economiza ${formatarReais(diferenca)} por mês.`
            : `No ColaAí você paga ${formatarReais(-diferenca)} a mais por mês.`,
        nota: `Ônibus: tarifa de ${formatarReais(TARIFA_DO_ONIBUS)} (Canvas do Problema), ida e volta.`,
    };
}

function modeloDaLinhaDoComparativo({ rotulo, valor }, maior, formatar = formatarReais) {
    const proporcao = maior ? valor / maior : 0;
    return `
        <li class="comparativo__linha">
            <span>${rotulo}</span>
            <strong>${formatar(valor)}</strong>
            <span class="comparativo__barra"><i data-proporcao="${proporcao}"></i></span>
        </li>`;
}

function combinadosDoUsuario() {
    return COLEGAS.filter(colega => colega.papel === papelBuscado() && estaAceito(colega));
}

function modeloDoCombinado(colega) {
    const turno = TURNOS[colega.turno];
    const sentido = colega.sentido === "ida" ? "Ida" : "Volta";
    const valor = rateioPorPessoa(colega.km, PASSAGEIROS_NA_LISTA);

    return `
        <li class="combinado">
            <span class="avatar" aria-hidden="true">${iniciais(colega.nome)}</span>
            <span class="combinado__pessoa">
                <strong>${colega.nome}</strong>
                <small>${sentido} · ${turno.rotulo} · ${turno.horarios[colega.sentido]}</small>
            </span>
            <strong class="combinado__valor">${formatarReais(valor)}</strong>
            <button class="combinado__copiar" type="button" data-copiar="${colega.id}" aria-label="Copiar o valor de ${colega.nome}">Copiar</button>
        </li>`;
}

function modeloDoSemCombinados() {
    return `
        <li class="combinados__vazio">
            Nenhuma carona combinada ainda.
            <button class="formulario__link" type="button" data-pagina="matches">Ver matches</button>
        </li>`;
}

function renderizarCalculadora() {
    const rateio = rateioPorPessoa(estado.km, estado.pessoas);

    CONTROLES_DA_CALCULADORA.forEach(chave => {
        ajustarFaixa($(`#rp-${chave}`), estado[chave]);
        $(`#rp-saida-${chave}`).textContent = FORMATO_DAS_SAIDAS[chave](estado[chave]);
    });

    $("#rp-numero").textContent = formatarReais(rateio);
    $("#rp-detalhe").textContent = `Viagem de ${formatarReais(custoDaViagem(estado.km))} dividida em ${estado.pessoas + 1} pessoas`;
    $("#rp-mes").textContent = `${formatarReais(valorDoRateioNoMes())} por mês`;
    $("#rp-mes-detalhe").textContent = `${viagensPorMes()} viagens, ida e volta em ${estado.dias} dias por semana`;

    const partes = ['<span class="rateio__parte rateio__parte--motorista"></span>']
        .concat(Array.from({ length: estado.pessoas }, () => '<span class="rateio__parte"></span>'));
    $("#rp-divisao").innerHTML = partes.join("");
}

function renderizarComparativo() {
    const comparativo = comparativoDoUsuario();
    const maior = Math.max(...comparativo.linhas.map(linha => linha.valor));

    $("#comp-titulo").textContent = comparativo.titulo;
    $("#comp-linhas").innerHTML = comparativo.linhas.map(linha => modeloDaLinhaDoComparativo(linha, maior)).join("");
    $$("#comp-linhas [data-proporcao]").forEach(barra => barra.style.setProperty("--proporcao", barra.dataset.proporcao));
    $("#comp-resumo").textContent = comparativo.resumo;
    $("#comp-nota").textContent = comparativo.nota;
    $("#comp-co2").textContent = `${Math.round(co2EvitadoNoMes())} kg de CO₂ evitados por mês, com ${KG_CO2_POR_KM.toString().replace(".", ",")} kg por km`;
}

function renderizarCombinados() {
    const motorista = estado.usuario.papel === "motorista";
    const combinados = combinadosDoUsuario();
    const total = combinados.reduce((soma, colega) => soma + rateioPorPessoa(colega.km, PASSAGEIROS_NA_LISTA), 0);

    $("#combinados-titulo").textContent = motorista ? "Pix dos passageiros" : "Pix para o motorista";
    $("#combinados-lista").innerHTML = combinados.length ? combinados.map(modeloDoCombinado).join("") : modeloDoSemCombinados();
    $("#combinados-total").hidden = !motorista || combinados.length < 2;
    $("#combinados-total-valor").textContent = formatarReais(total);
}

function renderizarPaginaRateio() {
    renderizarCalculadora();
    renderizarComparativo();
    renderizarCombinados();
}

async function copiarValor(id) {
    const valor = rateioPorPessoa(colegaPorId(id).km, PASSAGEIROS_NA_LISTA).toFixed(2).replace(".", ",");
    try {
        await navigator.clipboard.writeText(valor);
        avisar(`Valor copiado: R$ ${valor}`);
    } catch {
        avisar(`Não consegui copiar. O valor é R$ ${valor}.`);
    }
}

/* ---------- página de Matches ---------- */

const ROTULOS_DO_STATUS = {
    passageiro: { nenhum: "Disponível", pendente: "Aguardando", aceito: "Aceito", recusado: "Recusado" },
    motorista: { nenhum: "Disponível", pendente: "Pediu carona", aceito: "Aceito", recusado: "Recusado" },
};

const NUMERO_DE_WHATSAPP = /^55\d{10,11}$/;

/* Click to Chat: com número válido em dados.js abre a conversa com o colega;
   sem número, abre o WhatsApp só com a mensagem, para escolher o contato. */
function urlDoWhatsapp(colega) {
    const numero = String(colega.whatsapp || "").replace(/\D/g, "");
    const destino = NUMERO_DE_WHATSAPP.test(numero) ? numero : "";
    const horario = TURNOS[colega.turno].horarios[colega.sentido];
    const texto = `Oi, ${primeiroNome(colega.nome)}! Combinamos a carona pelo ColaAí (${horario}). Vamos acertar o Pix?`;
    return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`;
}

function abrirWhatsApp(id) {
    const colega = colegaPorId(id);
    if (!colega) return avisar("Colega não encontrado.");
    window.open(urlDoWhatsapp(colega), "_blank", "noopener,noreferrer");
}

function modeloDasAcoes(colega, status) {
    const id = colega.id;
    const motorista = estado.usuario.papel === "motorista";
    const botao = (atributo, texto, classe) =>
        `<button class="botao ${classe}" type="button" data-${atributo}="${id}">${texto}</button>`;
    const whatsapp = botao("whatsapp", "Chamar no WhatsApp", "botao--primario");

    if (!colega.compativel) return `<button class="botao botao--contorno" type="button" disabled>Outro turno</button>`;
    if (status === "aceito") return whatsapp + botao("cancelar", motorista ? "Desfazer" : "Cancelar", "botao--contorno");
    if (motorista) {
        return status === "recusado"
            ? botao("aceitar", "Aceitar mesmo assim", "botao--contorno")
            : botao("aceitar", "Aceitar", "botao--primario") + botao("recusar", "Recusar", "botao--contorno");
    }
    if (status === "pendente") return botao("cancelar", "Cancelar pedido", "botao--contorno");
    return botao("pedir", status === "recusado" ? "Pedir de novo" : "Deixa eu colar!", "botao--primario");
}

function modeloDoPedido(colega) {
    const status = statusDoPedido(colega);
    const motorista = estado.usuario.papel === "motorista";
    const turno = TURNOS[colega.turno];
    const sentido = colega.sentido === "ida" ? "Ida" : "Volta";
    const selo = colega.compativel ? ROTULOS_DO_STATUS[estado.usuario.papel][status] : "Outro turno";
    const classeDoSelo = colega.compativel ? `pedido__selo--${status}` : "";
    const classes = ["pedido", `pedido--${status}`, !colega.compativel && "pedido--incompativel"].filter(Boolean).join(" ");
    const detalheDoCarro = motorista
        ? `<div><dt>Distância</dt><dd>${colega.km} km</dd></div>`
        : `<div><dt>Carro</dt><dd>${colega.carro} · ${colega.cor}</dd></div>`;
    const vagas = motorista ? "" : `<div><dt>Vagas</dt><dd>${colega.vagas} livres</dd></div>`;

    return `
        <li class="${classes}" data-pedido="${colega.id}">
            <div class="pedido__topo">
                <span class="avatar" aria-hidden="true">${iniciais(colega.nome)}</span>
                <div class="pedido__pessoa">
                    <strong>${colega.nome}</strong>
                    <span>${colega.curso}</span>
                </div>
                <span class="pedido__selo ${classeDoSelo}">${selo}</span>
            </div>
            <dl class="pedido__dados">
                <div><dt>Horário</dt><dd>${turno.horarios[colega.sentido]} · ${sentido}</dd></div>
                <div><dt>${colega.sentido === "ida" ? "Destino" : "Saída"}</dt><dd>FATEC</dd></div>
                ${detalheDoCarro}
                ${vagas}
                <div><dt>Rateio</dt><dd>${formatarReais(rateioPorPessoa(colega.km, PASSAGEIROS_NA_LISTA))} por pessoa</dd></div>
            </dl>
            <div class="pedido__acoes">${modeloDasAcoes(colega, status)}</div>
        </li>`;
}

function renderizarPaginaMatches() {
    const resumo = resumoDosPedidos();
    const motorista = estado.usuario.papel === "motorista";

    $("#resumo-pendentes").textContent = resumo.pendente;
    $("#resumo-aceitos").textContent = resumo.aceito;
    $("#resumo-recusados").textContent = resumo.recusado;
    $("#pagina-matches-texto").textContent = motorista
        ? "Pedidos de carona dos colegas para o seu carro. Aceite quem você puder levar."
        : "Caronas de colegas até a FATEC. Peça uma e, quando o motorista aceitar, chame no WhatsApp.";

    const lista = colegasDaLista();
    $("#lista-pedidos").innerHTML = lista.length ? lista.map(modeloDoPedido).join("") : modeloDoVazio();
}

function fotoDoCarro(nome) {
    const modelo = nome.toLowerCase();
    return FOTOS_DOS_CARROS.find(foto => modelo.includes(foto.modelo))?.arquivo ?? null;
}

function dadosDoCarro() {
    const { usuario } = estado;
    const confirmados = confirmadosDoContexto();

    if (usuario.papel === "motorista") {
        return {
            nome: usuario.carro,
            foto: fotoDoCarro(usuario.carro),
            placa: usuario.placa,
            dono: "Seu carro · você dirige",
            vagasLivres: usuario.vagas - confirmados.size,
        };
    }

    const motorista = colegaPorId(estado.selecionadoId);
    if (!motorista) return { nome: "Sem motorista", dono: "Nenhum motorista nesta busca", placa: "", vagasLivres: 0 };

    return {
        nome: motorista.carro,
        foto: fotoDoCarro(motorista.carro),
        placa: motorista.placa,
        dono: `${motorista.cor} · de ${motorista.nome}`,
        vagasLivres: motorista.vagas - (confirmados.has(motorista.id) ? 1 : 0),
    };
}

function mostrarFotoDoCarro({ nome, foto }) {
    const imagem = $("#carro-foto");

    if (foto) {
        imagem.src = `./assets/carros/${foto}`;
        imagem.alt = nome;
    }
    imagem.hidden = !foto;
    $(".carro__desenho").hidden = Boolean(foto);
    $(".carro__palco").classList.toggle("carro__palco--foto", Boolean(foto));
}

function renderizarCarro() {
    const carro = dadosDoCarro();
    $("#carro-nome").textContent = carro.nome;
    $("#carro-dono").textContent = carro.dono;
    mostrarFotoDoCarro(carro);

    $("#carro-numero").textContent = carro.vagasLivres;
    $("#carro-vagas").setAttribute("aria-label", `${carro.vagasLivres} vagas livres`);

    const placa = $("#carro-placa");
    placa.classList.toggle("carro__placa--vazia", !carro.placa);
    $("#carro-placa-texto").textContent = carro.placa || "Sem placa";
    placa.setAttribute("aria-label", carro.placa ? `Placa ${carro.placa}` : "Placa não informada");
}

function montarAssentos() {
    const { usuario } = estado;
    const confirmados = [...confirmadosDoContexto()].map(colegaPorId);
    const livres = quantidade => Array.from({ length: Math.max(quantidade, 0) }, () => ({ tipo: "livre", nome: "Livre" }));

    if (usuario.papel === "motorista") {
        return [
            { tipo: "motorista", nome: "Você" },
            ...confirmados.map(colega => ({ tipo: "ocupado", nome: primeiroNome(colega.nome) })),
            ...livres(usuario.vagas - confirmados.length),
        ];
    }

    const [motorista] = confirmados;
    if (!motorista) return livres(4);

    return [
        { tipo: "motorista", nome: primeiroNome(motorista.nome) },
        { tipo: "ocupado", nome: "Você" },
        ...livres(motorista.vagas - 1),
    ];
}

function modeloDoAssento({ tipo, nome }) {
    const icone = { motorista: "icone-carro", ocupado: "icone-usuarios" }[tipo];
    const figura = icone ? `<svg class="icone"><use href="#${icone}"/></svg>` : "";
    return `<li class="assento assento--${tipo}">${figura}<span class="assento__nome">${nome}</span></li>`;
}

function textoDosLugares(confirmados) {
    if (!confirmados.length) return "Nada combinado";
    if (estado.usuario.papel === "passageiro") return `Você vai com ${primeiroNome(confirmados[0].nome)}`;
    return `${confirmados.length} de ${estado.usuario.vagas} vagas ocupadas`;
}

function renderizarCarona() {
    const confirmados = [...confirmadosDoContexto()].map(colegaPorId);

    $("#carona-contexto").textContent = `${rotuloDoSentido()} · ${TURNOS[estado.turno].rotulo}`;
    $("#carona-hora").textContent = horarioDoContexto();
    $("#carona-destino").textContent = estado.sentido === "ida" ? "Rumo à FATEC" : "Saindo da FATEC";
    $("#assentos").innerHTML = montarAssentos().map(modeloDoAssento).join("");
    $("#carona-lugares").textContent = textoDosLugares(confirmados);
    $("#carona-desfazer").disabled = !confirmados.length;
}

function renderizarRateio() {
    const { km, pessoas } = estado;
    const custo = custoDaViagem(km);

    $("#rateio-numero").textContent = formatarReais(rateioPorPessoa(km, pessoas));
    $("#rateio-detalhe").textContent = `Viagem de ${formatarReais(custo)} ÷ ${pessoas + 1} pessoas · Pix, sem taxa`;
    $("#saida-km").textContent = `${km} km`;
    $("#saida-pessoas").textContent = pessoas;

    const partes = ['<span class="rateio__parte rateio__parte--motorista"></span>']
        .concat(Array.from({ length: pessoas }, () => '<span class="rateio__parte"></span>'));
    $("#rateio-divisao").innerHTML = partes.join("");

    ajustarFaixa($("#faixa-km"), km);
    ajustarFaixa($("#faixa-pessoas"), pessoas);
}

function ajustarFaixa(faixa, valor) {
    faixa.value = valor;
    const progresso = ((faixa.value - faixa.min) / (faixa.max - faixa.min)) * 100;
    faixa.style.setProperty("--progresso", `${progresso}%`);
}

function renderizarRateios() {
    renderizarRateio();
    renderizarPaginaRateio();
}

function renderizarImpacto() {
    const total = totalDeCaronas();
    $("#impacto-caronas").textContent = total;
    $("#impacto-co2").textContent = `${Math.round(total * KG_CO2_POR_CARONA)} kg`;
    $("#impacto-bateria").style.setProperty("--nivel", Math.min(total / META_CARONAS_DO_MES, 1));
}

/* ---------- mapa real (MapLibre + OpenFreeMap/OpenStreetMap) ---------- */

function modeloDoMarcador(hub) {
    const emBreve = !hub.ativo && !hub.casa;
    const rotulo = emBreve ? `${hub.nome}<small>em breve</small>` : hub.nome;
    const situacao = hub.casa ? "pino--casa" : hub.ativo ? "pino--ativo" : "pino--breve";
    const icone = hub.casa ? "icone-casa" : "icone-pino";
    return `
        <span class="pino ${situacao}">
            <span class="pino__ponto"><svg class="icone"><use href="#${icone}"/></svg></span>
            <span class="pino__rotulo">${rotulo}</span>
        </span>`;
}

function adicionarMarcador(hub) {
    const elemento = document.createElement("button");
    elemento.type = "button";
    elemento.className = "marcador";
    elemento.setAttribute("aria-label", hub.casa ? hub.nome : hub.ativo ? `Hub ${hub.nome}` : `Hub ${hub.nome}, em breve`);
    elemento.innerHTML = modeloDoMarcador(hub);
    rotulosDosHubs[hub.id] = $(".pino__rotulo", elemento);

    if (!hub.ativo && !hub.casa) {
        elemento.addEventListener("click", () => avisar(`O hub ${hub.nome} chega em breve. Nesta versão, só a FATEC está ativa.`));
    }
    new maplibregl.Marker({ element: elemento }).setLngLat([hub.lng, hub.lat]).addTo(mapa);
}

function hubAtivo() {
    return HUBS.find(hub => hub.ativo);
}

async function buscarRotaPelasRuas() {
    const coordenadas = [CASA, hubAtivo()].map(ponto => `${ponto.lng},${ponto.lat}`).join(";");
    const resposta = await fetch(`${URL_ROTAS}/${coordenadas}?overview=full&geometries=geojson`);
    if (!resposta.ok) throw new Error("Serviço de rotas indisponível");

    const { routes } = await resposta.json();
    return routes[0].geometry.coordinates;
}

async function carregarRota() {
    const linhaReta = [CASA, hubAtivo()].map(ponto => [ponto.lng, ponto.lat]);
    caminhoDaRota = await buscarRotaPelasRuas().catch(() => linhaReta);
    desenharRota();
}

function caminhoNoSentido() {
    return estado.sentido === "ida" ? caminhoDaRota : [...caminhoDaRota].reverse();
}

function dadosDaRota() {
    return { type: "Feature", geometry: { type: "LineString", coordinates: caminhoNoSentido() } };
}

function criarImagemDaSeta(cor) {
    const tamanho = 24;
    const tela = document.createElement("canvas");
    tela.width = tela.height = tamanho;

    const contexto = tela.getContext("2d");
    contexto.strokeStyle = cor;
    contexto.lineWidth = 4;
    contexto.lineCap = "round";
    contexto.lineJoin = "round";
    contexto.beginPath();
    contexto.moveTo(9, 6);
    contexto.lineTo(16, 12);
    contexto.lineTo(9, 18);
    contexto.stroke();
    return contexto.getImageData(0, 0, tamanho, tamanho);
}

function desenharRota() {
    if (!caminhoDaRota || mapa.getSource("rota")) return;

    const cores = CORES_DA_ROTA[document.documentElement.dataset.tema];
    const tracoArredondado = { "line-cap": "round", "line-join": "round" };

    mapa.addSource("rota", { type: "geojson", data: dadosDaRota() });
    mapa.addImage("seta", criarImagemDaSeta(cores.contorno));
    mapa.addLayer({ id: "rota-contorno", type: "line", source: "rota", layout: tracoArredondado,
        paint: { "line-color": cores.contorno, "line-width": 10 } });
    mapa.addLayer({ id: "rota-linha", type: "line", source: "rota", layout: tracoArredondado,
        paint: { "line-color": cores.linha, "line-width": 7 } });
    mapa.addLayer({ id: "rota-setas", type: "symbol", source: "rota",
        layout: { "symbol-placement": "line", "symbol-spacing": 56, "icon-image": "seta", "icon-size": 0.5, "icon-allow-overlap": true } });
}

function renderizarMapa() {
    if (!mapa) return;
    rotulosDosHubs.fatec.textContent = `FATEC · ${horarioDoContexto()}`;
    mapa.getSource("rota")?.setData(dadosDaRota());
}

function enquadrarHubs() {
    const pontos = [...HUBS, CASA];
    const limites = pontos.reduce(
        (caixa, ponto) => caixa.extend([ponto.lng, ponto.lat]),
        new maplibregl.LngLatBounds([CASA.lng, CASA.lat], [CASA.lng, CASA.lat]),
    );
    mapa.fitBounds(limites, { padding: { top: 36, bottom: 36, left: 48, right: 48 }, maxZoom: 15, animate: false });
}

function recolherAtribuicao() {
    const atribuicao = $(".maplibregl-ctrl-attrib");
    atribuicao.classList.remove("maplibregl-compact-show");
    atribuicao.removeAttribute("open");
}

function iniciarMapa() {
    if (mapa || typeof maplibregl === "undefined") return; // sem internet, o painel segue funcionando sem o mapa

    try {
        mapa = new maplibregl.Map({
            container: "mapa",
            style: ESTILO_MAPA[document.documentElement.dataset.tema],
            center: [hubAtivo().lng, hubAtivo().lat],
            zoom: 12,
            scrollZoom: false,
            dragRotate: false,
            dragPan: !matchMedia("(pointer: coarse)").matches,
            attributionControl: { compact: true },
        });
    } catch {
        return; // navegador sem WebGL: fica o fundo do cartão
    }

    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
    [...HUBS, CASA].forEach(adicionarMarcador);
    renderizarMapa();
    enquadrarHubs();
    mapa.on("style.load", desenharRota);
    mapa.once("load", recolherAtribuicao);
    carregarRota();
    new ResizeObserver(() => {
        mapa.resize();
        enquadrarHubs();
    }).observe($("#mapa"));
}

/* ---------- painel: ações ---------- */

let temporizadorDoAviso;

function avisar(texto) {
    const aviso = $("#aviso");
    aviso.textContent = texto;
    aviso.classList.add("aviso--visivel");
    clearTimeout(temporizadorDoAviso);
    temporizadorDoAviso = setTimeout(() => aviso.classList.remove("aviso--visivel"), DURACAO_AVISO_MS);
}

function irParaCartao(id, botao) {
    if (location.hash !== "#painel") {
        location.hash = "#painel";
        setTimeout(() => irParaCartao(id, botao), 60);
        return;
    }

    const cartao = document.getElementById(id);
    cartao.scrollIntoView({ behavior: reduzMovimento() ? "auto" : "smooth", block: "center" });
    cartao.classList.add("cartao--destaque");
    setTimeout(() => cartao.classList.remove("cartao--destaque"), DURACAO_DESTAQUE_MS);

    if (botao.classList.contains("lateral__botao")) {
        $$(".lateral__botao").forEach(item => item.classList.toggle("lateral__botao--ativo", item === botao));
    }
}

function confirmarMantendoFoco(id) {
    alternarConfirmacao(id);
    renderizarPainel();
    $(`[data-confirmar="${id}"]`)?.focus();
}

function selecionarMantendoFoco(id) {
    estado.selecionadoId = id;
    renderizarMatches();
    renderizarCarro();
    $(`[data-selecionar="${id}"]`)?.focus();
}

function pedirCarona(id) {
    estado.pedidos[id] = "pendente";
    avisar(`Pedido enviado para ${primeiroNome(colegaPorId(id).nome)}.`);
    clearTimeout(temporizadoresDosPedidos[id]);
    temporizadoresDosPedidos[id] = setTimeout(() => responderPedido(id), ATRASO_DA_RESPOSTA_MS);
}

function responderPedido(id) {
    if (!estado.usuario || estado.pedidos[id] !== "pendente") return;

    if (COLEGAS_QUE_RECUSAM.includes(id)) {
        estado.pedidos[id] = "recusado";
        avisar(`${primeiroNome(colegaPorId(id).nome)} não consegue te levar desta vez.`);
    } else {
        alternarConfirmacao(id);
    }
    renderizarPainel();
}

function cancelarPedido(id) {
    clearTimeout(temporizadoresDosPedidos[id]);
    if (estaAceito(colegaPorId(id))) alternarConfirmacao(id);
    else delete estado.pedidos[id];
}

function aceitarPedido(id) {
    if (!estaAceito(colegaPorId(id))) alternarConfirmacao(id);
}

function recusarPedido(id) {
    estado.pedidos[id] = "recusado";
}

function agirNoPedido(acao, id) {
    acao(id);
    renderizarPainel();
    $(`[data-pedido="${id}"] .botao`)?.focus();
}

function abrirPagina(nome) {
    location.hash = `#${nome}`;
}

function mudarContexto(mudancas) {
    Object.assign(estado, mudancas);
    renderizarPainel();
}

const acoesDoPainel = {
    turno: (valor) => mudarContexto({ turno: valor }),
    sentido: (valor) => mudarContexto({ sentido: valor }),
    filtro: (valor) => mudarContexto({ filtro: valor }),
    selecionar: selecionarMantendoFoco,
    confirmar: confirmarMantendoFoco,
    pedir: id => agirNoPedido(pedirCarona, id),
    cancelar: id => agirNoPedido(cancelarPedido, id),
    aceitar: id => agirNoPedido(aceitarPedido, id),
    recusar: id => agirNoPedido(recusarPedido, id),
    pagina: abrirPagina,
    whatsapp: abrirWhatsApp,
    metrica: trocarMetricaDoGrafico,
    semana: indice => destacarSemana(Number(indice)),
    copiar: copiarValor,
    alvo: irParaCartao,
};

function tratarCliqueNoPainel(evento) {
    const botao = evento.target.closest("button");
    if (!botao) return;
    const chave = Object.keys(botao.dataset).find(nome => nome in acoesDoPainel);
    if (chave) acoesDoPainel[chave](botao.dataset[chave], botao);
}

function ligarPainel() {
    $("#tela-app").addEventListener("click", tratarCliqueNoPainel);
    $("#botao-sair").addEventListener("click", sair);
    $("#imp-calculo-botao").addEventListener("click", alternarCalculo);

    ["mouseover", "focusin"].forEach(tipo => $("#imp-pontos").addEventListener(tipo, evento => {
        const ponto = evento.target.closest("[data-semana]");
        if (ponto) destacarSemana(Number(ponto.dataset.semana));
    }));

    $("#busca").addEventListener("input", evento => mudarContexto({ busca: evento.target.value }));

    $("#interruptor-motorista").addEventListener("change", evento => {
        estado.usuario.papel = evento.target.checked ? "motorista" : "passageiro";
        mudarContexto({ selecionadoId: null });
    });

    $("#carona-desfazer").addEventListener("click", () => {
        confirmadosDoContexto().clear();
        renderizarPainel();
    });

    $("#faixa-km").addEventListener("input", evento => {
        estado.km = Number(evento.target.value);
        renderizarRateios();
    });
    $("#faixa-pessoas").addEventListener("input", evento => {
        estado.pessoas = Number(evento.target.value);
        renderizarRateios();
    });
    CONTROLES_DA_CALCULADORA.forEach(chave => {
        $(`#rp-${chave}`).addEventListener("input", evento => {
            estado[chave] = Number(evento.target.value);
            renderizarRateios();
        });
    });
}

/* ---------- início ---------- */

function iniciar() {
    $$("[data-tema-botao]").forEach(botao => botao.addEventListener("click", () => aplicarTema(botao.dataset.temaBotao)));
    aplicarTema(temaSalvo());
    ligarAcesso();
    ligarPainel();
    window.addEventListener("hashchange", mostrarTela);
    if (!location.hash) location.hash = "#entrar";
    mostrarTela();
}

iniciar();

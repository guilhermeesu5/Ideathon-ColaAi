"use strict";

const CONSUMO_KM_POR_LITRO = 11;
const PRECO_LITRO = 6.3;
const PASSAGEIROS_NA_LISTA = 2;
const KG_CO2_POR_CARONA = 1.9;
const CARONAS_BASE_DO_MES = 12;
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

let mapa;
let caminhoDaRota;
const rotulosDosHubs = {};

const estado = {
    usuario: null,
    sentido: "ida",
    turno: "manha",
    filtro: "compativeis",
    busca: "",
    selecionadoId: null,
    km: 8,
    pessoas: 2,
    confirmacoes: {},
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
    return (km / CONSUMO_KM_POR_LITRO) * PRECO_LITRO;
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

function totalDeCaronas() {
    const confirmadas = Object.values(estado.confirmacoes).reduce((soma, ids) => soma + ids.size, 0);
    return CARONAS_BASE_DO_MES + confirmadas;
}

function alternarConfirmacao(id) {
    const confirmados = confirmadosDoContexto();

    if (confirmados.has(id)) {
        confirmados.delete(id);
        return;
    }

    if (estado.usuario.papel === "passageiro") {
        confirmados.clear();
    } else if (confirmados.size >= estado.usuario.vagas) {
        avisar("Seu carro já está lotado neste turno.");
        return;
    }

    confirmados.add(id);
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
    const noPainel = location.hash === "#painel" && Boolean(estado.usuario);

    if (location.hash === "#painel" && !estado.usuario) {
        location.hash = "#entrar";
        return;
    }

    $("#tela-acesso").hidden = noPainel;
    $("#tela-app").hidden = !noPainel;
    if (noPainel) {
        renderizarPainel();
        iniciarMapa();
    }
    window.scrollTo(0, 0);
}

function entrar(usuario) {
    estado.usuario = usuario;
    location.hash = "#painel";
}

function sair() {
    estado.usuario = null;
    estado.selecionadoId = null;
    reiniciarAcesso();
    location.hash = "#entrar";
}

/* ---------- acesso: formulários, validação e envio ---------- */

const regrasDeCampo = {
    email: campo => emailInstitucional(campo.value) ? "" : "Use seu e-mail @aluno.cps.sp.gov.br ou @fatec.sp.gov.br.",
    senha: campo => campo.value.length >= 6 ? "" : "A senha precisa ter pelo menos 6 caracteres.",
    confirmar: campo => campo.value === campo.form.elements.senha.value ? "" : "As senhas precisam ser iguais.",
    nome: campo => campo.value.trim().split(/\s+/).length >= 2 ? "" : "Informe nome e sobrenome.",
    carro: campo => campo.value.trim().length >= 2 ? "" : "Informe o modelo do seu carro.",
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
        carro: dados.get("carro") || "Seu carro",
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
    const rotuloAcao = confirmado ? "Combinado" : colega.compativel ? "Combinar" : "Outro turno";

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
            <button class="matches__acao" type="button" data-confirmar="${colega.id}" aria-pressed="${confirmado}" ${colega.compativel ? "" : "disabled"}>${rotuloAcao}</button>
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

function dadosDoCarro() {
    const { usuario } = estado;
    const confirmados = confirmadosDoContexto();

    if (usuario.papel === "motorista") {
        return {
            nome: usuario.carro,
            dono: "Seu carro · você dirige",
            vagasLivres: usuario.vagas - confirmados.size,
        };
    }

    const motorista = colegaPorId(estado.selecionadoId);
    if (!motorista) return { nome: "Sem motorista", dono: "Nenhum motorista nesta busca", vagasLivres: 0 };

    return {
        nome: motorista.carro,
        dono: `${motorista.cor} · de ${motorista.nome}`,
        vagasLivres: motorista.vagas - (confirmados.has(motorista.id) ? 1 : 0),
    };
}

function renderizarCarro() {
    const carro = dadosDoCarro();
    $("#carro-nome").textContent = carro.nome;
    $("#carro-dono").textContent = carro.dono;

    const vagas = [1, 2, 3, 4].map(numero => {
        const livre = numero <= carro.vagasLivres ? " carro__vaga--livre" : "";
        return `<span class="carro__vaga${livre}">${numero}</span>`;
    });
    const rotulo = `<span class="carro__rotulo-vagas">Vagas</span>`;
    const vagasDoCarro = $("#carro-vagas");
    vagasDoCarro.innerHTML = rotulo + vagas.join("");
    vagasDoCarro.setAttribute("aria-label", `${carro.vagasLivres} vagas livres de 4`);
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

    ["#faixa-km", "#faixa-pessoas"].forEach(seletor => {
        const faixa = $(seletor);
        const progresso = ((faixa.value - faixa.min) / (faixa.max - faixa.min)) * 100;
        faixa.style.setProperty("--progresso", `${progresso}%`);
    });
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
        renderizarRateio();
    });
    $("#faixa-pessoas").addEventListener("input", evento => {
        estado.pessoas = Number(evento.target.value);
        renderizarRateio();
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

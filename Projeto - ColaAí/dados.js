"use strict";

/* Dados simulados do protótipo. No produto real, vêm da API Node.js + MySQL. */

const DOMINIOS_INSTITUCIONAIS = ["aluno.cps.sp.gov.br", "fatec.sp.gov.br"];

const TURNOS = {
    manha: { rotulo: "Manhã", horarios: { ida: "07:30", volta: "12:00" } },
    tarde: { rotulo: "Tarde", horarios: { ida: "13:00", volta: "17:30" } },
    noite: { rotulo: "Noite", horarios: { ida: "18:50", volta: "22:30" } },
};

const COLEGAS = [
   { id: "lucas",    nome: "Lucas Moreira",   curso: "ADS · 3º sem",            papel: "motorista",  turno: "manha", sentido: "ida",   carro: "Fiat Argo",       cor: "Prata",    vagas: 3, km: 7, whatsapp: "5518996028780" },
    { id: "marina",   nome: "Marina Duarte",   curso: "Gestão Empresarial · 5º", papel: "motorista",  turno: "manha", sentido: "ida",   carro: "Hyundai HB20",    cor: "Branco",   vagas: 2, km: 5, whatsapp: "5518996028780" },
    { id: "rafael",   nome: "Rafael Nogueira", curso: "ADS · 6º sem",            papel: "motorista",  turno: "tarde", sentido: "ida",   carro: "VW Gol",          cor: "Preto",    vagas: 3, km: 9, whatsapp: "5518996028780" },
    { id: "beatriz",  nome: "Beatriz Salles",  curso: "Big Data no Agro · 2º",   papel: "motorista",  turno: "noite", sentido: "ida",   carro: "Chevrolet Onix",  cor: "Cinza",    vagas: 2, km: 6, whatsapp: "5518996028780" },
    { id: "pedro",    nome: "Pedro Valença",   curso: "ADS · 4º sem",            papel: "motorista",  turno: "noite", sentido: "ida",   carro: "Renault Kwid",    cor: "Laranja",  vagas: 1, km: 11, whatsapp: "5518996028780" },
    { id: "camila",   nome: "Camila Rocha",    curso: "Gestão Empresarial · 3º", papel: "motorista",  turno: "noite", sentido: "volta", carro: "Toyota Etios",    cor: "Prata",    vagas: 3, km: 8, whatsapp: "5518996028780" },
    { id: "diego",    nome: "Diego Fontes",    curso: "ADS · 5º sem",            papel: "motorista",  turno: "manha", sentido: "volta", carro: "Honda Fit",       cor: "Azul",     vagas: 3, km: 10, whatsapp: "5518996028780" },

    { id: "ana",      nome: "Ana Clara Lima",  curso: "ADS · 1º sem",            papel: "passageiro", turno: "manha", sentido: "ida",   km: 6, whatsapp: "5518996028780" },
    { id: "joao",     nome: "João Vitor Prado", curso: "Gestão Empresarial · 2º", papel: "passageiro", turno: "manha", sentido: "ida",   km: 9, whatsapp: "5518996028780" },
    { id: "larissa",  nome: "Larissa Mendes",  curso: "Big Data no Agro · 4º",   papel: "passageiro", turno: "tarde", sentido: "ida",   km: 4, whatsapp: "5518996028780" },
    { id: "mateus",   nome: "Mateus Aguiar",   curso: "ADS · 6º sem",            papel: "passageiro", turno: "noite", sentido: "ida",   km: 8, whatsapp: "5518996028780" },
    { id: "sofia",    nome: "Sofia Brandão",   curso: "Gestão Empresarial · 1º", papel: "passageiro", turno: "noite", sentido: "ida",   km: 5, whatsapp: "5518996028780" },
    { id: "gabriel",  nome: "Gabriel Tanaka",  curso: "ADS · 2º sem",            papel: "passageiro", turno: "noite", sentido: "volta", km: 7, whatsapp: "5518996028780" },
    { id: "helena",   nome: "Helena Queiroz",  curso: "Big Data no Agro · 3º",   papel: "passageiro", turno: "manha", sentido: "volta", km: 6, whatsapp: "5518996028780" },
];

/* Coordenadas reais de Araçatuba (OpenStreetMap). */
const HUBS = [
    { id: "shopping", nome: "Shopping", ativo: false, lat: -21.22229, lng: -50.43551 },
    { id: "centro",   nome: "Centro",   ativo: false, lat: -21.20623, lng: -50.43888 },
    { id: "fatec",    nome: "FATEC",    ativo: true,  lat: -21.18163, lng: -50.44969 },
];

/* Ponto de partida da demonstração: Rua João Arruda Brasil, 100 (Condomínio Belo Horizonte).
   No produto, viria do perfil de cada usuário. */
const CASA = { id: "casa", nome: "Minha casa", ativo: false, casa: true, lat: -21.20653, lng: -50.45017 };

/* Histórico simulado do mês: caronas por semana e por turno (os dois somam o mesmo total). */
const HISTORICO_SIMULADO = {
    semanas: [2, 3, 3, 4],
    turnos: { manha: 6, tarde: 2, noite: 4 },
};

/* Fotos dos carros em assets/carros. O modelo é procurado dentro do nome do carro, sem diferenciar maiúsculas. */
const FOTOS_DOS_CARROS = [
    { modelo: "civic", arquivo: "honda-civic.webp" },
    { modelo: "onix", arquivo: "chevrolet-onix.webp" },
    { modelo: "polo", arquivo: "volkswagen-polo.webp" },
    { modelo: "argo", arquivo: "fiat-argo.webp" },
];

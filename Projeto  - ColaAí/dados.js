"use strict";

/* Dados simulados do protótipo. No produto real, vêm da API Node.js + MySQL. */

const DOMINIOS_INSTITUCIONAIS = ["aluno.cps.sp.gov.br", "fatec.sp.gov.br"];

const TURNOS = {
    manha: { rotulo: "Manhã", horarios: { ida: "07:30", volta: "12:00" } },
    tarde: { rotulo: "Tarde", horarios: { ida: "13:00", volta: "17:30" } },
    noite: { rotulo: "Noite", horarios: { ida: "18:50", volta: "22:30" } },
};

const COLEGAS = [
    { id: "lucas",    nome: "Lucas Moreira",   curso: "ADS · 3º sem",            papel: "motorista",  turno: "manha", sentido: "ida",   carro: "Fiat Argo",       cor: "Branco", placa: "FTC1A23",    vagas: 3, km: 7, whatsapp: "" },
    { id: "marina",   nome: "Marina Duarte",   curso: "Gestão Empresarial · 5º", papel: "motorista",  turno: "manha", sentido: "ida",   carro: "Volkswagen Polo", cor: "Prata", placa: "FTC2B34",   vagas: 2, km: 5, whatsapp: "" },
    { id: "rafael",   nome: "Rafael Nogueira", curso: "ADS · 6º sem",            papel: "motorista",  turno: "tarde", sentido: "ida",   carro: "Chevrolet Onix",  cor: "Prata", placa: "FTC3C45",    vagas: 3, km: 9, whatsapp: "" },
    { id: "beatriz",  nome: "Guilherme Almeida", curso: "Big Data no Agro · 2º",   papel: "motorista",  turno: "noite", sentido: "ida",   carro: "Chevrolet Onix",  cor: "Prata", placa: "FTC4D56",    vagas: 2, km: 6, whatsapp: "" },
    { id: "pedro",    nome: "Pedro Valença",   curso: "ADS · 4º sem",            papel: "motorista",  turno: "noite", sentido: "ida",   carro: "Fiat Argo",       cor: "Branco", placa: "FTC5E67",  vagas: 1, km: 11, whatsapp: "" },
    { id: "camila",   nome: "Camila Rocha",    curso: "Gestão Empresarial · 3º", papel: "motorista",  turno: "noite", sentido: "volta", carro: "Volkswagen Polo", cor: "Prata", placa: "FTC6F78",    vagas: 3, km: 8, whatsapp: "" },
    { id: "diego",    nome: "Diego Fontes",    curso: "ADS · 5º sem",            papel: "motorista",  turno: "manha", sentido: "volta", carro: "Chevrolet Onix",  cor: "Prata", placa: "FTC7G89",     vagas: 3, km: 10, whatsapp: "" },

    { id: "ana",      nome: "Ana Clara Lima",  curso: "ADS · 1º sem",            papel: "passageiro", turno: "manha", sentido: "ida",   km: 6, whatsapp: "" },
    { id: "joao",     nome: "João Vitor Prado", curso: "Gestão Empresarial · 2º", papel: "passageiro", turno: "manha", sentido: "ida",   km: 9, whatsapp: "" },
    { id: "larissa",  nome: "Larissa Mendes",  curso: "Big Data no Agro · 4º",   papel: "passageiro", turno: "tarde", sentido: "ida",   km: 4, whatsapp: "" },
    { id: "mateus",   nome: "Mateus Aguiar",   curso: "ADS · 6º sem",            papel: "passageiro", turno: "noite", sentido: "ida",   km: 8, whatsapp: "" },
    { id: "sofia",    nome: "Sofia Brandão",   curso: "Gestão Empresarial · 1º", papel: "passageiro", turno: "noite", sentido: "ida",   km: 5, whatsapp: "" },
    { id: "gabriel",  nome: "Gabriel Tanaka",  curso: "ADS · 2º sem",            papel: "passageiro", turno: "noite", sentido: "volta", km: 7, whatsapp: "" },
    { id: "helena",   nome: "Helena Queiroz",  curso: "Big Data no Agro · 3º",   papel: "passageiro", turno: "manha", sentido: "volta", km: 6, whatsapp: "" },
];

/* Coordenadas reais de Araçatuba (OpenStreetMap). */
const HUBS = [
    { id: "shopping", nome: "Shopping", ativo: false, lat: -21.22229, lng: -50.43551 },
    { id: "centro",   nome: "Centro",   ativo: false, lat: -21.20623, lng: -50.43888 },
    { id: "fatec",    nome: "FATEC",    ativo: true,  lat: -21.18163, lng: -50.44969 },
];

/* Ponto de partida da demonstração: um ponto de exemplo na região central de Araçatuba, não é endereço de ninguém.
   No produto, viria do perfil de cada usuário. */
const CASA = { id: "casa", nome: "Minha casa", ativo: false, casa: true, lat: -21.2015, lng: -50.4435 };

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
